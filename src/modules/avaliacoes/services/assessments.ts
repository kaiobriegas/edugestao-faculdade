import type { DatabaseClient } from "@/lib/database-client";
import { Prisma } from "@/generated/prisma/client";
import { AppError } from "@/modules/core/contracts/access";
import { audit, type Transaction } from "@/modules/core/services/auth";
import { brazilDateTime } from "@/lib/academic-time";
import {
  assessmentSchema,
  questionSchema,
  startSchema,
  attemptSchema,
  answersSchema,
  correctionSchema,
} from "../schemas/assessments";
import { freshAssessmentActor } from "./access";
async function clock(tx: Transaction) {
  const rows = await tx.$queryRaw<
    { milliseconds: number }[]
  >`SELECT (extract(epoch FROM clock_timestamp()) * 1000)::double precision AS milliseconds`;
  return new Date(rows[0].milliseconds);
}
async function editable(tx: Transaction, id: number) {
  if (await tx.tentativaAvaliacao.count({ where: { avaliacaoId: id } }))
    throw new AppError(
      "A prova já foi iniciada. Conteúdo, pontuação e prazo estão bloqueados.",
      409,
    );
}
async function attempt(
  tx: Transaction,
  id: number,
  userId: number,
  manager = false,
) {
  const t = await tx.tentativaAvaliacao.findUnique({
    where: { idTentativa: id },
    include: {
      aluno: true,
      avaliacao: {
        include: {
          questaoRegistros: {
            where: { ativo: true },
            orderBy: { idQuestao: "asc" },
          },
        },
      },
      respostaRegistros: { where: { ativo: true } },
    },
  });
  if (!t || (!manager && t.aluno.usuarioId !== userId))
    throw new AppError("Tentativa não encontrada.", 404);
  return t;
}
type Attempt = Awaited<ReturnType<typeof attempt>>;
async function store(
  tx: Transaction,
  t: Attempt,
  answers: Prisma.JsonValue | unknown,
  now: Date,
) {
  const values = answersSchema.parse({
    tentativaId: t.idTentativa,
    respostas: answers,
  }).respostas;
  const ids = new Set<number>();
  for (const r of values) {
    if (ids.has(r.questaoId)) throw new AppError("Questão repetida.");
    ids.add(r.questaoId);
    const q = t.avaliacao.questaoRegistros.find(
      (q) => q.idQuestao === r.questaoId,
    );
    if (!q) throw new AppError("Questão não pertence à prova.");
    if (
      (q.tipo === "OBJETIVA" && r.texto) ||
      (q.tipo === "DISCURSIVA" && r.alternativaSelecionada)
    )
      throw new AppError("Resposta incompatível com a questão.");
    const texto = r.texto || null,
      alternativaSelecionada = r.alternativaSelecionada || null;
    if (!texto && !alternativaSelecionada) {
      await tx.resposta.updateMany({
        where: { tentativaId: t.idTentativa, questaoId: q.idQuestao },
        data: { ativo: false },
      });
      continue;
    }
    const data = {
      texto,
      alternativaSelecionada,
      ativo: true,
      dataResposta: now,
      pontuacaoObtida: null,
      comentarioCorrecao: null,
    };
    await tx.resposta.upsert({
      where: {
        tentativaId_questaoId: {
          tentativaId: t.idTentativa,
          questaoId: q.idQuestao,
        },
      },
      update: data,
      create: {
        ...data,
        tentativaId: t.idTentativa,
        alunoId: t.alunoId,
        avaliacaoId: t.avaliacaoId,
        questaoId: q.idQuestao,
      },
    });
  }
}
async function recalculate(tx: Transaction, t: Attempt, now: Date) {
  const responses = await tx.resposta.findMany({
    where: { tentativaId: t.idTentativa, ativo: true },
    include: { questao: true },
  });
  let total = new Prisma.Decimal(0),
    pending = false;
  for (const r of responses) {
    if (r.questao.tipo === "OBJETIVA") {
      const points = new Prisma.Decimal(
        r.alternativaSelecionada === r.questao.alternativaCorreta
          ? r.questao.pontuacao
          : 0,
      );
      await tx.resposta.update({
        where: { idResposta: r.idResposta },
        data: { pontuacaoObtida: points },
      });
      total = total.plus(points);
    } else if (r.pontuacaoObtida === null) pending = true;
    else total = total.plus(r.pontuacaoObtida);
  }
  const finalizadaEm = t.finalizadaEm || now;
  await tx.tentativaAvaliacao.update({
    where: { idTentativa: t.idTentativa },
    data: { finalizadaEm, status: pending ? "FINALIZADA" : "CORRIGIDA" },
  });
  if (!pending)
    await tx.nota.upsert({
      where: { tentativaId: t.idTentativa },
      update: { valor: total, dataAvaliacao: finalizadaEm, ativo: true },
      create: {
        valor: total,
        dataAvaliacao: finalizadaEm,
        tentativaId: t.idTentativa,
        alunoId: t.alunoId,
        avaliacaoId: t.avaliacaoId,
      },
    });
  return {
    id: t.idTentativa,
    pendente: pending,
    nota: pending ? null : total.toFixed(2),
  };
}
export function createAssessmentService(db: DatabaseClient) {
  return {
    async save(resource: string, actorId: number, input: unknown) {
      return db.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT true AS locked FROM pg_advisory_xact_lock(37106)`;
          const manage = [
            "avaliacoes",
            "questoes",
            "corrigir",
            "encerrar-expirada",
          ].includes(resource);
          const actor = await freshAssessmentActor(tx, actorId, manage);
          const now = await clock(tx);
          if (resource === "avaliacoes") {
            const { id, ...v } = assessmentSchema.parse(input);
            const data = {
              ...v,
              dataAplicacao: brazilDateTime(v.dataAplicacao),
            };
            if (id) {
              const old = await tx.avaliacao.findUnique({
                where: { idAvaliacao: id },
              });
              if (!old) throw new AppError("Avaliação não encontrada.", 404);
              if (
                old.titulo !== data.titulo ||
                old.descricao !== data.descricao ||
                old.tipo !== data.tipo ||
                old.tempoLimite !== data.tempoLimite ||
                old.dataAplicacao.valueOf() !== data.dataAplicacao.valueOf()
              )
                await editable(tx, id);
            }
            const row = id
              ? await tx.avaliacao.update({ where: { idAvaliacao: id }, data })
              : await tx.avaliacao.create({ data });
            await audit(
              tx,
              actor.id,
              id ? "AVALIACAO_ATUALIZADA" : "AVALIACAO_CRIADA",
              "Avaliacao",
              row.idAvaliacao,
              actor.grupoId,
            );
            return { id: row.idAvaliacao };
          }
          if (resource === "questoes") {
            const { id, ...v } = questionSchema.parse(input);
            if (
              !(await tx.avaliacao.findUnique({
                where: { idAvaliacao: v.avaliacaoId },
              }))
            )
              throw new AppError("Avaliação não encontrada.", 404);
            await editable(tx, v.avaliacaoId);
            if (id) {
              const old = await tx.questao.findUnique({
                where: { idQuestao: id },
              });
              if (!old) throw new AppError("Questão não encontrada.", 404);
              if (old.avaliacaoId !== v.avaliacaoId)
                throw new AppError("Não é permitido mover a questão.");
            }
            if (
              v.ativo &&
              (await tx.questao.count({
                where: {
                  avaliacaoId: v.avaliacaoId,
                  ativo: true,
                  ...(id ? { idQuestao: { not: id } } : {}),
                },
              })) >= 100
            )
              throw new AppError("Limite de 100 questões ativas por prova.");
            const data = {
              ...v,
              alternativaCorreta: v.alternativaCorreta || null,
            };
            const row = id
              ? await tx.questao.update({ where: { idQuestao: id }, data })
              : await tx.questao.create({ data });
            await audit(
              tx,
              actor.id,
              id ? "QUESTAO_ATUALIZADA" : "QUESTAO_CRIADA",
              "Questao",
              row.idQuestao,
              actor.grupoId,
            );
            return { id: row.idQuestao };
          }
          if (resource === "iniciar") {
            const { avaliacaoId } = startSchema.parse(input);
            const aluno = await tx.aluno.findUnique({
              where: { usuarioId: actor.id },
            });
            if (!aluno)
              throw new AppError(
                "Sua conta precisa estar vinculada a um aluno.",
                403,
              );
            const existing = await tx.tentativaAvaliacao.findFirst({
              where: { alunoId: aluno.idAluno, avaliacaoId },
              orderBy: { numero: "asc" },
            });
            if (existing) return { id: existing.idTentativa };
            if (!aluno.ativo)
              throw new AppError("Cadastro acadêmico inativo.", 403);
            const exam = await tx.avaliacao.findUnique({
              where: { idAvaliacao: avaliacaoId },
              include: { questaoRegistros: { where: { ativo: true } } },
            });
            if (!exam || !exam.ativo)
              throw new AppError("Avaliação indisponível.", 409);
            if (exam.dataAplicacao > now)
              throw new AppError("A avaliação ainda não foi liberada.", 409);
            if (!exam.questaoRegistros.length)
              throw new AppError("Avaliação sem questões ativas.", 409);
            const t = await tx.tentativaAvaliacao.create({
              data: {
                alunoId: aluno.idAluno,
                avaliacaoId,
                numero: 1,
                iniciadaEm: now,
                prazoEm: new Date(now.valueOf() + exam.tempoLimite * 60000),
              },
            });
            await audit(
              tx,
              actor.id,
              "AVALIACAO_INICIADA",
              "TentativaAvaliacao",
              t.idTentativa,
              actor.grupoId,
            );
            return { id: t.idTentativa };
          }
          if (
            ["respostas", "finalizar", "encerrar-expirada"].includes(resource)
          ) {
            const v =
              resource === "encerrar-expirada"
                ? attemptSchema.parse(input)
                : answersSchema.parse(input);
            const t = await attempt(
              tx,
              v.tentativaId,
              actor.id,
              resource === "encerrar-expirada",
            );
            if (t.status !== "EM_ANDAMENTO") {
              if (resource === "respostas")
                throw new AppError("A prova já foi finalizada.", 409);
              return { id: t.idTentativa };
            }
            const expired = now >= t.prazoEm;
            if (resource === "encerrar-expirada" && !expired)
              throw new AppError("O prazo ainda não encerrou.", 409);
            if (resource !== "encerrar-expirada" && !t.aluno.ativo)
              throw new AppError("Cadastro acadêmico inativo.", 403);
            if (resource === "respostas" && expired)
              throw new AppError(
                "Prazo encerrado. Finalize para corrigir as respostas já salvas.",
                409,
              );
            if (!expired && "respostas" in v)
              await store(tx, t, v.respostas, now);
            if (resource === "respostas") return { id: t.idTentativa };
            const result = await recalculate(tx, t, now);
            await audit(
              tx,
              actor.id,
              "AVALIACAO_FINALIZADA",
              "TentativaAvaliacao",
              t.idTentativa,
              actor.grupoId,
            );
            return { ...result, expirado: expired };
          }
          if (resource === "corrigir") {
            const v = correctionSchema.parse(input);
            const r = await tx.resposta.findUnique({
              where: { idResposta: v.respostaId },
              include: { questao: true, tentativa: true },
            });
            if (!r || !r.ativo)
              throw new AppError("Resposta não encontrada.", 404);
            if (
              r.tentativa.status === "EM_ANDAMENTO" ||
              r.questao.tipo !== "DISCURSIVA"
            )
              throw new AppError(
                "Somente respostas discursivas finalizadas podem ser corrigidas.",
                409,
              );
            if (v.pontuacao > r.questao.pontuacao)
              throw new AppError("Pontuação excede o valor da questão.");
            await tx.resposta.update({
              where: { idResposta: r.idResposta },
              data: {
                pontuacaoObtida: new Prisma.Decimal(v.pontuacao),
                comentarioCorrecao: v.comentario,
              },
            });
            await tx.eventoAdministrativo.create({
              data: {
                atorUsuarioId: actor.id,
                acao: "RESPOSTA_CORRIGIDA",
                entidade: "Resposta",
                registroId: String(r.idResposta),
                metadados: {
                  grupoId: actor.grupoId,
                  anterior: r.pontuacaoObtida?.toString() || null,
                  pontuacao: String(v.pontuacao),
                },
              },
            });
            return recalculate(
              tx,
              await attempt(tx, r.tentativaId, actor.id, true),
              now,
            );
          }
          throw new AppError("Operação não encontrada.", 404);
        },
        { timeout: 15000, maxWait: 10000 },
      );
    },
  };
}
