import Link from "next/link";
import type { Resource } from "./fields";
import { currency, dayLabel, dateLabel, stateLabel } from "./fields";
export type FinanceRow = {
  id: number;
  nome?: string;
  descricao?: string | null;
  valor?: string | null;
  periodicidade?: string;
  ativo?: boolean;
  alunoId?: number;
  aluno?: string;
  matricula?: string;
  tipo?: string;
  percentual?: string | null;
  dataInicio?: string;
  dataFim?: string;
  planoId?: number;
  plano?: string;
  cobrancaId?: number;
  dataEmissao?: string;
  dataVencimento?: string;
  valorOriginal?: string;
  valorFinal?: string;
  pago?: string;
  saldo?: string;
  status?: string;
  situacao?: string;
  dataPagamento?: string;
  formaPagamento?: string;
  comprovante?: string | null;
  motivoEstorno?: string | null;
};
export function FinanceTable({
  resource,
  rows,
  manager,
  edit,
}: {
  resource: Resource;
  rows: FinanceRow[];
  manager: boolean;
  edit: (row: FinanceRow) => void;
}) {
  return (
    <div
      className="table-scroll"
      role="region"
      aria-label="Registros financeiros"
      tabIndex={0}
    >
      <table className="finance-table">
        <thead>
          <tr>
            {resource === "planos" ? (
              <>
                <th>Plano</th>
                <th>Valor</th>
                <th>Periodicidade</th>
                <th>Cadastro</th>
              </>
            ) : resource === "descontos" ? (
              <>
                <th>Descrição / aluno</th>
                <th>Benefício</th>
                <th>Validade</th>
                <th>Cadastro</th>
              </>
            ) : resource === "cobrancas" ? (
              <>
                <th>Cobrança / aluno</th>
                <th>Vencimento</th>
                <th>Valor final</th>
                <th>Pago / saldo</th>
                <th>Situação</th>
              </>
            ) : (
              <>
                <th>Pagamento / cobrança</th>
                <th>Aluno / plano</th>
                <th>Data (Brasília)</th>
                <th>Valor / forma</th>
                <th>Situação</th>
              </>
            )}
            <th>Ação</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              {resource === "planos" ? (
                <>
                  <td>
                    <strong>{r.nome}</strong>
                    <div className="muted">{r.descricao}</div>
                  </td>
                  <td>{currency(r.valor)}</td>
                  <td>{r.periodicidade}</td>
                  <td>{r.ativo ? "Ativo" : "Inativo"}</td>
                </>
              ) : resource === "descontos" ? (
                <>
                  <td>
                    <strong>{r.descricao}</strong>
                    <div>
                      {r.aluno} · {r.matricula}
                    </div>
                  </td>
                  <td>
                    {r.tipo === "PERCENTUAL"
                      ? `${r.percentual}%`
                      : currency(r.valor)}
                  </td>
                  <td>
                    {dayLabel(r.dataInicio)} a {dayLabel(r.dataFim)}
                  </td>
                  <td>{r.ativo ? "Ativo" : "Inativo"}</td>
                </>
              ) : resource === "cobrancas" ? (
                <>
                  <td>
                    <strong>
                      #{r.id} · {r.plano}
                    </strong>
                    <div>
                      {r.aluno} · {r.matricula}
                    </div>
                  </td>
                  <td>{dayLabel(r.dataVencimento)}</td>
                  <td>{currency(r.valorFinal)}</td>
                  <td>
                    <div>Pago: {currency(r.pago)}</div>
                    <div>Saldo: {currency(r.saldo)}</div>
                  </td>
                  <td>
                    <span
                      className={"tag" + (r.status === "PAGA" ? " green" : "")}
                    >
                      {stateLabel(r.situacao)}
                      {r.situacao === "VENCIDA" && r.status === "PARCIAL"
                        ? " · parcial"
                        : ""}
                    </span>
                  </td>
                </>
              ) : (
                <>
                  <td>
                    #{r.id} / cobrança #{r.cobrancaId}
                  </td>
                  <td>
                    {r.aluno}
                    <div className="muted">{r.plano}</div>
                  </td>
                  <td>{dateLabel(r.dataPagamento)}</td>
                  <td>
                    {currency(r.valor)}
                    <div className="muted">{r.formaPagamento}</div>
                  </td>
                  <td>{stateLabel(r.status)}</td>
                </>
              )}
              <td>
                {["planos", "descontos"].includes(resource) ? (
                  manager && (
                    <button className="btn small" onClick={() => edit(r)}>
                      Editar
                    </button>
                  )
                ) : (
                  <Link
                    className="btn small"
                    href={`/financeiro/cobrancas/${resource === "cobrancas" ? r.id : r.cobrancaId}`}
                  >
                    Ver cobrança
                  </Link>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
