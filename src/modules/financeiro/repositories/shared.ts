import { Prisma } from "@/generated/prisma/client";
import type { DatabaseClient } from "@/lib/database-client";
import {
  AppError,
  isManager,
  type Actor,
} from "@/modules/core/contracts/access";
import { reportSchema } from "../schemas/finance";
import { dayDate } from "../services/money";
export const chargeInclude = {
  aluno: { select: { nome: true, matricula: true } },
  plano: { select: { nome: true } },
} as const;
export function filterId(query: URLSearchParams, key: string) {
  const value = query.get(key);
  if (!value) return undefined;
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0 || id > 2147483647)
    throw new AppError("Filtro inválido.");
  return id;
}
export function chargeFilters(
  query: URLSearchParams,
  actor: Actor,
  today: string,
  includeStatus = true,
): Prisma.CobrancaWhereInput {
  const manager = isManager(actor),
    alunoId = filterId(query, "alunoId"),
    planoId = filterId(query, "planoId"),
    cobrancaId = filterId(query, "cobrancaId");
  if (!manager && alunoId)
    throw new AppError("Filtro de aluno é administrativo.", 403);
  const { inicio, fim } = reportSchema.parse({
      inicio: query.get("inicio") || undefined,
      fim: query.get("fim") || undefined,
    }),
    status = includeStatus ? query.get("status") || "" : "",
    busca = (query.get("busca") || "").trim().slice(0, 120);
  if (
    status &&
    !["PENDENTE", "PARCIAL", "PAGA", "CANCELADA", "VENCIDA"].includes(status)
  )
    throw new AppError("Situação inválida.");
  return {
    ...(manager ? { alunoId } : { aluno: { usuarioId: actor.id } }),
    planoId,
    idCobranca: cobrancaId,
    ...(inicio || fim
      ? {
          dataEmissao: {
            ...(inicio ? { gte: dayDate(inicio) } : {}),
            ...(fim ? { lte: dayDate(fim) } : {}),
          },
        }
      : {}),
    ...(status === "VENCIDA"
      ? {
          ativo: true,
          status: { in: ["PENDENTE", "PARCIAL"] },
          dataVencimento: { lt: dayDate(today) },
        }
      : status
        ? { status: status as "PENDENTE" | "PARCIAL" | "PAGA" | "CANCELADA" }
        : {}),
    ...(busca
      ? {
          OR: [
            { plano: { nome: { contains: busca, mode: "insensitive" } } },
            { aluno: { nome: { contains: busca, mode: "insensitive" } } },
            { aluno: { matricula: { contains: busca, mode: "insensitive" } } },
            ...(/^\d+$/.test(busca) && Number(busca) <= 2147483647
              ? [{ idCobranca: Number(busca) }]
              : []),
          ],
        }
      : {}),
  };
}
export async function paymentTotals(db: DatabaseClient, ids: number[]) {
  const rows = await db.pagamento.groupBy({
    by: ["cobrancaId"],
    where: { cobrancaId: { in: ids }, ativo: true, status: "CONFIRMADO" },
    _sum: { valor: true },
  });
  return new Map(
    rows.map((r) => [r.cobrancaId, r._sum.valor || new Prisma.Decimal(0)]),
  );
}
export function chargeRow(
  row: Prisma.CobrancaGetPayload<{ include: typeof chargeInclude }>,
  paid: Prisma.Decimal,
  today: string,
) {
  const due = row.dataVencimento.toISOString().slice(0, 10),
    vencida =
      row.ativo && ["PENDENTE", "PARCIAL"].includes(row.status) && due < today;
  return {
    id: row.idCobranca,
    alunoId: row.alunoId,
    aluno: row.aluno.nome,
    matricula: row.aluno.matricula,
    planoId: row.planoId,
    plano: row.plano.nome,
    dataEmissao: row.dataEmissao.toISOString().slice(0, 10),
    dataVencimento: due,
    valorOriginal: row.valorOriginal.toFixed(2),
    valorFinal: row.valorFinal.toFixed(2),
    pago: paid.toFixed(2),
    saldo:
      row.status === "CANCELADA"
        ? "0.00"
        : Prisma.Decimal.max(0, row.valorFinal.minus(paid)).toFixed(2),
    status: row.status,
    situacao: vencida ? "VENCIDA" : row.status,
    ativo: row.ativo,
    descontoTipoAplicado: row.descontoTipoAplicado,
    descontoPercentualAplicado:
      row.descontoPercentualAplicado?.toFixed(2) || null,
    descontoValorAplicado: row.descontoValorAplicado?.toFixed(2) || null,
  };
}
