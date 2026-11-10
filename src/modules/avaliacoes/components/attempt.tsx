"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api } from "@/modules/core/components/api";
import type { AttemptDetail } from "../repositories/queries";
import { AssessmentNav } from "./assessment-nav";
import { dateLabel, statusLabel } from "./fields";
type Answer = {
  questaoId: number;
  texto: string | null;
  alternativaSelecionada: "A" | "B" | "C" | "D" | null;
};
export function Attempt({
  initial,
  manager,
}: {
  initial: AttemptDetail;
  manager: boolean;
}) {
  const [data, setData] = useState(initial),
    [answers, setAnswers] = useState<Answer[]>(() =>
      initial.questoes.map((q) => ({
        questaoId: q.id,
        texto: q.resposta?.texto || null,
        alternativaSelecionada: q.resposta?.alternativaSelecionada || null,
      })),
    ),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [remaining, setRemaining] = useState(() =>
      Math.max(
        0,
        Math.ceil(
          (Date.parse(initial.prazoEm) - Date.parse(initial.serverNow)) / 1000,
        ),
      ),
    );
  const [receivedAt] = useState(() => Date.now());
  const timing = useRef({
      server: Date.parse(initial.serverNow),
      received: receivedAt,
    }),
    auto = useRef(false);
  const open = data.status === "EM_ANDAMENTO";
  async function reload() {
    const fresh = await api<AttemptDetail>(
      `/api/avaliacoes/tentativa?id=${data.id}`,
    );
    timing.current = {
      server: Date.parse(fresh.serverNow),
      received: Date.now(),
    };
    setData(fresh);
    if (fresh.status !== "EM_ANDAMENTO")
      setAnswers(
        fresh.questoes.map((q) => ({
          questaoId: q.id,
          texto: q.resposta?.texto || null,
          alternativaSelecionada: q.resposta?.alternativaSelecionada || null,
        })),
      );
  }
  async function operation(resource: string, body: unknown, success: string) {
    setBusy(true);
    setError("");
    try {
      const result = await api<{ expirado?: boolean }>(
        `/api/avaliacoes/${resource}`,
        body,
      );
      await reload();
      setMessage(
        result.expirado
          ? "Prazo encerrado: somente as respostas já salvas foram consideradas."
          : success,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!open) return;
    const timer = setInterval(
      () =>
        setRemaining(
          Math.max(
            0,
            Math.ceil(
              (Date.parse(data.prazoEm) -
                (timing.current.server +
                  Date.now() -
                  timing.current.received)) /
                1000,
            ),
          ),
        ),
      1000,
    );
    return () => clearInterval(timer);
  }, [open, data.prazoEm]);
  useEffect(() => {
    if (!open || manager || remaining > 0 || auto.current || busy) return;
    auto.current = true;
    api("/api/avaliacoes/finalizar", { tentativaId: data.id, respostas: [] })
      .then(() => api<AttemptDetail>(`/api/avaliacoes/tentativa?id=${data.id}`))
      .then((fresh) => {
        setData(fresh);
        setAnswers(
          fresh.questoes.map((q) => ({
            questaoId: q.id,
            texto: q.resposta?.texto || null,
            alternativaSelecionada: q.resposta?.alternativaSelecionada || null,
          })),
        );
        setMessage("Prazo encerrado: respostas salvas enviadas para correção.");
      })
      .catch((e) => setError(e.message));
  }, [open, manager, remaining, busy, data.id]);
  const change = (
    id: number,
    key: "texto" | "alternativaSelecionada",
    value: string,
  ) =>
    setAnswers((old) =>
      old.map((a) => (a.questaoId === id ? { ...a, [key]: value || null } : a)),
    );
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">TENTATIVA #{data.id}</p>
          <h1>{data.titulo}</h1>
          <p>
            {data.aluno} · {data.matricula}
          </p>
        </div>
        <Link className="btn" href="/avaliacoes/resultados">
          Voltar aos resultados
        </Link>
      </div>
      <AssessmentNav />
      {error && (
        <p className="alert error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="alert success" role="status">
          {message}
        </p>
      )}
      <section className="panel">
        <div className="stats">
          <div className="stat">
            <span>Situação</span>
            <strong>{statusLabel(data.status)}</strong>
          </div>
          <div className="stat">
            <span>Nota / valor da prova</span>
            <strong>
              {data.nota ?? "Pendente"} / {data.pontos}
            </strong>
          </div>
          <div className="stat">
            <span>{open ? "Tempo restante" : "Finalizada (Brasília)"}</span>
            <strong>
              {open
                ? `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`
                : dateLabel(data.finalizadaEm!)}
            </strong>
          </div>
        </div>
        {open && (
          <p className="note">
            Prazo: {dateLabel(data.prazoEm)}. Salve durante a prova. Após o
            prazo, somente as respostas já salvas serão consideradas.
          </p>
        )}
        {manager && open && remaining === 0 && (
          <button
            className="btn"
            disabled={busy}
            onClick={() =>
              operation(
                "encerrar-expirada",
                { tentativaId: data.id },
                "Tentativa encerrada.",
              )
            }
          >
            Encerrar tentativa expirada
          </button>
        )}
      </section>
      {data.questoes.map((q, index) => {
        const answer = answers.find((a) => a.questaoId === q.id)!;
        return (
          <section className="panel" key={q.id}>
            <fieldset
              className="assessment-question"
              disabled={busy || manager || !open || remaining === 0}
            >
              <legend>
                {index + 1}. {q.enunciado} ({q.pontuacao} ponto(s))
              </legend>
              {q.tipo === "OBJETIVA" ? (
                <div className="answer-options">
                  {(["A", "B", "C", "D"] as const).map((letter) => (
                    <label className="answer-option" key={letter}>
                      <input
                        type="radio"
                        name={`questao-${q.id}`}
                        checked={answer.alternativaSelecionada === letter}
                        onChange={() =>
                          change(q.id, "alternativaSelecionada", letter)
                        }
                      />
                      <span>
                        {letter}. {q[`alternativa${letter}`]}
                      </span>
                    </label>
                  ))}
                  {open && !manager && (
                    <button
                      type="button"
                      className="btn small"
                      onClick={() => change(q.id, "alternativaSelecionada", "")}
                    >
                      Limpar resposta {index + 1}
                    </button>
                  )}
                </div>
              ) : (
                <label className="field">
                  Resposta da questão {index + 1}
                  <textarea
                    rows={5}
                    maxLength={5000}
                    value={answer.texto || ""}
                    onChange={(e) => change(q.id, "texto", e.target.value)}
                  />
                </label>
              )}
            </fieldset>
            {!open && (
              <div className="note">
                {q.tipo === "OBJETIVA" && (
                  <p>Gabarito: {q.alternativaCorreta}</p>
                )}
                <p>
                  Pontuação obtida:{" "}
                  {q.resposta
                    ? (q.resposta.pontuacaoObtida ??
                      "Aguardando correção manual")
                    : "0 (não respondida)"}
                </p>
                {q.resposta?.comentario && (
                  <p>Comentário: {q.resposta.comentario}</p>
                )}
              </div>
            )}
            {manager && !open && q.tipo === "DISCURSIVA" && q.resposta && (
              <Correction
                key={`${q.resposta.id}-${q.resposta.pontuacaoObtida}`}
                id={q.resposta.id}
                index={index + 1}
                max={q.pontuacao}
                initialScore={q.resposta.pontuacaoObtida || ""}
                initialComment={q.resposta.comentario || ""}
                busy={busy}
                save={(pontuacao, comentario) =>
                  operation(
                    "corrigir",
                    { respostaId: q.resposta!.id, pontuacao, comentario },
                    "Correção salva com sucesso.",
                  )
                }
              />
            )}
          </section>
        );
      })}
      {open && !manager && (
        <section className="panel assessment-actions">
          <button
            className="btn"
            disabled={busy || remaining === 0}
            onClick={() =>
              operation(
                "respostas",
                { tentativaId: data.id, respostas: answers },
                "Respostas salvas com sucesso.",
              )
            }
          >
            Salvar respostas
          </button>
          <button
            className="btn primary"
            disabled={busy}
            onClick={() => {
              if (
                window.confirm(
                  "Finalizar a avaliação? Você não poderá alterar suas respostas.",
                )
              )
                void operation(
                  "finalizar",
                  { tentativaId: data.id, respostas: answers },
                  "Avaliação finalizada com sucesso.",
                );
            }}
          >
            Finalizar avaliação
          </button>
        </section>
      )}
    </>
  );
}
function Correction({
  id,
  index,
  max,
  initialScore,
  initialComment,
  busy,
  save,
}: {
  id: number;
  index: number;
  max: number;
  initialScore: string;
  initialComment: string;
  busy: boolean;
  save: (score: number, comment: string) => Promise<void>;
}) {
  const [score, setScore] = useState(initialScore),
    [comment, setComment] = useState(initialComment);
  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        void save(Number(score), comment);
      }}
    >
      <div className="form-grid">
        <label className="field" htmlFor={`score-${id}`}>
          Pontos da questão {index}
          <input
            id={`score-${id}`}
            type="number"
            min={0}
            max={max}
            step="0.01"
            required
            value={score}
            onChange={(e) => setScore(e.target.value)}
          />
        </label>
        <label className="field">
          Comentário da questão {index}
          <textarea
            value={comment}
            maxLength={2000}
            onChange={(e) => setComment(e.target.value)}
          />
        </label>
      </div>
      <button className="btn primary" disabled={busy}>
        Salvar correção {index}
      </button>
    </form>
  );
}
