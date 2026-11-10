import {
  apiError,
  jsonBody,
  jsonResponse,
  requestActor,
} from "@/lib/core-server";
import { getDatabase } from "@/lib/db";
import { readEnvironment } from "@/lib/env";
import { createAdministration } from "@/modules/core/services/administration";
import { listCore } from "@/modules/core/repositories/queries";
import { assertOrigin } from "@/modules/core/services/security";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ resource: string }> };
export async function GET(request: Request, context: Context) {
  try {
    const actor = await requestActor();
    const { resource } = await context.params;
    if (resource === "perfil") return jsonResponse({ actor });
    if (resource === "opcoes")
      return jsonResponse(
        await createAdministration(getDatabase()).options(actor),
      );
    return jsonResponse(
      await listCore(
        getDatabase(),
        actor,
        resource,
        new URL(request.url).searchParams,
      ),
    );
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: Request, context: Context) {
  try {
    assertOrigin(request, readEnvironment().APP_URL);
    const actor = await requestActor();
    const { resource } = await context.params;
    return jsonResponse({
      ok: true,
      ...(await createAdministration(getDatabase()).save(
        resource,
        actor.id,
        await jsonBody(request),
      )),
    });
  } catch (error) {
    return apiError(error);
  }
}
