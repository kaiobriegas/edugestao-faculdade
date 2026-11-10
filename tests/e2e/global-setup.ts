import { testDatabaseUrl } from "../../src/lib/test-database";
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { documentStorage } from "../../src/modules/alunos/services/files";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { createDatabaseClient } from "../../src/lib/database-client";
import { bootstrapRoot } from "../../src/modules/core/services/auth";
import {
  hashPassword,
  rateKey,
} from "../../src/modules/core/services/security";
import { seedCatalog } from "../../prisma/seed-catalog";
export default async function setup() {
  const url = testDatabaseUrl();
  const db = createDatabaseClient(url);
  const prefix = "e2e-" + randomUUID();
  const senha = randomUUID() + "!";
  const rootEmail = prefix + "-root@example.test",
    userEmail = prefix + "-user@example.test";
  const root = await bootstrapRoot(db, {
    nome: "Root da Interface",
    email: rootEmail,
    senha,
    grupo: prefix + "-root",
  });
  const userRole = await db.papel.findUniqueOrThrow({
    where: { nome: "Usuário" },
  });
  const rootGroup = (
    await db.usuario.findUniqueOrThrow({ where: { idUsuario: root.id } })
  ).grupoId;
  const group = await db.grupo.create({ data: { nome: prefix + "-user" } });
  const user = await db.usuario.create({
    data: {
      nome: "Usuário da Interface",
      email: userEmail,
      senhaHash: await hashPassword(senha),
      grupoId: group.idGrupo,
      papelId: userRole.idPapel,
    },
  });
  await seedCatalog(db);
  const catalog = await db.modulo.findUniqueOrThrow({
    where: { codigo: "biblioteca" },
  });
  await db.grupoModulo.create({
    data: {
      grupoId: group.idGrupo,
      moduloId: catalog.idModulo,
      habilitado: true,
    },
  });
  const studentModule = await db.modulo.findUniqueOrThrow({
    where: { codigo: "alunos" },
  });
  await db.grupoModulo.create({
    data: {
      grupoId: group.idGrupo,
      moduloId: studentModule.idModulo,
      habilitado: true,
    },
  });
  const courseModule = await db.modulo.findUniqueOrThrow({
    where: { codigo: "cursos" },
  });
  await db.grupoModulo.create({
    data: {
      grupoId: group.idGrupo,
      moduloId: courseModule.idModulo,
      habilitado: true,
    },
  });
  const assessmentModule = await db.modulo.findUniqueOrThrow({
    where: { codigo: "avaliacoes" },
  });
  await db.grupoModulo.create({
    data: { grupoId: group.idGrupo, moduloId: assessmentModule.idModulo },
  });
  const financeModule = await db.modulo.findUniqueOrThrow({
    where: { codigo: "financeiro" },
  });
  await db.grupoModulo.create({
    data: { grupoId: group.idGrupo, moduloId: financeModule.idModulo },
  });
  await mkdir(".local", { recursive: true });
  await writeFile(
    ".local/e2e-credentials.json",
    JSON.stringify({
      prefix,
      senha,
      rootEmail,
      userEmail,
      rootId: root.id,
      userId: user.idUsuario,
      rootGroup,
      groupId: group.idGrupo,
      moduleId: catalog.idModulo,
    }),
    { mode: 0o600 },
  );
  await db.$disconnect();
  return async () => {
    const cleanup = createDatabaseClient(url);
    try {
      const groups = await cleanup.grupo.findMany({
        where: { nome: { startsWith: prefix } },
        select: { idGrupo: true },
      });
      const ids = groups.map((g) => g.idGrupo);
      const users = await cleanup.usuario.findMany({
        where: { grupoId: { in: ids } },
        select: { idUsuario: true, email: true },
      });
      const uids = users.map((u) => u.idUsuario);
      const classes = await cleanup.turma.findMany({
        where: { nome: { startsWith: prefix } },
        select: { idTurma: true },
      });
      const classIds = classes.map((t) => t.idTurma);
      const students = await cleanup.aluno.findMany({
        where: { turmaId: { in: classIds } },
        select: { idAluno: true },
      });
      const studentIds = students.map((a) => a.idAluno);
      const docs = await cleanup.documento.findMany({
        where: { alunoId: { in: studentIds } },
        select: { chaveArmazenamento: true },
      });
      const storage = documentStorage(".local/e2e-storage");
      for (const doc of docs) await storage.remove(doc.chaveArmazenamento);
      await cleanup.documento.deleteMany({
        where: { alunoId: { in: studentIds } },
      });
      await cleanup.ocorrencia.deleteMany({
        where: { alunoId: { in: studentIds } },
      });
      await cleanup.alunoResponsavel.deleteMany({
        where: { alunoId: { in: studentIds } },
      });
      const courses = await cleanup.curso.findMany({
        where: { nome: { startsWith: prefix } },
        select: { idCurso: true },
      });
      const courseIds = courses.map((c) => c.idCurso);
      await cleanup.matricula.deleteMany({
        where: {
          OR: [{ cursoId: { in: courseIds } }, { alunoId: { in: studentIds } }],
        },
      });
      await cleanup.aula.deleteMany({ where: { cursoId: { in: courseIds } } });
      await cleanup.curso.deleteMany({ where: { idCurso: { in: courseIds } } });
      await cleanup.professor.deleteMany({
        where: { nome: { startsWith: prefix } },
      });
      const exams = await cleanup.avaliacao.findMany({
        where: { titulo: { startsWith: prefix } },
        select: { idAvaliacao: true },
      });
      const examIds = exams.map((e) => e.idAvaliacao);
      await cleanup.nota.deleteMany({
        where: {
          OR: [
            { avaliacaoId: { in: examIds } },
            { alunoId: { in: studentIds } },
          ],
        },
      });
      await cleanup.resposta.deleteMany({
        where: {
          OR: [
            { avaliacaoId: { in: examIds } },
            { alunoId: { in: studentIds } },
          ],
        },
      });
      await cleanup.tentativaAvaliacao.deleteMany({
        where: {
          OR: [
            { avaliacaoId: { in: examIds } },
            { alunoId: { in: studentIds } },
          ],
        },
      });
      await cleanup.questao.deleteMany({
        where: { avaliacaoId: { in: examIds } },
      });
      await cleanup.avaliacao.deleteMany({
        where: { idAvaliacao: { in: examIds } },
      });
      const books = await cleanup.livro.findMany({
        where: { titulo: { startsWith: prefix } },
        select: { idLivro: true },
      });
      const bookIds = books.map((b) => b.idLivro);
      await cleanup.emprestimo.deleteMany({
        where: {
          OR: [
            { exemplar: { livroId: { in: bookIds } } },
            { alunoId: { in: studentIds } },
          ],
        },
      });
      await cleanup.reserva.deleteMany({
        where: {
          OR: [{ livroId: { in: bookIds } }, { alunoId: { in: studentIds } }],
        },
      });
      await cleanup.exemplar.deleteMany({
        where: { livroId: { in: bookIds } },
      });
      await cleanup.livro.deleteMany({ where: { idLivro: { in: bookIds } } });
      await cleanup.categoria.deleteMany({
        where: { nome: { startsWith: prefix } },
      });
      const financialPlans = await cleanup.planoFinanceiro.findMany({
        where: { nome: { startsWith: prefix } },
        select: { idPlano: true },
      });
      const planIds = financialPlans.map((p) => p.idPlano);
      await cleanup.pagamento.deleteMany({
        where: {
          cobranca: {
            OR: [{ planoId: { in: planIds } }, { alunoId: { in: studentIds } }],
          },
        },
      });
      await cleanup.cobranca.deleteMany({
        where: {
          OR: [{ planoId: { in: planIds } }, { alunoId: { in: studentIds } }],
        },
      });
      await cleanup.desconto.deleteMany({
        where: { alunoId: { in: studentIds } },
      });
      await cleanup.planoFinanceiro.deleteMany({
        where: { idPlano: { in: planIds } },
      });
      await cleanup.aluno.deleteMany({
        where: { idAluno: { in: studentIds } },
      });
      await cleanup.responsavel.deleteMany({
        where: { nome: { startsWith: prefix } },
      });
      await cleanup.turma.deleteMany({ where: { idTurma: { in: classIds } } });
      await cleanup.eventoAdministrativo.deleteMany({
        where: { atorUsuarioId: { in: uids } },
      });
      await cleanup.sessao.deleteMany({ where: { usuarioId: { in: uids } } });
      await cleanup.tokenRedefinicaoSenha.deleteMany({
        where: { usuarioId: { in: uids } },
      });
      await cleanup.usuario.deleteMany({ where: { idUsuario: { in: uids } } });
      await cleanup.grupoModulo.deleteMany({ where: { grupoId: { in: ids } } });
      await cleanup.grupo.deleteMany({ where: { idGrupo: { in: ids } } });
      const keys = users.flatMap((u) =>
        ["login:", "recovery:"].map((a) =>
          rateKey(process.env.AUTH_SECRET!, a + u.email),
        ),
      );
      await cleanup.limiteAutenticacao.deleteMany({
        where: { chaveHash: { in: keys } },
      });
      await unlink(".local/e2e-credentials.json");
    } finally {
      await cleanup.$disconnect();
    }
  };
}
