"use client";
import { useEffect, useState } from "react";
import {
  EntityEditor,
  type FormValues,
} from "@/components/forms/entity-editor";
import { api } from "@/modules/core/components/api";
import { LibraryNav } from "./library-nav";
import { LibraryTable, type LibraryRow } from "./library-table";
import {
  fieldsFor,
  initialValues,
  payload,
  titles,
  createLabels,
  type Resource,
  type Options,
  stateLabel,
} from "./fields";
const empty: Options = {
  categorias: [],
  livros: [],
  exemplares: [],
  alunos: [],
};
export function LibraryList({
  resource,
  manager,
  initialBook = "",
}: {
  resource: Resource;
  manager: boolean;
  initialBook?: string;
}) {
  const [rows, setRows] = useState<LibraryRow[]>([]),
    [total, setTotal] = useState(0),
    [page, setPage] = useState(1),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState(""),
    [activity, setActivity] = useState(""),
    [book, setBook] = useState(initialBook),
    [category, setCategory] = useState(""),
    [student, setStudent] = useState(""),
    [options, setOptions] = useState<Options>(empty),
    [loading, setLoading] = useState(true),
    [ready, setReady] = useState(false),
    [values, setValues] = useState<FormValues | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let alive = true;
    api<Options>(`/api/biblioteca/${manager ? "opcoes" : "filtros"}`)
      .then((v) => {
        if (alive) {
          setOptions({ ...empty, ...v });
          setReady(true);
        }
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [manager, refresh]);
  useEffect(() => {
    let alive = true;
    const query = new URLSearchParams({
      pagina: String(page),
      busca: search,
      status,
      situacao: activity,
      livroId: book,
      categoriaId: category,
      alunoId: student,
    });
    api<{ items: LibraryRow[]; total: number }>(
      `/api/biblioteca/${resource}?${query}`,
    )
      .then((v) => {
        if (alive) {
          setRows(v.items);
          setTotal(v.total);
        }
      })
      .catch((e) => {
        if (alive) setError(e.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [
    resource,
    page,
    search,
    status,
    activity,
    book,
    category,
    student,
    refresh,
  ]);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!values) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api(`/api/biblioteca/${resource}`, payload(resource, values));
      setValues(null);
      setRefresh((v) => v + 1);
      setMessage(
        resource === "emprestimos"
          ? "Empréstimo registrado com sucesso."
          : resource === "reservas"
            ? "Reserva registrada com sucesso."
            : "Cadastro salvo com sucesso.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function edit(row: LibraryRow) {
    const next = initialValues(resource);
    for (const key of Object.keys(next))
      next[key] =
        row[key as keyof LibraryRow] === null ||
        row[key as keyof LibraryRow] === undefined
          ? ""
          : String(row[key as keyof LibraryRow]);
    next.id = String(row.id);
    setValues(next);
    setMessage("");
  }
  async function action(
    resource: string,
    body: unknown,
    prompt: string,
    success: string,
  ) {
    if (!window.confirm(prompt)) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api(`/api/biblioteca/${resource}`, body);
      setRefresh((v) => v + 1);
      setMessage(success);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const states =
    resource === "emprestimos"
      ? ["ABERTO", "ATRASADO", "DEVOLVIDO"]
      : resource === "reservas"
        ? ["ATIVA", "ATENDIDA", "CANCELADA", "EXPIRADA"]
        : resource === "exemplares"
          ? ["DISPONIVEL", "EMPRESTADO", "INDISPONIVEL"]
          : resource === "livros"
            ? ["DISPONIVEL"]
            : [];
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">BIBLIOTECA</p>
          <h1>
            {!manager && resource === "emprestimos"
              ? "Meus empréstimos"
              : !manager && resource === "reservas"
                ? "Minhas reservas"
                : titles[resource]}
          </h1>
          <p>
            {resource === "livros"
              ? "Pesquise títulos, autores e ISBN. Consulte exemplares disponíveis."
              : resource === "emprestimos"
                ? "Acompanhe retiradas, prazos e devoluções."
                : resource === "reservas"
                  ? "Reservas de livros com validade informada pelo gestor."
                  : "Organize o acervo e preserve o histórico."}
          </p>
        </div>
        {manager && (
          <button
            className="btn primary"
            disabled={!ready || busy}
            onClick={() => {
              setValues(initialValues(resource));
              setMessage("");
              setError("");
            }}
          >
            {createLabels[resource]}
          </button>
        )}
      </div>
      <LibraryNav manager={manager} />
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
      {values && (
        <EntityEditor
          fields={fieldsFor(resource, options, values)}
          values={values}
          change={(k, v) => setValues({ ...values, [k]: v })}
          submit={submit}
          close={() => setValues(null)}
          saving={busy}
          editing={!!values.id}
        />
      )}
      <section className="panel">
        <div className="filters">
          <label className="field search-field">
            Pesquisar
            <input
              value={search}
              maxLength={120}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </label>
          {states.length > 0 && (
            <label className="field">
              Filtrar situação
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Todas</option>
                {states.map((s) => (
                  <option key={s} value={s}>
                    {stateLabel(s)}
                  </option>
                ))}
              </select>
            </label>
          )}
          {manager &&
            ["livros", "categorias", "exemplares"].includes(resource) && (
              <label className="field">
                Filtrar cadastro
                <select
                  value={activity}
                  onChange={(e) => {
                    setActivity(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">Todos</option>
                  <option value="ativo">Ativo</option>
                  <option value="inativo">Inativo</option>
                </select>
              </label>
            )}
          {resource === "livros" && (
            <label className="field">
              Filtrar categoria
              <select
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Todas</option>
                {options.categorias.map((c) => (
                  <option value={c.id} key={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </label>
          )}
          {resource !== "livros" && resource !== "categorias" && manager && (
            <>
              <label className="field">
                Filtrar livro
                <select
                  value={book}
                  onChange={(e) => {
                    setBook(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">Todos</option>
                  {options.livros.map((c) => (
                    <option value={c.id} key={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </label>
              {resource !== "exemplares" && (
                <label className="field">
                  Filtrar aluno
                  <select
                    value={student}
                    onChange={(e) => {
                      setStudent(e.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="">Todos</option>
                    {options.alunos.map((c) => (
                      <option value={c.id} key={c.id}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </>
          )}
          {initialBook && !manager && book && (
            <button className="btn small" onClick={() => setBook("")}>
              Mostrar todos os livros
            </button>
          )}
        </div>
        {loading ? (
          <p role="status">Carregando biblioteca…</p>
        ) : !rows.length ? (
          <div className="empty">
            <h2>Nenhum registro encontrado</h2>
            <p>
              {manager
                ? "Cadastre um registro ou ajuste os filtros."
                : "Os registros autorizados aparecerão aqui. Solicite empréstimos e reservas ao gestor."}
            </p>
          </div>
        ) : (
          <LibraryTable
            resource={resource}
            rows={rows}
            manager={manager}
            busy={busy}
            edit={edit}
            action={action}
          />
        )}
        <div className="pagination">
          <span>{total} registro(s)</span>
          <button
            className="btn small"
            disabled={page <= 1}
            onClick={() => setPage((v) => v - 1)}
          >
            Anterior
          </button>
          <span>Página {page}</span>
          <button
            className="btn small"
            disabled={page * 10 >= total}
            onClick={() => setPage((v) => v + 1)}
          >
            Próxima
          </button>
        </div>
      </section>
      {resource === "reservas" && (
        <p className="note">
          Reserva não bloqueia exemplares nem concede prioridade automática.
          Vencidas são exibidas como expiradas; o gestor pode registrar seu
          encerramento.
        </p>
      )}
      {manager && (
        <p className="muted">
          Os seletores carregam até 1.000 opções. Se necessário, ajuste o
          cadastro antes da operação.
        </p>
      )}
    </>
  );
}
