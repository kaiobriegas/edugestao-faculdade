"use client";
import { useEffect, useState } from "react";
import { api } from "@/modules/core/components/api";
import type { FinancialReport as Report } from "../repositories/report";
import { FinanceNav } from "./finance-nav";
import {
  currency,
  dayLabel,
  stateLabel,
  emptyOptions,
  type Options,
} from "./fields";
export function FinancialReport() {
  const [data, setData] = useState<Report | null>(null),
    [options, setOptions] = useState<Options>(emptyOptions),
    [aluno, setAluno] = useState(""),
    [plano, setPlano] = useState(""),
    [inicio, setInicio] = useState(""),
    [fim, setFim] = useState(""),
    [error, setError] = useState(""),
    [query, setQuery] = useState(""),
    [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let alive = true;
    api<Options>("/api/financeiro/opcoes")
      .then((v) => {
        if (alive) setOptions(v);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    let alive = true;
    api<Report>(`/api/financeiro/relatorio?${query}`)
      .then((v) => {
        if (alive) {
          setData(v);
          setError("");
        }
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [query, refresh]);
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">FINANCEIRO</p>
          <h1>Relatório financeiro</h1>
          <p>Posição atual das cobranças emitidas no período selecionado.</p>
        </div>
      </div>
      <FinanceNav manager />
      {error && (
        <p className="alert error" role="alert">
          {error}
        </p>
      )}
      <section className="panel">
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            setRefresh((v) => v + 1);
            setQuery(
              new URLSearchParams({
                alunoId: aluno,
                planoId: plano,
                inicio,
                fim,
              }).toString(),
            );
          }}
        >
          <div className="form-grid">
            <label className="field">
              Emissão a partir de
              <input
                type="date"
                value={inicio}
                onChange={(e) => setInicio(e.target.value)}
              />
            </label>
            <label className="field">
              Emissão até
              <input
                type="date"
                value={fim}
                onChange={(e) => setFim(e.target.value)}
              />
            </label>
            <label className="field">
              Aluno do relatório
              <select value={aluno} onChange={(e) => setAluno(e.target.value)}>
                <option value="">Todos</option>
                {options.alunos.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nome}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Plano do relatório
              <select value={plano} onChange={(e) => setPlano(e.target.value)}>
                <option value="">Todos</option>
                {options.planos.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nome}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button className="btn primary">Consultar relatório</button>
        </form>
      </section>
      {!data ? (
        <p role="status">Carregando relatório…</p>
      ) : (
        <>
          <section className="stats">
            {[
              { label: "Total cobrado", value: data.cobrado },
              { label: "Recebido confirmado", value: data.recebido },
              { label: "Saldo em aberto", value: data.saldo },
              { label: "Saldo vencido", value: data.vencido },
            ].map((s) => (
              <div className="stat" key={s.label}>
                <span>{s.label}</span>
                <strong className="stat-label">{currency(s.value)}</strong>
              </div>
            ))}
          </section>
          <section className="panel">
            <h2>Situações das cobranças</h2>
            <p>
              {data.quantidade} cobrança(s) não cancelada(s), sendo{" "}
              {data.quantidadeVencida} vencida(s). Data de referência:{" "}
              {dayLabel(data.dataReferencia)}.
            </p>
            {!data.situacoes.length ? (
              <p className="empty">Nenhuma cobrança no período selecionado.</p>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Situação do pagamento</th>
                      <th>Quantidade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.situacoes.map((s) => (
                      <tr key={s.status}>
                        <td>{stateLabel(s.status)}</td>
                        <td>{s.quantidade}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
      <p className="note">
        O período filtra a data de emissão da cobrança. Recebido considera seus
        pagamentos confirmados até agora; estornos não entram. Valores
        cancelados ficam fora dos totais. Vencida é a cobrança com saldo e
        vencimento anterior ao dia atual. Este relatório não é um fluxo de caixa
        por data de pagamento.
      </p>
    </>
  );
}
