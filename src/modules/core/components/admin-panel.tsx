"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Pencil, X } from "lucide-react";
import type { Actor } from "../contracts/access";
import { api, navigateSession } from "./api";
type Row = {
  id: number;
  nome: string;
  email?: string;
  descricao?: string | null;
  ativo?: boolean;
  grupoId?: number;
  papelId?: number;
  moduloIds?: number[];
  detalhe?: string;
  complemento?: string;
};
type Editor = {
  id?: number;
  nome: string;
  email: string;
  senha: string;
  descricao: string;
  ativo: boolean;
  grupoId: number;
  papelId: number;
  moduloIds: number[];
  confirmacaoSenha: string;
};
type Options = {
  grupos: { idGrupo: number; nome: string; ativo: boolean }[];
  papeis: { idPapel: number; nome: string }[];
  modulos: { idModulo: number; nome: string; ativo: boolean }[];
};
const blankOptions: Options = { grupos: [], papeis: [], modulos: [] };
export function AdminPanel({
  resource,
  title,
  actor,
}: {
  resource: string;
  title: string;
  actor: Actor;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [options, setOptions] = useState(blankOptions);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editor, setEditor] = useState<Editor | null>(null);
  const [confirming, setConfirming] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const readonly = resource === "eventos";
  useEffect(() => {
    let ignore = false;
    async function load() {
      setLoading(true);
      try {
        const [result, opts] = await Promise.all([
          api<{ rows: Row[]; total: number }>(
            `/api/core/${resource}?` +
              new URLSearchParams({
                busca: search,
                pagina: String(page),
                situacao: status,
              }),
          ),
          api<Options>("/api/core/opcoes"),
        ]);
        if (!ignore) {
          setRows(result.rows);
          setTotal(result.total);
          setOptions(opts);
        }
      } catch (e) {
        if (!ignore)
          setError(e instanceof Error ? e.message : "Erro ao carregar.");
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    void load();
    return () => {
      ignore = true;
    };
  }, [resource, page, search, status, version]);
  useEffect(() => {
    if (confirming) dialog.current?.showModal();
    else dialog.current?.close();
  }, [confirming]);
  function edit(row?: Row) {
    setError("");
    setNotice("");
    setEditor({
      id: row?.id,
      nome: row?.nome || "",
      email: row?.email || "",
      senha: "",
      descricao: row?.descricao || "",
      ativo: row?.ativo ?? true,
      grupoId: row?.grupoId || actor.grupoId,
      papelId:
        row?.papelId ||
        options.papeis.find((p) => p.nome === "Usuário")?.idPapel ||
        0,
      moduloIds: row?.moduloIds || [],
      confirmacaoSenha: "",
    });
  }
  function change<K extends keyof Editor>(field: K, value: Editor[K]) {
    setEditor((current) =>
      current ? { ...current, [field]: value } : current,
    );
  }
  async function save() {
    if (!editor) return;
    setConfirming(false);
    setSaving(true);
    setError("");
    try {
      const common = {
        id: editor.id,
        confirmacaoSenha: editor.confirmacaoSenha,
      };
      const body =
        resource === "usuarios"
          ? {
              ...common,
              nome: editor.nome,
              email: editor.email,
              senha: editor.senha || undefined,
              grupoId: editor.grupoId,
              papelId: editor.papelId,
              ativo: editor.ativo,
            }
          : resource === "grupos"
            ? {
                ...common,
                nome: editor.nome,
                descricao: editor.descricao,
                ativo: editor.ativo,
                moduloIds: editor.moduloIds,
              }
            : resource === "papeis"
              ? { ...common, descricao: editor.descricao }
              : {
                  ...common,
                  nome: editor.nome,
                  descricao: editor.descricao,
                  ativo: editor.ativo,
                };
      const result = await api<{ relogin?: boolean }>(
        `/api/core/${resource}`,
        body,
      );
      if (result.relogin) {
        navigateSession("/login");
        return;
      }
      setEditor(null);
      setNotice("Alteração salva com sucesso.");
      setVersion((v) => v + 1);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">ADMINISTRAÇÃO</p>
          <h1>{title}</h1>
          <p>
            {readonly
              ? "Acompanhe as ações registradas no sistema."
              : "Cadastre e organize os acessos da plataforma."}
          </p>
        </div>
        {["usuarios", "grupos"].includes(resource) && (
          <button
            className="btn primary"
            disabled={loading}
            onClick={() => edit()}
          >
            <Plus size={17} />
            {resource === "usuarios" ? "Novo usuário" : "Novo grupo"}
          </button>
        )}
      </div>
      {error && (
        <p className="alert error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="alert success" role="status">
          {notice}
        </p>
      )}
      {editor && (
        <section className="panel edit-panel">
          <div className="section-heading">
            <h2>{editor.id ? "Editar registro" : "Novo cadastro"}</h2>
            <button
              className="icon-button"
              onClick={() => setEditor(null)}
              aria-label="Fechar formulário"
            >
              <X size={19} />
            </button>
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setConfirming(true);
            }}
            className="stack"
          >
            <div className="form-grid">
              <label className="field">
                Nome
                <input
                  value={editor.nome}
                  onChange={(e) => change("nome", e.target.value)}
                  required
                  minLength={2}
                  maxLength={120}
                  disabled={resource === "papeis"}
                />
              </label>
              {resource === "usuarios" ? (
                <>
                  <label className="field">
                    E-mail
                    <input
                      type="email"
                      value={editor.email}
                      onChange={(e) => change("email", e.target.value)}
                      required
                      maxLength={254}
                    />
                  </label>
                  <label className="field">
                    {editor.id
                      ? "Nova senha (opcional)"
                      : "Senha do novo usuário"}
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={editor.senha}
                      onChange={(e) => change("senha", e.target.value)}
                      required={!editor.id}
                      minLength={10}
                      maxLength={128}
                    />
                  </label>
                  <label className="field">
                    Grupo
                    <select
                      value={editor.grupoId}
                      onChange={(e) =>
                        change("grupoId", Number(e.target.value))
                      }
                      required
                    >
                      {options.grupos.map((g) => (
                        <option
                          key={g.idGrupo}
                          value={g.idGrupo}
                          disabled={!g.ativo}
                        >
                          {g.nome}
                          {g.ativo ? "" : " (inativo)"}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    Papel
                    <select
                      value={editor.papelId}
                      onChange={(e) =>
                        change("papelId", Number(e.target.value))
                      }
                      required
                    >
                      <option value="">Selecione</option>
                      {options.papeis.map((p) => (
                        <option key={p.idPapel} value={p.idPapel}>
                          {p.nome}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              ) : (
                <label className="field">
                  Descrição
                  <textarea
                    value={editor.descricao}
                    onChange={(e) => change("descricao", e.target.value)}
                    maxLength={1000}
                    rows={3}
                  />
                </label>
              )}
              {resource !== "papeis" && (
                <label className="field">
                  Situação
                  <select
                    value={editor.ativo ? "ativo" : "inativo"}
                    onChange={(e) =>
                      change("ativo", e.target.value === "ativo")
                    }
                  >
                    <option value="ativo">Ativo</option>
                    <option value="inativo">Inativo</option>
                  </select>
                </label>
              )}
              <label className="field">
                Sua senha para confirmar
                <input
                  type="password"
                  value={editor.confirmacaoSenha}
                  onChange={(e) => change("confirmacaoSenha", e.target.value)}
                  autoComplete="current-password"
                  required
                  maxLength={128}
                />
              </label>
            </div>
            {resource === "grupos" && (
              <fieldset className="module-checks">
                <legend>Módulos habilitados para o grupo</legend>
                {options.modulos.map((m) => (
                  <label key={m.idModulo}>
                    <input
                      type="checkbox"
                      checked={editor.moduloIds.includes(m.idModulo)}
                      onChange={(e) =>
                        change(
                          "moduloIds",
                          e.target.checked
                            ? [...editor.moduloIds, m.idModulo]
                            : editor.moduloIds.filter(
                                (id) => id !== m.idModulo,
                              ),
                        )
                      }
                    />
                    {m.nome}
                    {!m.ativo && " (catálogo inativo)"}
                  </label>
                ))}
              </fieldset>
            )}
            {resource === "papeis" && (
              <p className="note">
                Os três papéis globais são fixos. Edite a descrição; atribuições
                são feitas em Usuários.
              </p>
            )}
            <div className="actions">
              <button className="btn primary" disabled={saving}>
                {saving ? "Salvando…" : "Salvar alterações"}
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => setEditor(null)}
              >
                Cancelar
              </button>
            </div>
          </form>
        </section>
      )}
      <section className="panel">
        <div className="filters">
          <label className="search-field">
            <Search size={18} />
            <input
              aria-label="Pesquisar registros"
              placeholder={
                readonly ? "Buscar por ação…" : "Buscar por nome ou e-mail…"
              }
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </label>
          {!["papeis", "eventos"].includes(resource) && (
            <select
              aria-label="Filtrar situação"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Todas as situações</option>
              <option value="ativo">Ativos</option>
              <option value="inativo">Inativos</option>
            </select>
          )}
        </div>
        {loading ? (
          <p className="empty" role="status">
            Carregando registros…
          </p>
        ) : !rows.length ? (
          <div className="empty">
            <h3>Nenhum registro encontrado</h3>
            <p>
              {readonly
                ? "Os eventos aparecerão após as operações no sistema."
                : "Ajuste a pesquisa ou faça um novo cadastro."}
            </p>
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{readonly ? "Ação" : "Registro"}</th>
                  <th>Detalhes</th>
                  <th>{readonly ? "Data" : "Situação"}</th>
                  {!readonly && (
                    <th>
                      <span className="sr-only">Ações</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <strong>{row.nome}</strong>
                      <small>#{row.id}</small>
                    </td>
                    <td>
                      {row.detalhe}
                      <small>{readonly ? "" : row.complemento}</small>
                    </td>
                    <td>
                      {readonly ? (
                        row.complemento
                      ) : row.ativo === undefined ? (
                        <span className="tag">Global</span>
                      ) : (
                        <span className={row.ativo ? "tag green" : "tag"}>
                          {row.ativo ? "Ativo" : "Inativo"}
                        </span>
                      )}
                    </td>
                    {!readonly && (
                      <td>
                        <button
                          className="btn small"
                          onClick={() => edit(row)}
                          aria-label={`Editar ${row.nome}`}
                        >
                          <Pencil size={14} />
                          Editar
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="pagination">
          <span>
            {total} registro(s) · Página {page} de{" "}
            {Math.max(1, Math.ceil(total / 10))}
          </span>
          <div className="actions">
            <button
              className="btn small"
              disabled={page === 1 || loading}
              onClick={() => setPage((p) => p - 1)}
            >
              Anterior
            </button>
            <button
              className="btn small"
              disabled={page * 10 >= total || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima
            </button>
          </div>
        </div>
      </section>
      <dialog
        ref={dialog}
        onCancel={() => setConfirming(false)}
        className="confirmation"
      >
        <h2>Confirmar alteração</h2>
        <p>Os dados serão salvos e as permissões atualizadas imediatamente.</p>
        <div className="actions">
          <button className="btn primary" onClick={save}>
            Confirmar
          </button>
          <button className="btn" onClick={() => setConfirming(false)}>
            Voltar
          </button>
        </div>
      </dialog>
    </>
  );
}
