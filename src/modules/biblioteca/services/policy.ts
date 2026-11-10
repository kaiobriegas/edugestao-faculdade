import type { DatabaseClient } from "@/lib/database-client";
import type { Transaction } from "@/modules/core/services/auth";
import type { Prisma } from "@/generated/prisma/client";
export const availableCopy: Prisma.ExemplarWhereInput = {
  ativo: true,
  situacao: "DISPONIVEL",
  emprestimoRegistros: { none: { dataDevolucao: null } },
  livro: { ativo: true, categoria: { ativo: true } },
};
export async function libraryClock(db: DatabaseClient | Transaction) {
  const rows = await db.$queryRaw<
    { milliseconds: number }[]
  >`SELECT (extract(epoch FROM clock_timestamp())*1000)::double precision AS milliseconds`;
  return new Date(rows[0].milliseconds);
}
export function reservationState(
  row: { situacao: string; dataExpiracao: Date },
  now: Date,
) {
  return row.situacao === "ATIVA" && row.dataExpiracao <= now
    ? "EXPIRADA"
    : row.situacao;
}
