import type { DatabaseClient } from "@/lib/database-client";
import {
  AppError,
  assertManager,
  assertModule,
  isManager,
  type Actor,
} from "@/modules/core/contracts/access";
import { actorForUser, type Transaction } from "@/modules/core/services/auth";
export function courseAccess(actor: Actor, manage = false) {
  assertModule(actor, "cursos");
  if (manage) assertManager(actor);
}
export async function freshCourseActor(
  db: Transaction | DatabaseClient,
  userId: number,
  manage = false,
) {
  const actor = await actorForUser(db, userId);
  courseAccess(actor, manage);
  return actor;
}
export async function assertCourseRecord(
  db: Transaction | DatabaseClient,
  actor: Actor,
  id: number,
) {
  courseAccess(actor);
  const course = await db.curso.findFirst({
    where: {
      idCurso: id,
      ...(isManager(actor)
        ? {}
        : {
            OR: [
              { ativo: true },
              {
                matriculaRegistros: {
                  some: { aluno: { usuarioId: actor.id } },
                },
              },
            ],
          }),
    },
  });
  if (!course)
    throw new AppError("Curso não encontrado ou não autorizado.", 404);
  return course;
}
