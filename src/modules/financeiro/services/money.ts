import { Prisma } from "@/generated/prisma/client";
import type { DatabaseClient } from "@/lib/database-client";
import type { Transaction } from "@/modules/core/services/auth";
export function discountedTotal(
  original: Prisma.Decimal,
  discount: {
    tipo: string;
    percentual: Prisma.Decimal | null;
    valor: Prisma.Decimal | null;
  } | null,
) {
  if (!discount) return original;
  const result =
    discount.tipo === "PERCENTUAL"
      ? original.mul(new Prisma.Decimal(1).minus(discount.percentual!.div(100)))
      : Prisma.Decimal.max(0, original.minus(discount.valor!));
  return result.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}
export const dayDate = (day: string) => new Date(day + "T12:00:00Z");
export const brazilDay = (date: Date) =>
  new Date(date.valueOf() - 3 * 3600000).toISOString().slice(0, 10);
export async function financeClock(db: DatabaseClient | Transaction) {
  const rows = await db.$queryRaw<
    { milliseconds: number }[]
  >`SELECT (extract(epoch FROM clock_timestamp())*1000)::double precision AS milliseconds`;
  const now = new Date(rows[0].milliseconds);
  return { now, today: brazilDay(now) };
}
export async function paidTotal(
  db: DatabaseClient | Transaction,
  cobrancaId: number,
) {
  const value = await db.pagamento.aggregate({
    where: { cobrancaId, ativo: true, status: "CONFIRMADO" },
    _sum: { valor: true },
  });
  return value._sum.valor || new Prisma.Decimal(0);
}
export function chargeState(total: Prisma.Decimal, paid: Prisma.Decimal) {
  return paid.gte(total)
    ? ("PAGA" as const)
    : paid.gt(0)
      ? ("PARCIAL" as const)
      : ("PENDENTE" as const);
}
export async function recalculateCharge(tx: Transaction, id: number) {
  const charge = await tx.cobranca.findUniqueOrThrow({
      where: { idCobranca: id },
    }),
    paid = await paidTotal(tx, id);
  if (charge.status !== "CANCELADA")
    await tx.cobranca.update({
      where: { idCobranca: id },
      data: { status: chargeState(charge.valorFinal, paid) },
    });
}
