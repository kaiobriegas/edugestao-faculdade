import "dotenv/config";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { createDatabaseClient } from "../src/lib/database-client";
import {
  createAuthService,
  actorForUser,
} from "../src/modules/core/services/auth";
import { hashPassword } from "../src/modules/core/services/security";
import {
  assertManager,
  canManageUser,
} from "../src/modules/core/contracts/access";

const marker = "DEMO_CONTAS_V1";
async function main() {
  if (!process.argv.includes("--apply")) throw new Error("Use --apply.");
  const connection = process.env.DATABASE_URL;
  if (!connection || !process.env.AUTH_SECRET)
    throw new Error("Configure o ambiente.");
  if (
    !["localhost", "127.0.0.1", "[::1]"].includes(new URL(connection).hostname)
  )
    throw new Error("Preparo exclusivo do banco local.");
  const db = createDatabaseClient(connection);
  try {
    const result = await db.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT true AS locked FROM pg_advisory_xact_lock(37103)`;
        const previous = await tx.eventoAdministrativo.findFirst({
          where: { acao: marker, entidade: "Demonstracao" },
        });
        if (previous) return null;
        const root = await tx.usuario.findFirst({
          where: {
            ativo: true,
            grupo: { ativo: true },
            papel: { nome: "root" },
          },
        });
        if (!root) throw new Error("Conta root necessária.");
        const aluno = await tx.aluno.findUniqueOrThrow({
          where: { matricula: "DEMO-2026-001" },
        });
        if (aluno.usuarioId !== null)
          throw new Error("O aluno já possui conta. Vínculo preservado.");
        const definitions = [
          {
            nome: "DEMO — Administrador",
            email: "admin.demo@example.com",
            papel: "Administrador",
          },
          {
            nome: "DEMO — Ana Silva",
            email: "aluno.demo@example.com",
            papel: "Usuário",
          },
        ];
        if (
          await tx.usuario.count({
            where: { email: { in: definitions.map((d) => d.email) } },
          })
        )
          throw new Error(
            "E-mail de demonstração já utilizado. Contas preservadas.",
          );
        const codes = [
          "alunos",
          "cursos",
          "avaliacoes",
          "biblioteca",
          "financeiro",
        ];
        const modules = await tx.modulo.findMany({
          where: { codigo: { in: codes }, ativo: true },
        });
        assert.equal(modules.length, 5, "Os cinco módulos devem estar ativos.");
        const group = await tx.grupo.create({
          data: {
            nome: "DEMO — Apresentação",
            descricao: "Grupo fictício das contas de apresentação.",
            grupoModuloRegistros: {
              create: modules.map((m) => ({
                moduloId: m.idModulo,
                habilitado: true,
              })),
            },
          },
        });
        const accounts = [];
        for (const definition of definitions) {
          const role = await tx.papel.findUniqueOrThrow({
            where: { nome: definition.papel },
          });
          const password = `Demo@${randomBytes(9).toString("hex")}`;
          const user = await tx.usuario.create({
            data: {
              nome: definition.nome,
              email: definition.email,
              senhaHash: await hashPassword(password),
              grupoId: group.idGrupo,
              papelId: role.idPapel,
            },
          });
          if (definition.papel === "Usuário") {
            await tx.aluno.update({
              where: { idAluno: aluno.idAluno },
              data: { usuarioId: user.idUsuario },
            });
          }
          await tx.eventoAdministrativo.create({
            data: {
              acao: "DEMO_CONTA_CRIADA",
              entidade: "Usuario",
              registroId: String(user.idUsuario),
              metadados: {
                grupoId: group.idGrupo,
                papel: role.nome,
                carga: marker,
              },
            },
          });
          accounts.push({
            id: user.idUsuario,
            papel: role.nome,
            email: user.email,
            senha: password,
          });
        }
        await tx.eventoAdministrativo.create({
          data: {
            acao: marker,
            entidade: "Demonstracao",
            registroId: String(aluno.idAluno),
            metadados: {
              grupoId: group.idGrupo,
              alunoId: aluno.idAluno,
              administradorId: accounts[0].id,
              usuarioId: accounts[1].id,
            },
          },
        });
        return { accounts, alunoId: aluno.idAluno, grupoId: group.idGrupo };
      },
      { timeout: 30000 },
    );
    if (!result) {
      console.log(
        "Contas de demonstração já preparadas. Nenhuma senha ou vínculo alterado.",
      );
      return;
    }
    const auth = createAuthService(db, process.env.AUTH_SECRET);
    for (const account of result.accounts) {
      const login = await auth.login({
        email: account.email,
        senha: account.senha,
      });
      try {
        const actor = await auth.session(login.token);
        assert.equal(actor.papel, account.papel);
        assert.equal(actor.modulos.length, 5);
        assert.equal(
          canManageUser(actor, { grupoId: actor.grupoId, papel: "root" }),
          false,
        );
        if (account.papel === "Usuário") {
          assert.throws(() => assertManager(actor));
          const aluno = await db.aluno.findUniqueOrThrow({
            where: { usuarioId: actor.id },
          });
          assert.equal(aluno.idAluno, result.alunoId);
          assert.equal(aluno.matricula, "DEMO-2026-001");
        } else assertManager(actor);
      } finally {
        await auth.logout(login.token);
      }
    }
    const root = await db.usuario.findFirstOrThrow({
      where: { ativo: true, papel: { nome: "root" } },
    });
    assert.equal((await actorForUser(db, root.idUsuario)).papel, "root");
    // Credenciais geradas são exibidas uma única vez; nunca gravadas em fontes/documentação.
    console.log(
      JSON.stringify(
        {
          criado: true,
          loginVerificado: true,
          sessoesDeVerificacaoEncerradas: true,
          contas: result.accounts.map(({ papel, email, senha }) => ({
            papel,
            email,
            senha,
          })),
          aluno: "DEMO — Ana Silva",
          grupo: "DEMO — Apresentação",
        },
        null,
        2,
      ),
    );
  } finally {
    await db.$disconnect();
  }
}
main().catch((error: unknown) => {
  console.error(
    "Preparo não concluído. Confira banco local, módulos ativos e possíveis conflitos de contas/vínculo.",
  );
  if (error instanceof Error) console.error("Diagnóstico:", error.name);
  process.exitCode = 1;
});
