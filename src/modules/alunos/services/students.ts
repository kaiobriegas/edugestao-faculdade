import type { DatabaseClient } from "@/lib/database-client";
import { AppError, isRoot } from "@/modules/core/contracts/access";
import { audit } from "@/modules/core/services/auth";
import { verifyPassword } from "@/modules/core/services/security";
import {
  asDate,
  classSchema,
  documentSchema,
  linkSchema,
  occurrenceSchema,
  responsibleSchema,
  studentSchema,
} from "../schemas/alunos";
import { assertStudentRecord, freshStudentActor, lockStudents } from "./access";
export function createStudentService(db: DatabaseClient) {
  async function save(resource: string, actorId: number, input: unknown) {
    return db.$transaction(
      async (tx) => {
        await lockStudents(tx);
        const actor = await freshStudentActor(tx, actorId, true);
        if (resource === "alunos") {
          const data = studentSchema.parse(input);
          const current = data.id
            ? await tx.aluno.findUnique({ where: { idAluno: data.id } })
            : null;
          if (data.id && !current)
            throw new AppError("Aluno não encontrado.", 404);
          if (data.usuarioId !== undefined && !isRoot(actor))
            throw new AppError(
              "Somente root pode vincular contas a alunos.",
              403,
            );
          const accountChanged =
            data.usuarioId !== undefined &&
            data.usuarioId !== (current?.usuarioId ?? null);
          if (accountChanged) {
            const operator = await tx.usuario.findUniqueOrThrow({
              where: { idUsuario: actor.id },
              select: { senhaHash: true },
            });
            if (
              !data.confirmacaoSenha ||
              !(await verifyPassword(operator.senhaHash, data.confirmacaoSenha))
            )
              throw new AppError(
                "Confirme sua senha atual para alterar o vínculo de conta.",
                403,
              );
            if (
              data.usuarioId &&
              !(await tx.usuario.findFirst({
                where: {
                  idUsuario: data.usuarioId,
                  ativo: true,
                  grupo: { ativo: true },
                },
              }))
            )
              throw new AppError("Escolha uma conta ativa.");
          }
          const turma = await tx.turma.findUnique({
            where: { idTurma: data.turmaId },
          });
          if (!turma) throw new AppError("Escolha uma turma válida.");
          const entering =
            !current ||
            current.turmaId !== data.turmaId ||
            ((!current.ativo || current.status !== "MATRICULADO") &&
              data.ativo &&
              data.status === "MATRICULADO");
          if (entering && !turma.ativo)
            throw new AppError("Turma inativa não recebe novos alunos.");
          const affected = [
            ...new Set([data.turmaId, ...(current ? [current.turmaId] : [])]),
          ].sort((a, b) => a - b);
          for (const turmaId of affected)
            await tx.$queryRaw`SELECT id_turma FROM turma WHERE id_turma = ${turmaId} FOR UPDATE`;
          if (data.ativo && data.status === "MATRICULADO") {
            const occupancy = await tx.aluno.count({
              where: {
                turmaId: data.turmaId,
                ativo: true,
                status: "MATRICULADO",
                ...(current ? { idAluno: { not: current.idAluno } } : {}),
              },
            });
            if (occupancy >= turma.capacidade)
              throw new AppError(
                "A turma está sem vagas. Escolha outra turma.",
                409,
              );
          }
          const values = {
            nome: data.nome,
            matricula: data.matricula,
            dataNascimento: data.dataNascimento
              ? asDate(data.dataNascimento)
              : null,
            email: data.email,
            telefone: data.telefone,
            endereco: data.endereco,
            dataMatricula: asDate(data.dataMatricula),
            turmaId: data.turmaId,
            status: data.status,
            ativo: data.ativo,
            usuarioId: data.usuarioId,
          };
          const row = current
            ? await tx.aluno.update({
                where: { idAluno: current.idAluno },
                data: values,
              })
            : await tx.aluno.create({ data: values });
          await audit(
            tx,
            actor.id,
            current ? "ALUNO_ATUALIZADO" : "ALUNO_CRIADO",
            "Aluno",
            row.idAluno,
            actor.grupoId,
          );
          if (accountChanged)
            await audit(
              tx,
              actor.id,
              "CONTA_ALUNO_VINCULADA",
              "Aluno",
              row.idAluno,
              actor.grupoId,
            );
          return { id: row.idAluno };
        }
        if (resource === "turmas") {
          const data = classSchema.parse(input);
          if (data.id) {
            await tx.$queryRaw`SELECT id_turma FROM turma WHERE id_turma = ${data.id} FOR UPDATE`;
            const occupancy = await tx.aluno.count({
              where: { turmaId: data.id, ativo: true, status: "MATRICULADO" },
            });
            if (data.capacidade < occupancy)
              throw new AppError(
                "A capacidade não pode ser menor que a ocupação atual.",
                409,
              );
          }
          const { id, ...values } = data;
          const row = id
            ? await tx.turma.update({ where: { idTurma: id }, data: values })
            : await tx.turma.create({ data: values });
          await audit(
            tx,
            actor.id,
            id ? "TURMA_ATUALIZADA" : "TURMA_CRIADA",
            "Turma",
            row.idTurma,
            actor.grupoId,
          );
          return { id: row.idTurma };
        }
        if (resource === "responsaveis") {
          const { id, ...values } = responsibleSchema.parse(input);
          const row = id
            ? await tx.responsavel.update({
                where: { idResponsavel: id },
                data: values,
              })
            : await tx.responsavel.create({ data: values });
          await audit(
            tx,
            actor.id,
            id ? "RESPONSAVEL_ATUALIZADO" : "RESPONSAVEL_CRIADO",
            "Responsavel",
            row.idResponsavel,
            actor.grupoId,
          );
          return { id: row.idResponsavel };
        }
        if (resource === "vinculos") {
          const data = linkSchema.parse(input);
          await assertStudentRecord(tx, actor, data.alunoId);
          if (data.remover)
            await tx.alunoResponsavel.deleteMany({
              where: {
                alunoId: data.alunoId,
                responsavelId: data.responsavelId,
              },
            });
          else {
            const responsible = await tx.responsavel.findUnique({
              where: { idResponsavel: data.responsavelId },
            });
            if (!responsible?.ativo)
              throw new AppError("Escolha um responsável ativo.");
            await tx.alunoResponsavel.upsert({
              where: {
                alunoId_responsavelId: {
                  alunoId: data.alunoId,
                  responsavelId: data.responsavelId,
                },
              },
              create: {
                alunoId: data.alunoId,
                responsavelId: data.responsavelId,
                parentesco: data.parentesco || null,
              },
              update: { parentesco: data.parentesco || null },
            });
          }
          await audit(
            tx,
            actor.id,
            data.remover ? "RESPONSAVEL_DESVINCULADO" : "RESPONSAVEL_VINCULADO",
            "Aluno",
            data.alunoId,
            actor.grupoId,
          );
          return { id: data.alunoId };
        }
        if (resource === "ocorrencias") {
          const data = occurrenceSchema.parse(input);
          await assertStudentRecord(tx, actor, data.alunoId);
          const current = data.id
            ? await tx.ocorrencia.findFirst({
                where: { idOcorrencia: data.id, alunoId: data.alunoId },
              })
            : null;
          if (data.id && !current)
            throw new AppError("Ocorrência não encontrada.", 404);
          const values = {
            tipo: data.tipo,
            descricao: data.descricao,
            dataOcorrencia: asDate(data.dataOcorrencia),
            status: data.status,
            ativo: data.ativo,
          };
          const row = current
            ? await tx.ocorrencia.update({
                where: { idOcorrencia: current.idOcorrencia },
                data: values,
              })
            : await tx.ocorrencia.create({
                data: {
                  ...values,
                  alunoId: data.alunoId,
                  autorUsuarioId: actor.id,
                },
              });
          await audit(
            tx,
            actor.id,
            current ? "OCORRENCIA_ATUALIZADA" : "OCORRENCIA_CRIADA",
            "Ocorrencia",
            row.idOcorrencia,
            actor.grupoId,
          );
          return { id: row.idOcorrencia };
        }
        if (resource === "documentos") {
          const data = documentSchema.parse(input);
          const doc = await tx.documento.findUnique({
            where: { idDocumento: data.id },
          });
          if (!doc) throw new AppError("Documento não encontrado.", 404);
          await assertStudentRecord(tx, actor, doc.alunoId);
          await tx.documento.update({
            where: { idDocumento: data.id },
            data: {
              status: data.status,
              ativo: data.ativo && data.status !== "ARQUIVADO",
            },
          });
          await audit(
            tx,
            actor.id,
            "DOCUMENTO_ATUALIZADO",
            "Documento",
            doc.idDocumento,
            actor.grupoId,
          );
          return { id: doc.idDocumento };
        }
        throw new AppError("Operação não encontrada.", 404);
      },
      { timeout: 15000 },
    );
  }
  return { save };
}
