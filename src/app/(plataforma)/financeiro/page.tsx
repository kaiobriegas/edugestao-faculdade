import { pageActor } from "@/lib/core-server";
import { isManager } from "@/modules/core/contracts/access";
import { FinanceList } from "@/modules/financeiro/components/finance-list";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ cobrancaId?: string }>;
}) {
  const actor = await pageActor(),
    query = await searchParams,
    manager = isManager(actor);
  if (!actor.modulos.some((m) => m.codigo === "financeiro"))
    return (
      <section className="panel">
        <h1>Módulo não autorizado</h1>
        <p>Financeiro não está disponível para este perfil ou operação.</p>
      </section>
    );
  return (
    <FinanceList
      resource="cobrancas"
      manager={manager}
      initialCharge={query.cobrancaId || ""}
    />
  );
}
