import {
  apiError,
  jsonBody,
  jsonResponse,
  requestActor,
} from "@/lib/core-server";
import { getDatabase } from "@/lib/db";
import { readEnvironment } from "@/lib/env";
import { AppError } from "@/modules/core/contracts/access";
import { assertOrigin } from "@/modules/core/services/security";
import { createStudentService } from "@/modules/alunos/services/students";
import {
  createDocumentService,
  documentStorage,
  readMultipart,
} from "@/modules/alunos/services/files";
import { studentAccess } from "@/modules/alunos/services/access";
import {
  listStudents,
  studentDetail,
  studentOptions,
} from "@/modules/alunos/repositories/queries";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ resource: string }> };
export async function GET(request: Request, context: Context) {
  try {
    const actor = await requestActor();
    const { resource } = await context.params;
    const query = new URL(request.url).searchParams;
    if (resource === "opcoes")
      return jsonResponse(await studentOptions(getDatabase(), actor));
    if (resource === "detalhes") {
      const id = Number(query.get("id"));
      if (!Number.isInteger(id) || id <= 0)
        throw new AppError("Aluno inválido.");
      return jsonResponse(await studentDetail(getDatabase(), actor, id));
    }
    return jsonResponse(
      await listStudents(getDatabase(), actor, resource, query),
    );
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(request: Request, context: Context) {
  try {
    const env = readEnvironment();
    assertOrigin(request, env.APP_URL);
    const actor = await requestActor();
    studentAccess(actor, true);
    const { resource } = await context.params;
    if (
      resource === "documentos" &&
      request.headers.get("content-type")?.startsWith("multipart/form-data")
    ) {
      const form = await readMultipart(request, env.MAX_UPLOAD_BYTES);
      const file = form.get("arquivo");
      if (!(file instanceof File)) throw new AppError("Selecione um arquivo.");
      const data = {
        alunoId: Number(form.get("alunoId")),
        tipo: form.get("tipo"),
        descricao: form.get("descricao") || "",
      };
      return jsonResponse({
        ok: true,
        ...(await createDocumentService(
          getDatabase(),
          documentStorage(env.STORAGE_PRIVATE_DIR),
          env.MAX_UPLOAD_BYTES,
        ).upload(actor.id, data, {
          name: file.name,
          type: file.type,
          bytes: new Uint8Array(await file.arrayBuffer()),
        })),
      });
    }
    return jsonResponse({
      ok: true,
      ...(await createStudentService(getDatabase()).save(
        resource,
        actor.id,
        await jsonBody(request),
      )),
    });
  } catch (e) {
    return apiError(e);
  }
}
