import { pageActor } from "@/lib/core-server";
import { isManager } from "@/modules/core/contracts/access";
import { StudentList } from "@/modules/alunos/components/student-list";
export default async function Page() {
  const actor = await pageActor();
  if (!isManager(actor) || !actor.modulos.some((m) => m.codigo === "alunos"))
    return (
      <section className="panel">
        <h1>Acesso restrito</h1>
        <p>Seu perfil não pode gerenciar estes cadastros.</p>
      </section>
    );
  return (
    <StudentList key="responsaveis" resource="responsaveis" actor={actor} />
  );
}
