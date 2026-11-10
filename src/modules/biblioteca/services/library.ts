import type { DatabaseClient } from "@/lib/database-client";
import { AppError } from "@/modules/core/contracts/access";
import { audit } from "@/modules/core/services/auth";
import { brazilDateTime } from "@/lib/academic-time";
import {
  loanSchema,
  returnSchema,
  reservationSchema,
  reservationStatusSchema,
} from "../schemas/library";
import { freshLibraryActor } from "./access";
import { saveCatalog } from "./catalog";
import { libraryClock } from "./policy";
export function createLibraryService(db: DatabaseClient) {
  return {
    async save(resource: string, actorId: number, input: unknown) {
      return db.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT true AS locked FROM pg_advisory_xact_lock(37107)`;
          const actor = await freshLibraryActor(tx, actorId, true),
            now = await libraryClock(tx);
          if (["categorias", "livros", "exemplares"].includes(resource))
            return saveCatalog(tx, actor, resource, input);
          if (resource === "emprestimos") {
            const v = loanSchema.parse(input),
              due = brazilDateTime(v.dataPrevistaDevolucao);
            if (due <= now)
              throw new AppError(
                "A devolução prevista deve ser posterior ao empréstimo.",
              );
            await tx.$queryRaw`SELECT id_exemplar FROM exemplar WHERE id_exemplar=${v.exemplarId} FOR UPDATE`;
            const copy = await tx.exemplar.findUnique({
              where: { idExemplar: v.exemplarId },
              include: { livro: { include: { categoria: true } } },
            });
            if (!copy) throw new AppError("Exemplar não encontrado.", 404);
            if (
              !copy.ativo ||
              copy.situacao !== "DISPONIVEL" ||
              !copy.livro.ativo ||
              !copy.livro.categoria.ativo ||
              (await tx.emprestimo.findFirst({
                where: { exemplarId: v.exemplarId, dataDevolucao: null },
              }))
            )
              throw new AppError("Exemplar indisponível para empréstimo.", 409);
            await tx.$queryRaw`SELECT id_aluno FROM aluno WHERE id_aluno=${v.alunoId} FOR UPDATE`;
            const student = await tx.aluno.findUnique({
              where: { idAluno: v.alunoId },
            });
            if (!student || !student.ativo)
              throw new AppError("Escolha um aluno ativo.", 409);
            const row = await tx.emprestimo.create({
              data: {
                alunoId: v.alunoId,
                exemplarId: v.exemplarId,
                dataEmprestimo: now,
                dataPrevistaDevolucao: due,
              },
            });
            await tx.exemplar.update({
              where: { idExemplar: v.exemplarId },
              data: { situacao: "EMPRESTADO" },
            });
            await audit(
              tx,
              actor.id,
              "EMPRESTIMO_REGISTRADO",
              "Emprestimo",
              row.idEmprestimo,
              actor.grupoId,
            );
            return { id: row.idEmprestimo };
          }
          if (resource === "devolver") {
            const { emprestimoId } = returnSchema.parse(input);
            const row = await tx.emprestimo.findUnique({
              where: { idEmprestimo: emprestimoId },
            });
            if (!row) throw new AppError("Empréstimo não encontrado.", 404);
            await tx.$queryRaw`SELECT id_exemplar FROM exemplar WHERE id_exemplar=${row.exemplarId} FOR UPDATE`;
            if (row.dataDevolucao)
              return { id: row.idEmprestimo, repetida: true };
            await tx.emprestimo.update({
              where: { idEmprestimo: emprestimoId },
              data: { situacao: "DEVOLVIDO", dataDevolucao: now },
            });
            await tx.exemplar.update({
              where: { idExemplar: row.exemplarId },
              data: { situacao: "DISPONIVEL" },
            });
            await audit(
              tx,
              actor.id,
              "EMPRESTIMO_DEVOLVIDO",
              "Emprestimo",
              row.idEmprestimo,
              actor.grupoId,
            );
            return { id: row.idEmprestimo };
          }
          if (resource === "reservas") {
            const v = reservationSchema.parse(input),
              expires = brazilDateTime(v.dataExpiracao);
            if (expires <= now)
              throw new AppError("A validade deve ser posterior à reserva.");
            const book = await tx.livro.findUnique({
              where: { idLivro: v.livroId },
              include: { categoria: true },
            });
            if (!book || !book.ativo || !book.categoria.ativo)
              throw new AppError("Escolha um livro e categoria ativos.", 409);
            await tx.$queryRaw`SELECT id_aluno FROM aluno WHERE id_aluno=${v.alunoId} FOR UPDATE`;
            const student = await tx.aluno.findUnique({
              where: { idAluno: v.alunoId },
            });
            if (!student || !student.ativo)
              throw new AppError("Escolha um aluno ativo.", 409);
            if (
              await tx.reserva.findFirst({
                where: {
                  alunoId: v.alunoId,
                  livroId: v.livroId,
                  ativo: true,
                  situacao: "ATIVA",
                  dataExpiracao: { gt: now },
                },
              })
            )
              throw new AppError(
                "O aluno já possui uma reserva ativa para este livro.",
                409,
              );
            const row = await tx.reserva.create({
              data: {
                alunoId: v.alunoId,
                livroId: v.livroId,
                dataReserva: now,
                dataExpiracao: expires,
              },
            });
            await audit(
              tx,
              actor.id,
              "RESERVA_REGISTRADA",
              "Reserva",
              row.idReserva,
              actor.grupoId,
            );
            return { id: row.idReserva };
          }
          if (resource === "situacao-reserva") {
            const v = reservationStatusSchema.parse(input),
              row = await tx.reserva.findUnique({
                where: { idReserva: v.reservaId },
              });
            if (!row) throw new AppError("Reserva não encontrada.", 404);
            if (row.situacao === v.situacao)
              return { id: row.idReserva, repetida: true };
            if (row.situacao !== "ATIVA" || !row.ativo)
              throw new AppError("Reserva já encerrada.", 409);
            if (v.situacao === "EXPIRADA" && row.dataExpiracao > now)
              throw new AppError(
                "A reserva ainda está dentro da validade.",
                409,
              );
            if (v.situacao !== "EXPIRADA" && row.dataExpiracao <= now)
              throw new AppError("Reserva vencida: registre a expiração.", 409);
            if (
              v.situacao === "ATENDIDA" &&
              !(await tx.emprestimo.findFirst({
                where: {
                  alunoId: row.alunoId,
                  exemplar: { livroId: row.livroId },
                  dataEmprestimo: { gte: row.dataReserva },
                },
              }))
            )
              throw new AppError(
                "Registre um empréstimo deste livro para o aluno antes de atender a reserva.",
                409,
              );
            await tx.reserva.update({
              where: { idReserva: v.reservaId },
              data: { situacao: v.situacao },
            });
            await audit(
              tx,
              actor.id,
              "RESERVA_" + v.situacao,
              "Reserva",
              row.idReserva,
              actor.grupoId,
            );
            return { id: row.idReserva };
          }
          throw new AppError("Operação não encontrada.", 404);
        },
        { timeout: 15000, maxWait: 10000 },
      );
    },
  };
}
