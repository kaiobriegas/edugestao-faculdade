"use client";
import type { StudentDetail, StudentOptions } from "../repositories/queries";
import { useStudentMutation } from "./use-mutation";
export function ResponsibleSection({
  detail,
  options,
  manage,
  onSaved,
}: {
  detail: StudentDetail;
  options: StudentOptions;
  manage: boolean;
  onSaved: () => Promise<void>;
}) {
  const { busy, run, feedback } = useStudentMutation(onSaved);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    if (
      await run(
        "vinculos",
        {
          alunoId: detail.aluno.id,
          responsavelId: Number(data.get("responsavelId")),
          parentesco: String(data.get("parentesco") || ""),
        },
        "Responsável vinculado.",
      )
    )
      form.reset();
  }
  return (
    <section className="panel">
      <h2>Responsáveis</h2>
      <p className="section-description">
        O mesmo responsável pode acompanhar vários alunos.
      </p>
      {feedback}
      {!detail.responsaveis.length && (
        <p className="empty">Nenhum responsável vinculado.</p>
      )}
      <div className="record-list">
        {detail.responsaveis.map((r) => (
          <article className="record-item" key={r.id}>
            <div>
              <strong>{r.nome}</strong>
              <p>
                {r.parentesco}
                {r.ativo ? "" : " · inativo"}
              </p>
              <small>
                {[r.telefone, r.email].filter(Boolean).join(" · ") ||
                  "Sem contato informado"}
              </small>
            </div>
            {manage && (
              <button
                className="btn small"
                disabled={busy}
                aria-label={`Desvincular ${r.nome}`}
                onClick={() => {
                  if (
                    window.confirm(
                      "Remover somente o vínculo deste responsável com o aluno?",
                    )
                  )
                    void run(
                      "vinculos",
                      {
                        alunoId: detail.aluno.id,
                        responsavelId: r.id,
                        parentesco: r.parentesco,
                        remover: true,
                      },
                      "Vínculo removido.",
                    );
                }}
              >
                Desvincular
              </button>
            )}
          </article>
        ))}
      </div>
      {manage && (
        <form className="stack" onSubmit={submit}>
          <div className="form-grid">
            <label className="field">
              Responsável
              <select
                name="responsavelId"
                required
                defaultValue=""
                aria-label="Responsável"
              >
                <option value="">Selecione um responsável cadastrado</option>
                {options.responsaveis
                  .filter((r) => r.ativo)
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nome}
                    </option>
                  ))}
              </select>
            </label>
            <label className="field">
              Parentesco neste vínculo
              <input
                name="parentesco"
                maxLength={60}
                placeholder="Ex.: mãe, pai, tutor"
              />
            </label>
          </div>
          <button
            className="btn primary"
            disabled={busy || !options.responsaveis.some((r) => r.ativo)}
          >
            Vincular responsável
          </button>
          <p className="note">
            Para alterar o parentesco, selecione novamente o responsável e
            salve. Cadastre novos responsáveis no menu Responsáveis.
          </p>
        </form>
      )}
    </section>
  );
}
