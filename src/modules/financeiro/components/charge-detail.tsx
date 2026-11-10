"use client";
import { useState } from "react";
import Link from "next/link";
import {
  EntityEditor,
  type FormValues,
} from "@/components/forms/entity-editor";
import { api } from "@/modules/core/components/api";
import type { ChargeDetail as Detail } from "../repositories/queries";
import { FinanceNav } from "./finance-nav";
import {
  currency,
  dayLabel,
  dateLabel,
  stateLabel,
  fieldsFor,
  initialValues,
  payload,
  emptyOptions,
} from "./fields";
export function ChargeDetail({
  initial,
  manager,
}: {
  initial: Detail;
  manager: boolean;
}) {
  const [data, setData] = useState(initial),
    [values, setValues] = useState<FormValues | null>(null),
    [reason, setReason] = useState<{
      resource: "estornar" | "cancelar";
      id: number;
    } | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  async function operation(resource: string, body: unknown, success: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await api<{ repetida?: boolean }>(
        `/api/financeiro/${resource}`,
        body,
      );
      setData(await api<Detail>(`/api/financeiro/detalhes?id=${data.id}`));
      setValues(null);
      setReason(null);
      setMessage(
        result.repetida
          ? "Operação já registrada. Histórico preservado."
          : success,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">FINANCEIRO</p>
          <h1>Cobrança #{data.id}</h1>
          <p>
            {data.aluno} · {data.matricula} · {data.plano}
          </p>
        </div>
        <Link className="btn" href="/financeiro">
          Voltar às cobranças
        </Link>
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
      <section className="panel">
        <div className="stats">
          <div className="stat">
            <span>Valor final</span>
            <strong className="stat-label">{currency(data.valorFinal)}</strong>
          </div>
          <div className="stat">
            <span>Pago confirmado</span>
            <strong className="stat-label">{currency(data.pago)}</strong>
          </div>
          <div className="stat">
            <span>Saldo a pagar</span>
            <strong className="stat-label">{currency(data.saldo)}</strong>
          </div>
          <div className="stat">
            <span>Situação</span>
            <strong className="stat-label">{stateLabel(data.situacao)}</strong>
            {data.situacao === "VENCIDA" && (
              <small>Estado do pagamento: {stateLabel(data.status)}</small>
            )}
          </div>
        </div>
        <p>
          Emissão: {dayLabel(data.dataEmissao)} · Vencimento:{" "}
          {dayLabel(data.dataVencimento)}
        </p>
        <p>
          Valor original: {currency(data.valorOriginal)} · Desconto aplicado:{" "}
          {data.descontoTipoAplicado === "PERCENTUAL"
            ? `${data.descontoPercentualAplicado}%`
            : data.descontoTipoAplicado === "FIXO"
              ? currency(data.descontoValorAplicado)
              : "Sem desconto"}
        </p>
        <p className="note">
          Valores congelados na emissão. Alterar plano ou benefício não muda
          esta cobrança.
        </p>
        {manager && data.status !== "CANCELADA" && (
          <div className="actions">
            {data.saldo !== "0.00" && (
              <button
                className="btn primary"
                disabled={busy}
                onClick={() => {
                  setValues(initialValues("pagamentos", data.id));
                  setReason(null);
                  setMessage("");
                }}
              >
                Registrar pagamento
              </button>
            )}
            {data.pago === "0.00" && (
              <button
                className="btn"
                disabled={busy}
                onClick={() => {
                  setReason({ resource: "cancelar", id: data.id });
                  setValues(null);
                }}
              >
                Cancelar cobrança
              </button>
            )}
          </div>
        )}
      </section>
      {values && (
        <EntityEditor
          fields={fieldsFor(
            "pagamentos",
            {
              ...emptyOptions,
              cobrancas: [
                {
                  id: data.id,
                  nome: `#${data.id} · ${data.plano}`,
                  ativo: true,
                  saldo: data.saldo,
                },
              ],
            },
            values,
          )}
          values={values}
          change={(k, v) => setValues({ ...values, [k]: v })}
          submit={(e) => {
            e.preventDefault();
            void operation(
              "pagamentos",
              payload("pagamentos", values),
              "Pagamento registrado com sucesso.",
            );
          }}
          close={() => setValues(null)}
          saving={busy}
          editing={false}
        />
      )}
      {reason && (
        <ReasonForm
          key={`${reason.resource}-${reason.id}`}
          type={reason.resource}
          busy={busy}
          close={() => setReason(null)}
          save={(motivo) =>
            operation(
              reason.resource,
              {
                [reason.resource === "estornar" ? "pagamentoId" : "cobrancaId"]:
                  reason.id,
                motivo,
              },
              reason.resource === "estornar"
                ? "Estorno registrado com sucesso."
                : "Cobrança cancelada com sucesso.",
            )
          }
        />
      )}
      <section className="panel">
        <div className="section-heading">
          <h2>Histórico de pagamentos</h2>
          <Link
            className="btn small"
            href={`/financeiro/pagamentos?cobrancaId=${data.id}`}
          >
            Ver todos os pagamentos
          </Link>
        </div>
        {!data.pagamentos.length ? (
          <p className="empty">Nenhum pagamento registrado.</p>
        ) : (
          <div
            className="table-scroll"
            role="region"
            aria-label="Histórico de pagamentos"
            tabIndex={0}
          >
            <table className="finance-table">
              <thead>
                <tr>
                  <th>Registro / data</th>
                  <th>Valor / forma</th>
                  <th>Comprovante</th>
                  <th>Situação</th>
                  {manager && <th>Ação</th>}
                </tr>
              </thead>
              <tbody>
                {data.pagamentos.map((p) => (
                  <tr key={p.id}>
                    <td>
                      #{p.id}
                      <div>{dateLabel(p.dataPagamento)}</div>
                    </td>
                    <td>
                      {currency(p.valor)}
                      <div>{p.formaPagamento}</div>
                    </td>
                    <td>{p.comprovante || "Sem referência"}</td>
                    <td>
                      {stateLabel(p.status)}
                      {p.status === "ESTORNADO" && (
                        <>
                          <div>{dateLabel(p.estornadoEm)}</div>
                          <div>Motivo: {p.motivoEstorno}</div>
                          {manager && p.autorEstorno && (
                            <small>Por: {p.autorEstorno}</small>
                          )}
                        </>
                      )}
                    </td>
                    {manager && (
                      <td>
                        {p.status === "CONFIRMADO" ? (
                          <button
                            className="btn small"
                            disabled={busy}
                            onClick={() => {
                              setReason({ resource: "estornar", id: p.id });
                              setValues(null);
                              setMessage("");
                            }}
                          >
                            Estornar pagamento #{p.id}
                          </button>
                        ) : (
                          <span className="muted">Histórico preservado</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data.totalPagamentos > 100 && (
          <p className="note">
            Mostrando os 100 pagamentos mais recentes; use a consulta paginada
            para ver todos.
          </p>
        )}
      </section>
      <p className="note">
        Registro administrativo interno. Nenhuma transferência ou cobrança
        bancária é executada pelo sistema.
      </p>
    </>
  );
}
function ReasonForm({
  type,
  busy,
  close,
  save,
}: {
  type: "estornar" | "cancelar";
  busy: boolean;
  close: () => void;
  save: (reason: string) => Promise<void>;
}) {
  const [motivo, setMotivo] = useState("");
  return (
    <section className="panel">
      <h2>
        {type === "estornar" ? "Estornar pagamento" : "Cancelar cobrança"}
      </h2>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          if (
            window.confirm(
              type === "estornar"
                ? "Confirmar estorno do registro interno? O saldo será recalculado."
                : "Confirmar cancelamento da cobrança?",
            )
          )
            void save(motivo);
        }}
      >
        <label className="field">
          Justificativa
          <textarea
            required
            minLength={5}
            maxLength={1000}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
        </label>
        <div className="actions">
          <button className="btn primary" disabled={busy}>
            {type === "estornar"
              ? "Confirmar estorno"
              : "Confirmar cancelamento"}
          </button>
          <button className="btn" type="button" onClick={close}>
            Fechar
          </button>
        </div>
      </form>
    </section>
  );
}
