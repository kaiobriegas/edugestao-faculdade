import { z } from "zod";
import { brazilDateTime } from "@/lib/academic-time";
const id = z.number().int().positive(),
  text = z.string().trim().min(2).max(160);
const optional = z
  .string()
  .trim()
  .max(2000)
  .nullable()
  .optional()
  .transform((v) => v || null);
const date = z
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
}, "Informe data e hora válidas de Brasília.");
export const categorySchema = z
  .object({
    id: id.optional(),
    nome: text,
    descricao: optional,
    ativo: z.boolean(),
  })
  .strict();
export const bookSchema = z
  .object({
    id: id.optional(),
    titulo: text,
    autor: text,
    editora: z
      .string()
      .trim()
      .max(160)
      .nullable()
      .optional()
      .transform((v) => v || null),
    anoPublicacao: z.number().int().min(1).max(9999).nullable().optional(),
    isbn: z
      .string()
      .trim()
      .max(40)
      .nullable()
      .optional()
      .transform((v) => v || null),
    descricao: optional,
    categoriaId: id,
    ativo: z.boolean(),
  })
  .strict();
export const copySchema = z
  .object({
    id: id.optional(),
    codigo: z.string().trim().min(1).max(80),
    livroId: id,
    situacao: z.enum(["DISPONIVEL", "INDISPONIVEL", "EMPRESTADO"]),
    dataAquisicao: date.nullable().optional(),
    localizacao: z
      .string()
      .trim()
      .max(160)
      .nullable()
      .optional()
      .transform((v) => v || null),
    ativo: z.boolean(),
  })
  .strict();
export const loanSchema = z
  .object({ alunoId: id, exemplarId: id, dataPrevistaDevolucao: time })
  .strict();
export const returnSchema = z.object({ emprestimoId: id }).strict();
export const reservationSchema = z
  .object({ alunoId: id, livroId: id, dataExpiracao: time })
  .strict();
export const reservationStatusSchema = z
  .object({
    reservaId: id,
    situacao: z.enum(["ATENDIDA", "CANCELADA", "EXPIRADA"]),
  })
  .strict();
