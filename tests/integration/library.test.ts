import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { createDatabaseClient } from "@/lib/database-client";
import { bootstrapRoot, actorForUser } from "@/modules/core/services/auth";
import { hashPassword } from "@/modules/core/services/security";
import { localLessonTime } from "@/lib/academic-time";
import { createLibraryService } from "@/modules/biblioteca/services/library";
import {
  libraryList,
  libraryOptions,
} from "@/modules/biblioteca/repositories/queries";
import { bookDetail } from "@/modules/biblioteca/repositories/detail";
import { seedCatalog } from "../../prisma/seed-catalog";
const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith("_test"))
  throw new Error("Banco _test obrigatório.");
const db = createDatabaseClient(url),
  service = createLibraryService(db),
  prefix = "b-" + randomUUID().slice(0, 8),
  password = randomUUID(),
  groups: number[] = [];
let rootId: number,
  adminId: number,
  userId: number,
  peerId: number,
  deniedId: number,
  turmaId: number,
  ownStudent: number,
  peerStudent: number,
  moduleId: number;
const future = () => localLessonTime(new Date(Date.now() + 86400000));
const save = (resource: string, input: unknown, id = rootId) =>
  service.save(resource, id, input);
const actor = (id: number) => actorForUser(db, id);
beforeAll(async () => {
  await seedCatalog(db);
  const root = await bootstrapRoot(db, {
    nome: "Root Biblioteca",
    email: prefix + "root@example.test",
    senha: password,
    grupo: prefix + "root",
  });
  rootId = root.id;
  groups.push(
    (await db.usuario.findUniqueOrThrow({ where: { idUsuario: rootId } }))
      .grupoId,
  );
  for (const suffix of ["allowed", "denied"])
    groups.push(
      (await db.grupo.create({ data: { nome: prefix + suffix } })).idGrupo,
    );
  moduleId = (
    await db.modulo.findUniqueOrThrow({ where: { codigo: "biblioteca" } })
  ).idModulo;
  await db.grupoModulo.create({
    data: { grupoId: groups[1], moduloId: moduleId },
  });
  const senhaHash = await hashPassword(password);
  for (const [name, role, gid] of [
    ["admin", "Administrador", groups[1]],
    ["user", "Usuário", groups[1]],
    ["peer", "Usuário", groups[1]],
    ["denied", "Administrador", groups[2]],
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
    if (name === "admin") adminId = u.idUsuario;
    if (name === "user") userId = u.idUsuario;
    if (name === "peer") peerId = u.idUsuario;
    if (name === "denied") deniedId = u.idUsuario;
  }
  turmaId = (
    await db.turma.create({
      data: { nome: prefix, ano: 2026, periodo: "Manhã", capacidade: 20 },
    })
  ).idTurma;
  for (const [name, uid] of [
    ["own", userId],
    ["peer", peerId],
  ] as const) {
    const a = await db.aluno.create({
      data: {
        nome: prefix + name,
        matricula: prefix + name,
        dataMatricula: new Date(),
        turmaId,
        usuarioId: uid,
      },
    });
    if (name === "own") ownStudent = a.idAluno;
    else peerStudent = a.idAluno;
  }
});
afterAll(async () => {
  const books = await db.livro.findMany({
      where: { titulo: { startsWith: prefix } },
      select: { idLivro: true },
    }),
    ids = books.map((b) => b.idLivro);
  await db.emprestimo.deleteMany({
    where: { exemplar: { livroId: { in: ids } } },
  });
  await db.reserva.deleteMany({ where: { livroId: { in: ids } } });
  await db.exemplar.deleteMany({ where: { livroId: { in: ids } } });
  await db.livro.deleteMany({ where: { idLivro: { in: ids } } });
  await db.categoria.deleteMany({ where: { nome: { startsWith: prefix } } });
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
async function fixture() {
  const c = await save("categorias", {
    nome: prefix + randomUUID(),
    ativo: true,
  });
  const b = await save("livros", {
    titulo: prefix + randomUUID(),
    autor: "Autora de teste",
    categoriaId: c.id,
    ativo: true,
  });
  const e = await save("exemplares", {
    codigo: prefix + randomUUID(),
    livroId: b.id,
    situacao: "DISPONIVEL",
    ativo: true,
  });
  return { c, b, e };
}
const loan = (exemplarId: number, alunoId = ownStudent) =>
  save("emprestimos", { exemplarId, alunoId, dataPrevistaDevolucao: future() });
const reserve = (livroId: number, alunoId = ownStudent) =>
  save("reservas", { livroId, alunoId, dataExpiracao: future() });
async function list(
  resource: string,
  id = userId,
  q: Record<string, string> = {},
) {
  return libraryList(db, await actor(id), resource, new URLSearchParams(q));
}
describe("biblioteca em PostgreSQL real", () => {
  it("exige papel de gestor e módulo em todas as gravações", async () => {
    for (const resource of [
      "categorias",
      "livros",
      "exemplares",
      "emprestimos",
      "devolver",
      "reservas",
      "situacao-reserva",
    ]) {
      await expect(save(resource, {}, userId)).rejects.toMatchObject({
        status: 403,
      });
      await expect(save(resource, {}, deniedId)).rejects.toMatchObject({
        status: 403,
      });
    }
    await expect(libraryOptions(db, await actor(userId))).rejects.toMatchObject(
      { status: 403 },
    );
    await expect(list("categorias")).rejects.toMatchObject({ status: 403 });
    await expect(list("livros", deniedId)).rejects.toMatchObject({
      status: 403,
    });
  });
  it("cadastros reais são editáveis e referências ausentes são recusadas", async () => {
    const { c, b, e } = await fixture();
    await save(
      "categorias",
      {
        id: c.id,
        nome: prefix + "editada",
        descricao: "Categoria de estudo",
        ativo: true,
      },
      adminId,
    );
    await save(
      "livros",
      {
        id: b.id,
        titulo: prefix + "editado",
        autor: "Outra autora",
        categoriaId: c.id,
        ativo: true,
      },
      adminId,
    );
    await save(
      "exemplares",
      {
        id: e.id,
        codigo: prefix + "editado",
        livroId: b.id,
        situacao: "DISPONIVEL",
        localizacao: "Estante 2",
        dataAquisicao: "2026-10-28",
        ativo: true,
      },
      adminId,
    );
    const detail = await bookDetail(db, await actor(userId), b.id);
    expect(detail.autor).toBe("Outra autora");
    expect(detail.exemplares[0].localizacao).toBe("Estante 2");
    expect(detail.disponiveis).toBe(1);
    await expect(
      save("livros", {
        titulo: prefix + "inválido",
        autor: "Autora",
        categoriaId: 2147483647,
        ativo: true,
      }),
    ).rejects.toThrow();
    await expect(
      save("exemplares", {
        codigo: prefix + "inválido",
        livroId: 2147483647,
        situacao: "DISPONIVEL",
        ativo: true,
      }),
    ).rejects.toThrow();
  });
  it("mantém ISBN e código únicos no banco e não cria aluno duplicado", async () => {
    const { b, e, c } = await fixture();
    const old = await db.exemplar.findUniqueOrThrow({
      where: { idExemplar: e.id },
    });
    await expect(
      save("exemplares", {
        codigo: old.codigo,
        livroId: b.id,
        situacao: "DISPONIVEL",
        ativo: true,
      }),
    ).rejects.toMatchObject({ code: "P2002" });
    const isbn = prefix + randomUUID().slice(0, 20);
    await save("livros", {
      titulo: prefix + randomUUID(),
      autor: "Autora",
      categoriaId: c.id,
      isbn,
      ativo: true,
    });
    await expect(
      save("livros", {
        titulo: prefix + randomUUID(),
        autor: "Autora",
        categoriaId: c.id,
        isbn,
        ativo: true,
      }),
    ).rejects.toMatchObject({ code: "P2002" });
    const count = await db.aluno.count();
    const l = await loan(e.id);
    expect(
      (await db.emprestimo.findUniqueOrThrow({ where: { idEmprestimo: l.id } }))
        .alunoId,
    ).toBe(ownStudent);
    expect(await db.aluno.count()).toBe(count);
  });
  it("duas retiradas concorrentes do mesmo exemplar produzem somente um empréstimo", async () => {
    const { e } = await fixture();
    const results = await Promise.allSettled([
      loan(e.id),
      loan(e.id, peerStudent),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(
      await db.emprestimo.count({
        where: { exemplarId: e.id, dataDevolucao: null },
      }),
    ).toBe(1);
    expect(
      (await db.exemplar.findUniqueOrThrow({ where: { idExemplar: e.id } }))
        .situacao,
    ).toBe("EMPRESTADO");
  });
  it("devolução atualiza empréstimo e disponibilidade, sem desfazer nova retirada em repetição", async () => {
    const { b, e } = await fixture(),
      l = await loan(e.id);
    expect((await bookDetail(db, await actor(userId), b.id)).disponiveis).toBe(
      0,
    );
    await save("devolver", { emprestimoId: l.id });
    let row = await db.emprestimo.findUniqueOrThrow({
      where: { idEmprestimo: l.id },
    });
    expect(row.situacao).toBe("DEVOLVIDO");
    expect(row.dataDevolucao).not.toBeNull();
    expect((await bookDetail(db, await actor(userId), b.id)).disponiveis).toBe(
      1,
    );
    const next = await loan(e.id, peerStudent);
    await save("devolver", { emprestimoId: l.id });
    row = await db.emprestimo.findUniqueOrThrow({
      where: { idEmprestimo: next.id },
    });
    expect(row.dataDevolucao).toBeNull();
    expect(
      (await db.exemplar.findUniqueOrThrow({ where: { idExemplar: e.id } }))
        .situacao,
    ).toBe("EMPRESTADO");
    expect(
      await db.eventoAdministrativo.count({
        where: { acao: "EMPRESTIMO_DEVOLVIDO", registroId: String(l.id) },
      }),
    ).toBe(1);
  });
  it("um exemplar permite vários empréstimos históricos e exemplares distintos circulam simultaneamente", async () => {
    const { b, e } = await fixture(),
      l = await loan(e.id);
    await save("devolver", { emprestimoId: l.id });
    const second = await save("exemplares", {
      codigo: prefix + randomUUID(),
      livroId: b.id,
      situacao: "DISPONIVEL",
      ativo: true,
    });
    await Promise.all([loan(e.id), loan(second.id)]);
    expect(await db.emprestimo.count({ where: { exemplarId: e.id } })).toBe(2);
    expect(
      await db.emprestimo.count({
        where: { exemplar: { livroId: b.id }, dataDevolucao: null },
      }),
    ).toBe(2);
  });
  it("bloqueia aluno, categoria, livro ou exemplar inativos e exemplar indisponível", async () => {
    const { c, b, e } = await fixture();
    await db.aluno.update({
      where: { idAluno: ownStudent },
      data: { ativo: false },
    });
    try {
      await expect(loan(e.id)).rejects.toMatchObject({ status: 409 });
      await expect(reserve(b.id)).rejects.toMatchObject({ status: 409 });
    } finally {
      await db.aluno.update({
        where: { idAluno: ownStudent },
        data: { ativo: true },
      });
    }
    for (const target of ["categoria", "livro", "exemplar"] as const) {
      if (target === "categoria")
        await db.categoria.update({
          where: { idCategoria: c.id },
          data: { ativo: false },
        });
      if (target === "livro")
        await db.livro.update({
          where: { idLivro: b.id },
          data: { ativo: false },
        });
      if (target === "exemplar")
        await db.exemplar.update({
          where: { idExemplar: e.id },
          data: { ativo: false },
        });
      await expect(loan(e.id)).rejects.toMatchObject({ status: 409 });
      expect(
        (await bookDetail(db, await actor(rootId), b.id)).disponiveis,
      ).toBe(0);
      if (target === "categoria")
        await db.categoria.update({
          where: { idCategoria: c.id },
          data: { ativo: true },
        });
      if (target === "livro")
        await db.livro.update({
          where: { idLivro: b.id },
          data: { ativo: true },
        });
      if (target === "exemplar")
        await db.exemplar.update({
          where: { idExemplar: e.id },
          data: { ativo: true },
        });
    }
    await db.exemplar.update({
      where: { idExemplar: e.id },
      data: { situacao: "INDISPONIVEL" },
    });
    await expect(loan(e.id)).rejects.toMatchObject({ status: 409 });
  });
  it("devolve mesmo após inativação de livro categoria e aluno", async () => {
    const { c, b, e } = await fixture(),
      l = await loan(e.id);
    await db.categoria.update({
      where: { idCategoria: c.id },
      data: { ativo: false },
    });
    await db.livro.update({ where: { idLivro: b.id }, data: { ativo: false } });
    await db.aluno.update({
      where: { idAluno: ownStudent },
      data: { ativo: false },
    });
    try {
      await save("devolver", { emprestimoId: l.id });
      expect(
        (
          await db.emprestimo.findUniqueOrThrow({
            where: { idEmprestimo: l.id },
          })
        ).situacao,
      ).toBe("DEVOLVIDO");
      expect(
        (await bookDetail(db, await actor(userId), b.id)).disponiveis,
      ).toBe(0);
    } finally {
      await db.aluno.update({
        where: { idAluno: ownStudent },
        data: { ativo: true },
      });
    }
  });
  it("impede alterar disponibilidade de exemplar emprestado e trocar seu livro após histórico", async () => {
    const { b, e } = await fixture();
    const old = await db.exemplar.findUniqueOrThrow({
        where: { idExemplar: e.id },
      }),
      input = { id: e.id, codigo: old.codigo, livroId: b.id, ativo: true };
    await expect(
      save("exemplares", { ...input, situacao: "EMPRESTADO" }),
    ).rejects.toMatchObject({ status: 409 });
    const l = await loan(e.id);
    await expect(
      save("exemplares", { ...input, situacao: "DISPONIVEL" }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      save("exemplares", { ...input, situacao: "EMPRESTADO", ativo: false }),
    ).rejects.toMatchObject({ status: 409 });
    await save("exemplares", {
      ...input,
      situacao: "EMPRESTADO",
      localizacao: "Balcão",
    });
    await save("devolver", { emprestimoId: l.id });
    const other = await fixture();
    await expect(
      save("exemplares", {
        ...input,
        livroId: other.b.id,
        situacao: "DISPONIVEL",
      }),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("reservas não bloqueiam disponibilidade nem impedem retirada de outro aluno", async () => {
    const { b, e } = await fixture();
    await reserve(b.id);
    expect((await bookDetail(db, await actor(userId), b.id)).disponiveis).toBe(
      1,
    );
    await expect(reserve(b.id)).rejects.toMatchObject({ status: 409 });
    await loan(e.id, peerStudent);
    expect(
      (await list("reservas", userId, { livroId: String(b.id) })).total,
    ).toBe(1);
  });
  it("atendimento exige empréstimo do livro para o aluno e encerramentos são idempotentes auditados", async () => {
    const { b, e } = await fixture(),
      r = await reserve(b.id);
    await expect(
      save("situacao-reserva", { reservaId: r.id, situacao: "ATENDIDA" }),
    ).rejects.toMatchObject({ status: 409 });
    await loan(e.id);
    await save("situacao-reserva", { reservaId: r.id, situacao: "ATENDIDA" });
    await save("situacao-reserva", { reservaId: r.id, situacao: "ATENDIDA" });
    await expect(
      save("situacao-reserva", { reservaId: r.id, situacao: "CANCELADA" }),
    ).rejects.toMatchObject({ status: 409 });
    expect(
      await db.eventoAdministrativo.count({
        where: { acao: "RESERVA_ATENDIDA", registroId: String(r.id) },
      }),
    ).toBe(1);
    const r2 = await reserve(b.id);
    await save("situacao-reserva", { reservaId: r2.id, situacao: "CANCELADA" });
    expect(
      (await db.reserva.findUniqueOrThrow({ where: { idReserva: r2.id } }))
        .situacao,
    ).toBe("CANCELADA");
  });
  it("expiração é calculada sem mutação no GET e registrada somente após vencer", async () => {
    const { b } = await fixture(),
      r = await reserve(b.id);
    await expect(
      save("situacao-reserva", { reservaId: r.id, situacao: "EXPIRADA" }),
    ).rejects.toMatchObject({ status: 409 });
    await db.$executeRaw`UPDATE reserva SET data_reserva=clock_timestamp()-interval '2 days',data_expiracao=clock_timestamp()-interval '1 day' WHERE id_reserva=${r.id}`;
    const items = await list("reservas", userId, {
      livroId: String(b.id),
      status: "EXPIRADA",
    });
    expect(items.total).toBe(1);
    expect(
      (await db.reserva.findUniqueOrThrow({ where: { idReserva: r.id } }))
        .situacao,
    ).toBe("ATIVA");
    expect(
      (
        await list("reservas", userId, {
          livroId: String(b.id),
          status: "ATIVA",
        })
      ).total,
    ).toBe(0);
    await expect(
      save("situacao-reserva", { reservaId: r.id, situacao: "ATENDIDA" }),
    ).rejects.toMatchObject({ status: 409 });
    await save("situacao-reserva", { reservaId: r.id, situacao: "EXPIRADA" });
    expect(
      (await db.reserva.findUniqueOrThrow({ where: { idReserva: r.id } }))
        .situacao,
    ).toBe("EXPIRADA");
    await reserve(b.id);
  });
  it("usuário recebe somente seu histórico e acervo não informa quem tomou emprestado", async () => {
    const { b, e } = await fixture();
    await loan(e.id, peerStudent);
    await reserve(b.id, peerStudent);
    const queries = { livroId: String(b.id) };
    expect((await list("emprestimos", userId, queries)).total).toBe(0);
    expect((await list("reservas", userId, queries)).total).toBe(0);
    expect((await list("emprestimos", peerId, queries)).total).toBe(1);
    await expect(
      list("emprestimos", userId, { alunoId: String(peerStudent) }),
    ).rejects.toMatchObject({ status: 403 });
    const dto = await bookDetail(db, await actor(userId), b.id);
    expect(JSON.stringify(dto)).not.toContain(prefix + "peer");
    expect(JSON.stringify(dto)).not.toContain("usuarioId");
    expect(
      JSON.stringify(await libraryOptions(db, await actor(adminId))),
    ).not.toContain("senhaHash");
  });
  it("livro inativo sai do catálogo e só é consultado por gestor ou dono do histórico", async () => {
    const { b, e } = await fixture();
    await loan(e.id);
    await db.livro.update({ where: { idLivro: b.id }, data: { ativo: false } });
    expect(
      (
        await list("livros", userId, {
          busca: (
            await db.livro.findUniqueOrThrow({ where: { idLivro: b.id } })
          ).titulo,
        })
      ).total,
    ).toBe(0);
    await expect(
      bookDetail(db, await actor(peerId), b.id),
    ).rejects.toMatchObject({ status: 404 });
    expect((await bookDetail(db, await actor(userId), b.id)).ativo).toBe(false);
    expect(
      (await list("emprestimos", userId, { livroId: String(b.id) })).total,
    ).toBe(1);
  });
  it("busca por ISBN ou autor, filtro de disponibilidade e atraso são feitos no servidor", async () => {
    const { b, e } = await fixture();
    await db.livro.update({
      where: { idLivro: b.id },
      data: { isbn: prefix + "isbn", autor: prefix + "autora" },
    });
    expect(
      (
        await list("livros", userId, {
          busca: prefix + "isbn",
          status: "DISPONIVEL",
        })
      ).total,
    ).toBe(1);
    expect(
      (await list("livros", userId, { busca: prefix + "autora" })).total,
    ).toBe(1);
    const l = await loan(e.id);
    await db.$executeRaw`UPDATE emprestimo SET data_emprestimo=clock_timestamp()-interval '2 days',data_prevista_devolucao=clock_timestamp()-interval '1 day' WHERE id_emprestimo=${l.id}`;
    expect(
      (
        await list("emprestimos", userId, {
          livroId: String(b.id),
          status: "ATRASADO",
        })
      ).total,
    ).toBe(1);
    expect(
      (
        await list("livros", userId, {
          busca: prefix + "isbn",
          status: "DISPONIVEL",
        })
      ).total,
    ).toBe(0);
  });
  it("rejeita datas passadas e campos forjados sem gravar operações", async () => {
    const { b, e } = await fixture();
    await expect(
      save("emprestimos", {
        alunoId: ownStudent,
        exemplarId: e.id,
        dataPrevistaDevolucao: "2020-01-01T08:00",
      }),
    ).rejects.toThrow("posterior");
    await expect(
      save("reservas", {
        alunoId: ownStudent,
        livroId: b.id,
        dataExpiracao: "2020-01-01T08:00",
      }),
    ).rejects.toThrow("posterior");
    await expect(
      save("devolver", { emprestimoId: 1, exemplarId: e.id }),
    ).rejects.toThrow();
    expect(await db.emprestimo.count({ where: { exemplarId: e.id } })).toBe(0);
  });
  it("revogação de módulo é checada novamente dentro da transação", async () => {
    const { e } = await fixture();
    await db.grupoModulo.update({
      where: { grupoId_moduloId: { grupoId: groups[1], moduloId: moduleId } },
      data: { habilitado: false },
    });
    try {
      await expect(
        save(
          "emprestimos",
          {
            alunoId: ownStudent,
            exemplarId: e.id,
            dataPrevistaDevolucao: future(),
          },
          adminId,
        ),
      ).rejects.toMatchObject({ status: 403 });
    } finally {
      await db.grupoModulo.update({
        where: { grupoId_moduloId: { grupoId: groups[1], moduloId: moduleId } },
        data: { habilitado: true },
      });
    }
  });
});
