import { z } from "zod";
const id = z.number().int().positive();
const nome = z
  .string()
  .trim()
  .min(2, "Informe um nome com pelo menos 2 caracteres.")
  .max(120);
const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => v || null);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data válida.")
  .refine((v) => {
    const d = new Date(v + "T12:00:00Z");
    return !isNaN(d.valueOf()) && d.toISOString().slice(0, 10) === v;
  }, "Data inválida.");
const optionalDate = z
  .union([date, z.literal(""), z.null()])
  .optional()
  .transform((v) => v || null);
const email = text(254).refine(
  (v) => v === null || z.email().safeParse(v).success,
  "E-mail inválido.",
);
export function validCpf(value: string) {
  if (!/^\d{11}$/.test(value) || /^(\d)\1{10}$/.test(value)) return false;
  for (let length = 9; length < 11; length++) {
    let total = 0;
    for (let i = 0; i < length; i++)
      total += Number(value[i]) * (length + 1 - i);
    const digit = (total * 10) % 11;
    if (Number(value[length]) !== (digit === 10 ? 0 : digit)) return false;
  }
  return true;
}
export const studentSchema = z
  .object({
    id: id.optional(),
    nome,
    matricula: z.string().trim().min(1, "Informe a matrícula.").max(40),
    dataNascimento: optionalDate,
    email,
    telefone: text(30),
    endereco: text(300),
    dataMatricula: date,
    turmaId: id,
    status: z.enum(["MATRICULADO", "TRANCADO", "CONCLUIDO", "CANCELADO"]),
    ativo: z.boolean(),
    usuarioId: id.nullable().optional(),
    confirmacaoSenha: z.string().max(128).optional(),
  })
  .strict()
  .refine(
    (v) =>
      !v.dataNascimento ||
      v.dataNascimento <= new Date().toISOString().slice(0, 10),
    {
      message: "Nascimento não pode estar no futuro.",
      path: ["dataNascimento"],
    },
  );
export const classSchema = z
  .object({
    id: id.optional(),
    nome,
    descricao: text(1000),
    ano: z.number().int().min(1900).max(9999),
    periodo: z.string().trim().min(1).max(50),
    capacidade: z
      .number()
      .int()
      .min(1, "Capacidade deve ser positiva.")
      .max(10000),
    ativo: z.boolean(),
  })
  .strict();
export const responsibleSchema = z
  .object({
    id: id.optional(),
    nome,
    cpf: text(20)
      .transform((v) => v?.replace(/\D/g, "") || null)
      .refine((v) => !v || validCpf(v), "CPF inválido."),
    telefone: text(30),
    email,
    endereco: text(300),
    parentesco: text(60),
    ativo: z.boolean(),
  })
  .strict()
  .refine((v) => !!(v.email || v.telefone), {
    message: "Informe telefone ou e-mail do responsável.",
    path: ["telefone"],
  });
export const linkSchema = z
  .object({
    alunoId: id,
    responsavelId: id,
    parentesco: z.string().trim().max(60),
    remover: z.boolean().optional(),
  })
  .strict();
export const occurrenceSchema = z
  .object({
    id: id.optional(),
    alunoId: id,
    tipo: z.string().trim().min(2).max(80),
    descricao: z.string().trim().min(3).max(5000),
    dataOcorrencia: date,
    status: z.enum(["REGISTRADA", "EM_ACOMPANHAMENTO", "CONCLUIDA"]),
    ativo: z.boolean(),
  })
  .strict();
export const uploadSchema = z
  .object({
    alunoId: id,
    tipo: z.string().trim().min(2).max(80),
    descricao: text(1000),
  })
  .strict();
export const documentSchema = z
  .object({
    id,
    status: z.enum(["RECEBIDO", "VALIDADO", "REJEITADO", "ARQUIVADO"]),
    ativo: z.boolean(),
  })
  .strict();
export const asDate = (v: string) => new Date(v + "T12:00:00Z");
