import { studentDetail } from "@/modules/alunos/repositories/queries";
import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { createDatabaseClient } from "@/lib/database-client";
import { bootstrapRoot, actorForUser } from "@/modules/core/services/auth";
import { hashPassword } from "@/modules/core/services/security";
import { createAssessmentService } from "@/modules/avaliacoes/services/assessments";
import {
  assessmentDetail,
  attemptDetail,
  assessmentList,
} from "@/modules/avaliacoes/repositories/queries";
import { seedCatalog } from "../../prisma/seed-catalog";
const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith("_test"))
  throw new Error("Banco _test obrigatório.");
const db = createDatabaseClient(url),
  service = createAssessmentService(db),
  prefix = "a-" + randomUUID().slice(0, 8),
  password = randomUUID();
let rootId: number,
  userId: number,
  otherUser: number,
  adminId: number,
  deniedId: number,
  turmaId: number,
  alunoId: number,
  moduleId: number;
const groups: number[] = [];
beforeAll(async () => {
  await seedCatalog(db);
  const root = await bootstrapRoot(db, {
    nome: "Root Avaliações",
    email: prefix + "root@example.test",
    senha: password,
    grupo: prefix + "root",
  });
  rootId = root.id;
  groups.push(
    (await db.usuario.findUniqueOrThrow({ where: { idUsuario: rootId } }))
      .grupoId,
  );
  const group = await db.grupo.create({ data: { nome: prefix + "group" } });
  groups.push(group.idGrupo);
  const denied = await db.grupo.create({ data: { nome: prefix + "denied" } });
  groups.push(denied.idGrupo);
  moduleId = (
    await db.modulo.findUniqueOrThrow({ where: { codigo: "avaliacoes" } })
  ).idModulo;
  await db.grupoModulo.create({
    data: { grupoId: group.idGrupo, moduloId: moduleId },
  });
  const senhaHash = await hashPassword(password);
  for (const [name, role, gid] of [
    ["user", "Usuário", group.idGrupo],
    ["other", "Usuário", group.idGrupo],
    ["admin", "Administrador", group.idGrupo],
    ["denied", "Administrador", denied.idGrupo],
  ] as const) {
    const r = await db.papel.findUniqueOrThrow({ where: { nome: role } });
    const u = await db.usuario.create({
      data: {
        nome: name,
        email: prefix + name + "@example.test",
        senhaHash,
        papelId: r.idPapel,
        grupoId: gid,
      },
    });
    if (name === "user") userId = u.idUsuario;
    if (name === "other") otherUser = u.idUsuario;
    if (name === "admin") adminId = u.idUsuario;
    if (name === "denied") deniedId = u.idUsuario;
  }
  turmaId = (
    await db.turma.create({
      data: { nome: prefix, ano: 2026, periodo: "Manhã", capacidade: 20 },
    })
  ).idTurma;
  alunoId = (
    await db.aluno.create({
      data: {
        nome: prefix,
        matricula: prefix,
        dataMatricula: new Date(),
        turmaId,
        usuarioId: userId,
      },
    })
  ).idAluno;
});
afterAll(async () => {
  const exams = await db.avaliacao.findMany({
      where: { titulo: { startsWith: prefix } },
      select: { idAvaliacao: true },
    }),
    ids = exams.map((e) => e.idAvaliacao);
  await db.nota.deleteMany({ where: { avaliacaoId: { in: ids } } });
  await db.resposta.deleteMany({ where: { avaliacaoId: { in: ids } } });
  await db.tentativaAvaliacao.deleteMany({
    where: { avaliacaoId: { in: ids } },
  });
  await db.questao.deleteMany({ where: { avaliacaoId: { in: ids } } });
  await db.avaliacao.deleteMany({ where: { idAvaliacao: { in: ids } } });
  await db.aluno.deleteMany({ where: { turmaId } });
  await db.turma.deleteMany({ where: { idTurma: turmaId } });
  const users = await db.usuario.findMany({
      where: { grupoId: { in: groups } },
      select: { idUsuario: true },
    }),
    uids = users.map((u) => u.idUsuario);
  await db.eventoAdministrativo.deleteMany({
    where: { atorUsuarioId: { in: uids } },
  });
  await db.sessao.deleteMany({ where: { usuarioId: { in: uids } } });
  await db.tokenRedefinicaoSenha.deleteMany({
    where: { usuarioId: { in: uids } },
  });
  await db.usuario.deleteMany({ where: { idUsuario: { in: uids } } });
  await db.grupoModulo.deleteMany({ where: { grupoId: { in: groups } } });
  await db.grupo.deleteMany({ where: { idGrupo: { in: groups } } });
  await db.$disconnect();
});
async function exam(extra: Record<string, unknown> = {}) {
  return service.save("avaliacoes", rootId, {
    titulo: prefix + randomUUID(),
    tipo: "Prova",
    dataAplicacao: "2026-01-01T08:00",
    tempoLimite: 60,
    ativo: true,
    ...extra,
  });
}
async function question(avaliacaoId: number, disc = false, points = 2) {
  return service.save("questoes", rootId, {
    avaliacaoId,
    enunciado: disc
      ? "Explique a integridade referencial"
      : "Qual alternativa é correta?",
    tipo: disc ? "DISCURSIVA" : "OBJETIVA",
    pontuacao: points,
    ativo: true,
    ...(disc
      ? {}
      : {
          alternativaA: "Chave primária",
          alternativaB: "Cor incorreta",
          alternativaC: "Outro",
          alternativaD: "Nenhuma",
          alternativaCorreta: "A",
        }),
  });
}
async function start(avaliacaoId: number) {
  return service.save("iniciar", userId, { avaliacaoId });
}
async function fixture(disc = false) {
  const e = await exam(),
    a = await question(e.id),
    b = await question(e.id, disc, 3),
    t = await start(e.id);
  return { e, a, b, t };
}
const actor = (id: number) => actorForUser(db, id);
const answer = (questaoId: number, correct = true) => ({
  questaoId,
  alternativaSelecionada: correct ? "A" : "B",
});
describe("avaliações com PostgreSQL real", () => {
  it("exige módulo e papel administrativo em cada gravação", async () => {
    await expect(service.save("avaliacoes", userId, {})).rejects.toMatchObject({
      status: 403,
    });
    await expect(
      service.save("avaliacoes", deniedId, {}),
    ).rejects.toMatchObject({ status: 403 });
    const e = await exam();
    await expect(
      service.save("questoes", deniedId, { avaliacaoId: e.id }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(service.save("corrigir", userId, {})).rejects.toMatchObject({
      status: 403,
    });
  });
  it("admin com módulo pode criar e consulta é paginada sem gabarito", async () => {
    const e = await service.save("avaliacoes", adminId, {
      titulo: prefix + "admin",
      tipo: "Prova",
      dataAplicacao: "2026-01-01T08:00",
      tempoLimite: 5,
      ativo: true,
    });
    await question(e.id);
    const dto = await assessmentDetail(db, await actor(userId), e.id);
    expect(dto).not.toHaveProperty("questoes");
    expect(dto.pontos).toBe(2);
    const list = await assessmentList(
      db,
      await actor(userId),
      "avaliacoes",
      new URLSearchParams({ busca: prefix }),
    );
    expect(list.items.length).toBeLessThanOrEqual(10);
    expect(JSON.stringify(list)).not.toContain("alternativaCorreta");
  });
  it("vincula a identidade acadêmica da sessão e impede início antes da liberação", async () => {
    const e = await exam({ dataAplicacao: "2099-01-01T08:00" });
    await question(e.id);
    await expect(start(e.id)).rejects.toThrow("ainda não");
    await expect(
      service.save("iniciar", otherUser, { avaliacaoId: e.id }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      service.save("iniciar", userId, { avaliacaoId: e.id, alunoId }),
    ).rejects.toThrow();
  });
  it("não inicia prova vazia, inativa ou aluno inativo", async () => {
    const e = await exam();
    await expect(start(e.id)).rejects.toThrow("sem questões");
    await question(e.id);
    await db.avaliacao.update({
      where: { idAvaliacao: e.id },
      data: { ativo: false },
    });
    await expect(start(e.id)).rejects.toThrow("indisponível");
    await db.avaliacao.update({
      where: { idAvaliacao: e.id },
      data: { ativo: true },
    });
    await db.aluno.update({
      where: { idAluno: alunoId },
      data: { ativo: false },
    });
    try {
      await expect(start(e.id)).rejects.toMatchObject({ status: 403 });
    } finally {
      await db.aluno.update({
        where: { idAluno: alunoId },
        data: { ativo: true },
      });
    }
  });
  it("duplo início concorrente retorna a mesma tentativa", async () => {
    const e = await exam();
    await question(e.id);
    const [a, b] = await Promise.all([start(e.id), start(e.id)]);
    expect(a.id).toBe(b.id);
    expect(
      await db.tentativaAvaliacao.count({ where: { avaliacaoId: e.id } }),
    ).toBe(1);
  });
  it("permite várias respostas na mesma prova e oculta gabarito e pontos antes da finalização", async () => {
    const { a, b, t } = await fixture();
    await service.save("respostas", userId, {
      tentativaId: t.id,
      respostas: [answer(a.id), answer(b.id, false)],
    });
    expect(
      await db.resposta.count({ where: { tentativaId: t.id, ativo: true } }),
    ).toBe(2);
    const dto = await attemptDetail(db, await actor(userId), t.id);
    expect(Math.abs(Date.parse(dto.serverNow) - Date.now())).toBeLessThan(2000);
    expect(Date.parse(dto.prazoEm) - Date.parse(dto.serverNow)).toBeGreaterThan(
      3590000,
    );
    expect(dto.questoes[0]).not.toHaveProperty("alternativaCorreta");
    expect(dto.questoes[0].resposta).not.toHaveProperty("pontuacaoObtida");
    await expect(
      attemptDetail(db, await actor(otherUser), t.id),
    ).rejects.toMatchObject({ status: 404 });
    expect(
      (
        await assessmentList(
          db,
          await actor(otherUser),
          "resultados",
          new URLSearchParams(),
        )
      ).total,
    ).toBe(0);
  });
  it("corrige objetivas, grava nota única e finalizar novamente é idempotente", async () => {
    const { a, b, t } = await fixture();
    const input = {
      tentativaId: t.id,
      respostas: [answer(a.id), answer(b.id, false)],
    };
    await Promise.all([
      service.save("finalizar", userId, input),
      service.save("finalizar", userId, input),
    ]);
    const dto = await attemptDetail(db, await actor(userId), t.id);
    expect(dto.status).toBe("CORRIGIDA");
    expect(dto.nota).toBe("2.00");
    const history = await studentDetail(db, await actor(rootId), alunoId);
    const persisted = await db.nota.findUniqueOrThrow({
      where: { tentativaId: t.id },
    });
    expect(
      history.historico.notas.some(
        (n) => n.id === persisted.idNota && n.valor === "2",
      ),
    ).toBe(true);
    expect(dto.questoes[0].alternativaCorreta).toBe("A");
    expect(await db.nota.count({ where: { tentativaId: t.id } })).toBe(1);
    await expect(
      service.save("respostas", userId, input),
    ).rejects.toMatchObject({ status: 409 });
    expect((await start(dto.avaliacaoId)).id).toBe(t.id);
  });
  it("discursiva exige correção manual, aceita nota parcial e reavaliação auditada", async () => {
    const { a, b, t } = await fixture(true);
    await service.save("finalizar", userId, {
      tentativaId: t.id,
      respostas: [
        answer(a.id),
        {
          questaoId: b.id,
          texto: "A chave estrangeira preserva o vínculo entre registros.",
        },
      ],
    });
    let dto = await attemptDetail(db, await actor(rootId), t.id);
    expect(dto.status).toBe("FINALIZADA");
    expect(dto.nota).toBeNull();
    const respostaId = dto.questoes[1].resposta!.id;
    await expect(
      service.save("corrigir", adminId, { respostaId, pontuacao: 4 }),
    ).rejects.toThrow("excede");
    await service.save("corrigir", adminId, {
      respostaId,
      pontuacao: 1.25,
      comentario: "Explicação parcial.",
    });
    dto = await attemptDetail(db, await actor(userId), t.id);
    expect(dto.nota).toBe("3.25");
    expect(dto.status).toBe("CORRIGIDA");
    expect(dto.questoes[1].resposta?.comentario).toBe("Explicação parcial.");
    await service.save("corrigir", adminId, { respostaId, pontuacao: 2.75 });
    expect((await attemptDetail(db, await actor(userId), t.id)).nota).toBe(
      "4.75",
    );
    expect(await db.nota.count({ where: { tentativaId: t.id } })).toBe(1);
    expect(
      await db.eventoAdministrativo.count({
        where: { acao: "RESPOSTA_CORRIGIDA", registroId: String(respostaId) },
      }),
    ).toBe(2);
  });
  it("não deixa corrigir objetiva nem discursiva de prova em andamento", async () => {
    const { a, b, t } = await fixture(true);
    await service.save("respostas", userId, {
      tentativaId: t.id,
      respostas: [answer(a.id), { questaoId: b.id, texto: "Teste" }],
    });
    for (const r of await db.resposta.findMany({
      where: { tentativaId: t.id },
    }))
      await expect(
        service.save("corrigir", rootId, {
          respostaId: r.idResposta,
          pontuacao: 1,
        }),
      ).rejects.toMatchObject({ status: 409 });
  });
  it("rejeita questão alheia, duplicada, resposta incompatível e acesso a tentativa de terceiro", async () => {
    const { a, b, t } = await fixture(true),
      e2 = await exam(),
      q = await question(e2.id);
    for (const respostas of [
      [answer(q.id)],
      [answer(a.id), answer(a.id)],
      [{ questaoId: a.id, texto: "Não é alternativa" }],
      [answer(b.id)],
    ])
      await expect(
        service.save("respostas", userId, { tentativaId: t.id, respostas }),
      ).rejects.toThrow();
    await expect(
      service.save("finalizar", otherUser, {
        tentativaId: t.id,
        respostas: [],
      }),
    ).rejects.toMatchObject({ status: 404 });
    expect(await db.resposta.count({ where: { tentativaId: t.id } })).toBe(0);
  });
  it("retirar resposta salva mantém integridade e vale zero ao finalizar", async () => {
    const { a, b, t } = await fixture(true);
    await service.save("respostas", userId, {
      tentativaId: t.id,
      respostas: [answer(a.id), { questaoId: b.id, texto: "Rascunho" }],
    });
    await service.save("respostas", userId, {
      tentativaId: t.id,
      respostas: [{ questaoId: b.id, texto: null }],
    });
    await service.save("finalizar", userId, {
      tentativaId: t.id,
      respostas: [],
    });
    expect((await attemptDetail(db, await actor(userId), t.id)).nota).toBe(
      "2.00",
    );
  });
  it("bloqueia conteúdo após iniciar e permite inativar sem perder a tentativa", async () => {
    const { e, a, t } = await fixture();
    const current = await db.avaliacao.findUniqueOrThrow({
      where: { idAvaliacao: e.id },
    });
    await expect(question(e.id)).rejects.toMatchObject({ status: 409 });
    await expect(
      service.save("questoes", rootId, {
        id: a.id,
        avaliacaoId: e.id,
        enunciado: "Mudança",
        tipo: "DISCURSIVA",
        pontuacao: 5,
        ativo: true,
      }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      service.save("avaliacoes", rootId, {
        id: e.id,
        titulo: "Outro título",
        descricao: current.descricao,
        tipo: current.tipo,
        dataAplicacao: "2026-01-01T08:00",
        tempoLimite: 60,
        ativo: true,
      }),
    ).rejects.toMatchObject({ status: 409 });
    await service.save("avaliacoes", rootId, {
      id: e.id,
      titulo: current.titulo,
      descricao: current.descricao,
      tipo: current.tipo,
      dataAplicacao: "2026-01-01T08:00",
      tempoLimite: 60,
      ativo: false,
    });
    expect((await start(e.id)).id).toBe(t.id);
    await service.save("finalizar", userId, {
      tentativaId: t.id,
      respostas: [answer(a.id)],
    });
    expect((await attemptDetail(db, await actor(userId), t.id)).nota).toBe(
      "2.00",
    );
  });
  it("prazo usa relógio do servidor e ignora novas respostas enviadas tarde", async () => {
    const { a, b, t } = await fixture();
    await service.save("respostas", userId, {
      tentativaId: t.id,
      respostas: [answer(a.id)],
    });
    await db.tentativaAvaliacao.update({
      where: { idTentativa: t.id },
      data: {
        iniciadaEm: new Date(Date.now() - 120000),
        prazoEm: new Date(Date.now() - 60000),
      },
    });
    await expect(
      service.save("respostas", userId, {
        tentativaId: t.id,
        respostas: [answer(b.id)],
      }),
    ).rejects.toMatchObject({ status: 409 });
    const result = await service.save("finalizar", userId, {
      tentativaId: t.id,
      respostas: [answer(b.id)],
    });
    expect(result).toMatchObject({ expirado: true });
    expect((await attemptDetail(db, await actor(userId), t.id)).nota).toBe(
      "2.00",
    );
    expect(await db.resposta.count({ where: { tentativaId: t.id } })).toBe(1);
  });
  it("admin encerra somente tentativa expirada e respostas não enviadas valem zero", async () => {
    const { t } = await fixture(true);
    await expect(
      service.save("encerrar-expirada", adminId, { tentativaId: t.id }),
    ).rejects.toMatchObject({ status: 409 });
    await db.tentativaAvaliacao.update({
      where: { idTentativa: t.id },
      data: {
        iniciadaEm: new Date(Date.now() - 120000),
        prazoEm: new Date(Date.now() - 60000),
      },
    });
    await service.save("encerrar-expirada", adminId, { tentativaId: t.id });
    expect((await attemptDetail(db, await actor(userId), t.id)).nota).toBe(
      "0.00",
    );
  });
  it("módulo desabilitado e conta inativa revogam operações imediatamente", async () => {
    const { a, t } = await fixture();
    await db.grupoModulo.update({
      where: { grupoId_moduloId: { grupoId: groups[1], moduloId: moduleId } },
      data: { habilitado: false },
    });
    try {
      await expect(
        service.save("respostas", userId, {
          tentativaId: t.id,
          respostas: [answer(a.id)],
        }),
      ).rejects.toMatchObject({ status: 403 });
    } finally {
      await db.grupoModulo.update({
        where: { grupoId_moduloId: { grupoId: groups[1], moduloId: moduleId } },
        data: { habilitado: true },
      });
    }
    await db.usuario.update({
      where: { idUsuario: userId },
      data: { ativo: false },
    });
    try {
      await expect(
        service.save("finalizar", userId, { tentativaId: t.id, respostas: [] }),
      ).rejects.toThrow();
    } finally {
      await db.usuario.update({
        where: { idUsuario: userId },
        data: { ativo: true },
      });
    }
  });
});
