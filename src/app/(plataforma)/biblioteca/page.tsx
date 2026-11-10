import { pageActor } from "@/lib/core-server";
import { isManager } from "@/modules/core/contracts/access";
import { LibraryList } from "@/modules/biblioteca/components/library-list";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ livroId?: string }>;
}) {
  const actor = await pageActor(),
    query = await searchParams;
  const manager = isManager(actor);
  if (!actor.modulos.some((m) => m.codigo === "biblioteca"))
    return (
      <section className="panel">
        <h1>Módulo não autorizado</h1>
        <p>Biblioteca não está disponível para este perfil ou operação.</p>
      </section>
    );
  return (
    <LibraryList
      resource="livros"
      manager={manager}
      initialBook={query.livroId || ""}
    />
  );
}
