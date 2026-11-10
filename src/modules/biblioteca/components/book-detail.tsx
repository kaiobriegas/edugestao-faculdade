import Link from "next/link";
import type { BookDetail as Detail } from "../repositories/detail";
import { LibraryNav } from "./library-nav";
import { stateLabel } from "./fields";
export function BookDetail({
  book,
  manager,
}: {
  book: Detail;
  manager: boolean;
}) {
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">ACERVO</p>
          <h1>{book.titulo}</h1>
          <p>
            {book.autor} · {book.categoria}
          </p>
        </div>
        <Link className="btn" href="/biblioteca">
          Voltar ao acervo
        </Link>
      </div>
      <LibraryNav manager={manager} />
      <section className="panel">
        <div className="stats">
          <div className="stat">
            <span>Exemplares disponíveis</span>
            <strong>{book.disponiveis}</strong>
          </div>
          <div className="stat">
            <span>Exemplares cadastrados{!manager ? " ativos" : ""}</span>
            <strong>{book.totalExemplares}</strong>
          </div>
          <div className="stat">
            <span>Catálogo</span>
            <strong className="stat-label">
              {book.ativo ? "Ativo" : "Inativo"}
            </strong>
          </div>
        </div>
        <p>{book.descricao || "Sem descrição cadastrada."}</p>
        <p className="muted">
          Editora: {book.editora || "—"} · Ano: {book.anoPublicacao || "—"} ·
          ISBN: {book.isbn || "—"}
        </p>
        <div className="actions">
          <Link
            className="btn small"
            href={`/biblioteca/emprestimos?livroId=${book.id}`}
          >
            {manager
              ? "Histórico de empréstimos"
              : "Meus empréstimos deste livro"}
          </Link>
          <Link
            className="btn small"
            href={`/biblioteca/reservas?livroId=${book.id}`}
          >
            {manager ? "Histórico de reservas" : "Minhas reservas deste livro"}
          </Link>
        </div>
      </section>
      <section className="panel">
        <h2>Exemplares</h2>
        {!book.exemplares.length ? (
          <p className="empty">Nenhum exemplar disponível para consulta.</p>
        ) : (
          <div
            className="table-scroll"
            role="region"
            aria-label="Tabela da biblioteca"
            tabIndex={0}
          >
            <table className="library-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Localização</th>
                  <th>Estado</th>
                  <th>Disponibilidade</th>
                </tr>
              </thead>
              <tbody>
                {book.exemplares.map((e) => (
                  <tr key={e.id}>
                    <td>{e.codigo}</td>
                    <td>{e.localizacao || "—"}</td>
                    <td>
                      {stateLabel(e.situacao)}
                      {!e.ativo && " · Inativo"}
                    </td>
                    <td>
                      <span className={"tag" + (e.disponivel ? " green" : "")}>
                        {e.disponivel
                          ? "Disponível para empréstimo"
                          : "Indisponível para empréstimo"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {book.totalExemplares > 100 && (
          <p className="note">
            Mostrando os primeiros 100 exemplares. A contagem de disponibilidade
            considera todo o acervo.
          </p>
        )}
      </section>
      {!manager && (
        <p className="note">
          Solicite o empréstimo ou a reserva ao gestor da biblioteca.
        </p>
      )}
    </>
  );
}
