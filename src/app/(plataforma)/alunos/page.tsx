import { pageActor } from "@/lib/core-server";
import { StudentList } from "@/modules/alunos/components/student-list";
export default async function StudentsPage() {
  const actor = await pageActor();
  if (!actor.modulos.some((m) => m.codigo === "alunos"))
    return (
      <section className="panel">
        <h1>Módulo não autorizado</h1>
        <p>Gestão de Alunos não está habilitada para seu grupo.</p>
      </section>
    );
  return <StudentList key="alunos" resource="alunos" actor={actor} />;
}
