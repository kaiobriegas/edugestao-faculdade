import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { getDatabase } from "./db";
import { readEnvironment } from "./env";
import { createAuthService } from "@/modules/core/services/auth";
import { AppError } from "@/modules/core/contracts/access";
export const SESSION_COOKIE = "educacional_session";
export function authService() {
  return createAuthService(getDatabase(), readEnvironment().AUTH_SECRET);
}
export async function requestActor() {
  return authService().session((await cookies()).get(SESSION_COOKIE)?.value);
}
export async function pageActor() {
  try {
    return await requestActor();
  } catch (error) {
    if (error instanceof AppError && error.status === 401) redirect("/login");
    throw error;
  }
}
export const jsonResponse = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
export function apiError(error: unknown) {
  if (error instanceof AppError)
    return jsonResponse({ error: error.message }, error.status);
  if (error instanceof ZodError)
    return jsonResponse(
      { error: error.issues[0]?.message || "Verifique os campos informados." },
      400,
    );
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002")
      return jsonResponse(
        { error: "Já existe um registro com esses dados únicos." },
        409,
      );
    if (error.code === "P2025")
      return jsonResponse({ error: "Registro não encontrado." }, 404);
    if (error.code === "P2003")
      return jsonResponse(
        { error: "Registro vinculado não encontrado ou ainda em uso." },
        400,
      );
  }
  console.error("Falha interna em operação do núcleo.");
  return jsonResponse(
    { error: "Não foi possível concluir. Tente novamente." },
    500,
  );
}
export async function jsonBody(request: Request, maxBytes = 16000) {
  const type = request.headers.get("content-type") || "";
  if (!type.startsWith("application/json"))
    throw new AppError("Envie dados em JSON.", 415);
  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new AppError("Solicitação muito grande.", 413);
      }
      chunks.push(value);
    }
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const text = new TextDecoder().decode(bytes);
  try {
    return JSON.parse(text);
  } catch {
    throw new AppError("JSON inválido.");
  }
}
