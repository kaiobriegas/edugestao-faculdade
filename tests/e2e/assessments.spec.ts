import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createDatabaseClient } from "../../src/lib/database-client";
import { hashPassword } from "../../src/modules/core/services/security";
const fixture = () =>
  JSON.parse(readFileSync(".local/e2e-credentials.json", "utf8")) as {
    prefix: string;
    senha: string;
    rootEmail: string;
    groupId: number;
  };
const headers = { Origin: "http://127.0.0.1:3001" };
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
async function student() {
  const f = fixture(),
    db = createDatabaseClient(process.env.TEST_DATABASE_URL!),
    tag = randomUUID();
  try {
    const role = await db.papel.findUniqueOrThrow({
        where: { nome: "Usuário" },
      }),
      user = await db.usuario.create({
        data: {
          nome: "Aluno de avaliação",
          email: tag + "@example.test",
          senhaHash: await hashPassword(f.senha),
          grupoId: f.groupId,
          papelId: role.idPapel,
        },
      }),
      turma = await db.turma.create({
        data: {
          nome: f.prefix + "-av-" + tag,
          ano: 2026,
          periodo: "Manhã",
          capacidade: 10,
        },
      });
    await db.aluno.create({
      data: {
        nome: "Aluno de avaliação",
        matricula: "AV-" + tag,
        dataMatricula: new Date(),
        usuarioId: user.idUsuario,
        turmaId: turma.idTurma,
      },
    });
    return user.email;
  } finally {
    await db.$disconnect();
  }
}
async function assessmentManager() {
  const f = fixture(),
    db = createDatabaseClient(process.env.TEST_DATABASE_URL!);
  try {
    const role = await db.papel.findUniqueOrThrow({
      where: { nome: "Administrador" },
    });
    const user = await db.usuario.create({
      data: {
        nome: "Gestor de avaliações",
        email: randomUUID() + "@example.test",
        senhaHash: await hashPassword(f.senha),
        grupoId: f.groupId,
        papelId: role.idPapel,
      },
    });
    return user.email;
  } finally {
    await db.$disconnect();
  }
}
async function post(page: Page, resource: string, data: unknown) {
  const res = await page.request.post("/api/avaliacoes/" + resource, {
    headers,
    data,
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  return res.json();
}
test("prova objetiva e discursiva com rascunho, gabarito protegido e correção manual", async ({
  page,
}, info) => {
  const f = { ...fixture(), rootEmail: await assessmentManager() },
    email = await student();
  await login(page, f.rootEmail, f.senha);
  await page.goto("/avaliacoes");
  await page.getByRole("button", { name: "Nova avaliação" }).click();
  const titulo = f.prefix + "-prova-" + info.project.name;
  await page.getByLabel("Título", { exact: true }).fill(titulo);
  await page
    .getByLabel("Liberação (Brasília)", { exact: true })
    .fill("2026-01-01T08:00");
  await page.getByLabel("Tempo limite (minutos)", { exact: true }).fill("30");
  await page.getByRole("button", { name: "Salvar cadastro" }).click();
  await expect(
    page.getByText("Avaliação salva com sucesso.", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Pesquisar por título").fill(titulo);
  await page
    .getByRole("row")
    .filter({ hasText: titulo })
    .getByRole("link", { name: "Gerenciar", exact: true })
    .click();
  await expect(page).toHaveURL(/\/avaliacoes\/\d+$/);
  const examId = Number(new URL(page.url()).pathname.split("/").pop());
  await page.getByRole("button", { name: "Nova questão" }).click();
  await page
    .getByLabel("Enunciado", { exact: true })
    .fill("Qual recurso garante vínculos entre tabelas?");
  await page.getByLabel("Pontuação", { exact: true }).fill("2");
  for (const [letter, text] of Object.entries({
    A: "Chave estrangeira",
    B: "Cor de fundo",
    C: "Fonte",
    D: "Animação",
  }))
    await page.getByLabel("Alternativa " + letter, { exact: true }).fill(text);
  await page.getByRole("button", { name: "Salvar cadastro" }).click();
  await expect(
    page.getByRole("heading", { name: /1\. Qual recurso/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Nova questão" }).click();
  await page
    .getByRole("combobox", { name: "Tipo de questão", exact: true })
    .selectOption("DISCURSIVA");
  await page
    .getByLabel("Enunciado", { exact: true })
    .fill("Explique a integridade referencial.");
  await page.getByLabel("Pontuação", { exact: true }).fill("3");
  await page.getByRole("button", { name: "Salvar cadastro" }).click();
  await expect(
    page.getByRole("heading", { name: /2\. Explique/ }),
  ).toBeVisible();
  await logout(page);
  await login(page, email, f.senha);
  await page.goto(`/avaliacoes/${examId}`);
  await expect(page.getByText(/Gabarito/)).toHaveCount(0);
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Iniciar avaliação", exact: true })
    .click();
  await expect(page).toHaveURL(/\/avaliacoes\/tentativas\/\d+$/);
  const attemptId = Number(new URL(page.url()).pathname.split("/").pop());
  let response = await page.request.get(
    `/api/avaliacoes/tentativa?id=${attemptId}`,
  );
  let dto = await response.json();
  expect(JSON.stringify(dto)).not.toContain("alternativaCorreta");
  await page
    .getByRole("radio", { name: "A. Chave estrangeira", exact: true })
    .check();
  await page
    .getByRole("textbox", { name: "Resposta da questão 2", exact: true })
    .fill("A chave estrangeira impede referências a registros inexistentes.");
  await page
    .getByRole("button", { name: "Salvar respostas", exact: true })
    .click();
  await expect(
    page.getByText("Respostas salvas com sucesso.", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("radio", { name: "A. Chave estrangeira", exact: true }),
  ).toBeChecked();
  await expect(
    page.getByRole("textbox", { name: "Resposta da questão 2", exact: true }),
  ).toHaveValue(/chave estrangeira/);
  expect(
    (
      await page.request.post("/api/avaliacoes/corrigir", {
        headers,
        data: { respostaId: 1, pontuacao: 3 },
      })
    ).status(),
  ).toBe(403);
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Finalizar avaliação", exact: true })
    .click();
  await expect(
    page.getByText("Avaliação finalizada com sucesso.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Gabarito: A", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Aguardando correção", { exact: true }),
  ).toBeVisible();
  await logout(page);
  await login(page, f.rootEmail, f.senha);
  await page.goto(`/avaliacoes/${examId}`);
  await expect(
    page.getByRole("button", { name: "Nova questão", exact: true }),
  ).toBeDisabled();
  await page.goto(`/avaliacoes/tentativas/${attemptId}`);
  await page.getByLabel("Pontos da questão 2", { exact: true }).fill("2.5");
  await page
    .getByRole("textbox", { name: "Comentário da questão 2", exact: true })
    .fill("Resposta correta, pode detalhar a exclusão.");
  await page
    .getByRole("button", { name: "Salvar correção 2", exact: true })
    .click();
  await expect(
    page.getByText("Correção salva com sucesso.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("4.50 / 5", { exact: true })).toBeVisible();
  await logout(page);
  await login(page, email, f.senha);
  await page.goto("/avaliacoes/resultados");
  await page.getByLabel("Pesquisar por título").fill(titulo);
  await expect(page.getByText("4.50", { exact: true })).toBeVisible();
  await page
    .getByRole("row")
    .filter({ hasText: titulo })
    .getByRole("link", { name: "Ver tentativa", exact: true })
    .click();
  await expect(
    page.getByText("Resposta correta, pode detalhar a exclusão.", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Salvar correção/ }),
  ).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await page.screenshot({
    path: `.local/avaliacoes-${info.project.name}.png`,
    fullPage: true,
  });
  response = await page.request.get(`/api/avaliacoes/detalhes?id=${examId}`);
  dto = await response.json();
  expect(dto).not.toHaveProperty("questoes");
});
test("prazo expirado finaliza somente rascunho salvo e operação exige origem correta", async ({
  page,
}, info) => {
  const f = { ...fixture(), rootEmail: await assessmentManager() },
    email = await student();
  await login(page, f.rootEmail, f.senha);
  const e = await post(page, "avaliacoes", {
    titulo: f.prefix + "-prazo-" + info.project.name,
    tipo: "Prova",
    dataAplicacao: "2026-01-01T08:00",
    tempoLimite: 1,
    ativo: true,
  });
  const q = await post(page, "questoes", {
    avaliacaoId: e.id,
    enunciado: "Quanto é dois mais dois?",
    tipo: "OBJETIVA",
    pontuacao: 2,
    alternativaA: "4",
    alternativaB: "5",
    alternativaC: "6",
    alternativaD: "7",
    alternativaCorreta: "A",
    ativo: true,
  });
  await logout(page);
  await login(page, email, f.senha);
  const t = await post(page, "iniciar", { avaliacaoId: e.id });
  expect(
    (
      await page.request.post("/api/avaliacoes/respostas", {
        headers: { Origin: "https://indevido.example" },
        data: { tentativaId: t.id, respostas: [] },
      })
    ).status(),
  ).toBe(403);
  await post(page, "respostas", {
    tentativaId: t.id,
    respostas: [{ questaoId: q.id, alternativaSelecionada: "A" }],
  });
  const db = createDatabaseClient(process.env.TEST_DATABASE_URL!);
  try {
    await db.$executeRaw`UPDATE tentativa_avaliacao SET iniciada_em=clock_timestamp()-interval '2 minutes', prazo_em=clock_timestamp()-interval '1 minute' WHERE id_tentativa=${t.id}`;
  } finally {
    await db.$disconnect();
  }
  expect(
    (
      await page.request.post("/api/avaliacoes/respostas", {
        headers,
        data: {
          tentativaId: t.id,
          respostas: [{ questaoId: q.id, alternativaSelecionada: "B" }],
        },
      })
    ).status(),
  ).toBe(409);
  await page.goto(`/avaliacoes/tentativas/${t.id}`);
  await expect(page.getByText("Corrigida", { exact: true })).toBeVisible();
  await expect(page.getByText("2.00 / 2", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("radio", { name: "A. 4", exact: true }),
  ).toBeChecked();
  expect(
    (
      await page.request.post("/api/avaliacoes/finalizar", {
        headers,
        data: { tentativaId: t.id, alunoId: 123, respostas: [] },
      })
    ).status(),
  ).toBe(400);
});
