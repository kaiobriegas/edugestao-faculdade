import { z } from "zod";
const id = z.number().int().positive();
const nome = z
  .string()
  .trim()
  .min(2, "Informe pelo menos 2 caracteres.")
  .max(120);
const descricao = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .nullable()
  .transform((v) => v || null);
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.")
  .refine((v) => {
    const d = new Date(v + "T12:00:00Z");
    return !isNaN(d.valueOf()) && d.toISOString().slice(0, 10) === v;
  }, "Data inválida.");
import { brazilDateTime } from "@/lib/academic-time";
export { brazilDateTime, localLessonTime } from "@/lib/academic-time";
export const courseSchema = z
  .object({
    id: id.optional(),
    nome,
    descricao,
    cargaHoraria: z
      .number()
      .int()
      .min(1, "Carga horária deve ser positiva.")
      .max(10000),
    ativo: z.boolean(),
  })
  .strict();
export const teacherSchema = z
  .object({
    id: id.optional(),
    nome,
    email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
    especialidade: z
      .string()
      .trim()
      .max(200)
      .optional()
      .nullable()
      .transform((v) => v || null),
    ativo: z.boolean(),
  })
  .strict();
const lessonTime = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Informe data e hora de Brasília.")
  .refine((v) => {
    try {
      brazilDateTime(v);
      return true;
    } catch {
      return false;
    }
  }, "Data e hora inválidas.");
export const lessonSchema = z
  .object({
    id: id.optional(),
    titulo: nome,
    descricao,
    dataHora: lessonTime,
    duracao: z.number().int().min(1, "Duração deve ser positiva.").max(86400),
    cursoId: id,
    professorId: id,
    ativo: z.boolean(),
  })
  .strict();
export const enrollmentSchema = z
  .object({
    id: id.optional(),
    alunoId: id,
    cursoId: id,
    dataMatricula: day,
    status: z.enum(["ATIVA", "CONCLUIDA", "CANCELADA"]),
    ativo: z.boolean(),
    justificativa: z.string().trim().max(1000).optional(),
    confirmacaoSenha: z.string().max(128).optional(),
  })
  .strict();
