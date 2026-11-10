import Link from "next/link";
export function StudentNav({ manage }: { manage: boolean }) {
  return (
    <nav className="academic-nav" aria-label="Gestão de alunos">
      <Link className="btn small" href="/alunos">
        Alunos
      </Link>
      {manage && (
        <>
          <Link className="btn small" href="/alunos/turmas">
            Turmas
          </Link>
          <Link className="btn small" href="/alunos/responsaveis">
            Responsáveis
          </Link>
        </>
      )}
    </nav>
  );
}
