import type { DatabaseClient } from "@/lib/database-client";
import {
  AppError,
  assertManager,
  assertModule,
  isManager,
  type Actor,
} from "@/modules/core/contracts/access";
import { actorForUser, type Transaction } from "@/modules/core/services/auth";
export function studentAccess(actor: Actor, manage = false) {
  assertModule(actor, "alunos");
  if (manage) assertManager(actor);
}
export async function freshStudentActor(
  db: Transaction | DatabaseClient,
  userId: number,
  manage = false,
) {
  const actor = await actorForUser(db, userId);
  studentAccess(actor, manage);
  return actor;
}
export async function assertStudentRecord(
  db: Transaction | DatabaseClient,
  actor: Actor,
  alunoId: number,
) {
  studentAccess(actor);
  const row = await db.aluno.findFirst({
    where: {
      idAluno: alunoId,
      ...(isManager(actor) ? {} : { usuarioId: actor.id }),
    },
    select: { idAluno: true },
  });
  if (!row) throw new AppError("Aluno não encontrado ou não autorizado.", 404);
}
export async function lockStudents(tx: Transaction) {
  await tx.$queryRaw`SELECT true AS locked FROM pg_advisory_xact_lock(37104)`;
}
