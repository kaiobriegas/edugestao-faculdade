import type { DatabaseClient } from "@/lib/database-client";
import {
  assertManager,
  assertModule,
  type Actor,
} from "@/modules/core/contracts/access";
import { actorForUser, type Transaction } from "@/modules/core/services/auth";
export function assessmentAccess(actor: Actor, manage = false) {
  assertModule(actor, "avaliacoes");
  if (manage) assertManager(actor);
}
export async function freshAssessmentActor(
  db: DatabaseClient | Transaction,
  id: number,
  manage = false,
) {
  const actor = await actorForUser(db, id);
  assessmentAccess(actor, manage);
  return actor;
}
