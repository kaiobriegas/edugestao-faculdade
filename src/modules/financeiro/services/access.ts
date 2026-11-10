import type { DatabaseClient } from "@/lib/database-client";
import {
  assertManager,
  assertModule,
  type Actor,
} from "@/modules/core/contracts/access";
import { actorForUser, type Transaction } from "@/modules/core/services/auth";
export function financeAccess(actor: Actor, manage = false) {
  assertModule(actor, "financeiro");
  if (manage) assertManager(actor);
}
export async function freshFinanceActor(
  db: DatabaseClient | Transaction,
  id: number,
  manage = false,
) {
  const actor = await actorForUser(db, id);
  financeAccess(actor, manage);
  return actor;
}
