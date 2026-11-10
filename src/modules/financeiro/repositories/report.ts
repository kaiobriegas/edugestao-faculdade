import { Prisma } from "@/generated/prisma/client";
import type { DatabaseClient } from "@/lib/database-client";
import type { Actor } from "@/modules/core/contracts/access";
import { financeAccess } from "../services/access";
import { financeClock, dayDate } from "../services/money";
import { chargeFilters } from "./shared";
export async function financialReport(
  db: DatabaseClient,
  actor: Actor,
  query: URLSearchParams,
) {
  financeAccess(actor, true);
  return db.$transaction(
    async (tx) => {
      const { today } = await financeClock(tx),
        base = chargeFilters(query, actor, today, false),
        where: Prisma.CobrancaWhereInput = {
          ...base,
          ativo: true,
          status: { not: "CANCELADA" },
        },
        overdue: Prisma.CobrancaWhereInput = {
          ...where,
          status: { in: ["PENDENTE", "PARCIAL"] },
          dataVencimento: { lt: dayDate(today) },
        };
      const [charges, payments, late, latePaid, states] = await Promise.all([
        tx.cobranca.aggregate({
          where,
          _sum: { valorFinal: true },
          _count: true,
        }),
        tx.pagamento.aggregate({
          where: { ativo: true, status: "CONFIRMADO", cobranca: where },
          _sum: { valor: true },
        }),
        tx.cobranca.aggregate({
          where: overdue,
          _sum: { valorFinal: true },
          _count: true,
        }),
        tx.pagamento.aggregate({
          where: { ativo: true, status: "CONFIRMADO", cobranca: overdue },
          _sum: { valor: true },
        }),
        tx.cobranca.groupBy({
          by: ["status"],
          where: { ...base, ativo: true },
          _count: true,
        }),
      ]);
      const zero = new Prisma.Decimal(0),
        total = charges._sum.valorFinal || zero,
        received = payments._sum.valor || zero;
      return {
        dataReferencia: today,
        cobrado: total.toFixed(2),
        recebido: received.toFixed(2),
        saldo: total.minus(received).toFixed(2),
        vencido: (late._sum.valorFinal || zero)
          .minus(latePaid._sum.valor || zero)
          .toFixed(2),
        quantidade: charges._count,
        quantidadeVencida: late._count,
        situacoes: states.map((s) => ({
          status: s.status,
          quantidade: s._count,
        })),
      };
    },
    { isolationLevel: "RepeatableRead" },
  );
}
export type FinancialReport = Awaited<ReturnType<typeof financialReport>>;
