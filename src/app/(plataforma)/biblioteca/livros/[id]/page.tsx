import { pageActor } from "@/lib/core-server";
import { getDatabase } from "@/lib/db";
import { AppError, isManager } from "@/modules/core/contracts/access";
import { bookDetail } from "@/modules/biblioteca/repositories/detail";
import { BookDetail } from "@/modules/biblioteca/components/book-detail";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await pageActor(),
    { id } = await params,
    value = Number(id);
  if (!Number.isSafeInteger(value) || value <= 0)
    return (
      <section className="panel">
        <h1>Livro inválido</h1>
      </section>
    );
  const result = await bookDetail(getDatabase(), actor, value)
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
  return <BookDetail book={result.data} manager={isManager(actor)} />;
}
