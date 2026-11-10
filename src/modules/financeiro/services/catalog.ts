import { Prisma } from "@/generated/prisma/client";
import { AppError, type Actor } from "@/modules/core/contracts/access";
import { audit, type Transaction } from "@/modules/core/services/auth";
import { planSchema, discountSchema } from "../schemas/finance";
import { dayDate } from "./money";
export async function saveFinanceCatalog(
  tx: Transaction,
  actor: Actor,
  resource: string,
  input: unknown,
) {
  if (resource === "planos") {
    const { id, ...v } = planSchema.parse(input),
      data = { ...v, valor: new Prisma.Decimal(v.valor) };
    const row = id
      ? await tx.planoFinanceiro.update({ where: { idPlano: id }, data })
      : await tx.planoFinanceiro.create({ data });
    await audit(
      tx,
      actor.id,
      id ? "PLANO_ATUALIZADO" : "PLANO_CRIADO",
      "PlanoFinanceiro",
      row.idPlano,
      actor.grupoId,
    );
    return { id: row.idPlano };
  }
  if (resource === "descontos") {
    const { id, ...v } = discountSchema.parse(input),
      old = id
        ? await tx.desconto.findUnique({ where: { idDesconto: id } })
        : null;
    if (id && !old) throw new AppError("Desconto não encontrado.", 404);
    if (old && old.alunoId !== v.alunoId)
      throw new AppError(
        "O aluno do desconto não pode ser trocado. Crie outro benefício.",
        409,
      );
    await tx.$queryRaw`SELECT id_aluno FROM aluno WHERE id_aluno=${v.alunoId} FOR UPDATE`;
    const aluno = await tx.aluno.findUnique({ where: { idAluno: v.alunoId } });
    if (!aluno || ((!old || (!old.ativo && v.ativo)) && !aluno.ativo))
      throw new AppError("Escolha um aluno ativo.", 409);
    const data = {
      ...v,
      percentual:
        v.tipo === "PERCENTUAL" ? new Prisma.Decimal(v.percentual!) : null,
      valor: v.tipo === "FIXO" ? new Prisma.Decimal(v.valor!) : null,
      dataInicio: dayDate(v.dataInicio),
      dataFim: dayDate(v.dataFim),
    };
    const row = id
      ? await tx.desconto.update({ where: { idDesconto: id }, data })
      : await tx.desconto.create({ data });
    await audit(
      tx,
      actor.id,
      id ? "DESCONTO_ATUALIZADO" : "DESCONTO_CRIADO",
      "Desconto",
      row.idDesconto,
      actor.grupoId,
    );
    return { id: row.idDesconto };
  }
  throw new AppError("Cadastro não encontrado.", 404);
}
