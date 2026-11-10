import { Prisma } from "@/generated/prisma/client";
import type { DatabaseClient } from "@/lib/database-client";
import { AppError } from "@/modules/core/contracts/access";
import { audit } from "@/modules/core/services/auth";
import { brazilDateTime } from "@/lib/academic-time";
import {
  chargeSchema,
  paymentSchema,
  reversalSchema,
  cancellationSchema,
} from "../schemas/finance";
import { freshFinanceActor } from "./access";
import { saveFinanceCatalog } from "./catalog";
import {
  brazilDay,
  dayDate,
  discountedTotal,
  paidTotal,
  chargeState,
  financeClock,
  recalculateCharge,
} from "./money";
export function createFinanceService(db: DatabaseClient) {
  return {
    async save(resource: string, actorId: number, input: unknown) {
      return db.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT true AS locked FROM pg_advisory_xact_lock(37108)`;
          const actor = await freshFinanceActor(tx, actorId, true),
            { now, today } = await financeClock(tx);
          if (["planos", "descontos"].includes(resource))
            return saveFinanceCatalog(tx, actor, resource, input);
          if (resource === "cobrancas") {
            const v = chargeSchema.parse(input);
            if (v.dataVencimento < today)
              throw new AppError("Vencimento não pode ser anterior à emissão.");
            await tx.$queryRaw`SELECT id_aluno FROM aluno WHERE id_aluno=${v.alunoId} FOR UPDATE`;
            const aluno = await tx.aluno.findUnique({
                where: { idAluno: v.alunoId },
              }),
              plan = await tx.planoFinanceiro.findUnique({
                where: { idPlano: v.planoId },
              });
            if (!aluno?.ativo || !plan?.ativo)
              throw new AppError("Escolha aluno e plano ativos.", 409);
            const discount = v.descontoId
              ? await tx.desconto.findUnique({
                  where: { idDesconto: v.descontoId },
                })
              : null;
            if (
              v.descontoId &&
              (!discount ||
                discount.alunoId !== v.alunoId ||
                !discount.ativo ||
                discount.dataInicio.toISOString().slice(0, 10) > today ||
                discount.dataFim.toISOString().slice(0, 10) < today)
            )
              throw new AppError(
                "Desconto inválido, fora da vigência ou de outro aluno.",
                409,
              );
            const valorFinal = discountedTotal(plan.valor, discount);
            const row = await tx.cobranca.create({
              data: {
                alunoId: v.alunoId,
                planoId: v.planoId,
                descontoId: discount?.idDesconto || null,
                dataEmissao: dayDate(today),
                dataVencimento: dayDate(v.dataVencimento),
                valorOriginal: plan.valor,
                valorFinal,
                descontoTipoAplicado: discount?.tipo || null,
                descontoValorAplicado: discount?.valor || null,
                descontoPercentualAplicado: discount?.percentual || null,
                status: chargeState(valorFinal, new Prisma.Decimal(0)),
              },
            });
            await audit(
              tx,
              actor.id,
              "COBRANCA_EMITIDA",
              "Cobranca",
              row.idCobranca,
              actor.grupoId,
            );
            return { id: row.idCobranca };
          }
          if (resource === "pagamentos") {
            const v = paymentSchema.parse(input),
              valor = new Prisma.Decimal(v.valor),
              date = brazilDateTime(v.dataPagamento);
            await tx.$queryRaw`SELECT id_cobranca FROM cobranca WHERE id_cobranca=${v.cobrancaId} FOR UPDATE`;
            const charge = await tx.cobranca.findUnique({
              where: { idCobranca: v.cobrancaId },
            });
            if (!charge) throw new AppError("Cobrança não encontrada.", 404);
            const old = await tx.pagamento.findUnique({
              where: {
                cobrancaId_chaveIdempotencia: {
                  cobrancaId: v.cobrancaId,
                  chaveIdempotencia: v.chaveIdempotencia,
                },
              },
            });
            if (old) {
              if (
                !old.valor.eq(valor) ||
                old.dataPagamento.valueOf() !== date.valueOf() ||
                old.formaPagamento !== v.formaPagamento ||
                old.comprovante !== v.comprovante
              )
                throw new AppError(
                  "Esta solicitação já foi usada com dados diferentes.",
                  409,
                );
              return {
                id: old.idPagamento,
                repetida: true,
                status: old.status,
              };
            }
            if (!charge.ativo || charge.status === "CANCELADA")
              throw new AppError("Cobrança cancelada ou inativa.", 409);
            if (
              date > now ||
              brazilDay(date) < charge.dataEmissao.toISOString().slice(0, 10)
            )
              throw new AppError(
                "Data do pagamento deve estar entre a emissão e o momento atual.",
              );
            const paid = await paidTotal(tx, v.cobrancaId),
              balance = charge.valorFinal.minus(paid);
            if (valor.gt(balance))
              throw new AppError("Pagamento excede o saldo da cobrança.", 409);
            const row = await tx.pagamento.create({
              data: {
                cobrancaId: v.cobrancaId,
                valor,
                dataPagamento: date,
                formaPagamento: v.formaPagamento,
                comprovante: v.comprovante,
                chaveIdempotencia: v.chaveIdempotencia,
              },
            });
            await recalculateCharge(tx, v.cobrancaId);
            await audit(
              tx,
              actor.id,
              "PAGAMENTO_REGISTRADO",
              "Pagamento",
              row.idPagamento,
              actor.grupoId,
            );
            return { id: row.idPagamento, status: row.status };
          }
          if (resource === "estornar") {
            const v = reversalSchema.parse(input),
              payment = await tx.pagamento.findUnique({
                where: { idPagamento: v.pagamentoId },
              });
            if (!payment) throw new AppError("Pagamento não encontrado.", 404);
            await tx.$queryRaw`SELECT id_cobranca FROM cobranca WHERE id_cobranca=${payment.cobrancaId} FOR UPDATE`;
            if (payment.status === "ESTORNADO")
              return { id: payment.idPagamento, repetida: true };
            await tx.pagamento.update({
              where: { idPagamento: payment.idPagamento },
              data: {
                status: "ESTORNADO",
                estornadoEm: now,
                motivoEstorno: v.motivo,
                estornadoPorId: actor.id,
              },
            });
            await recalculateCharge(tx, payment.cobrancaId);
            await audit(
              tx,
              actor.id,
              "PAGAMENTO_ESTORNADO",
              "Pagamento",
              payment.idPagamento,
              actor.grupoId,
            );
            return { id: payment.idPagamento };
          }
          if (resource === "cancelar") {
            const v = cancellationSchema.parse(input);
            await tx.$queryRaw`SELECT id_cobranca FROM cobranca WHERE id_cobranca=${v.cobrancaId} FOR UPDATE`;
            const row = await tx.cobranca.findUnique({
              where: { idCobranca: v.cobrancaId },
            });
            if (!row) throw new AppError("Cobrança não encontrada.", 404);
            if (row.status === "CANCELADA")
              return { id: row.idCobranca, repetida: true };
            if ((await paidTotal(tx, v.cobrancaId)).gt(0))
              throw new AppError(
                "Estorne os pagamentos confirmados antes de cancelar a cobrança.",
                409,
              );
            await tx.cobranca.update({
              where: { idCobranca: v.cobrancaId },
              data: { status: "CANCELADA" },
            });
            await tx.eventoAdministrativo.create({
              data: {
                atorUsuarioId: actor.id,
                acao: "COBRANCA_CANCELADA",
                entidade: "Cobranca",
                registroId: String(row.idCobranca),
                metadados: { grupoId: actor.grupoId, motivo: v.motivo },
              },
            });
            return { id: row.idCobranca };
          }
          throw new AppError("Operação não encontrada.", 404);
        },
        { timeout: 15000, maxWait: 10000 },
      );
    },
  };
}
