import { z } from "zod";
import { brazilDateTime } from "@/lib/academic-time";
const id = z.number().int().positive().max(2147483647),
  text = z.string().trim().min(2).max(160);
const optional = z
  .string()
  .trim()
  .max(2000)
  .nullable()
  .optional()
  .transform((v) => v || null);
export const moneySchema = z
  .string()
  .trim()
  .regex(
    /^\d{1,12}(\.\d{1,2})?$/,
    "Informe um valor com até duas casas decimais e ponto decimal.",
  );
const percent = moneySchema.refine(
  (v) => Number(v) <= 100,
  "Percentual deve estar entre 0 e 100.",
);
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(v + "T12:00:00Z");
    return !isNaN(d.valueOf()) && d.toISOString().slice(0, 10) === v;
  }, "Data inválida.");
const time = z.string().refine((v) => {
  try {
    brazilDateTime(v);
    return true;
  } catch {
    return false;
  }
}, "Data e hora inválidas.");
export const planSchema = z
  .object({
    id: id.optional(),
    nome: text,
    descricao: optional,
    valor: moneySchema,
    periodicidade: z.string().trim().min(2).max(80),
    ativo: z.boolean(),
  })
  .strict();
export const discountSchema = z
  .object({
    id: id.optional(),
    alunoId: id,
    descricao: text,
    tipo: z.enum(["PERCENTUAL", "FIXO"]),
    percentual: percent.nullable().optional(),
    valor: moneySchema.nullable().optional(),
    dataInicio: day,
    dataFim: day,
    ativo: z.boolean(),
  })
  .strict()
  .superRefine((v, c) => {
    if (v.dataFim < v.dataInicio)
      c.addIssue({
        code: "custom",
        message: "Fim da validade deve ser igual ou posterior ao início.",
      });
    if (
      (v.tipo === "PERCENTUAL" && (v.percentual == null || v.valor != null)) ||
      (v.tipo === "FIXO" && (v.valor == null || v.percentual != null))
    )
      c.addIssue({
        code: "custom",
        message: "Preencha somente o valor correspondente ao tipo de desconto.",
      });
  });
export const chargeSchema = z
  .object({
    alunoId: id,
    planoId: id,
    descontoId: id.nullable().optional(),
    dataVencimento: day,
  })
  .strict();
export const paymentSchema = z
  .object({
    cobrancaId: id,
    valor: moneySchema.refine(
      (v) => Number(v) > 0,
      "Pagamento deve ser positivo.",
    ),
    dataPagamento: time,
    formaPagamento: z.enum([
      "PIX",
      "DINHEIRO",
      "TRANSFERENCIA",
      "CARTAO",
      "OUTRO",
    ]),
    comprovante: z
      .string()
      .trim()
      .max(160)
      .nullable()
      .optional()
      .transform((v) => v || null),
    chaveIdempotencia: z.uuid(),
  })
  .strict();
export const reversalSchema = z
  .object({
    pagamentoId: id,
    motivo: z
      .string()
      .trim()
      .min(5, "Informe uma justificativa com pelo menos 5 caracteres.")
      .max(1000),
  })
  .strict();
export const cancellationSchema = z
  .object({
    cobrancaId: id,
    motivo: z
      .string()
      .trim()
      .min(5, "Informe uma justificativa com pelo menos 5 caracteres.")
      .max(1000),
  })
  .strict();
export const reportSchema = z
  .object({ inicio: day.optional(), fim: day.optional() })
  .refine((v) => !v.inicio || !v.fim || v.inicio <= v.fim, "Período inválido.");
