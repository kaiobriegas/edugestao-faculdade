"use client";
import type { StudentDetail } from "../repositories/queries";
import { useStudentMutation } from "./use-mutation";
export function DocumentSection({
  detail,
  manage,
  onSaved,
  maxBytes,
}: {
  detail: StudentDetail;
  manage: boolean;
  onSaved: () => Promise<void>;
  maxBytes: number;
}) {
  const { busy, run, feedback } = useStudentMutation(onSaved);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    data.set("alunoId", String(detail.aluno.id));
    if (await run("documentos", data, "Documento enviado com sucesso."))
      form.reset();
  }
  return (
    <section className="panel">
      <h2>Documentos</h2>
      <p className="section-description">
        Arquivos privados. O download verifica sua autorização.
      </p>
      {feedback}
      {manage && (
        <form className="stack" onSubmit={submit}>
          <div className="form-grid">
            <label className="field">
              Tipo do documento
              <input
                name="tipo"
                required
                minLength={2}
                maxLength={80}
                placeholder="Ex.: Identidade"
              />
            </label>
            <label className="field">
              Descrição do documento
              <input name="descricao" maxLength={1000} />
            </label>
            <label className="field">
              Arquivo
              <input
                type="file"
                name="arquivo"
                accept="application/pdf,image/png,image/jpeg"
                required
              />
            </label>
          </div>
          <p className="note">
            PDF, PNG ou JPEG. Limite de {Math.round(maxBytes / 1024 / 1024)} MB
            por arquivo. O conteúdo não é publicado em pasta pública.
          </p>
          <button className="btn primary" disabled={busy}>
            {busy ? "Enviando…" : "Enviar documento"}
          </button>
        </form>
      )}
      {!detail.documentos.length ? (
        <p className="empty">Nenhum documento cadastrado.</p>
      ) : (
        <div className="record-list">
          {detail.documentos.map((doc) => (
            <article className="record-item" key={doc.id}>
              <div>
                <strong>{doc.tipo}</strong>
                <p>
                  {doc.nomeArquivo} ·{" "}
                  {Math.max(1, Math.ceil(doc.tamanhoBytes / 1024))} KB
                </p>
                <small>
                  {new Date(doc.dataEnvio).toLocaleDateString("pt-BR")} ·{" "}
                  {doc.status}
                  {!doc.ativo && " · inativo"}
                </small>
                {doc.descricao && <p>{doc.descricao}</p>}
              </div>
              <div className="record-actions">
                <a
                  className="btn small"
                  href={`/api/alunos/documentos/${doc.id}`}
                  aria-label={`Baixar ${doc.nomeArquivo}`}
                >
                  Baixar
                </a>
                {manage && (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      const status = String(
                        new FormData(event.currentTarget).get("status"),
                      );
                      if (
                        status === "ARQUIVADO" &&
                        !window.confirm(
                          "Arquivar este documento? O aluno não poderá baixá-lo enquanto estiver arquivado.",
                        )
                      )
                        return;
                      void run(
                        "documentos",
                        { id: doc.id, status, ativo: status !== "ARQUIVADO" },
                        "Situação do documento atualizada.",
                      );
                    }}
                  >
                    <label className="field">
                      <span className="sr-only">
                        Situação de {doc.nomeArquivo}
                      </span>
                      <select name="status" defaultValue={doc.status}>
                        {["RECEBIDO", "VALIDADO", "REJEITADO", "ARQUIVADO"].map(
                          (s) => (
                            <option key={s}>{s}</option>
                          ),
                        )}
                      </select>
                    </label>
                    <button className="btn small" disabled={busy}>
                      Salvar situação
                    </button>
                  </form>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      <small className="muted">
        Mostrando os documentos mais recentes, até 100 registros.
      </small>
    </section>
  );
}
