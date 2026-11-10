import { randomUUID } from "node:crypto";
import { readdir, rmdir } from "node:fs/promises";
import { join } from "node:path";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { createDatabaseClient } from "@/lib/database-client";
import { bootstrapRoot, actorForUser } from "@/modules/core/services/auth";
import { hashPassword } from "@/modules/core/services/security";
import { createStudentService } from "@/modules/alunos/services/students";
import {
  createDocumentService,
  documentStorage,
} from "@/modules/alunos/services/files";
import {
  studentDetail,
  listStudents,
} from "@/modules/alunos/repositories/queries";
import { seedCatalog } from "../../prisma/seed-catalog";
const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith("_test"))
  throw new Error("Banco _test obrigatório.");
const db = createDatabaseClient(url);
const service = createStudentService(db);
const prefix = "s-" + randomUUID().slice(0, 8),
  password = randomUUID();
const storageDir = join(".local", prefix),
  storage = documentStorage(storageDir),
  files = createDocumentService(db, storage, 10485760);
let rootId: number,
  rootGroup: number,
  groupA: number,
  groupB: number,
  adminId: number,
  userId: number,
  deniedId: number;
const trackedFiles: string[] = [];
const pdf = {
  name: "identidade.pdf",
  type: "application/pdf",
  bytes: Buffer.from("%PDF-1.4\n1 0 obj <</Type /Catalog>> endobj\n%%EOF"),
};
beforeAll(async () => {
  await seedCatalog(db);
  const root = await bootstrapRoot(db, {
    nome: "Root Acadêmico",
    email: prefix + "-root@example.test",
    senha: password,
    grupo: prefix + "-root",
  });
  rootId = root.id;
  rootGroup = (
    await db.usuario.findUniqueOrThrow({ where: { idUsuario: rootId } })
  ).grupoId;
  groupA = (await db.grupo.create({ data: { nome: prefix + "-A" } })).idGrupo;
  groupB = (await db.grupo.create({ data: { nome: prefix + "-B" } })).idGrupo;
  const catalog = await db.modulo.findUniqueOrThrow({
    where: { codigo: "alunos" },
  });
  await db.grupoModulo.create({
    data: { grupoId: groupA, moduloId: catalog.idModulo, habilitado: true },
  });
  const roles = await db.papel.findMany();
  const senhaHash = await hashPassword(password);
  for (const [part, role, group] of [
    ["admin", "Administrador", groupA],
    ["user", "Usuário", groupA],
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
});
afterAll(async () => {
  const students = await db.aluno.findMany({
    where: { matricula: { startsWith: prefix } },
    select: { idAluno: true },
  });
  const ids = students.map((a) => a.idAluno);
  const docs = await db.documento.findMany({
    where: { alunoId: { in: ids } },
    select: { chaveArmazenamento: true },
  });
  for (const d of docs) await storage.remove(d.chaveArmazenamento);
  for (const key of trackedFiles) await storage.remove(key);
  await db.documento.deleteMany({ where: { alunoId: { in: ids } } });
  await db.ocorrencia.deleteMany({ where: { alunoId: { in: ids } } });
  await db.alunoResponsavel.deleteMany({ where: { alunoId: { in: ids } } });
  await db.matricula.deleteMany({ where: { alunoId: { in: ids } } });
  await db.aluno.deleteMany({ where: { idAluno: { in: ids } } });
  await db.responsavel.deleteMany({ where: { nome: { startsWith: prefix } } });
  await db.turma.deleteMany({ where: { nome: { startsWith: prefix } } });
  await db.curso.deleteMany({ where: { nome: { startsWith: prefix } } });
  const groups = [rootGroup, groupA, groupB].filter(Boolean);
  const users = await db.usuario.findMany({
    where: { grupoId: { in: groups } },
    select: { idUsuario: true },
  });
  const uids = users.map((u) => u.idUsuario);
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
  await rmdir(join(storageDir, "documentos")).catch(() => {});
  await rmdir(storageDir).catch(() => {});
  await db.$disconnect();
});
async function makeClass(capacidade = 3) {
  return (
    await service.save("turmas", rootId, {
      nome: prefix + randomUUID(),
      ano: 2026,
      periodo: "Manhã",
      capacidade,
      ativo: true,
    })
  ).id;
}
function data(turmaId: number) {
  return {
    nome: "Aluno de Teste",
    matricula: prefix + randomUUID().slice(0, 18),
    dataMatricula: "2026-10-28",
    turmaId,
    status: "MATRICULADO",
    ativo: true,
  };
}
async function makeStudent(turmaId?: number) {
  const input = data(turmaId || (await makeClass()));
  const result = await service.save("alunos", rootId, input);
  return { id: result.id, ...input };
}
describe("gestão de alunos no PostgreSQL", () => {
  it("cadastra aluno central sem conta e valida matrícula única", async () => {
    const a = await makeStudent();
    expect(
      (await db.aluno.findUniqueOrThrow({ where: { idAluno: a.id } }))
        .usuarioId,
    ).toBeNull();
    await expect(
      service.save("alunos", rootId, { ...a, id: undefined }),
    ).rejects.toMatchObject({ code: "P2002" });
  });
  it("serializa duas inscrições na última vaga", async () => {
    const turma = await makeClass(1);
    const results = await Promise.allSettled([
      service.save("alunos", rootId, data(turma)),
      service.save("alunos", rootId, data(turma)),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await db.aluno.count({ where: { turmaId: turma } })).toBe(1);
  });
  it("bloqueia transferência e reativação em turma cheia", async () => {
    const full = await makeClass(1);
    await makeStudent(full);
    const a = await makeStudent();
    await expect(
      service.save("alunos", rootId, { ...a, turmaId: full }),
    ).rejects.toThrow("sem vagas");
    const inactive = await service.save("alunos", rootId, {
      ...data(full),
      ativo: false,
    });
    const stored = await db.aluno.findUniqueOrThrow({
      where: { idAluno: inactive.id },
    });
    await expect(
      service.save("alunos", rootId, {
        id: stored.idAluno,
        nome: stored.nome,
        matricula: stored.matricula,
        dataMatricula: "2026-10-28",
        turmaId: full,
        status: "MATRICULADO",
        ativo: true,
      }),
    ).rejects.toThrow("sem vagas");
  });
  it("libera vaga após inativação e impede reduzir capacidade abaixo da ocupação", async () => {
    const turma = await makeClass(2);
    const a = await makeStudent(turma);
    await makeStudent(turma);
    const base = {
      id: turma,
      nome: prefix + "-capacity",
      ano: 2026,
      periodo: "Manhã",
      capacidade: 1,
      ativo: true,
    };
    await expect(service.save("turmas", rootId, base)).rejects.toThrow(
      "ocupação",
    );
    await service.save("alunos", rootId, { ...a, ativo: false });
    await service.save("turmas", rootId, base);
    expect(
      (await db.turma.findUniqueOrThrow({ where: { idTurma: turma } }))
        .capacidade,
    ).toBe(1);
  });
  it("turma inativa não recebe novo aluno", async () => {
    const turma = await makeClass();
    await db.turma.update({
      where: { idTurma: turma },
      data: { ativo: false },
    });
    await expect(service.save("alunos", rootId, data(turma))).rejects.toThrow(
      "inativa",
    );
  });
  it("permite múltiplos responsáveis e parentesco por vínculo sem duplicar ligação", async () => {
    const a = await makeStudent(),
      b = await makeStudent();
    const r = await service.save("responsaveis", rootId, {
      nome: prefix + "-Responsável",
      telefone: "38999999999",
      ativo: true,
    });
    const r2 = await service.save("responsaveis", rootId, {
      nome: prefix + "-Tutor",
      email: "tutor@example.test",
      ativo: true,
    });
    for (const [alunoId, responsavelId, parentesco] of [
      [a.id, r.id, "Mãe"],
      [b.id, r.id, "Tia"],
      [a.id, r2.id, "Tutor"],
    ] as const)
      await service.save("vinculos", rootId, {
        alunoId,
        responsavelId,
        parentesco,
      });
    await service.save("vinculos", rootId, {
      alunoId: a.id,
      responsavelId: r.id,
      parentesco: "Responsável legal",
    });
    expect(await db.alunoResponsavel.count({ where: { alunoId: a.id } })).toBe(
      2,
    );
    await service.save("vinculos", rootId, {
      alunoId: a.id,
      responsavelId: r.id,
      parentesco: "",
      remover: true,
    });
    expect(
      await db.alunoResponsavel.count({ where: { responsavelId: r.id } }),
    ).toBe(1);
  });
  it("nega escrita sem módulo ou papel gestor", async () => {
    const input = data(await makeClass());
    await expect(service.save("alunos", deniedId, input)).rejects.toMatchObject(
      { status: 403 },
    );
    await expect(service.save("alunos", userId, input)).rejects.toMatchObject({
      status: 403,
    });
    const result = await service.save("alunos", adminId, input);
    expect(result.id).toBeTypeOf("number");
  });
  it("somente root vincula conta mediante senha e vínculo é único", async () => {
    const a = await makeStudent();
    await expect(
      service.save("alunos", adminId, { ...a, usuarioId: userId }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      service.save("alunos", rootId, { ...a, usuarioId: userId }),
    ).rejects.toMatchObject({ status: 403 });
    await service.save("alunos", rootId, {
      ...a,
      usuarioId: userId,
      confirmacaoSenha: password,
    });
    const b = await makeStudent();
    await expect(
      service.save("alunos", rootId, {
        ...b,
        usuarioId: userId,
        confirmacaoSenha: password,
      }),
    ).rejects.toMatchObject({ code: "P2002" });
    await service.save("alunos", rootId, {
      ...a,
      usuarioId: null,
      confirmacaoSenha: password,
    });
  });
  it("autoria é da sessão e ocorrências são ocultadas do aluno", async () => {
    const a = await makeStudent();
    await service.save("alunos", rootId, {
      ...a,
      usuarioId: userId,
      confirmacaoSenha: password,
    });
    const input = {
      alunoId: a.id,
      tipo: "Pedagógica",
      descricao: "Acompanhamento interno",
      dataOcorrencia: "2026-10-28",
      status: "REGISTRADA",
      ativo: true,
    };
    const occurrence = await service.save("ocorrencias", adminId, input);
    expect(
      (
        await db.ocorrencia.findUniqueOrThrow({
          where: { idOcorrencia: occurrence.id },
        })
      ).autorUsuarioId,
    ).toBe(adminId);
    await expect(
      service.save("ocorrencias", adminId, {
        ...input,
        autorUsuarioId: rootId,
      }),
    ).rejects.toThrow();
    const actor = await actorForUser(db, userId);
    expect((await studentDetail(db, actor, a.id)).ocorrencias).toHaveLength(0);
    const b = await makeStudent();
    await expect(studentDetail(db, actor, b.id)).rejects.toMatchObject({
      status: 404,
    });
    const listed = await listStudents(
      db,
      actor,
      "alunos",
      new URLSearchParams(),
    );
    expect(listed.total).toBe(1);
    await service.save("alunos", rootId, {
      ...a,
      usuarioId: null,
      confirmacaoSenha: password,
    });
  });
  it("histórico usa a mesma identidade e respeita módulo habilitado", async () => {
    const a = await makeStudent();
    await service.save("alunos", rootId, {
      ...a,
      usuarioId: userId,
      confirmacaoSenha: password,
    });
    const course = await db.curso.create({
      data: { nome: prefix + "-Curso", cargaHoraria: 10 },
    });
    await db.matricula.create({
      data: {
        alunoId: a.id,
        cursoId: course.idCurso,
        dataMatricula: new Date("2026-10-28T12:00:00Z"),
      },
    });
    expect(
      (await studentDetail(db, await actorForUser(db, rootId), a.id)).historico
        .matriculas,
    ).toHaveLength(1);
    expect(
      (await studentDetail(db, await actorForUser(db, userId), a.id)).historico
        .matriculas,
    ).toHaveLength(0);
    await service.save("alunos", rootId, {
      ...a,
      usuarioId: null,
      confirmacaoSenha: password,
    });
  });
  it("upload privado não vaza chave e aluno baixa somente arquivo próprio", async () => {
    const a = await makeStudent(),
      b = await makeStudent();
    await service.save("alunos", rootId, {
      ...a,
      usuarioId: userId,
      confirmacaoSenha: password,
    });
    const doc = await files.upload(
      rootId,
      { alunoId: a.id, tipo: "Identidade" },
      pdf,
    );
    const otherDoc = await files.upload(
      rootId,
      { alunoId: b.id, tipo: "Identidade" },
      pdf,
    );
    expect((await files.download(userId, doc.id)).bytes.equals(pdf.bytes)).toBe(
      true,
    );
    await expect(files.download(userId, otherDoc.id)).rejects.toMatchObject({
      status: 404,
    });
    const detail = await studentDetail(
      db,
      await actorForUser(db, userId),
      a.id,
    );
    expect(JSON.stringify(detail)).not.toContain("chaveArmazenamento");
    await expect(
      files.upload(userId, { alunoId: a.id, tipo: "Teste" }, pdf),
    ).rejects.toMatchObject({ status: 403 });
    await service.save("documentos", rootId, {
      id: doc.id,
      status: "ARQUIVADO",
      ativo: false,
    });
    await expect(files.download(userId, doc.id)).rejects.toMatchObject({
      status: 404,
    });
    expect((await files.download(rootId, doc.id)).bytes.equals(pdf.bytes)).toBe(
      true,
    );
    await service.save("alunos", rootId, {
      ...a,
      usuarioId: null,
      confirmacaoSenha: password,
    });
  });
  it("rejeita arquivo mascarado antes de gravar", async () => {
    const a = await makeStudent();
    const before = (
      await readdir(join(storageDir, "documentos")).catch(() => [])
    ).length;
    await expect(
      files.upload(
        rootId,
        { alunoId: a.id, tipo: "Teste" },
        { ...pdf, bytes: Buffer.from("<html>nao PDF</html>") },
      ),
    ).rejects.toThrow("válido");
    expect(
      (await readdir(join(storageDir, "documentos")).catch(() => [])).length,
    ).toBe(before);
  });
  it("remove arquivo se o aluno deixa de existir antes da transação", async () => {
    const a = await makeStudent();
    const before = (
      await readdir(join(storageDir, "documentos")).catch(() => [])
    ).length;
    const interrupted = createDocumentService(
      db,
      {
        ...storage,
        async put(key, bytes) {
          trackedFiles.push(key);
          await storage.put(key, bytes);
          await db.aluno.delete({ where: { idAluno: a.id } });
        },
      },
      10485760,
    );
    await expect(
      interrupted.upload(rootId, { alunoId: a.id, tipo: "Teste" }, pdf),
    ).rejects.toMatchObject({ status: 404 });
    expect((await readdir(join(storageDir, "documentos"))).length).toBe(before);
  });
});
