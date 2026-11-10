import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { createDatabaseClient } from "@/lib/database-client";
import { bootstrapRoot, actorForUser } from "@/modules/core/services/auth";
import { hashPassword } from "@/modules/core/services/security";
import { createCourseService } from "@/modules/cursos/services/courses";
import {
  courseDetail,
  courseOptions,
  listCourses,
} from "@/modules/cursos/repositories/queries";
import { studentDetail } from "@/modules/alunos/repositories/queries";
import { seedCatalog } from "../../prisma/seed-catalog";
const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith("_test"))
  throw new Error("Banco _test obrigatório.");
const db = createDatabaseClient(url),
  service = createCourseService(db),
  prefix = "c-" + randomUUID().slice(0, 8),
  password = randomUUID();
let rootId: number,
  adminId: number,
  userId: number,
  deniedId: number,
  rootGroup: number,
  groupA: number,
  groupB: number,
  groupC: number,
  turmaId: number,
  ownId: number,
  otherId: number,
  coursesModule: number;
beforeAll(async () => {
  await seedCatalog(db);
  const root = await bootstrapRoot(db, {
    nome: "Root Cursos",
    email: prefix + "root@example.test",
    senha: password,
    grupo: prefix + "root",
  });
  rootId = root.id;
  rootGroup = (
    await db.usuario.findUniqueOrThrow({ where: { idUsuario: root.id } })
  ).grupoId;
  groupA = (await db.grupo.create({ data: { nome: prefix + "A" } })).idGrupo;
  groupB = (await db.grupo.create({ data: { nome: prefix + "B" } })).idGrupo;
  groupC = (await db.grupo.create({ data: { nome: prefix + "C" } })).idGrupo;
  const catalog = await db.modulo.findUniqueOrThrow({
    where: { codigo: "cursos" },
  });
  coursesModule = catalog.idModulo;
  const alunos = await db.modulo.findUniqueOrThrow({
    where: { codigo: "alunos" },
  });
  await db.grupoModulo.createMany({
    data: [
      { grupoId: groupA, moduloId: coursesModule },
      { grupoId: groupC, moduloId: coursesModule },
      { grupoId: groupC, moduloId: alunos.idModulo },
    ],
  });
  const roles = await db.papel.findMany(),
    senhaHash = await hashPassword(password);
  for (const [part, role, group] of [
    ["admin", "Administrador", groupA],
    ["user", "Usuário", groupC],
    ["denied", "Administrador", groupB],
  ] as const) {
    const u = await db.usuario.create({
      data: {
        nome: part,
        email: prefix + part + "@example.test",
        senhaHash,
        grupoId: group,
        papelId: roles.find((r) => r.nome === role)!.idPapel,
      },
    });
    if (part === "admin") adminId = u.idUsuario;
    if (part === "user") userId = u.idUsuario;
    if (part === "denied") deniedId = u.idUsuario;
  }
  turmaId = (
    await db.turma.create({
      data: {
        nome: prefix + "-turma",
        ano: 2026,
        periodo: "Manhã",
        capacidade: 1000,
      },
    })
  ).idTurma;
  ownId = (await student(true)).idAluno;
  otherId = (await student()).idAluno;
});
afterAll(async () => {
  const classes = await db.curso.findMany({
      where: { nome: { startsWith: prefix } },
      select: { idCurso: true },
    }),
    courseIds = classes.map((c) => c.idCurso);
  const students = await db.aluno.findMany({
      where: { matricula: { startsWith: prefix } },
      select: { idAluno: true },
    }),
    studentIds = students.map((a) => a.idAluno);
  await db.matricula.deleteMany({
    where: {
      OR: [{ cursoId: { in: courseIds } }, { alunoId: { in: studentIds } }],
    },
  });
  await db.aula.deleteMany({ where: { cursoId: { in: courseIds } } });
  await db.curso.deleteMany({ where: { idCurso: { in: courseIds } } });
  await db.professor.deleteMany({ where: { nome: { startsWith: prefix } } });
  await db.aluno.deleteMany({ where: { idAluno: { in: studentIds } } });
  await db.turma.deleteMany({ where: { nome: { startsWith: prefix } } });
  const gids = [rootGroup, groupA, groupB, groupC].filter(Boolean),
    users = await db.usuario.findMany({
      where: { grupoId: { in: gids } },
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
  await db.grupoModulo.deleteMany({ where: { grupoId: { in: gids } } });
  await db.grupo.deleteMany({ where: { idGrupo: { in: gids } } });
  await db.$disconnect();
});
async function student(own = false) {
  return db.aluno.create({
    data: {
      nome: prefix + randomUUID(),
      matricula: prefix + randomUUID().slice(0, 16),
      dataMatricula: new Date("2026-10-28T12:00:00Z"),
      turmaId,
      usuarioId: own ? userId : undefined,
    },
  });
}
async function course(hours = 2, ativo = true) {
  return (
    await service.save("cursos", rootId, {
      nome: prefix + randomUUID(),
      cargaHoraria: hours,
      ativo,
    })
  ).id;
}
async function teacher() {
  return (
    await service.save("professores", rootId, {
      nome: prefix + randomUUID(),
      email: randomUUID() + "@example.test",
      ativo: true,
    })
  ).id;
}
const enroll = (cursoId: number, alunoId = ownId) => ({
  cursoId,
  alunoId,
  dataMatricula: "2026-10-28",
  status: "ATIVA",
  ativo: true,
});
async function lesson(cursoId: number, duracao = 60) {
  return {
    cursoId,
    professorId: await teacher(),
    titulo: prefix + "Aula",
    dataHora: "2026-10-29T09:30",
    duracao,
    ativo: true,
  };
}
describe("cursos aulas e matrículas no PostgreSQL", () => {
  it("mantém curso e professor únicos por aula e horário correto", async () => {
    const cursoId = await course(),
      input = await lesson(cursoId);
    const saved = await service.save("aulas", rootId, input),
      row = await db.aula.findUniqueOrThrow({ where: { idAula: saved.id } });
    expect(row.cursoId).toBe(cursoId);
    expect(row.professorId).toBe(input.professorId);
    expect(row.dataHora.toISOString()).toBe("2026-10-29T12:30:00.000Z");
    await expect(
      service.save("aulas", rootId, { ...input, professorId: 2147483647 }),
    ).rejects.toThrow("válidos");
  });
  it("não atribui nova aula a professor inativo e preserva vínculos anteriores", async () => {
    const input = await lesson(await course()),
      saved = await service.save("aulas", rootId, input);
    await db.professor.update({
      where: { idProfessor: input.professorId },
      data: { ativo: false },
    });
    await expect(service.save("aulas", rootId, input)).rejects.toThrow(
      "inativo",
    );
    expect(
      (
        await service.save("aulas", rootId, {
          ...input,
          id: saved.id,
          titulo: prefix + "Corrigida",
        })
      ).id,
    ).toBe(saved.id);
  });
  it("respeita soma de duração e permite editar aula sem contá-la duas vezes", async () => {
    const cursoId = await course(1),
      input = await lesson(cursoId, 40),
      saved = await service.save("aulas", rootId, input);
    await expect(
      service.save("aulas", rootId, { ...input, duracao: 30 }),
    ).rejects.toThrow("excede");
    await service.save("aulas", rootId, {
      ...input,
      id: saved.id,
      duracao: 60,
    });
    expect(
      (await db.aula.findUniqueOrThrow({ where: { idAula: saved.id } }))
        .duracao,
    ).toBe(60);
  });
  it("serializa duas aulas concorrentes no limite da carga horária", async () => {
    const input = await lesson(await course(1), 50);
    const results = await Promise.allSettled([
      service.save("aulas", rootId, input),
      service.save("aulas", rootId, { ...input, titulo: prefix + "Segunda" }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });
  it("impede redução do curso abaixo das aulas ativas e reativação excedente", async () => {
    const cursoId = await course(2),
      input = await lesson(cursoId, 90),
      saved = await service.save("aulas", rootId, input);
    const base = await db.curso.findUniqueOrThrow({
      where: { idCurso: cursoId },
    });
    await expect(
      service.save("cursos", rootId, {
        id: cursoId,
        nome: base.nome,
        cargaHoraria: 1,
        ativo: true,
      }),
    ).rejects.toThrow("menor");
    await service.save("aulas", rootId, {
      ...input,
      id: saved.id,
      ativo: false,
    });
    await service.save("cursos", rootId, {
      id: cursoId,
      nome: base.nome,
      cargaHoraria: 1,
      ativo: true,
    });
    await expect(
      service.save("aulas", rootId, { ...input, id: saved.id, ativo: true }),
    ).rejects.toThrow("excede");
  });
  it("matricula o aluno central sem criar outra identidade", async () => {
    const count = await db.aluno.count(),
      cursoId = await course();
    const saved = await service.save(
      "matriculas",
      adminId,
      enroll(cursoId, otherId),
    );
    expect(
      (
        await db.matricula.findUniqueOrThrow({
          where: { idMatricula: saved.id },
        })
      ).alunoId,
    ).toBe(otherId);
    expect(await db.aluno.count()).toBe(count);
  });
  it("impede matrículas ativas concorrentes do mesmo aluno no curso", async () => {
    const input = enroll(await course());
    const results = await Promise.allSettled([
      service.save("matriculas", rootId, input),
      service.save("matriculas", rootId, input),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    await expect(
      service.save("matriculas", rootId, input),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("preserva cancelamentos e permite nova matrícula sem reativação duplicada", async () => {
    const input = enroll(await course()),
      first = await service.save("matriculas", rootId, input);
    await service.save("matriculas", rootId, {
      ...input,
      id: first.id,
      status: "CANCELADA",
    });
    await service.save("matriculas", rootId, input);
    expect(
      await db.matricula.count({
        where: { cursoId: input.cursoId, alunoId: ownId },
      }),
    ).toBe(2);
    await expect(
      service.save("matriculas", rootId, { ...input, id: first.id }),
    ).rejects.toThrow("já possui");
  });
  it("exceção de curso inativo exige root senha e justificativa auditada", async () => {
    const input = enroll(await course(1, false));
    await expect(
      service.save("matriculas", adminId, {
        ...input,
        justificativa: "Exceção",
        confirmacaoSenha: password,
      }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(service.save("matriculas", rootId, input)).rejects.toThrow(
      "justificativa",
    );
    await expect(
      service.save("matriculas", rootId, {
        ...input,
        justificativa: "Exceção",
        confirmacaoSenha: "errada",
      }),
    ).rejects.toMatchObject({ status: 403 });
    const saved = await service.save("matriculas", rootId, {
      ...input,
      justificativa: "Exceção aprovada",
      confirmacaoSenha: password,
    });
    const event = await db.eventoAdministrativo.findFirstOrThrow({
      where: { acao: "MATRICULA_EXCEPCIONAL", registroId: String(saved.id) },
    });
    expect(event.metadados).toMatchObject({
      justificativa: "Exceção aprovada",
    });
    expect(JSON.stringify(event)).not.toContain(password);
  });
  it("encerramento em curso inativo funciona mas reativação exige autorização", async () => {
    const input = enroll(await course()),
      saved = await service.save("matriculas", adminId, input);
    await db.curso.update({
      where: { idCurso: input.cursoId },
      data: { ativo: false },
    });
    await service.save("matriculas", adminId, {
      ...input,
      id: saved.id,
      status: "CONCLUIDA",
    });
    await expect(
      service.save("matriculas", adminId, { ...input, id: saved.id }),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("não altera aluno ou curso de uma matrícula já criada", async () => {
    const input = enroll(await course()),
      saved = await service.save("matriculas", rootId, input);
    await expect(
      service.save("matriculas", rootId, {
        ...input,
        id: saved.id,
        alunoId: otherId,
      }),
    ).rejects.toThrow("fixos");
    await expect(
      service.save("matriculas", rootId, {
        ...input,
        id: saved.id,
        cursoId: await course(),
      }),
    ).rejects.toThrow("fixos");
  });
  it("não matricula aluno inativo mas permite encerrar vínculo existente", async () => {
    const a = await student(),
      input = enroll(await course(), a.idAluno),
      saved = await service.save("matriculas", rootId, input);
    await db.aluno.update({
      where: { idAluno: a.idAluno },
      data: { ativo: false },
    });
    await service.save("matriculas", rootId, {
      ...input,
      id: saved.id,
      status: "CONCLUIDA",
    });
    await expect(
      service.save("matriculas", rootId, enroll(await course(), a.idAluno)),
    ).rejects.toThrow("Aluno inativo");
  });
  it("nega escrita sem módulo ou papel e oferece seletor mínimo ao gestor de cursos", async () => {
    const input = { nome: prefix + "Negado", cargaHoraria: 1, ativo: true };
    await expect(service.save("cursos", deniedId, input)).rejects.toMatchObject(
      { status: 403 },
    );
    await expect(service.save("cursos", userId, input)).rejects.toMatchObject({
      status: 403,
    });
    const actor = await actorForUser(db, adminId);
    expect(actor.modulos.some((m) => m.codigo === "alunos")).toBe(false);
    const opts = await courseOptions(db, actor);
    expect(opts.alunos.some((a) => a.id === ownId)).toBe(true);
    expect(Object.keys(opts.alunos[0]).sort()).toEqual([
      "ativo",
      "id",
      "matricula",
      "nome",
    ]);
  });
  it("usuário consulta só suas matrículas sem receber outros alunos ou e-mail do docente", async () => {
    const cursoId = await course(),
      input = await lesson(cursoId);
    await service.save("aulas", rootId, input);
    await service.save("matriculas", rootId, enroll(cursoId));
    await service.save("matriculas", rootId, enroll(cursoId, otherId));
    const actor = await actorForUser(db, userId),
      detail = await courseDetail(db, actor, cursoId);
    expect(detail.matriculas).toHaveLength(1);
    expect(detail.matriculas[0].matricula).toBe(
      (await db.aluno.findUniqueOrThrow({ where: { idAluno: ownId } }))
        .matricula,
    );
    expect(JSON.stringify(detail)).not.toContain(
      (
        await db.professor.findUniqueOrThrow({
          where: { idProfessor: input.professorId },
        })
      ).email,
    );
    expect(
      (
        await listCourses(
          db,
          actor,
          "matriculas",
          new URLSearchParams({ alunoId: String(otherId) }),
        )
      ).total,
    ).toBe(0);
    await expect(
      listCourses(db, actor, "professores", new URLSearchParams()),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("mantém curso histórico do próprio aluno e oculta curso inativo alheio", async () => {
    const cursoId = await course(),
      foreign = await course(1, false);
    await service.save("matriculas", rootId, enroll(cursoId));
    await db.curso.update({
      where: { idCurso: cursoId },
      data: { ativo: false },
    });
    const actor = await actorForUser(db, userId);
    expect((await courseDetail(db, actor, cursoId)).curso.id).toBe(cursoId);
    await expect(courseDetail(db, actor, foreign)).rejects.toMatchObject({
      status: 404,
    });
    expect(
      (
        await listCourses(db, actor, "cursos", new URLSearchParams())
      ).rows.every((c) => "ativo" in c && c.ativo),
    ).toBe(true);
  });
  it("consulta cursos pelo mesmo aluno na ficha acadêmica e revoga módulo imediatamente", async () => {
    const cursoId = await course();
    await service.save("matriculas", rootId, enroll(cursoId));
    const detail = await studentDetail(
      db,
      await actorForUser(db, rootId),
      ownId,
    );
    const expected = await db.curso.findUniqueOrThrow({
      where: { idCurso: cursoId },
    });
    expect(
      detail.historico.matriculas.some((m) => m.curso === expected.nome),
    ).toBe(true);
    try {
      await db.grupoModulo.update({
        where: {
          grupoId_moduloId: { grupoId: groupC, moduloId: coursesModule },
        },
        data: { habilitado: false },
      });
      await expect(
        listCourses(
          db,
          await actorForUser(db, userId),
          "cursos",
          new URLSearchParams(),
        ),
      ).rejects.toMatchObject({ status: 403 });
    } finally {
      await db.grupoModulo.update({
        where: {
          grupoId_moduloId: { grupoId: groupC, moduloId: coursesModule },
        },
        data: { habilitado: true },
      });
    }
  });
});
