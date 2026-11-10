"use client";
import { useState } from "react";
import type { StudentDetail } from "../repositories/queries";
import { useStudentMutation } from "./use-mutation";
type Occurrence = StudentDetail["ocorrencias"][number];
export function OccurrenceSection({
  detail,
  onSaved,
}: {
  detail: StudentDetail;
  onSaved: () => Promise<void>;
}) {
  const { busy, run, feedback } = useStudentMutation(onSaved);
  const [editing, setEditing] = useState<Occurrence | null>(null);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const body = {
      id: editing?.id,
      alunoId: detail.aluno.id,
      tipo: String(data.get("tipo")),
      descricao: String(data.get("descricao")),
      dataOcorrencia: String(data.get("dataOcorrencia")),
      status: String(data.get("status")),
      ativo: true,
    };
    if (await run("ocorrencias", body, "Ocorrência salva com sucesso.")) {
      form.reset();
      setEditing(null);
    }
  }
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <h2>Ocorrências internas</h2>
          <p>
            Visíveis somente a gestores autorizados. Autoria registrada pelo
            sistema.
          </p>
        </div>
      </div>
      {feedback}
      <form key={editing?.id || "new"} className="stack" onSubmit={submit}>
        <h3>{editing ? "Editar ocorrência" : "Registrar ocorrência"}</h3>
        <div className="form-grid">
          <label className="field">
            Tipo da ocorrência
            <input
              name="tipo"
              required
              minLength={2}
              maxLength={80}
              defaultValue={editing?.tipo || ""}
            />
          </label>
          <label className="field">
            Data da ocorrência
            <input
              type="date"
              name="dataOcorrencia"
              required
              defaultValue={
                editing?.dataOcorrencia || new Date().toISOString().slice(0, 10)
              }
            />
          </label>
          <label className="field">
            Status da ocorrência
            <select
              name="status"
              defaultValue={editing?.status || "REGISTRADA"}
            >
              {["REGISTRADA", "EM_ACOMPANHAMENTO", "CONCLUIDA"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Descrição da ocorrência
            <textarea
              name="descricao"
              required
              minLength={3}
              maxLength={5000}
              rows={3}
              defaultValue={editing?.descricao || ""}
            />
          </label>
        </div>
        <div className="actions">
          <button className="btn primary" disabled={busy}>
            {editing ? "Salvar ocorrência" : "Registrar ocorrência"}
          </button>
          {editing && (
            <button
              type="button"
              className="btn"
              onClick={() => setEditing(null)}
            >
              Cancelar edição
            </button>
          )}
        </div>
      </form>
      {!detail.ocorrencias.length ? (
        <p className="empty">Nenhuma ocorrência registrada.</p>
      ) : (
        <div className="record-list">
          {detail.ocorrencias.map((o) => (
            <article className="record-item" key={o.id}>
              <div>
                <strong>{o.tipo}</strong>
                <p>{o.descricao}</p>
                <small>
                  {o.dataOcorrencia.split("-").reverse().join("/")} · {o.status}{" "}
                  · Por {o.autor}
                  {!o.ativo && " · inativa"}
                </small>
              </div>
              <div className="actions">
                <button
                  className="btn small"
                  disabled={busy}
                  onClick={() => setEditing(o)}
                  aria-label={`Editar ocorrência ${o.tipo}`}
                >
                  Editar
                </button>
                {o.ativo && (
                  <button
                    className="btn small"
                    disabled={busy}
                    aria-label={`Inativar ocorrência ${o.tipo}`}
                    onClick={() => {
                      if (
                        window.confirm(
                          "Inativar esta ocorrência mantendo o histórico?",
                        )
                      )
                        void run(
                          "ocorrencias",
                          {
                            id: o.id,
                            alunoId: detail.aluno.id,
                            tipo: o.tipo,
                            descricao: o.descricao,
                            dataOcorrencia: o.dataOcorrencia,
                            status: o.status,
                            ativo: false,
                          },
                          "Ocorrência inativada.",
                        );
                    }}
                  >
                    Inativar
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      <small className="muted">
        Mais recentes, até 100 ocorrências. A edição preserva o autor original.
      </small>
    </section>
  );
}
