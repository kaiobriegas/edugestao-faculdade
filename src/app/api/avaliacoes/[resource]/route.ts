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
import { createAssessmentService } from "@/modules/avaliacoes/services/assessments";
import {
  assessmentDetail,
  attemptDetail,
  assessmentList,
} from "@/modules/avaliacoes/repositories/queries";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ resource: string }> };
export async function GET(request: Request, context: Context) {
  try {
    const actor = await requestActor(),
      { resource } = await context.params,
      query = new URL(request.url).searchParams;
    if (["detalhes", "tentativa"].includes(resource)) {
      const id = Number(query.get("id"));
      if (!Number.isSafeInteger(id) || id <= 0)
        throw new AppError("Identificador inválido.");
      return jsonResponse(
        await (resource === "detalhes" ? assessmentDetail : attemptDetail)(
          getDatabase(),
          actor,
          id,
        ),
      );
    }
    return jsonResponse(
      await assessmentList(getDatabase(), actor, resource, query),
    );
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(request: Request, context: Context) {
  try {
    assertOrigin(request, readEnvironment().APP_URL);
    const actor = await requestActor(),
      { resource } = await context.params;
    return jsonResponse({
      ok: true,
      ...(await createAssessmentService(getDatabase()).save(
        resource,
        actor.id,
        await jsonBody(
          request,
          ["respostas", "finalizar"].includes(resource) ? 1048576 : 16000,
        ),
      )),
    });
  } catch (e) {
    return apiError(e);
  }
}
