"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  EntityEditor,
  type FormValues,
} from "@/components/forms/entity-editor";
import { api } from "@/modules/core/components/api";
import { AssessmentNav } from "./assessment-nav";
import { assessmentFields, dateLabel, statusLabel } from "./fields";
type Row = {
  id: number;
  titulo: string;
  tipo?: string;
  ativo?: boolean;
  tempoLimite?: number;
  questoes?: number;
  pontos?: number;
  dataAplicacao?: string;
  aluno?: string;
  matricula?: string;
  status?: string;
  nota?: string | null;
  prazoEm?: string;
};
export function AssessmentList({
  manager,
  results = false,
}: {
  manager: boolean;
  results?: boolean;
}) {
  const [data, setData] = useState<{ items: Row[]; total: number }>({
      items: [],
      total: 0,
    }),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState(""),
    [page, setPage] = useState(1),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [loading, setLoading] = useState(true),
    [refresh, setRefresh] = useState(0),
    [values, setValues] = useState<FormValues | null>(null),
    [saving, setSaving] = useState(false);
  const resource = results ? "resultados" : "avaliacoes";
  useEffect(() => {
    let alive = true;
    api<{ items: Row[]; total: number }>(
      `/api/avaliacoes/${resource}?pagina=${page}&busca=${encodeURIComponent(search)}&${results ? "status" : "situacao"}=${filter}`,
    )
      .then((v) => {
        if (alive) {
          setData(v);
          setError("");
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
  }, [resource, results, page, search, filter, refresh]);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!values) return;
    setSaving(true);
    setError("");
    try {
      await api("/api/avaliacoes/avaliacoes", {
        ...values,
        tempoLimite: Number(values.tempoLimite),
        ativo: values.ativo === "true",
      });
      setValues(null);
      setMessage("Avaliação salva com sucesso.");
      setRefresh((v) => v + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">GESTÃO DE AVALIAÇÕES</p>
          <h1>{results ? "Resultados e histórico" : "Avaliações"}</h1>
          <p>
            {results
              ? "Acompanhe tentativas, correções e notas."
              : "Provas objetivas e discursivas com prazo individual."}
          </p>
        </div>
        {manager && !results && (
          <button
            className="btn primary"
            onClick={() => {
              setValues({
                titulo: "",
                descricao: "",
                tipo: "Prova",
                dataAplicacao: "",
                tempoLimite: "60",
                ativo: "true",
              });
              setMessage("");
            }}
          >
            Nova avaliação
          </button>
        )}
      </div>
      <AssessmentNav />
      {error && (
        <div className="alert error" role="alert">
          {error}
        </div>
      )}
      {message && (
        <div className="alert success" role="status">
          {message}
        </div>
      )}
      {values && (
        <EntityEditor
          fields={assessmentFields}
          values={values}
          change={(k, v) => setValues({ ...values, [k]: v })}
          submit={submit}
          close={() => setValues(null)}
          saving={saving}
          editing={false}
        />
      )}
      <section className="panel">
        <div className="filters">
          <label className="field search-field">
            Pesquisar por título
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </label>
          {(results || manager) && (
            <label className="field">
              Filtrar situação
              <select
                value={filter}
                onChange={(e) => {
                  setFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Todas</option>
                {(results
                  ? [
                      { value: "EM_ANDAMENTO", label: "Em andamento" },
                      { value: "FINALIZADA", label: "Aguardando correção" },
                      { value: "CORRIGIDA", label: "Corrigida" },
                    ]
                  : [
                      { value: "ativo", label: "Ativa" },
                      { value: "inativo", label: "Inativa" },
                    ]
                ).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        {loading ? (
          <p role="status">Carregando avaliações…</p>
        ) : !data.items.length ? (
          <div className="empty">
            <h2>
              {results
                ? "Nenhuma tentativa encontrada"
                : "Nenhuma avaliação encontrada"}
            </h2>
            <p>
              {results
                ? "Os resultados aparecerão após o início de uma prova."
                : "As avaliações disponíveis aparecerão aqui."}
            </p>
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Avaliação</th>
                  <th>{results ? "Aluno" : "Liberação (Brasília)"}</th>
                  <th>{results ? "Situação" : "Questões / pontos"}</th>
                  <th>{results ? "Nota" : "Tempo"}</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {r.titulo}
                      {!results && (
                        <small className="muted">
                          {" "}
                          {r.ativo ? "Ativa" : "Inativa"}
                        </small>
                      )}
                    </td>
                    <td>
                      {results ? (
                        <>
                          {r.aluno}
                          <small className="muted"> {r.matricula}</small>
                        </>
                      ) : (
                        dateLabel(r.dataAplicacao!)
                      )}
                    </td>
                    <td>
                      {results
                        ? statusLabel(r.status!)
                        : `${r.questoes} / ${r.pontos}`}
                    </td>
                    <td>
                      {results
                        ? (r.nota ?? "Pendente")
                        : `${r.tempoLimite} min`}
                    </td>
                    <td>
                      <Link
                        className="btn small"
                        href={
                          results
                            ? `/avaliacoes/tentativas/${r.id}`
                            : `/avaliacoes/${r.id}`
                        }
                      >
                        {results
                          ? "Ver tentativa"
                          : manager
                            ? "Gerenciar"
                            : "Ver avaliação"}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="pagination">
          <span>{data.total} registro(s)</span>
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
            disabled={page * 10 >= data.total}
            onClick={() => setPage((v) => v + 1)}
          >
            Próxima
          </button>
        </div>
      </section>
      <p className="note">
        Uma tentativa por avaliação. A nota corresponde à soma dos pontos, sem
        conversão de escala.
      </p>
    </>
  );
}
