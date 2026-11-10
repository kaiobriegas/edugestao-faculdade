import Link from "next/link";
export function CourseNav({ manage }: { manage: boolean }) {
  return (
    <nav className="academic-nav" aria-label="Gestão de cursos">
      <Link className="btn small" href="/cursos">
        Cursos
      </Link>
      {manage && (
        <Link className="btn small" href="/cursos/professores">
          Professores
        </Link>
      )}
      <Link className="btn small" href="/cursos/aulas">
        Programação
      </Link>
      <Link className="btn small" href="/cursos/matriculas">
        {manage ? "Matrículas" : "Minhas matrículas"}
      </Link>
    </nav>
  );
}
