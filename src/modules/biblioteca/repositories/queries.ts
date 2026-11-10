import type { DatabaseClient } from "@/lib/database-client";
import type { Prisma } from "@/generated/prisma/client";
import {
  AppError,
  isManager,
  type Actor,
} from "@/modules/core/contracts/access";
import { readListQuery } from "@/modules/core/schemas/core";
import { libraryAccess } from "../services/access";
import {
  availableCopy,
  libraryClock,
  reservationState,
} from "../services/policy";
function filterId(query: URLSearchParams, key: string) {
  const value = query.get(key);
  if (!value) return undefined;
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0)
    throw new AppError("Filtro inválido.");
  return id;
}
export async function libraryOptions(db: DatabaseClient, actor: Actor) {
  libraryAccess(actor, true);
  const [categorias, livros, exemplares, alunos] = await Promise.all([
    db.categoria.findMany({
      take: 1000,
      orderBy: { nome: "asc" },
      select: { idCategoria: true, nome: true, ativo: true },
    }),
    db.livro.findMany({
      take: 1000,
      orderBy: { titulo: "asc" },
      select: {
        idLivro: true,
        titulo: true,
        ativo: true,
        categoria: { select: { ativo: true } },
      },
    }),
    db.exemplar.findMany({
      take: 1000,
      where: availableCopy,
      orderBy: { codigo: "asc" },
      select: {
        idExemplar: true,
        codigo: true,
        livro: { select: { titulo: true } },
      },
    }),
    db.aluno.findMany({
      take: 1000,
      orderBy: { nome: "asc" },
      select: { idAluno: true, nome: true, matricula: true, ativo: true },
    }),
  ]);
  return {
    categorias: categorias.map((c) => ({
      id: c.idCategoria,
      nome: c.nome,
      ativo: c.ativo,
    })),
    livros: livros.map((l) => ({
      id: l.idLivro,
      nome: l.titulo,
      ativo: l.ativo && l.categoria.ativo,
    })),
    exemplares: exemplares.map((e) => ({
      id: e.idExemplar,
      nome: `${e.codigo} · ${e.livro.titulo}`,
      ativo: true,
    })),
    alunos: alunos.map((a) => ({
      id: a.idAluno,
      nome: `${a.nome} · ${a.matricula}`,
      ativo: a.ativo,
    })),
  };
}
export async function libraryList(
  db: DatabaseClient,
  actor: Actor,
  resource: string,
  query: URLSearchParams,
) {
  libraryAccess(actor, resource === "categorias");
  const manager = isManager(actor),
    { pagina, busca, ativo } = readListQuery(query),
    skip = (pagina - 1) * 10,
    take = 10,
    livroId = filterId(query, "livroId"),
    alunoId = filterId(query, "alunoId"),
    categoriaId = filterId(query, "categoriaId");
  if (!manager && alunoId)
    throw new AppError("Filtro de aluno é administrativo.", 403);
  const status = query.get("status") || "",
    now = await libraryClock(db);
  if (resource === "categorias") {
    const where = {
      nome: { contains: busca, mode: "insensitive" as const },
      ativo,
    };
    const [rows, total] = await Promise.all([
      db.categoria.findMany({
        where,
        skip,
        take,
        orderBy: { idCategoria: "desc" },
      }),
      db.categoria.count({ where }),
    ]);
    return {
      pagina,
      total,
      items: rows.map((c) => ({
        id: c.idCategoria,
        nome: c.nome,
        descricao: c.descricao,
        ativo: c.ativo,
      })),
    };
  }
  if (resource === "livros") {
    const where: Prisma.LivroWhereInput = {
      categoriaId,
      OR: [
        { titulo: { contains: busca, mode: "insensitive" as const } },
        { autor: { contains: busca, mode: "insensitive" as const } },
        { isbn: { contains: busca, mode: "insensitive" as const } },
      ],
      ...(manager ? { ativo } : { ativo: true, categoria: { ativo: true } }),
      ...(status === "DISPONIVEL"
        ? { exemplarRegistros: { some: availableCopy } }
        : {}),
    };
    const [rows, total] = await Promise.all([
      db.livro.findMany({
        where,
        skip,
        take,
        orderBy: { idLivro: "desc" },
        include: {
          categoria: { select: { nome: true } },
          _count: { select: { exemplarRegistros: { where: availableCopy } } },
        },
      }),
      db.livro.count({ where }),
    ]);
    return {
      pagina,
      total,
      items: rows.map((l) => ({
        id: l.idLivro,
        titulo: l.titulo,
        autor: l.autor,
        editora: l.editora,
        anoPublicacao: l.anoPublicacao,
        isbn: l.isbn,
        descricao: l.descricao,
        categoriaId: l.categoriaId,
        categoria: l.categoria.nome,
        ativo: l.ativo,
        disponiveis: l._count.exemplarRegistros,
      })),
    };
  }
  if (resource === "exemplares") {
    if (
      status &&
      !["DISPONIVEL", "EMPRESTADO", "INDISPONIVEL"].includes(status)
    )
      throw new AppError("Situação inválida.");
    const where: Prisma.ExemplarWhereInput = {
      livroId,
      ...(manager
        ? { ativo }
        : { ativo: true, livro: { ativo: true, categoria: { ativo: true } } }),
      OR: [
        { codigo: { contains: busca, mode: "insensitive" as const } },
        {
          livro: { titulo: { contains: busca, mode: "insensitive" as const } },
        },
      ],
      ...(status === "DISPONIVEL"
        ? availableCopy
        : status
          ? { situacao: status as "EMPRESTADO" | "INDISPONIVEL" }
          : {}),
    };
    const [rows, total] = await Promise.all([
      db.exemplar.findMany({
        where,
        skip,
        take,
        orderBy: { idExemplar: "desc" },
        include: {
          livro: {
            select: {
              titulo: true,
              ativo: true,
              categoria: { select: { ativo: true } },
            },
          },
          _count: {
            select: { emprestimoRegistros: { where: { dataDevolucao: null } } },
          },
        },
      }),
      db.exemplar.count({ where }),
    ]);
    return {
      pagina,
      total,
      items: rows.map((e) => ({
        id: e.idExemplar,
        codigo: e.codigo,
        livroId: e.livroId,
        titulo: e.livro.titulo,
        situacao: e.situacao,
        localizacao: e.localizacao,
        dataAquisicao: e.dataAquisicao?.toISOString().slice(0, 10) || null,
        ativo: e.ativo,
        disponivel:
          e.ativo &&
          e.situacao === "DISPONIVEL" &&
          e.livro.ativo &&
          e.livro.categoria.ativo &&
          e._count.emprestimoRegistros === 0,
      })),
    };
  }
  if (resource === "emprestimos") {
    if (status && !["ABERTO", "DEVOLVIDO", "ATRASADO"].includes(status))
      throw new AppError("Situação inválida.");
    const where: Prisma.EmprestimoWhereInput = {
      ...(manager ? { alunoId } : { aluno: { usuarioId: actor.id } }),
      ...(livroId ? { exemplar: { livroId } } : {}),
      OR: [
        {
          exemplar: {
            codigo: { contains: busca, mode: "insensitive" as const },
          },
        },
        {
          exemplar: {
            livro: {
              titulo: { contains: busca, mode: "insensitive" as const },
            },
          },
        },
        ...(manager
          ? [
              {
                aluno: {
                  nome: { contains: busca, mode: "insensitive" as const },
                },
              },
              {
                aluno: {
                  matricula: { contains: busca, mode: "insensitive" as const },
                },
              },
            ]
          : []),
      ],
      ...(status === "ATRASADO"
        ? { dataDevolucao: null, dataPrevistaDevolucao: { lt: now } }
        : status === "ABERTO"
          ? { dataDevolucao: null }
          : status === "DEVOLVIDO"
            ? { dataDevolucao: { not: null } }
            : {}),
    };
    const [rows, total] = await Promise.all([
      db.emprestimo.findMany({
        where,
        skip,
        take,
        orderBy: { idEmprestimo: "desc" },
        include: {
          aluno: { select: { nome: true, matricula: true } },
          exemplar: {
            select: {
              codigo: true,
              livro: { select: { titulo: true, idLivro: true } },
            },
          },
        },
      }),
      db.emprestimo.count({ where }),
    ]);
    return {
      pagina,
      total,
      items: rows.map((e) => ({
        id: e.idEmprestimo,
        aluno: e.aluno.nome,
        matricula: e.aluno.matricula,
        titulo: e.exemplar.livro.titulo,
        livroId: e.exemplar.livro.idLivro,
        codigo: e.exemplar.codigo,
        dataEmprestimo: e.dataEmprestimo.toISOString(),
        dataPrevistaDevolucao: e.dataPrevistaDevolucao.toISOString(),
        dataDevolucao: e.dataDevolucao?.toISOString() || null,
        situacao: e.situacao,
        atrasado: !e.dataDevolucao && e.dataPrevistaDevolucao < now,
      })),
    };
  }
  if (resource === "reservas") {
    if (
      status &&
      !["ATIVA", "ATENDIDA", "CANCELADA", "EXPIRADA"].includes(status)
    )
      throw new AppError("Situação inválida.");
    const where: Prisma.ReservaWhereInput = {
      ...(manager ? { alunoId } : { aluno: { usuarioId: actor.id } }),
      livroId,
      AND: [
        {
          OR: [
            {
              livro: {
                titulo: { contains: busca, mode: "insensitive" as const },
              },
            },
            ...(manager
              ? [
                  {
                    aluno: {
                      nome: { contains: busca, mode: "insensitive" as const },
                    },
                  },
                  {
                    aluno: {
                      matricula: {
                        contains: busca,
                        mode: "insensitive" as const,
                      },
                    },
                  },
                ]
              : []),
          ],
        },
        ...(status === "ATIVA"
          ? [
              {
                situacao: "ATIVA" as const,
                dataExpiracao: { gt: now },
                ativo: true,
              },
            ]
          : status === "EXPIRADA"
            ? [
                {
                  OR: [
                    { situacao: "EXPIRADA" as const },
                    { situacao: "ATIVA" as const, dataExpiracao: { lte: now } },
                  ],
                },
              ]
            : status
              ? [{ situacao: status as "ATENDIDA" | "CANCELADA" }]
              : []),
      ],
    };
    const [rows, total] = await Promise.all([
      db.reserva.findMany({
        where,
        skip,
        take,
        orderBy: { idReserva: "desc" },
        include: {
          aluno: { select: { nome: true, matricula: true } },
          livro: { select: { titulo: true } },
        },
      }),
      db.reserva.count({ where }),
    ]);
    return {
      pagina,
      total,
      items: rows.map((r) => ({
        id: r.idReserva,
        aluno: r.aluno.nome,
        matricula: r.aluno.matricula,
        titulo: r.livro.titulo,
        livroId: r.livroId,
        dataReserva: r.dataReserva.toISOString(),
        dataExpiracao: r.dataExpiracao.toISOString(),
        situacao: reservationState(r, now),
        situacaoRegistrada: r.situacao,
        ativo: r.ativo,
      })),
    };
  }
  throw new AppError("Recurso não encontrado.", 404);
}

export async function libraryFilters(db: DatabaseClient, actor: Actor) {
  libraryAccess(actor);
  const rows = await db.categoria.findMany({
    where: { ativo: true },
    take: 1000,
    orderBy: { nome: "asc" },
    select: { idCategoria: true, nome: true },
  });
  return {
    categorias: rows.map((c) => ({
      id: c.idCategoria,
      nome: c.nome,
      ativo: true,
    })),
  };
}
