import { notFound } from "next/navigation";
import { pageActor } from "@/lib/core-server";
import { getDatabase } from "@/lib/db";
import { readEnvironment } from "@/lib/env";
import { AppError } from "@/modules/core/contracts/access";
import { studentDetail } from "@/modules/alunos/repositories/queries";
import { StudentFile } from "@/modules/alunos/components/student-detail";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await pageActor();
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const result = await studentDetail(getDatabase(), actor, id).catch(
    (error: unknown) => {
      if (error instanceof AppError) return error;
      throw error;
    },
  );
  if (result instanceof AppError) {
    if (result.status === 404) notFound();
    return (
      <section className="panel">
        <h1>Acesso restrito</h1>
        <p>{result.message}</p>
      </section>
    );
  }
  return (
    <StudentFile
      initial={result}
      actor={actor}
      maxBytes={readEnvironment().MAX_UPLOAD_BYTES}
    />
  );
}
