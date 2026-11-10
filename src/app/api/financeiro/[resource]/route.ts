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
import { createFinanceService } from "@/modules/financeiro/services/finance";
import {
  financeOptions,
  financeList,
  chargeDetail,
} from "@/modules/financeiro/repositories/queries";
import { financialReport } from "@/modules/financeiro/repositories/report";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ resource: string }> };
export async function GET(request: Request, context: Context) {
  try {
    const actor = await requestActor(),
      { resource } = await context.params,
      query = new URL(request.url).searchParams;
    if (resource === "opcoes")
      return jsonResponse(await financeOptions(getDatabase(), actor));
    if (resource === "relatorio")
      return jsonResponse(await financialReport(getDatabase(), actor, query));
    if (resource === "detalhes") {
      const id = Number(query.get("id"));
      if (!Number.isInteger(id) || id <= 0 || id > 2147483647)
        throw new AppError("Cobrança inválida.");
      return jsonResponse(await chargeDetail(getDatabase(), actor, id));
    }
    return jsonResponse(
      await financeList(getDatabase(), actor, resource, query),
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
      ...(await createFinanceService(getDatabase()).save(
        resource,
        actor.id,
        await jsonBody(request),
      )),
    });
  } catch (e) {
    return apiError(e);
  }
}
