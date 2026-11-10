import { z } from "zod";
const email = z.string().trim().toLowerCase().max(254).pipe(z.email());
export const passwordSchema = z
  .string()
  .min(10, "Use pelo menos 10 caracteres na senha.")
  .max(128);
export const loginSchema = z
  .object({ email, senha: z.string().min(1).max(128) })
  .strict();
export const recoverySchema = z.object({ email }).strict();
export const resetSchema = z
  .object({ token: z.string().regex(/^[a-f0-9]{64}$/), senha: passwordSchema })
  .strict();
const nome = z.string().trim().min(2).max(120);
const descricao = z.string().trim().max(1000).default("");
const id = z.number().int().positive();
const credentials = {
  confirmacaoSenha: z.string().min(1, "Confirme sua senha atual.").max(128),
};
export const userSchema = z
  .object({
    id: id.optional(),
    nome,
    email,
    senha: passwordSchema.optional(),
    grupoId: id,
    papelId: id,
    ativo: z.boolean(),
    ...credentials,
  })
  .strict();
export const groupSchema = z
  .object({
    id: id.optional(),
    nome,
    descricao,
    ativo: z.boolean(),
    moduloIds: z.array(id).max(5),
    ...credentials,
  })
  .strict();
export const roleSchema = z.object({ id, descricao, ...credentials }).strict();
export const moduleSchema = z
  .object({ id, nome, descricao, ativo: z.boolean(), ...credentials })
  .strict();
export const profileSchema = z
  .object({ nome, email, novaSenha: passwordSchema.optional(), ...credentials })
  .strict();
export const bootstrapSchema = z
  .object({ nome, email, senha: passwordSchema, grupo: nome })
  .strict();
export function readListQuery(query: URLSearchParams) {
  const page = Number(query.get("pagina") || 1);
  const status = query.get("situacao") || "";
  return {
    pagina: Number.isInteger(page) && page > 0 ? Math.min(page, 10000) : 1,
    busca: (query.get("busca") || "").trim().slice(0, 120),
    ativo: status === "ativo" ? true : status === "inativo" ? false : undefined,
  };
}
