import { pageActor } from "@/lib/core-server";
import { CourseList } from "@/modules/cursos/components/course-list";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ cursoId?: string; alunoId?: string }>;
}) {
  const actor = await pageActor();
  const query = await searchParams;
  if (!actor.modulos.some((m) => m.codigo === "cursos"))
    return (
      <section className="panel">
        <h1>Acesso restrito</h1>
        <p>Gestão de Cursos não está disponível para este perfil.</p>
      </section>
    );
  return (
    <CourseList
      key="matriculas"
      resource="matriculas"
      actor={actor}
      initialCourse={query.cursoId || ""}
      initialStudent={query.alunoId || ""}
    />
  );
}
