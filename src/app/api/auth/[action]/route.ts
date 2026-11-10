import { cookies } from "next/headers";
import { readEnvironment } from "@/lib/env";
import {
  apiError,
  authService,
  jsonBody,
  jsonResponse,
  SESSION_COOKIE,
} from "@/lib/core-server";
import { assertOrigin } from "@/modules/core/services/security";
import { sendRecovery } from "@/lib/mail";
import { AppError } from "@/modules/core/contracts/access";
export const runtime = "nodejs";
export async function POST(
  request: Request,
  context: { params: Promise<{ action: string }> },
) {
  try {
    assertOrigin(request, readEnvironment().APP_URL);
    const { action } = await context.params;
    const auth = authService();
    const jar = await cookies();
    if (action === "logout") {
      await auth.logout(jar.get(SESSION_COOKIE)?.value);
      jar.delete(SESSION_COOKIE);
      return jsonResponse({ ok: true });
    }
    const body = await jsonBody(request);
    if (action === "login") {
      const { token, expiraEm } = await auth.login(body);
      jar.set(SESSION_COOKIE, token, {
        httpOnly: true,
        secure: new URL(readEnvironment().APP_URL).protocol === "https:",
        sameSite: "lax",
        path: "/",
        expires: expiraEm,
      });
      return jsonResponse({ ok: true });
    }
    if (action === "recuperar")
      return jsonResponse({ message: await auth.recover(body, sendRecovery) });
    if (action === "redefinir") {
      await auth.reset(body);
      jar.delete(SESSION_COOKIE);
      return jsonResponse({
        message: "Senha redefinida. Você já pode entrar com a nova senha.",
      });
    }
    throw new AppError("Operação não encontrada.", 404);
  } catch (error) {
    return apiError(error);
  }
}
