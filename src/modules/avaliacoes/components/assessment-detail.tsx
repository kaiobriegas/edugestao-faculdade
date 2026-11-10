"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  EntityEditor,
  type FormValues,
} from "@/components/forms/entity-editor";
import { api } from "@/modules/core/components/api";
import { localLessonTime } from "@/lib/academic-time";
import type { AssessmentDetail as Detail } from "../repositories/queries";
import { AssessmentNav } from "./assessment-nav";
import { assessmentFields, questionFields, dateLabel } from "./fields";
export function AssessmentDetail({
  initial,
  manager,
}: {
  initial: Detail;
  manager: boolean;
}) {
  const router = useRouter(),
    [data, setData] = useState(initial),
    [editor, setEditor] = useState<"assessment" | "question" | null>(null),
    [values, setValues] = useState<FormValues>({}),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function reload() {
    setData(await api<Detail>(`/api/avaliacoes/detalhes?id=${data.id}`));
  }
  function editAssessment() {
    setValues({
      id: String(data.id),
      titulo: data.titulo,
      descricao: data.descricao || "",
      tipo: data.tipo,
      dataAplicacao: localLessonTime(new Date(data.dataAplicacao)),
      tempoLimite: String(data.tempoLimite),
      ativo: String(data.ativo),
    });
    setEditor("assessment");
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (editor === "assessment")
        await api("/api/avaliacoes/avaliacoes", {
          ...values,
          id: Number(values.id),
          tempoLimite: Number(values.tempoLimite),
          ativo: values.ativo === "true",
        });
      else {
        const objective = values.tipo === "OBJETIVA";
        await api("/api/avaliacoes/questoes", {
          ...(values.id ? { id: Number(values.id) } : {}),
          avaliacaoId: data.id,
          enunciado: values.enunciado,
          tipo: values.tipo,
          pontuacao: Number(values.pontuacao),
          ativo: values.ativo === "true",
          ...Object.fromEntries(
            ["A", "B", "C", "D"].map((l) => [
              "alternativa" + l,
              objective ? values["alternativa" + l] : null,
            ]),
          ),
          alternativaCorreta: objective ? values.alternativaCorreta : null,
        });
      }
      await reload();
      setEditor(null);
      setMessage("Cadastro salvo com sucesso.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function start() {
    if (
      !data.tentativaId &&
      !window.confirm("Iniciar a prova agora? O prazo começa imediatamente.")
    )
      return;
    setBusy(true);
    try {
      const r = await api<{ id: number }>("/api/avaliacoes/iniciar", {
        avaliacaoId: data.id,
      });
      router.push(`/avaliacoes/tentativas/${r.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">AVALIAÇÃO</p>
          <h1>{data.titulo}</h1>
          <p>{data.descricao}</p>
        </div>
        {manager ? (
          <button className="btn" onClick={editAssessment}>
            Editar avaliação
          </button>
        ) : (
          <button className="btn primary" disabled={busy} onClick={start}>
            {data.tentativaId ? "Abrir minha tentativa" : "Iniciar avaliação"}
          </button>
        )}
      </div>
      <AssessmentNav />
      {error && (
        <p role="alert" className="alert error">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="alert success">
          {message}
        </p>
      )}
      <section className="panel">
        <div className="stats">
          <div className="stat">
            <span>Liberação (Brasília)</span>
            <strong>{dateLabel(data.dataAplicacao)}</strong>
          </div>
          <div className="stat">
            <span>Prazo após iniciar</span>
            <strong>{data.tempoLimite} min</strong>
          </div>
          <div className="stat">
            <span>Questões / pontos</span>
            <strong>
              {data.quantidade} / {data.pontos}
            </strong>
          </div>
        </div>
        <p className="note">
          {data.ativo
            ? "Avaliação ativa."
            : "Avaliação inativa: novas tentativas bloqueadas."}{" "}
          {manager && data.bloqueada
            ? "O conteúdo está bloqueado porque já existe tentativa iniciada. Apenas a situação pode ser alterada."
            : "Uma tentativa por aluno. Salve as respostas durante a prova."}
        </p>
      </section>
      {editor && (
        <EntityEditor
          fields={
            editor === "assessment"
              ? assessmentFields.map((f) => ({
                  ...f,
                  disabled: data.bloqueada && f.name !== "ativo",
                }))
              : questionFields(values.tipo === "OBJETIVA")
          }
          values={values}
          change={(k, v) => setValues({ ...values, [k]: v })}
          submit={submit}
          close={() => setEditor(null)}
          saving={busy}
          editing={!!values.id}
        />
      )}
      {manager && (
        <section className="panel">
          <div className="section-heading">
            <h2>Questões</h2>
            <button
              className="btn primary"
              disabled={data.bloqueada}
              onClick={() => {
                setValues({
                  enunciado: "",
                  tipo: "OBJETIVA",
                  pontuacao: "1",
                  alternativaA: "",
                  alternativaB: "",
                  alternativaC: "",
                  alternativaD: "",
                  alternativaCorreta: "A",
                  ativo: "true",
                });
                setEditor("question");
              }}
            >
              Nova questão
            </button>
          </div>
          {!data.questoes?.length && (
            <p className="empty">
              Cadastre as questões antes de liberar a avaliação.
            </p>
          )}
          <div className="record-list">
            {data.questoes?.map((q, i) => (
              <article className="record-item" key={q.idQuestao}>
                <div>
                  <h3>
                    {i + 1}. {q.enunciado}
                  </h3>
                  <p>
                    {q.tipo === "OBJETIVA"
                      ? `Objetiva · gabarito ${q.alternativaCorreta}`
                      : "Discursiva · correção manual"}{" "}
                    · {q.pontuacao} ponto(s) · {q.ativo ? "Ativa" : "Inativa"}
                  </p>
                </div>
                <button
                  className="btn small"
                  disabled={data.bloqueada}
                  onClick={() => {
                    setValues({
                      id: String(q.idQuestao),
                      enunciado: q.enunciado,
                      tipo: q.tipo,
                      pontuacao: String(q.pontuacao),
                      alternativaA: q.alternativaA || "",
                      alternativaB: q.alternativaB || "",
                      alternativaC: q.alternativaC || "",
                      alternativaD: q.alternativaD || "",
                      alternativaCorreta: q.alternativaCorreta || "A",
                      ativo: String(q.ativo),
                    });
                    setEditor("question");
                  }}
                >
                  Editar questão {i + 1}
                </button>
              </article>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
