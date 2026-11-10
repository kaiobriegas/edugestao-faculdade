import "dotenv/config";
import { emitKeypressEvents } from "node:readline";
import { createInterface as createPromisesInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { ZodError } from "zod";
import { createDatabaseClient } from "../src/lib/database-client";
import { bootstrapRoot } from "../src/modules/core/services/auth";
import { AppError } from "../src/modules/core/contracts/access";
async function secret(question: string): Promise<string> {
  stdout.write(question);
  const previous = stdin.isRaw;
  emitKeypressEvents(stdin);
  stdin.setRawMode(true);
  stdin.resume();
  return new Promise((resolve, reject) => {
    let result = "";
    function done(error?: Error) {
      stdin.off("keypress", pressed);
      stdin.setRawMode(previous);
      stdin.pause();
      stdout.write("\n");
      if (error) reject(error);
      else resolve(result);
    }
    function pressed(
      text: string,
      key: { name?: string; ctrl?: boolean; meta?: boolean },
    ) {
      if (key.ctrl && key.name === "c")
        return done(new Error("Operação cancelada."));
      if (key.name === "return") return done();
      if (key.name === "backspace") {
        result = result.slice(0, -1);
        return;
      }
      if (!key.ctrl && !key.meta && text && !text.startsWith("\u001b"))
        result += text;
    }
    stdin.on("keypress", pressed);
  });
}
async function main() {
  if (!stdin.isTTY || !stdout.isTTY)
    throw new AppError(
      "Execute o bootstrap em um terminal interativo; a senha não será exibida.",
    );
  if (!process.env.DATABASE_URL)
    throw new AppError("Configure DATABASE_URL primeiro.");
  const db = createDatabaseClient(process.env.DATABASE_URL);
  try {
    if (await db.usuario.count({ where: { papel: { nome: "root" } } }))
      throw new AppError(
        "O root inicial já existe. Entre no sistema para gerenciar usuários.",
      );
    const prompt = createPromisesInterface({ input: stdin, output: stdout });
    let nome: string, email: string, grupo: string;
    try {
      nome = await prompt.question("Nome: ");
      email = await prompt.question("E-mail: ");
      grupo =
        (await prompt.question("Nome do grupo [Administração]: ")) ||
        "Administração";
    } finally {
      prompt.close();
    }
    const senha = await secret("Senha (mínimo 10 caracteres; oculta): ");
    if (senha !== (await secret("Repita a senha (oculta): ")))
      throw new AppError("As senhas não conferem.");
    await bootstrapRoot(db, { nome, email, grupo, senha });
    console.log(
      "Primeiro root criado. Inicie a aplicação e entre com os dados informados.",
    );
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(
    error instanceof AppError
      ? error.message
      : error instanceof ZodError
        ? "Verifique nome, e-mail e senha (mínimo 10 caracteres)."
        : "Não foi possível criar o root. Verifique banco e migrações.",
  );
  process.exitCode = 1;
});
