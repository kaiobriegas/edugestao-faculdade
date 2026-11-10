import { pageActor } from "@/lib/core-server";
import { getDatabase } from "@/lib/db";
import { AppError, isManager } from "@/modules/core/contracts/access";
import { assessmentDetail } from "@/modules/avaliacoes/repositories/queries";
import { AssessmentDetail } from "@/modules/avaliacoes/components/assessment-detail";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await pageActor(),
    { id } = await params;
  const value = Number(id);
  if (!Number.isSafeInteger(value) || value <= 0)
    return (
      <section className="panel">
        <h1>Registro inválido</h1>
      </section>
    );
  const result = await assessmentDetail(getDatabase(), actor, value)
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
  return <AssessmentDetail initial={result.data} manager={isManager(actor)} />;
}
