import { pageActor } from "@/lib/core-server";
import { getDatabase } from "@/lib/db";
import { AppError, isManager } from "@/modules/core/contracts/access";
import { chargeDetail } from "@/modules/financeiro/repositories/queries";
import { ChargeDetail } from "@/modules/financeiro/components/charge-detail";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await pageActor(),
    { id } = await params,
    value = Number(id);
  if (!Number.isInteger(value) || value <= 0 || value > 2147483647)
    return (
      <section className="panel">
        <h1>Cobrança inválida</h1>
      </section>
    );
  const result = await chargeDetail(getDatabase(), actor, value)
    .then((data) => ({ data, error: null }))
    .catch((e: unknown) => {
      if (e instanceof AppError) return { data: null, error: e.message };
      throw e;
    });
  if (!result.data)
    return (
      <section className="panel">
        <h1>Acesso indisponível</h1>
        <p>{result.error}</p>
      </section>
    );
  return (
    <ChargeDetail
      key={result.data.id}
      initial={result.data}
      manager={isManager(actor)}
    />
  );
}
