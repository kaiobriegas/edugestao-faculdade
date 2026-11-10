"use client";
import { useEffect, useState } from "react";
import {
  EntityEditor,
  type FormValues,
} from "@/components/forms/entity-editor";
import { api } from "@/modules/core/components/api";
import { FinanceNav } from "./finance-nav";
import { FinanceTable, type FinanceRow } from "./finance-table";
import {
  emptyOptions,
  titles,
  createLabels,
  fieldsFor,
  initialValues,
  payload,
  stateLabel,
  type Resource,
  type Options,
} from "./fields";
export function FinanceList({
  resource,
  manager,
  initialCharge = "",
}: {
  resource: Resource;
  manager: boolean;
  initialCharge?: string;
}) {
  const [rows, setRows] = useState<FinanceRow[]>([]),
    [total, setTotal] = useState(0),
    [page, setPage] = useState(1),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState(""),
    [activity, setActivity] = useState(""),
    [student, setStudent] = useState(""),
    [plan, setPlan] = useState(""),
    [charge, setCharge] = useState(initialCharge),
    [options, setOptions] = useState<Options>(emptyOptions),
    [ready, setReady] = useState(!manager),
    [loading, setLoading] = useState(true),
    [refresh, setRefresh] = useState(0),
    [values, setValues] = useState<FormValues | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  useEffect(() => {
    if (!manager) return;
    let alive = true;
    api<Options>("/api/financeiro/opcoes")
      .then((v) => {
        if (alive) {
          setOptions(v);
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
      alunoId: student,
      planoId: plan,
      cobrancaId: charge,
    });
    api<{ items: FinanceRow[]; total: number }>(
      `/api/financeiro/${resource}?${query}`,
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
    student,
    plan,
    charge,
    refresh,
  ]);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!values) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await api<{ repetida?: boolean }>(
        `/api/financeiro/${resource}`,
        payload(resource, values),
      );
      setValues(null);
      setRefresh((v) => v + 1);
      setMessage(
        result.repetida
          ? "Pagamento já registrado. Consulte o histórico."
          : resource === "cobrancas"
            ? "Cobrança emitida com sucesso."
            : resource === "pagamentos"
              ? "Pagamento registrado com sucesso."
              : "Cadastro salvo com sucesso.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function edit(row: FinanceRow) {
    const next = initialValues(resource);
    for (const key of Object.keys(next))
      next[key] =
        row[key as keyof FinanceRow] == null
          ? ""
          : String(row[key as keyof FinanceRow]);
    next.id = String(row.id);
    setValues(next);
    setMessage("");
  }
  const states =
    resource === "cobrancas"
      ? ["PENDENTE", "PARCIAL", "PAGA", "VENCIDA", "CANCELADA"]
      : resource === "pagamentos"
        ? ["CONFIRMADO", "ESTORNADO"]
        : [];
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">FINANCEIRO</p>
          <h1>
            {!manager
              ? resource === "cobrancas"
                ? "Minhas cobranças"
                : "Meus pagamentos"
              : titles[resource]}
          </h1>
          <p>
            {resource === "planos"
              ? "Valores e periodicidade de referência para emissão manual."
              : resource === "descontos"
                ? "Benefícios por aluno com validade e tipo definidos."
                : resource === "cobrancas"
                  ? "Valores emitidos, pagamentos e saldos reais."
                  : "Registros administrativos internos de pagamentos e estornos."}
          </p>
        </div>
        {manager && (
          <button
            className="btn primary"
            disabled={!ready || busy}
            onClick={() => {
              setValues(initialValues(resource));
              setError("");
              setMessage("");
            }}
          >
            {createLabels[resource]}
          </button>
        )}
      </div>
      <FinanceNav manager={manager} />
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
          change={(k, v) =>
            setValues({
              ...values,
              [k]: v,
              ...(resource === "cobrancas" && k === "alunoId"
                ? { descontoId: "" }
                : {}),
            })
          }
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
          {["planos", "descontos"].includes(resource) && (
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
          {manager && resource !== "planos" && (
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
                {options.alunos.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nome}
                  </option>
                ))}
              </select>
            </label>
          )}
          {manager && ["cobrancas", "pagamentos"].includes(resource) && (
            <label className="field">
              Filtrar plano
              <select
                value={plan}
                onChange={(e) => {
                  setPlan(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Todos</option>
                {options.planos.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nome}
                  </option>
                ))}
              </select>
            </label>
          )}
          {charge && (
            <button className="btn small" onClick={() => setCharge("")}>
              Mostrar todas as cobranças
            </button>
          )}
        </div>
        {loading ? (
          <p role="status">Carregando financeiro…</p>
        ) : !rows.length ? (
          <div className="empty">
            <h2>Nenhum registro encontrado</h2>
            <p>
              {manager
                ? "Cadastre um registro ou ajuste os filtros."
                : "Seus registros financeiros aparecerão aqui."}
            </p>
          </div>
        ) : (
          <FinanceTable
            resource={resource}
            rows={rows}
            manager={manager}
            edit={edit}
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
      <p className="note">
        {resource === "cobrancas"
          ? "Emissão manual. Valores e desconto ficam congelados na cobrança emitida."
          : resource === "pagamentos"
            ? "Registro interno: não movimenta dinheiro nem aciona gateway. Estornos e detalhes ficam na ficha da cobrança."
            : resource === "descontos"
              ? "Um benefício por cobrança, sem acumular descontos. A validade é conferida na emissão."
              : "Periodicidade informativa. O sistema não gera cobranças automaticamente."}
      </p>
      {manager && <p className="muted">Seletores limitados a 1.000 opções.</p>}
    </>
  );
}
