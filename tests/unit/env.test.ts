import { describe, expect, it } from "vitest";
import { readEnvironment } from "@/lib/env";
const valid = {
  DATABASE_URL: "postgresql://local:password@localhost:5432/db",
  AUTH_SECRET: "s".repeat(48),
};
describe("configuração do servidor", () => {
  it("aceita PostgreSQL e usa valores padrão", () => {
    const env = readEnvironment(valid);
    expect(env.MAX_UPLOAD_BYTES).toBe(10485760);
    expect(env.APP_URL).toBe("http://localhost:3000");
  });
  it("rejeita URL de banco incompatível e segredo curto", () => {
    expect(() =>
      readEnvironment({ ...valid, DATABASE_URL: "https://example.com" }),
    ).toThrow("DATABASE_URL");
    expect(() => readEnvironment({ ...valid, AUTH_SECRET: "short" })).toThrow(
      "AUTH_SECRET",
    );
  });
  it("não inclui valores secretos no erro", () => {
    const secret = "sensitive-invalid-url";
    try {
      readEnvironment({ ...valid, DATABASE_URL: secret });
    } catch (error) {
      expect(String(error)).not.toContain(secret);
      expect(String(error)).not.toContain(valid.AUTH_SECRET);
      return;
    }
    throw new Error("Entrada inválida deveria ter sido rejeitada");
  });
  it("APP_URL exige HTTP/HTTPS sem credenciais embutidas", () => {
    for (const APP_URL of [
      "ftp://example.test",
      "https://usuario:segredo@example.test",
    ])
      expect(() => readEnvironment({ ...valid, APP_URL })).toThrow("APP_URL");
    expect(
      readEnvironment({ ...valid, APP_URL: "https://escola.example.test" })
        .APP_URL,
    ).toBe("https://escola.example.test");
  });
});
