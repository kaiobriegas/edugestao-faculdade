/** Guard compartilhado pelos executores de teste; nunca exibe URLs ou segredos. */
export function testDatabaseUrl(
  env: Record<string, string | undefined> = process.env,
) {
  function parse(value: string | undefined) {
    try {
      if (!value) throw new Error();
      const url = new URL(value);
      if (!["postgres:", "postgresql:"].includes(url.protocol))
        throw new Error();
      decodeURIComponent(url.pathname);
      return url;
    } catch {
      throw new Error("Configure URLs PostgreSQL válidas para os testes.");
    }
  }
  const test = parse(env.TEST_DATABASE_URL),
    name = decodeURIComponent(test.pathname.slice(1));
  if (!/^[a-z][a-z0-9_]*_test$/.test(name))
    throw new Error("Banco de testes deve terminar em _test.");
  const host = (u: URL) => {
    const h = u.hostname.toLowerCase().replace(/\.$/, "");
    return ["localhost", "127.0.0.1", "[::1]", "::1"].includes(h)
      ? "loopback"
      : h;
  };
  if (env.DATABASE_URL) {
    const app = parse(env.DATABASE_URL);
    if (
      decodeURIComponent(app.pathname.slice(1)) === name &&
      host(app) === host(test) &&
      (app.port || "5432") === (test.port || "5432")
    )
      throw new Error(
        "Banco de testes precisa ser distinto do banco da aplicação.",
      );
  }
  return env.TEST_DATABASE_URL!.trim();
}
