import Link from "next/link";
export function LibraryNav({ manager }: { manager: boolean }) {
  return (
    <nav className="academic-nav" aria-label="Gestão da biblioteca">
      <Link className="btn small" href="/biblioteca">
        Acervo
      </Link>
      {manager && (
        <>
          <Link className="btn small" href="/biblioteca/categorias">
            Categorias
          </Link>
          <Link className="btn small" href="/biblioteca/exemplares">
            Exemplares
          </Link>
        </>
      )}
      <Link className="btn small" href="/biblioteca/emprestimos">
        {manager ? "Empréstimos" : "Meus empréstimos"}
      </Link>
      <Link className="btn small" href="/biblioteca/reservas">
        {manager ? "Reservas" : "Minhas reservas"}
      </Link>
    </nav>
  );
}
