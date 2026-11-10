import Link from "next/link";
export function FinanceNav({ manager }: { manager: boolean }) {
  return (
    <nav className="academic-nav" aria-label="Gestão financeira">
      <Link className="btn small" href="/financeiro">
        {manager ? "Cobranças" : "Minhas cobranças"}
      </Link>
      {manager && (
        <>
          <Link className="btn small" href="/financeiro/planos">
            Planos
          </Link>
          <Link className="btn small" href="/financeiro/descontos">
            Descontos
          </Link>
        </>
      )}
      <Link className="btn small" href="/financeiro/pagamentos">
        {manager ? "Pagamentos" : "Meus pagamentos"}
      </Link>
      {manager && (
        <Link className="btn small" href="/financeiro/relatorios">
          Relatórios
        </Link>
      )}
    </nav>
  );
}
