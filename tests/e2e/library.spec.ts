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
const future = () => localLessonTime(new Date(Date.now() + 7 * 86400000));
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
          nome: student ? "Aluno da Biblioteca" : "Gestor da Biblioteca",
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
          nome: f.prefix + "-bib-" + tag,
          ano: 2026,
          periodo: "Manhã",
          capacidade: 10,
        },
      });
      matricula = "BIB-" + tag.slice(0, 8);
      alunoId = (
        await db.aluno.create({
          data: {
            nome: "Aluno da Biblioteca",
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
  const r = await page.request.post("/api/biblioteca/" + resource, {
    headers,
    data,
  });
  expect(r.ok(), await r.text()).toBeTruthy();
  return r.json();
}
const success = (page: Page, message: string) =>
  expect(page.getByText(message, { exact: true })).toBeVisible();
test("biblioteca completa com categoria livro exemplar reserva empréstimo devolução e histórico próprio", async ({
  page,
}, info) => {
  const f = fixture(),
    manager = await account(),
    student = await account(true),
    peer = await account(true),
    category = f.prefix + "-categoria-" + info.project.name,
    title = f.prefix + "-livro-" + info.project.name,
    code = "EX-" + randomUUID().slice(0, 8);
  await login(page, manager.email, f.senha);
  await page
    .getByRole("navigation", { name: "Menu principal" })
    .getByRole("link", { name: "Biblioteca", exact: true })
    .click();
  await expect(page).toHaveURL(/\/biblioteca$/);
  const nav = () =>
    page.getByRole("navigation", { name: "Gestão da biblioteca" });
  await nav().getByRole("link", { name: "Categorias", exact: true }).click();
  await page
    .getByRole("button", { name: "Nova categoria", exact: true })
    .click();
  await page.getByLabel("Nome", { exact: true }).fill(category);
  await page
    .getByRole("button", { name: "Salvar cadastro", exact: true })
    .click();
  await success(page, "Cadastro salvo com sucesso.");
  await nav().getByRole("link", { name: "Acervo", exact: true }).click();
  await page.getByRole("button", { name: "Novo livro", exact: true }).click();
  await page.getByLabel("Título", { exact: true }).fill(title);
  await page.getByLabel("Autor", { exact: true }).fill("Autora do Trabalho");
  await page
    .getByRole("combobox", { name: "Categoria", exact: true })
    .selectOption({ label: category });
  await page
    .getByLabel("ISBN", { exact: true })
    .fill("978" + Date.now().toString().slice(-10));
  await page
    .getByRole("button", { name: "Salvar cadastro", exact: true })
    .click();
  await success(page, "Cadastro salvo com sucesso.");
  await nav().getByRole("link", { name: "Exemplares", exact: true }).click();
  await page
    .getByRole("button", { name: "Novo exemplar", exact: true })
    .click();
  await page.getByLabel("Código do exemplar", { exact: true }).fill(code);
  await page
    .getByRole("combobox", { name: "Livro", exact: true })
    .selectOption({ label: title });
  await page
    .getByLabel("Localização", { exact: true })
    .fill("Estante A · Prateleira 2");
  await page
    .getByRole("button", { name: "Salvar cadastro", exact: true })
    .click();
  await success(page, "Cadastro salvo com sucesso.");
  await nav().getByRole("link", { name: "Reservas", exact: true }).click();
  await page.getByRole("button", { name: "Nova reserva", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Aluno", exact: true })
    .selectOption({ label: `Aluno da Biblioteca · ${student.matricula}` });
  await page
    .getByRole("combobox", { name: "Livro", exact: true })
    .selectOption({ label: title });
  await page
    .getByLabel("Validade da reserva (Brasília)", { exact: true })
    .fill(future());
  await page
    .getByRole("button", { name: "Salvar cadastro", exact: true })
    .click();
  await success(page, "Reserva registrada com sucesso.");
  await nav().getByRole("link", { name: "Empréstimos", exact: true }).click();
  await page
    .getByRole("button", { name: "Novo empréstimo", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Aluno", exact: true })
    .selectOption({ label: `Aluno da Biblioteca · ${student.matricula}` });
  await page
    .getByRole("combobox", { name: "Exemplar disponível", exact: true })
    .selectOption({ label: `${code} · ${title}` });
  await page
    .getByLabel("Devolução prevista (Brasília)", { exact: true })
    .fill(future());
  await page
    .getByRole("button", { name: "Salvar cadastro", exact: true })
    .click();
  await success(page, "Empréstimo registrado com sucesso.");
  const row = () => page.getByRole("row").filter({ hasText: code });
  await expect(row().getByText("Aberto", { exact: true })).toBeVisible();
  const db = createDatabaseClient(process.env.TEST_DATABASE_URL!);
  let bookId = 0,
    copyId = 0;
  try {
    const c = await db.exemplar.findUniqueOrThrow({ where: { codigo: code } });
    copyId = c.idExemplar;
    bookId = c.livroId;
    expect(
      (await db.emprestimo.findFirstOrThrow({ where: { exemplarId: copyId } }))
        .alunoId,
    ).toBe(student.alunoId);
  } finally {
    await db.$disconnect();
  }
  expect(
    (
      await page.request.post("/api/biblioteca/emprestimos", {
        headers,
        data: {
          alunoId: peer.alunoId,
          exemplarId: copyId,
          dataPrevistaDevolucao: future(),
        },
      })
    ).status(),
  ).toBe(409);
  await nav().getByRole("link", { name: "Reservas", exact: true }).click();
  const reservationRow = () =>
    page
      .getByRole("row")
      .filter({ hasText: title })
      .filter({ hasText: student.matricula });
  page.once("dialog", (d) => d.accept());
  await reservationRow()
    .getByRole("button", { name: "Atender", exact: true })
    .click();
  await success(page, "Reserva atualizada com sucesso.");
  await expect(
    reservationRow().getByText("Atendida", { exact: true }),
  ).toBeVisible();
  await nav().getByRole("link", { name: "Empréstimos", exact: true }).click();
  page.once("dialog", (d) => d.accept());
  await row().getByRole("button", { name: "Devolver", exact: true }).click();
  await success(page, "Devolução registrada com sucesso.");
  await expect(row().getByText("Devolvido", { exact: true })).toBeVisible();
  await page.goto(`/biblioteca/livros/${bookId}`);
  await expect(
    page.getByText("Disponível para empréstimo", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: `.local/biblioteca-${info.project.name}.png`,
    fullPage: true,
  });
  await logout(page);
  await login(page, student.email, f.senha);
  await page.goto("/biblioteca/emprestimos");
  await page.getByLabel("Pesquisar", { exact: true }).fill(code);
  await expect(
    page
      .getByRole("row")
      .filter({ hasText: code })
      .getByText("Devolvido", { exact: true }),
  ).toBeVisible();
  expect((await page.request.get("/api/biblioteca/opcoes")).status()).toBe(403);
  expect(
    (
      await page.request.post("/api/biblioteca/devolver", {
        headers,
        data: { emprestimoId: 1 },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await page.request.get(
        `/api/biblioteca/emprestimos?alunoId=${peer.alunoId}`,
      )
    ).status(),
  ).toBe(403);
  await page.goto(`/biblioteca/livros/${bookId}`);
  await expect(
    page.getByRole("button", { name: "Novo empréstimo", exact: true }),
  ).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await logout(page);
  await login(page, peer.email, f.senha);
  const own = await page.request.get(
    `/api/biblioteca/emprestimos?livroId=${bookId}`,
  );
  expect((await own.json()).total).toBe(0);
  const reserves = await page.request.get(
    `/api/biblioteca/reservas?livroId=${bookId}`,
  );
  expect((await reserves.json()).total).toBe(0);
});
test("reserva vencida é filtrada como expirada e gestor registra encerramento sem alterar empréstimos", async ({
  page,
}, info) => {
  const f = fixture(),
    manager = await account(),
    student = await account(true),
    title = f.prefix + "-vencida-" + info.project.name;
  await login(page, manager.email, f.senha);
  const c = await post(page, "categorias", {
      nome: f.prefix + "-vencida-cat-" + info.project.name,
      ativo: true,
    }),
    b = await post(page, "livros", {
      titulo: title,
      autor: "Autora",
      categoriaId: c.id,
      ativo: true,
    }),
    e = await post(page, "exemplares", {
      codigo: "V-" + randomUUID().slice(0, 8),
      livroId: b.id,
      situacao: "DISPONIVEL",
      ativo: true,
    }),
    r = await post(page, "reservas", {
      livroId: b.id,
      alunoId: student.alunoId,
      dataExpiracao: future(),
    });
  const db = createDatabaseClient(process.env.TEST_DATABASE_URL!);
  try {
    await db.$executeRaw`UPDATE reserva SET data_reserva=clock_timestamp()-interval '2 days',data_expiracao=clock_timestamp()-interval '1 day' WHERE id_reserva=${r.id}`;
  } finally {
    await db.$disconnect();
  }
  await page.goto("/biblioteca/reservas");
  await page.getByLabel("Pesquisar", { exact: true }).fill(title);
  await page
    .getByRole("combobox", { name: "Filtrar situação", exact: true })
    .selectOption("EXPIRADA");
  const row = page.getByRole("row").filter({ hasText: title });
  await expect(row.getByText("Expirada", { exact: true })).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await row
    .getByRole("button", { name: "Registrar expiração", exact: true })
    .click();
  await success(page, "Expiração registrada com sucesso.");
  await expect(
    row.getByRole("button", { name: "Registrar expiração", exact: true }),
  ).toHaveCount(0);
  expect(
    (
      await page.request.post("/api/biblioteca/emprestimos", {
        headers: { Origin: "https://indevido.example" },
        data: {
          alunoId: student.alunoId,
          exemplarId: e.id,
          dataPrevistaDevolucao: future(),
        },
      })
    ).status(),
  ).toBe(403);
  const dto = await (
    await page.request.get(`/api/biblioteca/detalhes?id=${b.id}`)
  ).json();
  expect(dto.disponiveis).toBe(1);
  await post(page, "emprestimos", {
    alunoId: student.alunoId,
    exemplarId: e.id,
    dataPrevistaDevolucao: future(),
  });
  expect(
    (
      await (
        await page.request.get(`/api/biblioteca/detalhes?id=${b.id}`)
      ).json()
    ).disponiveis,
  ).toBe(0);
});
