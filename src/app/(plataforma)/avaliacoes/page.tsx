import { pageActor } from "@/lib/core-server";
import { isManager } from "@/modules/core/contracts/access";
import { AssessmentList } from "@/modules/avaliacoes/components/assessment-list";
export default async function Page() {
  const actor = await pageActor();
  if (!actor.modulos.some((m) => m.codigo === "avaliacoes"))
    return (
      <section className="panel">
        <h1>Acesso restrito</h1>
        <p>Gestão de Avaliações não está disponível para este perfil.</p>
      </section>
    );
  return <AssessmentList manager={isManager(actor)} />;
}
