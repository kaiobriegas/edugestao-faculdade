import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createDatabaseClient } from "../../src/lib/database-client";
import { hashPassword } from "../../src/modules/core/services/security";
import { localLessonTime } from "../../src/lib/academic-time";
const fixture = () =>
  JSON.parse(readFileSync(".local/e2e-credentials.json", "utf8")) as {
    prefix: string;
    senha: string;
    groupId: number;
  };
const headers = { Origin: "http://127.0.0.1:3001" };
const today = () => localLessonTime(new Date()).slice(0, 10);
const due = () =>
  localLessonTime(new Date(Date.now() + 7 * 86400000)).slice(0, 10);
async function login(page: Page, email: string, senha: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(senha);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}
async function logout(page: Page) {
  await page
    .getByRole("button", { name: "Sair da conta", exact: true })
    .click();
  await page.waitForURL("**/login", { waitUntil: "load" });
}
async function account(student = false) {
  const f = fixture(),
    db = createDatabaseClient(process.env.TEST_DATABASE_URL!),
    tag = randomUUID();
  try {
    const role = await db.papel.findUniqueOrThrow({
        where: { nome: student ? "Usuário" : "Administrador" },
      }),
      u = await db.usuario.create({
        data: {
          nome: student ? "Aluno do Financeiro" : "Gestor do Financeiro",
          email: tag + "@example.test",
          senhaHash: await hashPassword(f.senha),
          grupoId: f.groupId,
          papelId: role.idPapel,
        },
      });
    let alunoId = 0,
      matricula = "";
    if (student) {
      const turma = await db.turma.create({
        data: {
          nome: f.prefix + "-fin-" + tag,
          ano: 2026,
          periodo: "Manhã",
          capacidade: 10,
        },
      });
      matricula = "FIN-" + tag.slice(0, 8);
      alunoId = (
        await db.aluno.create({
          data: {
            nome: "Aluno do Financeiro",
            matricula,
            dataMatricula: new Date(),
            usuarioId: u.idUsuario,
            turmaId: turma.idTurma,
          },
        })
      ).idAluno;
    }
    return { email: u.email, alunoId, matricula };
  } finally {
    await db.$disconnect();
  }
}
async function post(page: Page, resource: string, data: unknown) {
  const r = await page.request.post("/api/financeiro/" + resource, {
    headers,
    data,
  });
  expect(r.ok(), await r.text()).toBeTruthy();
  return r.json();
}
const success = (page: Page, message: string) =>
  expect(page.getByText(message, { exact: true })).toBeVisible();
const stat = (page: Page, label: string) =>
  page.locator(".stat").filter({ has: page.getByText(label, { exact: true }) });
test("plano desconto cobrança pagamentos parciais relatório e histórico próprio pela interface", async ({
  page,
}, info) => {
  const f = fixture(),
    manager = await account(),
    student = await account(true),
    peer = await account(true),
    planName = f.prefix + "-plano-" + info.project.name,
    benefit = "Bolsa do Trabalho " + info.project.name;
  await login(page, manager.email, f.senha);
  await page
    .getByRole("navigation", { name: "Menu principal" })
    .getByRole("link", { name: "Financeiro", exact: true })
    .click();
  await expect(page).toHaveURL(/\/financeiro$/);
  const nav = () => page.getByRole("navigation", { name: "Gestão financeira" });
  await nav().getByRole("link", { name: "Planos", exact: true }).click();
  await page.getByRole("button", { name: "Novo plano", exact: true }).click();
  await page.getByLabel("Nome", { exact: true }).fill(planName);
  await page.getByLabel("Valor (R$)", { exact: true }).fill("100.50");
  await page
    .getByRole("button", { name: "Salvar cadastro", exact: true })
    .click();
  await success(page, "Cadastro salvo com sucesso.");
  await nav().getByRole("link", { name: "Descontos", exact: true }).click();
  await page
    .getByRole("button", { name: "Novo desconto", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Aluno", exact: true })
    .selectOption({ label: `Aluno do Financeiro · ${student.matricula}` });
  await page.getByLabel("Descrição do desconto", { exact: true }).fill(benefit);
  await page.getByLabel("Percentual (%)", { exact: true }).fill("10.00");
  await page.getByLabel("Início da validade", { exact: true }).fill(today());
  await page.getByLabel("Fim da validade", { exact: true }).fill(due());
  await page
    .getByRole("button", { name: "Salvar cadastro", exact: true })
    .click();
  await success(page, "Cadastro salvo com sucesso.");
  await nav().getByRole("link", { name: "Cobranças", exact: true }).click();
  await page
    .getByRole("button", { name: "Emitir cobrança", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Aluno", exact: true })
    .selectOption({ label: `Aluno do Financeiro · ${student.matricula}` });
  await page
    .getByRole("combobox", { name: "Plano financeiro", exact: true })
    .selectOption({ label: planName + " · R$ 100,50" });
  const discounts = page.getByRole("combobox", {
    name: "Desconto opcional",
    exact: true,
  });
  const discountOption = discounts.getByRole("option", {
    name: new RegExp(benefit),
  });
  await discounts.selectOption((await discountOption.getAttribute("value"))!);
  await page.getByLabel("Vencimento", { exact: true }).fill(due());
  await page
    .getByRole("button", { name: "Salvar cadastro", exact: true })
    .click();
  await success(page, "Cobrança emitida com sucesso.");
  await page
    .getByRole("row")
    .filter({ hasText: planName })
    .filter({ hasText: student.matricula })
    .getByRole("link", { name: "Ver cobrança", exact: true })
    .click();
  await expect(page).toHaveURL(/\/financeiro\/cobrancas\/\d+$/);
  const chargeId = Number(new URL(page.url()).pathname.split("/").pop());
  await expect(
    stat(page, "Valor final").getByText("R$ 90,45", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Registrar pagamento", exact: true })
    .click();
  await page
    .getByLabel("Valor do pagamento (R$)", { exact: true })
    .fill("40.20");
  await page
    .getByLabel("Referência do comprovante (sem upload)", { exact: true })
    .fill("REC-PRIMEIRA-PARCELA");
  await page
    .getByRole("button", { name: "Salvar cadastro", exact: true })
    .click();
  await success(page, "Pagamento registrado com sucesso.");
  await expect(
    stat(page, "Saldo a pagar").getByText("R$ 50,25", { exact: true }),
  ).toBeVisible();
  await expect(
    stat(page, "Situação").getByText("Parcial", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Registrar pagamento", exact: true })
    .click();
  await page
    .getByLabel("Valor do pagamento (R$)", { exact: true })
    .fill("50.25");
  await page
    .getByRole("button", { name: "Salvar cadastro", exact: true })
    .click();
  await success(page, "Pagamento registrado com sucesso.");
  await expect(
    stat(page, "Situação").getByText("Paga", { exact: true }),
  ).toBeVisible();
  await expect(
    stat(page, "Pago confirmado").getByText("R$ 90,45", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: `.local/financeiro-${info.project.name}.png`,
    fullPage: true,
  });
  await nav().getByRole("link", { name: "Relatórios", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Plano do relatório", exact: true })
    .selectOption({ label: planName });
  await page
    .getByRole("button", { name: "Consultar relatório", exact: true })
    .click();
  await expect(
    stat(page, "Total cobrado").getByText("R$ 90,45", { exact: true }),
  ).toBeVisible();
  await expect(
    stat(page, "Recebido confirmado").getByText("R$ 90,45", { exact: true }),
  ).toBeVisible();
  await expect(
    stat(page, "Saldo em aberto").getByText("R$ 0,00", { exact: true }),
  ).toBeVisible();
  await logout(page);
  await login(page, student.email, f.senha);
  await page.goto(`/financeiro/cobrancas/${chargeId}`);
  await expect(
    stat(page, "Situação").getByText("Paga", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Registrar pagamento", exact: true }),
  ).toHaveCount(0);
  expect((await page.request.get("/api/financeiro/relatorio")).status()).toBe(
    403,
  );
  expect((await page.request.get("/api/financeiro/opcoes")).status()).toBe(403);
  expect(
    (
      await page.request.post("/api/financeiro/pagamentos", {
        headers,
        data: {},
      })
    ).status(),
  ).toBe(403);
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await logout(page);
  await login(page, peer.email, f.senha);
  expect(
    (
      await page.request.get(`/api/financeiro/detalhes?id=${chargeId}`)
    ).status(),
  ).toBe(404);
  expect(
    (
      await page.request.get(
        `/api/financeiro/cobrancas?alunoId=${student.alunoId}`,
      )
    ).status(),
  ).toBe(403);
  const payments = await page.request.get(
    `/api/financeiro/pagamentos?cobrancaId=${chargeId}`,
  );
  expect((await payments.json()).total).toBe(0);
});
test("estorno e cancelamento preservam pagamentos e impedem nova baixa em cobrança cancelada", async ({
  page,
}, info) => {
  const f = fixture(),
    manager = await account(),
    student = await account(true);
  await login(page, manager.email, f.senha);
  const p = await post(page, "planos", {
      nome: f.prefix + "-estorno-" + info.project.name,
      valor: "25.50",
      periodicidade: "Única",
      ativo: true,
    }),
    c = await post(page, "cobrancas", {
      planoId: p.id,
      alunoId: student.alunoId,
      dataVencimento: due(),
    }),
    input = {
      cobrancaId: c.id,
      valor: "25.50",
      dataPagamento: localLessonTime(new Date()),
      formaPagamento: "DINHEIRO",
      chaveIdempotencia: randomUUID(),
    },
    payment = await post(page, "pagamentos", input);
  const repeated = await post(page, "pagamentos", input);
  expect(repeated.id).toBe(payment.id);
  await page.goto(`/financeiro/cobrancas/${c.id}`);
  await page
    .getByRole("button", {
      name: `Estornar pagamento #${payment.id}`,
      exact: true,
    })
    .click();
  await page
    .getByRole("textbox", { name: "Justificativa", exact: true })
    .fill("Lançamento registrado na cobrança errada.");
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Confirmar estorno", exact: true })
    .click();
  await success(page, "Estorno registrado com sucesso.");
  await expect(
    stat(page, "Saldo a pagar").getByText("R$ 25,50", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("cell", { name: /^Estornado/ })).toBeVisible();
  await page
    .getByRole("button", { name: "Cancelar cobrança", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Justificativa", exact: true })
    .fill("Cobrança duplicada, cancelamento administrativo.");
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Confirmar cancelamento", exact: true })
    .click();
  await success(page, "Cobrança cancelada com sucesso.");
  await expect(
    stat(page, "Situação").getByText("Cancelada", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("cell", { name: /^Estornado/ })).toBeVisible();
  expect(
    (
      await page.request.post("/api/financeiro/pagamentos", {
        headers,
        data: { ...input, valor: "0.01", chaveIdempotencia: randomUUID() },
      })
    ).status(),
  ).toBe(409);
  expect(
    (
      await page.request.post("/api/financeiro/cancelar", {
        headers: { Origin: "https://indevido.example" },
        data: { cobrancaId: c.id, motivo: "Pedido externo inválido" },
      })
    ).status(),
  ).toBe(403);
});
