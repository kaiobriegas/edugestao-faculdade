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
import { createLibraryService } from "@/modules/biblioteca/services/library";
import {
  libraryFilters,
  libraryList,
  libraryOptions,
} from "@/modules/biblioteca/repositories/queries";
import { bookDetail } from "@/modules/biblioteca/repositories/detail";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ resource: string }> };
export async function GET(request: Request, context: Context) {
  try {
    const actor = await requestActor(),
      { resource } = await context.params,
      query = new URL(request.url).searchParams;
    if (resource === "filtros")
      return jsonResponse(await libraryFilters(getDatabase(), actor));
    if (resource === "opcoes")
      return jsonResponse(await libraryOptions(getDatabase(), actor));
    if (resource === "detalhes") {
      const id = Number(query.get("id"));
      if (!Number.isSafeInteger(id) || id <= 0)
        throw new AppError("Livro inválido.");
      return jsonResponse(await bookDetail(getDatabase(), actor, id));
    }
    return jsonResponse(
      await libraryList(getDatabase(), actor, resource, query),
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
      ...(await createLibraryService(getDatabase()).save(
        resource,
        actor.id,
        await jsonBody(request),
      )),
    });
  } catch (e) {
    return apiError(e);
  }
}
