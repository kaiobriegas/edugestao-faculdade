import Link from "next/link";
import type { Resource } from "./fields";
import { dateLabel, stateLabel } from "./fields";
export type LibraryRow = {
  id: number;
  nome?: string;
  titulo?: string;
  descricao?: string | null;
  autor?: string;
  editora?: string | null;
  anoPublicacao?: number | null;
  isbn?: string | null;
  categoriaId?: number;
  categoria?: string;
  ativo?: boolean;
  disponiveis?: number;
  codigo?: string;
  livroId?: number;
  situacao?: string;
  situacaoRegistrada?: string;
  localizacao?: string | null;
  dataAquisicao?: string | null;
  disponivel?: boolean;
  aluno?: string;
  matricula?: string;
  dataEmprestimo?: string;
  dataPrevistaDevolucao?: string;
  dataDevolucao?: string | null;
  atrasado?: boolean;
  dataReserva?: string;
  dataExpiracao?: string;
};
export function LibraryTable({
  resource,
  rows,
  manager,
  busy,
  edit,
  action,
}: {
  resource: Resource;
  rows: LibraryRow[];
  manager: boolean;
  busy: boolean;
  edit: (row: LibraryRow) => void;
  action: (
    resource: string,
    body: unknown,
    prompt: string,
    message: string,
  ) => void;
}) {
  const history = ["emprestimos", "reservas"].includes(resource);
  return (
    <div
      className="table-scroll"
      role="region"
      aria-label="Tabela da biblioteca"
      tabIndex={0}
    >
      <table className="library-table">
        <thead>
          <tr>
            {resource === "categorias" ? (
              <>
                <th>Nome</th>
                <th>Descrição</th>
                <th>Situação</th>
              </>
            ) : history ? (
              <>
                <th>Livro / exemplar</th>
                <th>Aluno</th>
                <th>Datas (Brasília)</th>
                <th>Situação</th>
              </>
            ) : resource === "livros" ? (
              <>
                <th>Título / autor</th>
                <th>Categoria</th>
                <th>Disponíveis</th>
                <th>Situação</th>
              </>
            ) : (
              <>
                <th>Código / livro</th>
                <th>Localização</th>
                <th>Estado</th>
                <th>Disponibilidade</th>
              </>
            )}
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              {resource === "categorias" ? (
                <>
                  <td>{r.nome}</td>
                  <td>{r.descricao || "—"}</td>
                  <td>{r.ativo ? "Ativo" : "Inativo"}</td>
                </>
              ) : history ? (
                <>
                  <td>
                    <Link href={`/biblioteca/livros/${r.livroId}`}>
                      {r.titulo}
                    </Link>
                    {r.codigo && <small className="muted"> · {r.codigo}</small>}
                  </td>
                  <td>
                    {r.aluno}
                    <small className="muted"> · {r.matricula}</small>
                  </td>
                  <td>
                    {resource === "emprestimos" ? (
                      <>
                        <div>Retirada: {dateLabel(r.dataEmprestimo)}</div>
                        <div>
                          Prevista: {dateLabel(r.dataPrevistaDevolucao)}
                        </div>
                        <div>Devolução: {dateLabel(r.dataDevolucao)}</div>
                      </>
                    ) : (
                      <>
                        <div>Reserva: {dateLabel(r.dataReserva)}</div>
                        <div>Validade: {dateLabel(r.dataExpiracao)}</div>
                      </>
                    )}
                  </td>
                  <td>
                    <span
                      className={
                        "tag" +
                        (r.situacao === "DEVOLVIDO" || r.situacao === "ATENDIDA"
                          ? " green"
                          : "")
                      }
                    >
                      {stateLabel(r.atrasado ? "ATRASADO" : r.situacao)}
                    </span>
                  </td>
                </>
              ) : resource === "livros" ? (
                <>
                  <td>
                    <strong>{r.titulo}</strong>
                    <div className="muted">{r.autor}</div>
                    {r.isbn && <small>ISBN {r.isbn}</small>}
                  </td>
                  <td>{r.categoria}</td>
                  <td>{r.disponiveis}</td>
                  <td>{r.ativo ? "Ativo" : "Inativo"}</td>
                </>
              ) : (
                <>
                  <td>
                    <strong>{r.codigo}</strong>
                    <div>
                      <Link href={`/biblioteca/livros/${r.livroId}`}>
                        {r.titulo}
                      </Link>
                    </div>
                  </td>
                  <td>{r.localizacao || "—"}</td>
                  <td>
                    {stateLabel(r.situacao)}
                    {!r.ativo && " · Inativo"}
                  </td>
                  <td>
                    {r.disponivel
                      ? "Disponível para empréstimo"
                      : "Indisponível para empréstimo"}
                  </td>
                </>
              )}
              <td>
                <div className="actions">
                  {resource === "livros" && (
                    <Link
                      className="btn small"
                      href={`/biblioteca/livros/${r.id}`}
                    >
                      Ver livro
                    </Link>
                  )}
                  {manager && !history && (
                    <button className="btn small" onClick={() => edit(r)}>
                      Editar
                    </button>
                  )}
                  {manager &&
                    resource === "emprestimos" &&
                    !r.dataDevolucao && (
                      <button
                        className="btn small"
                        disabled={busy}
                        onClick={() =>
                          action(
                            "devolver",
                            { emprestimoId: r.id },
                            "Confirmar a devolução deste exemplar?",
                            "Devolução registrada com sucesso.",
                          )
                        }
                      >
                        Devolver
                      </button>
                    )}
                  {manager &&
                    resource === "reservas" &&
                    r.situacao === "ATIVA" && (
                      <>
                        <button
                          className="btn small"
                          disabled={busy}
                          onClick={() =>
                            action(
                              "situacao-reserva",
                              { reservaId: r.id, situacao: "ATENDIDA" },
                              "Marcar como atendida? É necessário ter registrado um empréstimo para o aluno.",
                              "Reserva atualizada com sucesso.",
                            )
                          }
                        >
                          Atender
                        </button>
                        <button
                          className="btn small"
                          disabled={busy}
                          onClick={() =>
                            action(
                              "situacao-reserva",
                              { reservaId: r.id, situacao: "CANCELADA" },
                              "Cancelar esta reserva?",
                              "Reserva atualizada com sucesso.",
                            )
                          }
                        >
                          Cancelar reserva
                        </button>
                      </>
                    )}
                  {manager &&
                    resource === "reservas" &&
                    r.situacao === "EXPIRADA" &&
                    r.situacaoRegistrada === "ATIVA" && (
                      <button
                        className="btn small"
                        disabled={busy}
                        onClick={() =>
                          action(
                            "situacao-reserva",
                            { reservaId: r.id, situacao: "EXPIRADA" },
                            "Registrar a expiração desta reserva vencida?",
                            "Expiração registrada com sucesso.",
                          )
                        }
                      >
                        Registrar expiração
                      </button>
                    )}
                  {history &&
                    (!manager ||
                      (resource === "emprestimos" && r.dataDevolucao) ||
                      (resource === "reservas" &&
                        !["ATIVA", "EXPIRADA"].includes(r.situacao || ""))) && (
                      <span className="muted">Histórico</span>
                    )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
