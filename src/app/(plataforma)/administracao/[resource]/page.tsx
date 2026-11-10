import { notFound } from "next/navigation";
import { pageActor } from "@/lib/core-server";
import { isManager, isRoot } from "@/modules/core/contracts/access";
import { AdminPanel } from "@/modules/core/components/admin-panel";
const titles: Record<string, string> = {
  usuarios: "Usuários",
  grupos: "Grupos",
  papeis: "Papéis",
  modulos: "Módulos",
  eventos: "Eventos administrativos",
};
export default async function AdministrationPage({
  params,
}: {
  params: Promise<{ resource: string }>;
}) {
  const { resource } = await params;
  const actor = await pageActor();
  if (!titles[resource]) notFound();
  if (
    !isManager(actor) ||
    (!isRoot(actor) && !["usuarios", "eventos"].includes(resource))
  )
    return (
      <section className="panel">
        <h1>Acesso restrito</h1>
        <p>Seu papel não permite gerenciar esta área.</p>
      </section>
    );
  return (
    <AdminPanel resource={resource} title={titles[resource]} actor={actor} />
  );
}
