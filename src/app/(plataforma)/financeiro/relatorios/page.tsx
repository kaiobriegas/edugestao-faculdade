import { pageActor } from "@/lib/core-server";
import { isManager } from "@/modules/core/contracts/access";
import { FinancialReport } from "@/modules/financeiro/components/report";
export default async function Page() {
  const actor = await pageActor();
  if (
    !isManager(actor) ||
    !actor.modulos.some((m) => m.codigo === "financeiro")
  )
    return (
      <section className="panel">
        <h1>Módulo não autorizado</h1>
      </section>
    );
  return <FinancialReport />;
}
