"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { isManager, isRoot, type Actor } from "@/modules/core/contracts/access";
import { api } from "@/modules/core/components/api";
import type { StudentOptions } from "../repositories/queries";
import { emptyOptions, fieldsFor, studentStatuses } from "./fields";
import { EntityEditor, type FormValues } from "./entity-editor";
import { StudentNav } from "./student-nav";
type Row = {
  id: number;
  nome: string;
  detalhe: string;
  complemento: string;
  ativo: boolean;
  [key: string]: unknown;
};
const titles: Record<string, string> = {
  alunos: "Gestão de Alunos",
  turmas: "Turmas",
  responsaveis: "Responsáveis",
};
export function StudentList({
  resource,
  actor,
}: {
  resource: "alunos" | "turmas" | "responsaveis";
  actor: Actor;
}) {
  const manager = isManager(actor);
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]),
    [options, setOptions] = useState<StudentOptions>(emptyOptions),
    [total, setTotal] = useState(0);
  const [search, setSearch] = useState(""),
    [state, setState] = useState(""),
    [turma, setTurma] = useState(""),
    [academicStatus, setAcademicStatus] = useState("");
  const [page, setPage] = useState(1),
    [version, setVersion] = useState(0),
    [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [values, setValues] = useState<FormValues | null>(null),
    [editing, setEditing] = useState<Row | null>(null);
  const fields = useMemo(
    () => fieldsFor(resource, options, isRoot(actor)),
    [resource, options, actor],
  );
  useEffect(() => {
    let ignore = false;
    async function load() {
      setLoading(true);
      try {
        const [result, opts] = await Promise.all([
          api<{ rows: Row[]; total: number }>(
            `/api/alunos/${resource}?` +
              new URLSearchParams({
                busca: search,
                situacao: state,
                pagina: String(page),
                turmaId: turma,
                status: academicStatus,
              }),
          ),
          manager
            ? api<StudentOptions>("/api/alunos/opcoes")
            : Promise.resolve(emptyOptions),
        ]);
        if (!ignore) {
          setRows(result.rows);
          setTotal(result.total);
          setOptions(opts);
        }
      } catch (e) {
        if (!ignore)
          setError(
            e instanceof Error ? e.message : "Erro ao carregar os cadastros.",
          );
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    void load();
    return () => {
      ignore = true;
    };
  }, [resource, search, state, page, turma, academicStatus, version, manager]);
  function edit(row?: Row) {
    const initial: FormValues = {
      ativo: "true",
      status: "MATRICULADO",
      dataMatricula: new Date().toISOString().slice(0, 10),
      ano: String(new Date().getFullYear()),
      periodo: "Manhã",
      capacidade: "30",
    };
    for (const f of fields)
      if (row) initial[f.name] = String(row[f.name] ?? "");
    initial.confirmacaoSenha = "";
    setValues(initial);
    setEditing(row || null);
    setError("");
    setNotice("");
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!values) return;
    if (
      editing?.ativo &&
      values.ativo === "false" &&
      !window.confirm("Inativar este cadastro? O histórico será preservado.")
    )
      return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const body: Record<string, unknown> = editing ? { id: editing.id } : {};
      for (const f of fields) {
        const value = values[f.name] || "";
        body[f.name] =
          f.name === "ativo"
            ? value === "true"
            : f.type === "number" || ["turmaId", "usuarioId"].includes(f.name)
              ? value
                ? Number(value)
                : f.nullable
                  ? null
                  : 0
              : value;
      }
      await api(`/api/alunos/${resource}`, body);
      setNotice("Cadastro salvo com sucesso.");
      setValues(null);
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
      <StudentNav manage={manager} />
      <div className="page-heading">
        <div>
          <p className="eyebrow">CADASTRO ACADÊMICO</p>
          <h1>{manager ? titles[resource] : "Meu cadastro acadêmico"}</h1>
          <p>
            {resource === "alunos"
              ? "Uma identidade acadêmica para todos os módulos."
              : resource === "turmas"
                ? "Organize as turmas e acompanhe as vagas disponíveis."
                : "Cadastre os responsáveis e vincule-os na ficha do aluno."}
          </p>
        </div>
        {manager && (
          <button
            className="btn primary"
            disabled={loading}
            onClick={() => edit()}
          >
            <Plus size={17} />
            {resource === "alunos"
              ? "Novo aluno"
              : resource === "turmas"
                ? "Nova turma"
                : "Novo responsável"}
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
      {values && (
        <EntityEditor
          fields={fields}
          values={values}
          change={(key, value) =>
            setValues((v) => (v ? { ...v, [key]: value } : v))
          }
          submit={save}
          close={() => setValues(null)}
          saving={saving}
          editing={!!editing}
        />
      )}
      <section className="panel">
        <div className="filters">
          <label className="search-field">
            <Search size={18} />
            <input
              aria-label="Pesquisar cadastros"
              placeholder={
                resource === "alunos" ? "Nome ou matrícula…" : "Pesquisar…"
              }
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <select
            aria-label="Filtrar cadastro"
            value={state}
            onChange={(e) => {
              setState(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Todos os cadastros</option>
            <option value="ativo">Ativos</option>
            <option value="inativo">Inativos</option>
          </select>
          {resource === "alunos" && manager && (
            <>
              <select
                aria-label="Filtrar turma"
                value={turma}
                onChange={(e) => {
                  setTurma(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Todas as turmas</option>
                {options.turmas.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome}
                  </option>
                ))}
              </select>
              <select
                aria-label="Filtrar status acadêmico"
                value={academicStatus}
                onChange={(e) => {
                  setAcademicStatus(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Todos os status</option>
                {studentStatuses.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </>
          )}
        </div>
        {loading ? (
          <p className="empty" role="status">
            Carregando cadastros…
          </p>
        ) : !rows.length ? (
          <div className="empty">
            <h3>Nenhum cadastro encontrado</h3>
            <p>
              {manager
                ? "Cadastre uma turma e, depois, seus alunos. Ajuste os filtros se necessário."
                : "Seu cadastro acadêmico ainda não foi vinculado a esta conta. Solicite o vínculo ao root."}
            </p>
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Informações</th>
                  <th>Situação</th>
                  <th>Ações</th>
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
                      <small>{row.complemento}</small>
                    </td>
                    <td>
                      <span className={row.ativo ? "tag green" : "tag"}>
                        {row.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td>
                      <div className="actions">
                        {resource === "alunos" && (
                          <Link
                            className="btn small"
                            href={`/alunos/${row.id}`}
                          >
                            Abrir ficha
                          </Link>
                        )}
                        {manager && (
                          <button
                            className="btn small"
                            aria-label={`Editar ${row.nome}`}
                            onClick={() => edit(row)}
                          >
                            Editar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="pagination">
          <span>
            {total} cadastro(s) · Página {page} de{" "}
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
    </>
  );
}
