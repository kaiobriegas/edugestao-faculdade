import "dotenv/config";
import { spawnSync } from "node:child_process";
import { resolve, join } from "node:path";
import { existsSync } from "node:fs";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import pg from "pg";
const action = process.argv[2];
if (!["init", "start", "stop", "status"].includes(action))
  throw new Error("Use init, start, stop ou status.");
const binaryDir = resolve(
  process.env.POSTGRES_BIN ||
    ".local/pg-runtime/node_modules/@embedded-postgres/windows-x64/native/bin",
);
const local = resolve(".local");
const data = join(local, "postgres-data");
const suffix = process.platform === "win32" ? ".exe" : "";
if (!existsSync(join(binaryDir, "pg_ctl" + suffix)))
  throw new Error(
    "PostgreSQL nativo não encontrado. Defina POSTGRES_BIN ou use Docker Compose. Consulte README.",
  );
function run(exe, args, allowed = [0]) {
  const result = spawnSync(join(binaryDir, exe + suffix), args, {
    encoding: "utf8",
    windowsHide: true,
    stdio: "ignore",
  });
  if (!allowed.includes(result.status)) {
    console.error(result.stderr || result.stdout);
    throw new Error(`Falha no comando ${exe}.`);
  }
  return result;
}
await mkdir(local, { recursive: true });
if (action === "init") {
  if (existsSync(join(data, "PG_VERSION"))) {
    console.log("Cluster já existe e foi preservado.");
    process.exit(0);
  }
  if (!process.env.POSTGRES_USER || !process.env.POSTGRES_PASSWORD)
    throw new Error("Execute npm run env:init.");
  const passwordFile = join(local, "init-password.tmp");
  try {
    await writeFile(passwordFile, process.env.POSTGRES_PASSWORD + "\n", {
      flag: "wx",
      mode: 0o600,
    });
    run("initdb", [
      "-D",
      data,
      "-U",
      process.env.POSTGRES_USER,
      "--pwfile",
      passwordFile,
      "-A",
      "scram-sha-256",
      "--encoding",
      "UTF8",
      "--locale",
      "C",
    ]);
  } finally {
    await unlink(passwordFile).catch(() => {});
  }
  console.log(
    "Cluster local inicializado com autenticação SCRAM. Dados existentes não foram removidos.",
  );
} else if (action === "start") {
  if (!existsSync(join(data, "PG_VERSION")))
    throw new Error("Execute npm run db:local:init antes de iniciar.");
  const status = run("pg_ctl", ["status", "-D", data], [0, 3]);
  if (status.status !== 0) {
    const port = process.env.POSTGRES_PORT || "54329";
    if (!/^\d{4,5}$/.test(port)) throw new Error("POSTGRES_PORT inválida.");
    run("pg_ctl", [
      "start",
      "-D",
      data,
      "-l",
      join(local, "postgres.log"),
      "-o",
      `-h 127.0.0.1 -p ${port}`,
      "-w",
    ]);
  }
  if (!process.env.DATABASE_URL) throw new Error("Configure DATABASE_URL.");
  const target = new URL(process.env.DATABASE_URL);
  if (!["localhost", "127.0.0.1"].includes(target.hostname))
    throw new Error("Este script só administra o cluster local.");
  const dbname = decodeURIComponent(target.pathname.slice(1));
  if (!/^[a-z][a-z0-9_]*$/.test(dbname))
    throw new Error("Nome de banco inválido.");
  target.pathname = "/postgres";
  const client = new pg.Client({ connectionString: target.toString() });
  try {
    await client.connect();
    const existing = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [dbname],
    );
    if (!existing.rowCount) await client.query(`CREATE DATABASE "${dbname}"`);
  } finally {
    await client.end();
  }
  console.log("PostgreSQL local disponível; banco da aplicação preparado.");
} else if (action === "stop") {
  if (run("pg_ctl", ["status", "-D", data], [0, 3]).status === 0)
    run("pg_ctl", ["stop", "-D", data, "-m", "fast", "-w"]);
  console.log("PostgreSQL local parado; dados preservados.");
} else
  console.log(
    run("pg_ctl", ["status", "-D", data], [0, 3]).status === 0
      ? "Cluster em execução."
      : "Cluster parado.",
  );
