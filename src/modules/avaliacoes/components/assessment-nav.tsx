import Link from "next/link";
export function AssessmentNav() {
  return (
    <nav className="academic-nav" aria-label="Gestão de avaliações">
      <Link href="/avaliacoes">Avaliações</Link>
      <Link href="/avaliacoes/resultados">Resultados e histórico</Link>
    </nav>
  );
}
