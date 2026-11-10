import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
export function createDatabaseClient(connectionString: string) {
  const adapter = new PrismaPg({
    connectionString,
    max: 10,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000,
  });
  return new PrismaClient({ adapter, log: [] });
}
export type DatabaseClient = ReturnType<typeof createDatabaseClient>;
