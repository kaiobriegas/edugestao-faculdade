import "dotenv/config";
import { spawnSync } from "node:child_process";
import { resolve, join } from "node:path";
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import { createHash } from "node:crypto";
import pg from "pg";

// Transferência local: backup fora do Git; restauração permitida apenas em banco vazio.
const [action, file] = process.argv.slice(2);
async function main() {
  if (!["backup", "restore"].includes(action))
    throw new Error("Use backup ou restore <arquivo.dump> --apply.");
  if (!process.env.DATABASE_URL) throw new Error("Configure .env primeiro.");
  const url = new URL(process.env.DATABASE_URL);
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
    throw new Error("Este utilitário é exclusivo de PostgreSQL local.");
  const binaryDir = resolve(
    process.env.POSTGRES_TOOLS_BIN || ".local/pg-tools",
  );
  const executable = (name) =>
    join(binaryDir, name + (process.platform === "win32" ? ".exe" : ""));
  const env = {
    ...process.env,
    PGHOST: url.hostname.replace(/^\[|\]$/g, ""),
    PGPORT: url.port || "5432",
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
  };
  function run(name, args) {
    const result = spawnSync(executable(name), args, {
      env,
      windowsHide: true,
      encoding: "utf8",
    });
    if (result.error || result.status !== 0)
      throw new Error(
        `Falha em ${name}. Confira binários, conexão e compatibilidade do PostgreSQL.`,
      );
    return result.stdout;
  }
  if (action === "backup") {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const directory = resolve("backups", `notebook-${stamp}`);
    await mkdir(directory, { recursive: true });
    const output = join(directory, "educacional.dump");
    run("pg_dump", [
      "--format=custom",
      "--no-owner",
      "--no-privileges",
      "--file",
      output,
    ]);
    const listing = run("pg_restore", ["--list", output]);
    if (!listing.includes("TABLE DATA"))
      throw new Error("Backup sem dados reconhecíveis.");
    const hash = createHash("sha256")
      .update(await readFile(output))
      .digest("hex");
    await writeFile(
      join(directory, "educacional.dump.sha256"),
      `${hash}  educacional.dump\n`,
      { flag: "wx" },
    );
    await writeFile(
      join(directory, "LEIA-ME.txt"),
      "Backup privado do PostgreSQL. Contém contas (hashes de senha) e dados da aplicação.\n" +
        "Copie esta pasta diretamente para seu notebook; não envie ao GitHub.\n" +
        "A configuração .env deve ser criada novamente no destino. Não está neste backup.\n" +
        "Documentos enviados são separados: copie storage/private pelo mesmo meio privado.\n" +
        "Restaure em banco vazio seguindo docs/TRANSFERIR_NOTEBOOK.md.\n",
      { flag: "wx" },
    );
    console.log(`Backup criado e estrutura conferida: ${output}`);
    return;
  }
  if (!file || !process.argv.includes("--apply"))
    throw new Error(
      "Informe o arquivo .dump e --apply para restaurar no banco vazio.",
    );
  const input = resolve(file);
  await access(input);
  const expected = (await readFile(`${input}.sha256`, "utf8"))
    .trim()
    .split(/\s+/)[0];
  const actual = createHash("sha256")
    .update(await readFile(input))
    .digest("hex");
  if (actual !== expected)
    throw new Error("Checksum do backup divergente. Restauração recusada.");
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    const result = await client.query(
      "SELECT count(*)::int AS total FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%' AND c.relkind IN ('r','p','v','m','S','f')",
    );
    if (result.rows[0].total !== 0)
      throw new Error(
        "Banco de destino não está vazio. Nenhum dado foi substituído.",
      );
    run("pg_restore", [
      "--no-owner",
      "--no-privileges",
      "--single-transaction",
      "--exit-on-error",
      "--dbname",
      env.PGDATABASE,
      input,
    ]);
    console.log(
      "Backup restaurado em banco vazio. Confira npm.cmd run db:status e o login.",
    );
  } finally {
    await client.end();
  }
}
main().catch((error) => {
  // Mensagens próprias, sem URLs, senhas ou stderr do PostgreSQL.
  const allowed = [
    "Use ",
    "Configure ",
    "Este utilitário",
    "Falha em ",
    "Backup sem",
    "Informe ",
    "Checksum ",
    "Banco de destino",
  ];
  console.error(
    allowed.some((prefix) => error.message?.startsWith(prefix))
      ? error.message
      : "Falha na transferência. Confira conexão local, binários e caminho do backup.",
  );
  process.exitCode = 1;
});
