import type { DatabaseClient } from "@/lib/database-client";
import {
  assertManager,
  assertModule,
  type Actor,
} from "@/modules/core/contracts/access";
import { actorForUser, type Transaction } from "@/modules/core/services/auth";
export function libraryAccess(actor: Actor, manage = false) {
  assertModule(actor, "biblioteca");
  if (manage) assertManager(actor);
}
export async function freshLibraryActor(
  db: DatabaseClient | Transaction,
  id: number,
  manage = false,
) {
  const actor = await actorForUser(db, id);
  libraryAccess(actor, manage);
  return actor;
}
