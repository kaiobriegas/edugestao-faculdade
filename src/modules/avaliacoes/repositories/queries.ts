import type { DatabaseClient } from "@/lib/database-client";
import {
  AppError,
  isManager,
  type Actor,
} from "@/modules/core/contracts/access";
import { readListQuery } from "@/modules/core/schemas/core";
import { assessmentAccess } from "../services/access";
export async function assessmentDetail(
  db: DatabaseClient,
  actor: Actor,
  id: number,
) {
  assessmentAccess(actor);
  const manage = isManager(actor);
  const e = await db.avaliacao.findFirst({
    where: {
      idAvaliacao: id,
      ...(manage
        ? {}
        : {
            OR: [
              { ativo: true },
              {
                tentativaAvaliacaoRegistros: {
                  some: { aluno: { usuarioId: actor.id } },
                },
              },
            ],
          }),
    },
    include: {
      questaoRegistros: {
        where: manage ? {} : { ativo: true },
        orderBy: { idQuestao: "asc" },
      },
      _count: { select: { tentativaAvaliacaoRegistros: true } },
      tentativaAvaliacaoRegistros: {
        where: { aluno: { usuarioId: actor.id } },
        select: { idTentativa: true },
        take: 1,
      },
    },
  });
  if (!e) throw new AppError("Avaliação não encontrada.", 404);
  return {
    id: e.idAvaliacao,
    titulo: e.titulo,
    descricao: e.descricao,
    tipo: e.tipo,
    dataAplicacao: e.dataAplicacao.toISOString(),
    tempoLimite: e.tempoLimite,
    ativo: e.ativo,
    bloqueada: e._count.tentativaAvaliacaoRegistros > 0,
    quantidade: e.questaoRegistros.filter((q) => q.ativo).length,
    pontos: e.questaoRegistros
      .filter((q) => q.ativo)
      .reduce((n, q) => n + q.pontuacao, 0),
    tentativaId: e.tentativaAvaliacaoRegistros[0]?.idTentativa || null,
    ...(manage ? { questoes: e.questaoRegistros } : {}),
  };
}
export async function attemptDetail(
  db: DatabaseClient,
  actor: Actor,
  id: number,
) {
  assessmentAccess(actor);
  const manager = isManager(actor);
  const t = await db.tentativaAvaliacao.findFirst({
    where: {
      idTentativa: id,
      ...(manager ? {} : { aluno: { usuarioId: actor.id } }),
    },
    include: {
      aluno: { select: { nome: true, matricula: true } },
      avaliacao: {
        include: {
          questaoRegistros: {
            where: { ativo: true },
            orderBy: { idQuestao: "asc" },
          },
        },
      },
      respostaRegistros: { where: { ativo: true } },
      nota: true,
    },
  });
  if (!t) throw new AppError("Tentativa não encontrada.", 404);
  const clock = await db.$queryRaw<
    { milliseconds: number }[]
  >`SELECT (extract(epoch FROM clock_timestamp()) * 1000)::double precision AS milliseconds`;
  const now = new Date(clock[0].milliseconds);
  const reveal = manager || t.status !== "EM_ANDAMENTO";
  return {
    id: t.idTentativa,
    avaliacaoId: t.avaliacaoId,
    titulo: t.avaliacao.titulo,
    aluno: t.aluno.nome,
    matricula: t.aluno.matricula,
    status: t.status,
    serverNow: now.toISOString(),
    prazoEm: t.prazoEm.toISOString(),
    finalizadaEm: t.finalizadaEm?.toISOString() || null,
    expirado: now >= t.prazoEm,
    nota: t.nota?.valor.toFixed(2) || null,
    pontos: t.avaliacao.questaoRegistros.reduce(
      (sum, q) => sum + q.pontuacao,
      0,
    ),
    questoes: t.avaliacao.questaoRegistros.map((q) => {
      const r = t.respostaRegistros.find((r) => r.questaoId === q.idQuestao);
      return {
        id: q.idQuestao,
        enunciado: q.enunciado,
        tipo: q.tipo,
        pontuacao: q.pontuacao,
        alternativaA: q.alternativaA,
        alternativaB: q.alternativaB,
        alternativaC: q.alternativaC,
        alternativaD: q.alternativaD,
        ...(reveal ? { alternativaCorreta: q.alternativaCorreta } : {}),
        resposta: r
          ? {
              id: r.idResposta,
              texto: r.texto,
              alternativaSelecionada: r.alternativaSelecionada,
              ...(reveal
                ? {
                    pontuacaoObtida: r.pontuacaoObtida?.toFixed(2) || null,
                    comentario: r.comentarioCorrecao,
                  }
                : {}),
            }
          : null,
      };
    }),
  };
}
export async function assessmentList(
  db: DatabaseClient,
  actor: Actor,
  resource: string,
  query: URLSearchParams,
) {
  assessmentAccess(actor);
  const manager = isManager(actor),
    { pagina, busca, ativo } = readListQuery(query),
    skip = (pagina - 1) * 10,
    take = 10;
  if (resource === "avaliacoes") {
    const where = {
      titulo: { contains: busca, mode: "insensitive" as const },
      ...(manager ? { ativo } : { ativo: true }),
    };
    const [rows, total] = await Promise.all([
      db.avaliacao.findMany({
        where,
        skip,
        take,
        orderBy: { idAvaliacao: "desc" },
        include: {
          questaoRegistros: {
            where: { ativo: true },
            select: { pontuacao: true },
          },
          _count: { select: { tentativaAvaliacaoRegistros: true } },
        },
      }),
      db.avaliacao.count({ where }),
    ]);
    return {
      pagina,
      total,
      items: rows.map((e) => ({
        id: e.idAvaliacao,
        titulo: e.titulo,
        tipo: e.tipo,
        ativo: e.ativo,
        dataAplicacao: e.dataAplicacao.toISOString(),
        tempoLimite: e.tempoLimite,
        questoes: e.questaoRegistros.length,
        pontos: e.questaoRegistros.reduce((n, q) => n + q.pontuacao, 0),
        bloqueada: e._count.tentativaAvaliacaoRegistros > 0,
      })),
    };
  }
  if (resource === "resultados") {
    const status = query.get("status"),
      avaliacaoId = Number(query.get("avaliacaoId"));
    const where = {
      ...(manager ? {} : { aluno: { usuarioId: actor.id } }),
      ...(avaliacaoId > 0 ? { avaliacaoId } : {}),
      ...(status && ["EM_ANDAMENTO", "FINALIZADA", "CORRIGIDA"].includes(status)
        ? { status: status as "EM_ANDAMENTO" | "FINALIZADA" | "CORRIGIDA" }
        : {}),
      avaliacao: { titulo: { contains: busca, mode: "insensitive" as const } },
    };
    const [rows, total] = await Promise.all([
      db.tentativaAvaliacao.findMany({
        where,
        skip,
        take,
        orderBy: { idTentativa: "desc" },
        include: {
          aluno: { select: { nome: true, matricula: true } },
          avaliacao: { select: { titulo: true } },
          nota: true,
        },
      }),
      db.tentativaAvaliacao.count({ where }),
    ]);
    return {
      pagina,
      total,
      items: rows.map((t) => ({
        id: t.idTentativa,
        titulo: t.avaliacao.titulo,
        aluno: t.aluno.nome,
        matricula: t.aluno.matricula,
        status: t.status,
        prazoEm: t.prazoEm.toISOString(),
        nota: t.nota?.valor.toFixed(2) || null,
      })),
    };
  }
  throw new AppError("Recurso não encontrado.", 404);
}
export type AssessmentDetail = Awaited<ReturnType<typeof assessmentDetail>>;
export type AttemptDetail = Awaited<ReturnType<typeof attemptDetail>>;
