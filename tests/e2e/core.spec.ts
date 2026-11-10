import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createDatabaseClient } from "../../src/lib/database-client";
type Fixture = {
  prefix: string;
  senha: string;
  rootEmail: string;
  userEmail: string;
  groupId: number;
  moduleId: number;
};
function fixture(): Fixture {
  return JSON.parse(readFileSync(".local/e2e-credentials.json", "utf8"));
}
async function login(page: Page, email: string, senha: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(senha);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}
test("root cadastra usuário, grupo e atribui módulo pela interface", async ({
  page,
}, info) => {
  const f = fixture();
  await login(page, f.rootEmail, f.senha);
  await expect(page.getByRole("heading", { name: "Olá, Root." })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `.local/dashboard-${info.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("link", { name: "Usuários", exact: true }).click();
  await page.getByRole("button", { name: "Novo usuário" }).click();
  const name = "Aluno " + randomUUID().slice(0, 8),
    email = randomUUID() + "@example.test";
  await page.getByLabel("Nome", { exact: true }).fill(name);
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Senha do novo usuário", { exact: true }).fill(f.senha);
  await page
    .getByLabel("Sua senha para confirmar", { exact: true })
    .fill(f.senha);
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(
    page.getByText("Alteração salva com sucesso.", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Pesquisar registros").fill(email);
  await expect(page.getByText(name, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: `Editar ${name}` }).click();
  await page
    .getByRole("combobox", { name: "Situação", exact: true })
    .selectOption("inativo");
  await page
    .getByLabel("Sua senha para confirmar", { exact: true })
    .fill(f.senha);
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(
    page.getByText("Alteração salva com sucesso.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Inativo", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Grupos", exact: true }).click();
  await page.getByRole("button", { name: "Novo grupo" }).click();
  const groupName = f.prefix + "-UI-" + info.project.name;
  await page.getByLabel("Nome", { exact: true }).fill(groupName);
  await page
    .getByLabel("Descrição", { exact: true })
    .fill("Grupo cadastrado pela interface");
  await page.getByLabel("Biblioteca", { exact: true }).check();
  await page
    .getByLabel("Sua senha para confirmar", { exact: true })
    .fill(f.senha);
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(
    page.getByText("Alteração salva com sucesso.", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Pesquisar registros").fill(groupName);
  await expect(page.getByText(groupName, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Sair da conta" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/administracao/usuarios");
  await expect(page).toHaveURL(/\/login$/);
});
test("usuário tem menu restrito e API impede acesso direto ou CSRF", async ({
  page,
}) => {
  const f = fixture();
  await login(page, f.userEmail, f.senha);
  await expect(
    page.getByRole("link", { name: "Usuários", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Biblioteca", exact: true }),
  ).toBeVisible();
  expect((await page.request.get("/api/core/usuarios")).status()).toBe(403);
  expect(
    (
      await page.request.post("/api/core/grupos", {
        headers: { Origin: "https://externo.example" },
        data: {},
      })
    ).status(),
  ).toBe(403);
  const db = createDatabaseClient(process.env.TEST_DATABASE_URL!);
  try {
    await db.grupoModulo.update({
      where: { grupoId_moduloId: { grupoId: f.groupId, moduloId: f.moduleId } },
      data: { habilitado: false },
    });
    await page.goto("/modulos/biblioteca");
    await expect(
      page.getByRole("heading", { name: "Módulo não autorizado" }),
    ).toBeVisible();
  } finally {
    await db.grupoModulo.update({
      where: { grupoId_moduloId: { grupoId: f.groupId, moduloId: f.moduleId } },
      data: { habilitado: true },
    });
    await db.$disconnect();
  }
});
test("perfil e recuperação de senha funcionam com e-mail capturado no Mailpit", async ({
  page,
  request,
}, info) => {
  const f = fixture();
  const db = createDatabaseClient(process.env.TEST_DATABASE_URL!);
  const email = randomUUID() + "@example.test",
    senha = randomUUID();
  const { hashPassword } =
    await import("../../src/modules/core/services/security");
  try {
    const role = await db.papel.findUniqueOrThrow({
      where: { nome: "Usuário" },
    });
    await db.usuario.create({
      data: {
        nome: "Conta Recuperação",
        email,
        senhaHash: await hashPassword(senha),
        grupoId: f.groupId,
        papelId: role.idPapel,
      },
    });
    await login(page, email, senha);
    await page.getByRole("link", { name: "Meu perfil" }).click();
    await page.getByLabel("Nome", { exact: true }).fill("Perfil Atualizado");
    await page.getByLabel("Sua senha atual", { exact: true }).fill(senha);
    await page.getByRole("button", { name: "Salvar perfil" }).click();
    await expect(page.getByRole("status")).toHaveText("Perfil atualizado.");
    await page.getByRole("button", { name: "Sair da conta" }).click();
    await page.getByRole("link", { name: "Esqueci minha senha" }).click();
    await expect(
      page.getByRole("heading", { name: "Recupere seu acesso" }),
    ).toBeVisible();
    await page.getByLabel("E-mail", { exact: true }).fill(email);
    await page
      .getByRole("button", { name: "Enviar link de recuperação" })
      .click();
    await expect(page.getByRole("status")).toContainText(
      "Se houver uma conta ativa",
    );
    const messages = await (
      await request.get("http://127.0.0.1:8025/api/v1/messages")
    ).json();
    const message = messages.messages.find((m: { To: { Address: string }[] }) =>
      m.To.some((to) => to.Address === email),
    );
    expect(message).toBeTruthy();
    const detail = await (
      await request.get(`http://127.0.0.1:8025/api/v1/message/${message.ID}`)
    ).json();
    const match = detail.Text.match(/token=([a-f0-9]{64})/);
    expect(match).toBeTruthy();
    const token = match[1];
    const novaSenha = randomUUID();
    await page.goto(`/redefinir-senha?token=${token}`);
    await page.getByLabel("Nova senha", { exact: true }).fill(novaSenha);
    await page.getByRole("button", { name: "Salvar nova senha" }).click();
    await expect(page.getByRole("status")).toContainText("Senha redefinida");
    await page.getByRole("link", { name: "Voltar para o login" }).click();
    await login(page, email, novaSenha);
    await page.screenshot({
      path: `.local/profile-${info.project.name}.png`,
      fullPage: true,
    });
  } finally {
    await db.$disconnect();
  }
});
