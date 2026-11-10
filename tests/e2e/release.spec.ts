import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { rootAccount, login } from "./support/platform-fixture";
const fixture = () =>
  JSON.parse(readFileSync(".local/e2e-credentials.json", "utf8")) as {
    senha: string;
  };
const headers = {
  Origin: "http://127.0.0.1:3001",
  "Content-Type": "application/json",
};
test("teclado permite pular menu e formulário restaura o foco ao fechar", async ({
  page,
}, info) => {
  const root = await rootAccount();
  await login(page, root.email, fixture().senha);
  await page.goto("/dashboard");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Pular para o conteúdo", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
  await expect(
    page
      .getByRole("navigation", { name: "Menu principal" })
      .getByRole("link", { name: "Visão geral", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await page.goto("/biblioteca/categorias");
  const open = page.getByRole("button", {
    name: "Nova categoria",
    exact: true,
  });
  await open.click();
  await expect(
    page.getByRole("textbox", { name: "Nome", exact: true }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Fechar", exact: true }).click();
  await expect(open).toBeFocused();
  await page.goto("/dashboard");
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await page.screenshot({
    path: `.local/entrega-final-${info.project.name}.png`,
    fullPage: true,
  });
});
test("respostas privadas, sessão e limites JSON preservam os dados do servidor", async ({
  page,
}) => {
  const root = await rootAccount();
  await login(page, root.email, fixture().senha);
  const profile = await page.request.get("/api/core/perfil");
  expect(profile.headers()["cache-control"]).toContain("no-store");
  const text = await profile.text();
  for (const field of ["senhaHash", "tokenHash", "AUTH_SECRET", "DATABASE_URL"])
    expect(text).not.toContain(field);
  const cookies = await page.context().cookies();
  const session = cookies.find((c) => c.name === "educacional_session");
  expect(session?.httpOnly).toBe(true);
  expect(session?.sameSite).toBe("Lax");
  expect(profile.headers()["x-content-type-options"]).toBe("nosniff");
  expect(profile.headers()["x-frame-options"]).toBe("DENY");
  for (const path of ["/.env", "/storage/private/documentos/inexistente.pdf"])
    expect((await page.request.get(path)).status()).toBe(404);
  expect(
    (
      await page.request.post("/api/core/perfil", { headers, data: "{" })
    ).status(),
  ).toBe(400);
  expect(
    (
      await page.request.post("/api/core/perfil", {
        headers: { Origin: headers.Origin, "Content-Type": "text/plain" },
        data: "texto",
      })
    ).status(),
  ).toBe(415);
  expect(
    (
      await page.request.post("/api/core/perfil", {
        headers,
        data: JSON.stringify({ nome: "ã".repeat(9000) }),
      })
    ).status(),
  ).toBe(413);
});
