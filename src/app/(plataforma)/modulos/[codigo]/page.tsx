import { redirect } from "next/navigation";
import { pageActor } from "@/lib/core-server";
export default async function ModulePage({
  params,
}: {
  params: Promise<{ codigo: string }>;
}) {
  await pageActor();
  const { codigo } = await params;
  if (
    ["alunos", "cursos", "avaliacoes", "biblioteca", "financeiro"].includes(
      codigo,
    )
  )
    redirect(`/${codigo}`);
  return (
    <section className="panel">
      <h1>Módulo não encontrado</h1>
      <p>Use o menu para acessar os módulos disponíveis para sua conta.</p>
    </section>
  );
}
