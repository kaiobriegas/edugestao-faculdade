import "server-only";
import { createDatabaseClient, type DatabaseClient } from "./database-client";
import { readEnvironment } from "./env";
const shared = globalThis as unknown as { database?: DatabaseClient };
export function getDatabase() {
  if (!shared.database)
    shared.database = createDatabaseClient(readEnvironment().DATABASE_URL);
  return shared.database;
}
