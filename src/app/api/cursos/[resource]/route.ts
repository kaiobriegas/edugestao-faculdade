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
import { createCourseService } from "@/modules/cursos/services/courses";
import {
  courseDetail,
  courseOptions,
  listCourses,
} from "@/modules/cursos/repositories/queries";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ resource: string }> };
export async function GET(request: Request, context: Context) {
  try {
    const actor = await requestActor();
    const { resource } = await context.params;
    const query = new URL(request.url).searchParams;
    if (resource === "opcoes")
      return jsonResponse(await courseOptions(getDatabase(), actor));
    if (resource === "detalhes") {
      const id = Number(query.get("id"));
      if (!Number.isInteger(id) || id <= 0)
        throw new AppError("Curso inválido.");
      return jsonResponse(await courseDetail(getDatabase(), actor, id));
    }
    return jsonResponse(
      await listCourses(getDatabase(), actor, resource, query),
    );
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(request: Request, context: Context) {
  try {
    assertOrigin(request, readEnvironment().APP_URL);
    const actor = await requestActor();
    const { resource } = await context.params;
    return jsonResponse({
      ok: true,
      ...(await createCourseService(getDatabase()).save(
        resource,
        actor.id,
        await jsonBody(request),
      )),
    });
  } catch (e) {
    return apiError(e);
  }
}
