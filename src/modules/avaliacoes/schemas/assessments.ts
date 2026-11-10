import { z } from "zod";
import { brazilDateTime } from "@/lib/academic-time";
const id = z.number().int().positive();
const optionalText = z
  .string()
  .trim()
  .max(2000)
  .nullable()
  .optional()
  .transform((v) => v || null);
export const assessmentSchema = z
  .object({
    id: id.optional(),
    titulo: z.string().trim().min(2).max(160),
    descricao: optionalText,
    tipo: z.string().trim().min(2).max(80),
    dataAplicacao: z.string().refine((v) => {
      try {
        brazilDateTime(v);
        return true;
      } catch {
        return false;
      }
    }, "Data e hora inválidas."),
    tempoLimite: z.number().int().min(1).max(1440),
    ativo: z.boolean(),
  })
  .strict();
export const questionSchema = z
  .object({
    id: id.optional(),
    avaliacaoId: id,
    enunciado: z.string().trim().min(2).max(5000),
    tipo: z.enum(["OBJETIVA", "DISCURSIVA"]),
    pontuacao: z.number().int().min(1).max(10000),
    alternativaA: optionalText,
    alternativaB: optionalText,
    alternativaC: optionalText,
    alternativaD: optionalText,
    alternativaCorreta: z.enum(["A", "B", "C", "D"]).nullable().optional(),
    ativo: z.boolean(),
  })
  .strict()
  .superRefine((v, c) => {
    if (
      v.tipo === "OBJETIVA" &&
      (!v.alternativaA ||
        !v.alternativaB ||
        !v.alternativaC ||
        !v.alternativaD ||
        !v.alternativaCorreta)
    )
      c.addIssue({
        code: "custom",
        message: "Informe as quatro alternativas e o gabarito.",
      });
    if (
      v.tipo === "DISCURSIVA" &&
      (v.alternativaCorreta ||
        v.alternativaA ||
        v.alternativaB ||
        v.alternativaC ||
        v.alternativaD)
    )
      c.addIssue({
        code: "custom",
        message: "Questões discursivas não têm alternativas.",
      });
  });
export const startSchema = z.object({ avaliacaoId: id }).strict();
export const attemptSchema = z.object({ tentativaId: id }).strict();
export const answersSchema = z
  .object({
    tentativaId: id,
    respostas: z
      .array(
        z
          .object({
            questaoId: id,
            texto: z.string().trim().max(5000).nullable().optional(),
            alternativaSelecionada: z
              .enum(["A", "B", "C", "D"])
              .nullable()
              .optional(),
          })
          .strict(),
      )
      .max(100),
  })
  .strict();
export const correctionSchema = z
  .object({
    respostaId: id,
    pontuacao: z
      .number()
      .finite()
      .min(0)
      .max(10000)
      .refine(
        (v) => Math.abs(v * 100 - Math.round(v * 100)) < 0.000001,
        "Use no máximo duas casas decimais.",
      ),
    comentario: optionalText,
  })
  .strict();
