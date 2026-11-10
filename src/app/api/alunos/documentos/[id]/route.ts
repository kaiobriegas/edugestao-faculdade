import { apiError, requestActor } from "@/lib/core-server";
import { getDatabase } from "@/lib/db";
import { readEnvironment } from "@/lib/env";
import { AppError } from "@/modules/core/contracts/access";
import {
  createDocumentService,
  documentStorage,
} from "@/modules/alunos/services/files";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requestActor();
    const id = Number((await context.params).id);
    if (!Number.isInteger(id) || id <= 0)
      throw new AppError("Documento inválido.");
    const env = readEnvironment();
    const file = await createDocumentService(
      getDatabase(),
      documentStorage(env.STORAGE_PRIVATE_DIR),
      env.MAX_UPLOAD_BYTES,
    ).download(actor.id, id);
    const name = encodeURIComponent(file.name).replace(
      /['()*]/g,
      (c) => "%" + c.charCodeAt(0).toString(16),
    );
    return new Response(new Uint8Array(file.bytes), {
      headers: {
        "Content-Type": file.mime,
        "Content-Length": String(file.bytes.length),
        "Content-Disposition": `attachment; filename="documento"; filename*=UTF-8''${name}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    return apiError(e);
  }
}
