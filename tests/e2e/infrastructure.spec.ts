import { expect, test } from "@playwright/test";
test("visitante é direcionado ao login e healthcheck conecta ao PostgreSQL", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("heading", { name: "Entre na sua conta" }),
  ).toBeVisible();
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({
    status: "ok",
    database: "connected",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: ".local/login-preview.png", fullPage: true });
});
