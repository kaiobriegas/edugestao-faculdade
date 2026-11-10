import { AppError } from "@/modules/core/contracts/access";
import { audit, type Transaction } from "@/modules/core/services/auth";
import type { Actor } from "@/modules/core/contracts/access";
import { categorySchema, bookSchema, copySchema } from "../schemas/library";
export async function saveCatalog(
  tx: Transaction,
  actor: Actor,
  resource: string,
  input: unknown,
) {
  if (resource === "categorias") {
    const { id, ...values } = categorySchema.parse(input);
    const row = id
      ? await tx.categoria.update({ where: { idCategoria: id }, data: values })
      : await tx.categoria.create({ data: values });
    await audit(
      tx,
      actor.id,
      id ? "CATEGORIA_ATUALIZADA" : "CATEGORIA_CRIADA",
      "Categoria",
      row.idCategoria,
      actor.grupoId,
    );
    return { id: row.idCategoria };
  }
  if (resource === "livros") {
    const { id, ...values } = bookSchema.parse(input);
    const category = await tx.categoria.findUnique({
      where: { idCategoria: values.categoriaId },
    });
    if (!category) throw new AppError("Categoria não encontrada.");
    const old = id
      ? await tx.livro.findUnique({ where: { idLivro: id } })
      : null;
    if (id && !old) throw new AppError("Livro não encontrado.", 404);
    if (
      (!old ||
        old.categoriaId !== values.categoriaId ||
        (!old.ativo && values.ativo)) &&
      !category.ativo
    )
      throw new AppError("Escolha uma categoria ativa.", 409);
    const row = id
      ? await tx.livro.update({ where: { idLivro: id }, data: values })
      : await tx.livro.create({ data: values });
    await audit(
      tx,
      actor.id,
      id ? "LIVRO_ATUALIZADO" : "LIVRO_CRIADO",
      "Livro",
      row.idLivro,
      actor.grupoId,
    );
    return { id: row.idLivro };
  }
  if (resource === "exemplares") {
    const { id, ...values } = copySchema.parse(input);
    const old = id
      ? await tx.exemplar.findUnique({ where: { idExemplar: id } })
      : null;
    if (id && !old) throw new AppError("Exemplar não encontrado.", 404);
    const book = await tx.livro.findUnique({
      where: { idLivro: values.livroId },
      include: { categoria: true },
    });
    if (!book) throw new AppError("Livro não encontrado.");
    if (
      (!old ||
        old.livroId !== values.livroId ||
        (!old.ativo && values.ativo)) &&
      (!book.ativo || !book.categoria.ativo)
    )
      throw new AppError("Escolha um livro e categoria ativos.", 409);
    const history = id
      ? await tx.emprestimo.count({ where: { exemplarId: id } })
      : 0;
    const open = id
      ? await tx.emprestimo.findFirst({
          where: { exemplarId: id, dataDevolucao: null },
        })
      : null;
    if (history && old?.livroId !== values.livroId)
      throw new AppError(
        "Exemplar com histórico não pode trocar de livro.",
        409,
      );
    if (open && (!values.ativo || values.situacao !== "EMPRESTADO"))
      throw new AppError(
        "Devolva o empréstimo antes de alterar a disponibilidade ou inativar o exemplar.",
        409,
      );
    if (!open && values.situacao === "EMPRESTADO")
      throw new AppError(
        "Use o registro de empréstimo para emprestar um exemplar.",
        409,
      );
    const data = {
      ...values,
      dataAquisicao: values.dataAquisicao
        ? new Date(values.dataAquisicao + "T12:00:00Z")
        : null,
    };
    const row = id
      ? await tx.exemplar.update({ where: { idExemplar: id }, data })
      : await tx.exemplar.create({ data });
    await audit(
      tx,
      actor.id,
      id ? "EXEMPLAR_ATUALIZADO" : "EXEMPLAR_CRIADO",
      "Exemplar",
      row.idExemplar,
      actor.grupoId,
    );
    return { id: row.idExemplar };
  }
  throw new AppError("Cadastro não encontrado.", 404);
}
