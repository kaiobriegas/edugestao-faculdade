import { createHash, createHmac, randomBytes } from "node:crypto";
import { hash, verify } from "@node-rs/argon2";
import { AppError } from "../contracts/access";
export const tokenDigest = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export const randomToken = () => randomBytes(32).toString("hex");
export const rateKey = (secret: string, value: string) =>
  createHmac("sha256", secret).update(value).digest("hex");
export const hashPassword = (password: string) =>
  hash(password, {
    algorithm: 2,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
export async function verifyPassword(encoded: string, password: string) {
  try {
    return await verify(encoded, password);
  } catch {
    return false;
  }
}
export function assertOrigin(request: Request, appUrl: string) {
  const expected = new URL(appUrl);
  const allowed = new Set([expected.origin]);
  if (["localhost", "127.0.0.1"].includes(expected.hostname)) {
    const alternate = new URL(expected);
    alternate.hostname =
      expected.hostname === "localhost" ? "127.0.0.1" : "localhost";
    allowed.add(alternate.origin);
  }
  if (!allowed.has(request.headers.get("origin") || ""))
    throw new AppError("Origem da solicitação não autorizada.", 403);
}
