import type { DatabaseClient } from "@/lib/database-client";
import { AppError, assertRoot } from "@/modules/core/contracts/access";
import { audit } from "@/modules/core/services/auth";
import { verifyPassword } from "@/modules/core/services/security";
import {
  brazilDateTime,
  courseSchema,
  enrollmentSchema,
  lessonSchema,
  teacherSchema,
} from "../schemas/cursos";
import { freshCourseActor } from "./access";
export function createCourseService(db: DatabaseClient) {
  async function save(resource: string, actorId: number, input: unknown) {
    return db.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT true AS locked FROM pg_advisory_xact_lock(37105)`;
        const actor = await freshCourseActor(tx, actorId, true);
        if (resource === "cursos") {
          const { id, ...values } = courseSchema.parse(input);
          if (id) {
            await tx.$queryRaw`SELECT id_curso FROM curso WHERE id_curso=${id} FOR UPDATE`;
            const planned = await tx.aula.aggregate({
              where: { cursoId: id, ativo: true },
              _sum: { duracao: true },
            });
            if ((planned._sum.duracao || 0) > values.cargaHoraria * 60)
              throw new AppError(
                "A carga horária não pode ser menor que a soma das aulas ativas.",
                409,
              );
          }
          const row = id
            ? await tx.curso.update({ where: { idCurso: id }, data: values })
            : await tx.curso.create({ data: values });
          await audit(
            tx,
            actor.id,
            id ? "CURSO_ATUALIZADO" : "CURSO_CRIADO",
            "Curso",
            row.idCurso,
            actor.grupoId,
          );
          return { id: row.idCurso };
        }
        if (resource === "professores") {
          const { id, ...values } = teacherSchema.parse(input);
          const row = id
            ? await tx.professor.update({
                where: { idProfessor: id },
                data: values,
              })
            : await tx.professor.create({ data: values });
          await audit(
            tx,
            actor.id,
            id ? "PROFESSOR_ATUALIZADO" : "PROFESSOR_CRIADO",
            "Professor",
            row.idProfessor,
            actor.grupoId,
          );
          return { id: row.idProfessor };
        }
        if (resource === "aulas") {
          const data = lessonSchema.parse(input);
          const current = data.id
            ? await tx.aula.findUnique({ where: { idAula: data.id } })
            : null;
          if (data.id && !current)
            throw new AppError("Aula não encontrada.", 404);
          for (const id of [
            ...new Set([data.cursoId, ...(current ? [current.cursoId] : [])]),
          ].sort((a, b) => a - b))
            await tx.$queryRaw`SELECT id_curso FROM curso WHERE id_curso=${id} FOR UPDATE`;
          const course = await tx.curso.findUnique({
            where: { idCurso: data.cursoId },
          });
          const teacher = await tx.professor.findUnique({
            where: { idProfessor: data.professorId },
          });
          if (!course || !teacher)
            throw new AppError("Escolha um curso e um professor válidos.");
          if (
            (!current ||
              current.professorId !== data.professorId ||
              (!current.ativo && data.ativo)) &&
            !teacher.ativo
          )
            throw new AppError("Professor inativo não recebe novas aulas.");
          if (data.ativo) {
            const planned = await tx.aula.aggregate({
              where: {
                cursoId: data.cursoId,
                ativo: true,
                ...(current ? { idAula: { not: current.idAula } } : {}),
              },
              _sum: { duracao: true },
            });
            if (
              (planned._sum.duracao || 0) + data.duracao >
              course.cargaHoraria * 60
            )
              throw new AppError(
                "A soma das aulas ativas excede a carga horária do curso.",
                409,
              );
          }
          const { id, ...values } = data;
          const converted = {
            ...values,
            dataHora: brazilDateTime(values.dataHora),
          };
          const row = id
            ? await tx.aula.update({ where: { idAula: id }, data: converted })
            : await tx.aula.create({ data: converted });
          await audit(
            tx,
            actor.id,
            id ? "AULA_ATUALIZADA" : "AULA_CRIADA",
            "Aula",
            row.idAula,
            actor.grupoId,
          );
          return { id: row.idAula };
        }
        if (resource === "matriculas") {
          const data = enrollmentSchema.parse(input);
          const current = data.id
            ? await tx.matricula.findUnique({ where: { idMatricula: data.id } })
            : null;
          if (data.id && !current)
            throw new AppError("Matrícula não encontrada.", 404);
          if (
            current &&
            (current.alunoId !== data.alunoId ||
              current.cursoId !== data.cursoId)
          )
            throw new AppError(
              "Aluno e curso da matrícula são fixos. Encerre o vínculo e crie uma nova matrícula.",
            );
          await tx.$queryRaw`SELECT id_curso FROM curso WHERE id_curso=${data.cursoId} FOR UPDATE`;
          await tx.$queryRaw`SELECT id_aluno FROM aluno WHERE id_aluno=${data.alunoId} FOR UPDATE`;
          const course = await tx.curso.findUnique({
            where: { idCurso: data.cursoId },
          });
          const student = await tx.aluno.findUnique({
            where: { idAluno: data.alunoId },
          });
          if (!course || !student)
            throw new AppError("Escolha curso e aluno válidos.");
          const entering =
            !current ||
            ((!current.ativo || current.status !== "ATIVA") &&
              data.ativo &&
              data.status === "ATIVA");
          if (entering && !student.ativo)
            throw new AppError("Aluno inativo não recebe nova matrícula.");
          const exception = entering && !course.ativo;
          if (exception) {
            assertRoot(actor);
            if (!data.justificativa || data.justificativa.length < 5)
              throw new AppError(
                "Curso inativo exige justificativa de pelo menos 5 caracteres.",
              );
            const operator = await tx.usuario.findUniqueOrThrow({
              where: { idUsuario: actor.id },
              select: { senhaHash: true },
            });
            if (
              !data.confirmacaoSenha ||
              !(await verifyPassword(operator.senhaHash, data.confirmacaoSenha))
            )
              throw new AppError(
                "Confirme sua senha root para autorizar matrícula em curso inativo.",
                403,
              );
          }
          if (
            data.ativo &&
            data.status === "ATIVA" &&
            (await tx.matricula.findFirst({
              where: {
                alunoId: data.alunoId,
                cursoId: data.cursoId,
                ativo: true,
                status: "ATIVA",
                ...(current
                  ? { idMatricula: { not: current.idMatricula } }
                  : {}),
              },
            }))
          )
            throw new AppError(
              "Este aluno já possui matrícula ativa neste curso.",
              409,
            );
          const values = {
            alunoId: data.alunoId,
            cursoId: data.cursoId,
            dataMatricula: new Date(data.dataMatricula + "T12:00:00Z"),
            status: data.status,
            ativo: data.ativo,
          };
          const row = current
            ? await tx.matricula.update({
                where: { idMatricula: current.idMatricula },
                data: values,
              })
            : await tx.matricula.create({ data: values });
          await audit(
            tx,
            actor.id,
            current ? "MATRICULA_ATUALIZADA" : "MATRICULA_CRIADA",
            "Matricula",
            row.idMatricula,
            actor.grupoId,
          );
          if (exception)
            await tx.eventoAdministrativo.create({
              data: {
                atorUsuarioId: actor.id,
                acao: "MATRICULA_EXCEPCIONAL",
                entidade: "Matricula",
                registroId: String(row.idMatricula),
                metadados: {
                  grupoId: actor.grupoId,
                  alunoId: data.alunoId,
                  cursoId: data.cursoId,
                  justificativa: data.justificativa!,
                },
              },
            });
          return { id: row.idMatricula };
        }
        throw new AppError("Operação não encontrada.", 404);
      },
      { timeout: 15000 },
    );
  }
  return { save };
}
