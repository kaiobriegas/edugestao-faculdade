import { it, describe, expect } from "vitest";
import { testDatabaseUrl } from "@/lib/test-database";
describe("isolamento obrigatório do banco de testes", () => {
  it("aceita somente banco dedicado com sufixo _test", () => {
    const url = "postgresql://user:senha@localhost:54329/educacional_test";
    expect(
      testDatabaseUrl({
        TEST_DATABASE_URL: url,
        DATABASE_URL: "postgresql://user:senha@127.0.0.1:54329/educacional",
      }),
    ).toBe(url);
    expect(() =>
      testDatabaseUrl({
        TEST_DATABASE_URL: "postgresql://user:senha@localhost/producao",
      }),
    ).toThrow("_test");
  });
  it("rejeita URL ausente, malformada e protocolo incompatível sem expor segredo", () => {
    for (const value of [
      undefined,
      "segredo-nao-expor",
      "https://user:senha-secreta@example.test/banco_test",
    ]) {
      let error: unknown;
      try {
        testDatabaseUrl({ TEST_DATABASE_URL: value });
      } catch (e) {
        error = e;
      }
      expect(error).toBeInstanceOf(Error);
      expect(String(error)).not.toContain("senha-secreta");
      expect(String(error)).not.toContain("segredo-nao-expor");
    }
  });
  it("bloqueia o mesmo banco apesar de credenciais, porta padrão ou alias de loopback diferentes", () => {
    for (const host of ["localhost", "127.0.0.1", "[::1]", "localhost."])
      expect(() =>
        testDatabaseUrl({
          DATABASE_URL: "postgresql://app:senha@localhost/projeto_test",
          TEST_DATABASE_URL: `postgres://tester:outra@${host}:5432/projeto_test`,
        }),
      ).toThrow("distinto");
  });
  it("distingue bancos e portas realmente diferentes", () => {
    expect(() =>
      testDatabaseUrl({
        DATABASE_URL: "postgresql://a:b@localhost:5432/projeto_test",
        TEST_DATABASE_URL: "postgresql://a:b@localhost:5433/projeto_test",
      }),
    ).not.toThrow();
    expect(() =>
      testDatabaseUrl({
        DATABASE_URL: "postgresql://a:b@localhost/projeto",
        TEST_DATABASE_URL: "postgresql://a:b@localhost/outro_test",
      }),
    ).not.toThrow();
  });
});
