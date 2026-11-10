import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createDatabaseClient } from "../../src/lib/database-client";
import { hashPassword } from "../../src/modules/core/services/security";
type Fixture = {
  prefix: string;
  senha: string;
  rootEmail: string;
  userEmail: string;
  groupId: number;
};
const fixture = (): Fixture =>
  JSON.parse(readFileSync(".local/e2e-credentials.json", "utf8"));
const pdf = Buffer.from("%PDF-1.4\n1 0 obj <</Type /Catalog>> endobj\n%%EOF");
async function login(page: Page, email: string, senha: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(senha);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}
test("cadastro acadêmico completo com responsável, ocorrência e documento privado", async ({
  page,
}, info) => {
  const f = fixture();
  await login(page, f.rootEmail, f.senha);
  await page.getByRole("link", { name: "Alunos", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Gestão de Alunos", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Gestão de alunos" })
    .getByRole("link", { name: "Turmas", exact: true })
    .click();
  await page.getByRole("button", { name: "Nova turma" }).click();
  const className = f.prefix + "-turma-" + info.project.name;
  await page.getByLabel("Nome", { exact: true }).fill(className);
  await page.getByLabel("Capacidade", { exact: true }).fill("2");
  await page.getByRole("button", { name: "Salvar cadastro" }).click();
  await expect(
    page.getByText("Cadastro salvo com sucesso.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Gestão de alunos" })
    .getByRole("link", { name: "Responsáveis", exact: true })
    .click();
  await page.getByRole("button", { name: "Novo responsável" }).click();
  const responsible = f.prefix + "-responsavel-" + info.project.name;
  await page.getByLabel("Nome", { exact: true }).fill(responsible);
  await page.getByLabel("Telefone", { exact: true }).fill("38999999999");
  await page.getByRole("button", { name: "Salvar cadastro" }).click();
  await expect(
    page.getByText("Cadastro salvo com sucesso.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Gestão de alunos" })
    .getByRole("link", { name: "Alunos", exact: true })
    .click();
  await page.getByRole("button", { name: "Novo aluno" }).click();
  const name = "Aluno Acadêmico " + info.project.name,
    matricula = "AC-" + randomUUID().slice(0, 8);
  await page.getByLabel("Nome", { exact: true }).fill(name);
  await page.getByLabel("Matrícula acadêmica", { exact: true }).fill(matricula);
  await page
    .getByLabel("Data de nascimento", { exact: true })
    .fill("2005-07-01");
  await page
    .getByRole("combobox", { name: "Turma", exact: true })
    .selectOption({ label: className + " · 2 vaga(s)" });
  await page.getByRole("button", { name: "Salvar cadastro" }).click();
  await expect(
    page.getByText("Cadastro salvo com sucesso.", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Pesquisar cadastros").fill(matricula);
  await expect(page.getByText(name, { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `.local/students-${info.project.name}.png`,
    fullPage: true,
  });
  await page
    .getByRole("row")
    .filter({ hasText: matricula })
    .getByRole("link", { name: "Abrir ficha" })
    .click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  await page
    .getByRole("combobox", { name: "Responsável", exact: true })
    .selectOption({ label: responsible });
  await page.getByLabel("Parentesco neste vínculo").fill("Mãe");
  await page.getByRole("button", { name: "Vincular responsável" }).click();
  await expect(
    page.getByText("Responsável vinculado.", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Tipo da ocorrência", { exact: true })
    .fill("Acompanhamento");
  await page
    .getByLabel("Descrição da ocorrência", { exact: true })
    .fill("Registro acadêmico feito no teste de interface.");
  await page
    .getByRole("button", { name: "Registrar ocorrência", exact: true })
    .click();
  await expect(
    page.getByText("Ocorrência salva com sucesso.", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Tipo do documento", { exact: true })
    .fill("Identidade");
  await page.getByLabel("Arquivo", { exact: true }).setInputFiles({
    name: "comprovante.pdf",
    mimeType: "application/pdf",
    buffer: pdf,
  });
  await page
    .getByRole("button", { name: "Enviar documento", exact: true })
    .click();
  await expect(
    page.getByText("Documento enviado com sucesso.", { exact: true }),
  ).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("link", { name: "Baixar comprovante.pdf", exact: true })
    .click();
  expect((await downloadPromise).suggestedFilename()).toBe("comprovante.pdf");
  const response = await page.request.get(
    (await page
      .getByRole("link", { name: "Baixar comprovante.pdf" })
      .getAttribute("href")) || "",
  );
  expect(response.status()).toBe(200);
  expect(await response.body()).toEqual(pdf);
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `.local/student-file-${info.project.name}.png`,
    fullPage: true,
  });
});
test("aluno consulta apenas ficha e arquivos próprios e não vê ocorrências internas", async ({
  page,
}, info) => {
  const f = fixture();
  await login(page, f.rootEmail, f.senha);
  const db = createDatabaseClient(process.env.TEST_DATABASE_URL!);
  const email = randomUUID() + "@example.test",
    matricula = "SEC-" + randomUUID().slice(0, 8);
  let studentId = 0,
    otherStudentId = 0;
  try {
    const role = await db.papel.findUniqueOrThrow({
      where: { nome: "Usuário" },
    });
    const user = await db.usuario.create({
      data: {
        nome: "Conta Aluno",
        email,
        senhaHash: await hashPassword(f.senha),
        grupoId: f.groupId,
        papelId: role.idPapel,
      },
    });
    const cls = await page.request.post("/api/alunos/turmas", {
      headers: { Origin: "http://127.0.0.1:3001" },
      data: {
        nome: f.prefix + "-seguranca-" + info.project.name,
        ano: 2026,
        periodo: "Manhã",
        capacidade: 3,
        ativo: true,
      },
    });
    expect(cls.status()).toBe(200);
    const turmaId = (await cls.json()).id;
    const base = {
      nome: "Aluno da Conta",
      matricula,
      dataMatricula: "2026-10-28",
      turmaId,
      status: "MATRICULADO",
      ativo: true,
      usuarioId: user.idUsuario,
      confirmacaoSenha: f.senha,
    };
    const own = await page.request.post("/api/alunos/alunos", {
      headers: { Origin: "http://127.0.0.1:3001" },
      data: base,
    });
    expect(own.status()).toBe(200);
    studentId = (await own.json()).id;
    const other = await page.request.post("/api/alunos/alunos", {
      headers: { Origin: "http://127.0.0.1:3001" },
      data: {
        ...base,
        nome: "Aluno de outra conta",
        matricula: "OT-" + randomUUID().slice(0, 8),
        usuarioId: null,
      },
    });
    expect(other.status()).toBe(200);
    otherStudentId = (await other.json()).id;
    await page.request.post("/api/alunos/ocorrencias", {
      headers: { Origin: "http://127.0.0.1:3001" },
      data: {
        alunoId: studentId,
        tipo: "Interna",
        descricao: "Conteúdo interno do gestor",
        dataOcorrencia: "2026-10-28",
        status: "REGISTRADA",
        ativo: true,
      },
    });
    const doc = await page.request.post("/api/alunos/documentos", {
      headers: { Origin: "http://127.0.0.1:3001" },
      multipart: {
        alunoId: String(otherStudentId),
        tipo: "Identidade",
        arquivo: {
          name: "outro.pdf",
          mimeType: "application/pdf",
          buffer: pdf,
        },
      },
    });
    expect(doc.status()).toBe(200);
    const docId = (await doc.json()).id;
    await page.getByRole("button", { name: "Sair da conta" }).click();
    await page.waitForURL("**/login", { waitUntil: "load" });
    await login(page, email, f.senha);
    await page.getByRole("link", { name: "Alunos", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Meu cadastro acadêmico" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Novo aluno" })).toHaveCount(
      0,
    );
    await page.getByRole("link", { name: "Abrir ficha" }).click();
    await expect(
      page.getByRole("heading", { name: "Aluno da Conta", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Ocorrências internas" }),
    ).toHaveCount(0);
    expect(await page.content()).not.toContain("Conteúdo interno do gestor");
    expect(
      (
        await page.request.get(`/api/alunos/detalhes?id=${otherStudentId}`)
      ).status(),
    ).toBe(404);
    expect(
      (await page.request.get(`/api/alunos/documentos/${docId}`)).status(),
    ).toBe(404);
    expect((await page.request.get("/api/alunos/responsaveis")).status()).toBe(
      403,
    );
    expect(
      (
        await page.request.post("/api/alunos/ocorrencias", {
          headers: { Origin: "http://127.0.0.1:3001" },
          data: {},
        })
      ).status(),
    ).toBe(403);
  } finally {
    await db.$disconnect();
  }
});
