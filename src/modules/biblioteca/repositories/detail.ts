import type { DatabaseClient } from "@/lib/database-client";
import {
  AppError,
  isManager,
  type Actor,
} from "@/modules/core/contracts/access";
import { libraryAccess } from "../services/access";
import { availableCopy } from "../services/policy";
export async function bookDetail(db: DatabaseClient, actor: Actor, id: number) {
  libraryAccess(actor);
  const manager = isManager(actor);
  const row = await db.livro.findFirst({
    where: {
      idLivro: id,
      ...(manager
        ? {}
        : {
            OR: [
              { ativo: true, categoria: { ativo: true } },
              {
                exemplarRegistros: {
                  some: {
                    emprestimoRegistros: {
                      some: { aluno: { usuarioId: actor.id } },
                    },
                  },
                },
              },
              {
                reservaRegistros: { some: { aluno: { usuarioId: actor.id } } },
              },
            ],
          }),
    },
    include: { categoria: { select: { nome: true, ativo: true } } },
  });
  if (!row) throw new AppError("Livro não encontrado ou não autorizado.", 404);
  const [copies, total, available] = await Promise.all([
    db.exemplar.findMany({
      where: { livroId: id, ...(manager ? {} : { ativo: true }) },
      take: 100,
      orderBy: { codigo: "asc" },
      include: {
        _count: {
          select: { emprestimoRegistros: { where: { dataDevolucao: null } } },
        },
      },
    }),
    db.exemplar.count({
      where: { livroId: id, ...(manager ? {} : { ativo: true }) },
    }),
    db.exemplar.count({ where: { ...availableCopy, livroId: id } }),
  ]);
  return {
    id: row.idLivro,
    titulo: row.titulo,
    autor: row.autor,
    editora: row.editora,
    anoPublicacao: row.anoPublicacao,
    isbn: row.isbn,
    descricao: row.descricao,
    categoria: row.categoria.nome,
    ativo: row.ativo && row.categoria.ativo,
    totalExemplares: total,
    disponiveis: available,
    exemplares: copies.map((c) => ({
      id: c.idExemplar,
      codigo: c.codigo,
      localizacao: c.localizacao,
      situacao: c.situacao,
      ativo: c.ativo,
      disponivel:
        c.ativo &&
        row.ativo &&
        row.categoria.ativo &&
        c.situacao === "DISPONIVEL" &&
        c._count.emprestimoRegistros === 0,
    })),
  };
}
export type BookDetail = Awaited<ReturnType<typeof bookDetail>>;
