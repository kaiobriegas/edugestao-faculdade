import { z } from "zod";
const postgresUrl = z
  .url()
  .refine(
    (value) => ["postgres:", "postgresql:"].includes(new URL(value).protocol),
    "Use uma URL PostgreSQL válida.",
  );
export const environmentSchema = z.object({
  DATABASE_URL: postgresUrl,
  APP_URL: z
    .url()
    .refine((value) => {
      const u = new URL(value);
      return (
        ["http:", "https:"].includes(u.protocol) && !u.username && !u.password
      );
    }, "Use URL HTTP/HTTPS sem credenciais.")
    .default("http://localhost:3000"),
  AUTH_SECRET: z.string().min(32),
  STORAGE_PRIVATE_DIR: z.string().min(1).default("./storage/private"),
  MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(10485760),
});
export function readEnvironment(
  source: Record<string, string | undefined> = process.env,
) {
  const result = environmentSchema.safeParse(source);
  if (!result.success) {
    const fields = [
      ...new Set(result.error.issues.map((issue) => issue.path.join("."))),
    ];
    throw new Error(`Configuração inválida. Verifique: ${fields.join(", ")}.`);
  }
  return result.data;
}
