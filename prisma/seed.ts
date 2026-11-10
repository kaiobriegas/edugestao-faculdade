import "dotenv/config";
import { createDatabaseClient } from "../src/lib/database-client";
import { seedCatalog } from "./seed-catalog";
async function main() {
  if (!process.env.DATABASE_URL) throw new Error("Configure DATABASE_URL antes do seed.");
  const db = createDatabaseClient(process.env.DATABASE_URL);
  try { await seedCatalog(db); console.log("Catálogo preparado: três papéis e cinco módulos. Nenhuma conta criada."); }
  finally { await db.$disconnect(); }
}
main().catch(() => { console.error("Falha no seed. Verifique conexão e migrações; nenhum segredo foi registrado."); process.exitCode = 1; });
