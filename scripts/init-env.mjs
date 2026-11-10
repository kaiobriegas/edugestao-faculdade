import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
const password = randomBytes(24).toString("hex");
const config = `DATABASE_URL=postgresql://educacional:${password}@127.0.0.1:54329/educacional
TEST_DATABASE_URL=postgresql://educacional:${password}@127.0.0.1:54329/educacional_test
POSTGRES_DB=educacional
POSTGRES_USER=educacional
POSTGRES_PASSWORD=${password}
POSTGRES_PORT=54329
APP_URL=http://localhost:3000
AUTH_SECRET=${randomBytes(48).toString("hex")}
SMTP_HOST=127.0.0.1
SMTP_PORT=1025
MAIL_FROM="Plataforma Educacional <nao-responda@educacional.local>"
STORAGE_PRIVATE_DIR=./storage/private
MAX_UPLOAD_BYTES=10485760
TZ=America/Sao_Paulo
`;
try {
  await writeFile(".env", config, { flag: "wx", mode: 0o600 });
  console.log(
    ".env criado com segredos aleatórios. Nenhuma credencial foi exibida.",
  );
} catch (error) {
  if (error.code === "EEXIST") console.log(".env já existe e foi preservado.");
  else throw error;
}
