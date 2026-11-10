import { expect, type Page, type Browser } from "@playwright/test";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createDatabaseClient } from "../../../src/lib/database-client";
import { hashPassword } from "../../../src/modules/core/services/security";
import { localLessonTime } from "../../../src/lib/academic-time";
const fixture = () =>
  JSON.parse(readFileSync(".local/e2e-credentials.json", "utf8")) as {
    prefix: string;
    senha: string;
    rootGroup: number;
  };
const headers = { Origin: "http://127.0.0.1:3001" };
const today = () => localLessonTime(new Date()).slice(0, 10),
  future = () => localLessonTime(new Date(Date.now() + 7 * 86400000));
async function login(page: Page, email: string, senha: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(senha);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}
async function post(page: Page, area: string, resource: string, data: unknown) {
  const response = await page.request.post(`/api/${area}/${resource}`, {
    headers,
    data,
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return (await response.json()) as { id: number };
}
async function rootAccount() {
  const f = fixture(),
    db = createDatabaseClient(process.env.TEST_DATABASE_URL!);
  try {
    const roles = await db.papel.findMany(),
      modules = await db.modulo.findMany({
        select: { idModulo: true, codigo: true, nome: true },
      }),
      email = randomUUID() + "@example.test";
    await db.usuario.create({
      data: {
        nome: "Root da Jornada Integrada",
        email,
        senhaHash: await hashPassword(f.senha),
        papelId: roles.find((r) => r.nome === "root")!.idPapel,
        grupoId: f.rootGroup,
      },
    });
    return {
      email,
      userRole: roles.find((r) => r.nome === "Usuário")!.idPapel,
      modules,
    };
  } finally {
    await db.$disconnect();
  }
}
async function contextFor(browser: Browser, page: Page, mobile: boolean) {
  return browser.newContext({
    baseURL: "http://127.0.0.1:3001",
    viewport: page.viewportSize(),
    isMobile: mobile,
    hasTouch: mobile,
  });
}
async function journey(page: Page, project: string, createStudentInUI = false) {
  const f = fixture(),
    r = await rootAccount(),
    tag = project + "-" + randomUUID().slice(0, 6),
    name = f.prefix + "-jornada-" + tag;
  await login(page, r.email, f.senha);
  const groupData = {
      nome: name,
      descricao: "Jornada integrada",
      ativo: true,
      moduloIds: r.modules.map((m) => m.idModulo),
      confirmacaoSenha: f.senha,
    },
    group = await post(page, "core", "grupos", groupData),
    email = randomUUID() + "@example.test",
    accountName = "Conta Jornada " + tag;
  const account = await post(page, "core", "usuarios", {
      nome: accountName,
      email,
      senha: f.senha,
      grupoId: group.id,
      papelId: r.userRole,
      ativo: true,
      confirmacaoSenha: f.senha,
    }),
    peerEmail = randomUUID() + "@example.test";
  await post(page, "core", "usuarios", {
    nome: "Colega da Jornada " + tag,
    email: peerEmail,
    senha: f.senha,
    grupoId: group.id,
    papelId: r.userRole,
    ativo: true,
    confirmacaoSenha: f.senha,
  });
  const turma = await post(page, "alunos", "turmas", {
      nome: name,
      ano: 2026,
      periodo: "Manhã",
      capacidade: 10,
      ativo: true,
    }),
    matricula = "INT-" + randomUUID().slice(0, 8),
    studentData = {
      nome: "Aluno da Jornada Integrada " + tag,
      matricula,
      dataMatricula: today(),
      turmaId: turma.id,
      status: "MATRICULADO",
      ativo: true,
      usuarioId: account.id,
      confirmacaoSenha: f.senha,
    };
  let alunoId: number;
  if (createStudentInUI) {
    await page.goto("/alunos");
    await page.getByRole("button", { name: "Novo aluno", exact: true }).click();
    await page.getByLabel("Nome", { exact: true }).fill(studentData.nome);
    await page
      .getByLabel("Matrícula acadêmica", { exact: true })
      .fill(matricula);
    await page.getByLabel("Data de matrícula", { exact: true }).fill(today());
    await page
      .getByRole("combobox", { name: "Turma", exact: true })
      .selectOption({ label: name + " · 10 vaga(s)" });
    await page
      .getByRole("combobox", {
        name: "Conta de acesso (opcional)",
        exact: true,
      })
      .selectOption(String(account.id));
    await page
      .getByLabel("Sua senha (somente ao alterar vínculo de conta)", {
        exact: true,
      })
      .fill(f.senha);
    await page
      .getByRole("button", { name: "Salvar cadastro", exact: true })
      .click();
    await expect(
      page.getByText("Cadastro salvo com sucesso.", { exact: true }),
    ).toBeVisible();
    await page
      .getByLabel("Pesquisar cadastros", { exact: true })
      .fill(matricula);
    await page
      .getByRole("row")
      .filter({ hasText: matricula })
      .getByRole("link", { name: "Abrir ficha", exact: true })
      .click();
    await expect(page).toHaveURL(/\/alunos\/\d+$/);
    alunoId = Number(new URL(page.url()).pathname.split("/").pop());
  } else alunoId = (await post(page, "alunos", "alunos", studentData)).id;
  const course = await post(page, "cursos", "cursos", {
      nome: name,
      descricao: "Curso da jornada",
      cargaHoraria: 2,
      ativo: true,
    }),
    professor = await post(page, "cursos", "professores", {
      nome: f.prefix + "-docente-" + tag,
      email: randomUUID() + "@example.test",
      ativo: true,
    });
  await post(page, "cursos", "aulas", {
    titulo: "Aula integrada de banco de dados",
    descricao: "Programação da jornada",
    dataHora: future(),
    duracao: 60,
    cursoId: course.id,
    professorId: professor.id,
    ativo: true,
  });
  const enrollment = await post(page, "cursos", "matriculas", {
      alunoId,
      cursoId: course.id,
      dataMatricula: today(),
      status: "ATIVA",
      ativo: true,
    }),
    exam = await post(page, "avaliacoes", "avaliacoes", {
      titulo: name,
      descricao: "Avaliação da jornada",
      tipo: "Prova",
      dataAplicacao: "2026-01-01T08:00",
      tempoLimite: 60,
      ativo: true,
    });
  await post(page, "avaliacoes", "questoes", {
    avaliacaoId: exam.id,
    enunciado: "Qual chave preserva referências?",
    tipo: "OBJETIVA",
    pontuacao: 2,
    alternativaA: "Estrangeira",
    alternativaB: "Cor",
    alternativaC: "Fonte",
    alternativaD: "Margem",
    alternativaCorreta: "A",
    ativo: true,
  });
  await post(page, "avaliacoes", "questoes", {
    avaliacaoId: exam.id,
    enunciado: "Explique a integridade referencial.",
    tipo: "DISCURSIVA",
    pontuacao: 3,
    ativo: true,
  });
  const category = await post(page, "biblioteca", "categorias", {
      nome: name,
      ativo: true,
    }),
    book = await post(page, "biblioteca", "livros", {
      titulo: name,
      autor: "Autora integrada",
      categoriaId: category.id,
      ativo: true,
    }),
    code = "J-" + randomUUID().slice(0, 8),
    copy = await post(page, "biblioteca", "exemplares", {
      codigo: code,
      livroId: book.id,
      situacao: "DISPONIVEL",
      ativo: true,
    }),
    reserve = await post(page, "biblioteca", "reservas", {
      alunoId,
      livroId: book.id,
      dataExpiracao: future(),
    }),
    loan = await post(page, "biblioteca", "emprestimos", {
      alunoId,
      exemplarId: copy.id,
      dataPrevistaDevolucao: future(),
    }),
    plan = await post(page, "financeiro", "planos", {
      nome: name,
      valor: "100.50",
      periodicidade: "Mensal",
      ativo: true,
    }),
    discount = await post(page, "financeiro", "descontos", {
      alunoId,
      descricao: "Bolsa da jornada",
      tipo: "PERCENTUAL",
      percentual: "10.00",
      dataInicio: today(),
      dataFim: future().slice(0, 10),
      ativo: true,
    }),
    charge = await post(page, "financeiro", "cobrancas", {
      alunoId,
      planoId: plan.id,
      descontoId: discount.id,
      dataVencimento: future().slice(0, 10),
    });
  return {
    f,
    r,
    name,
    group,
    groupData,
    email,
    peerEmail,
    alunoId,
    matricula,
    studentData,
    account,
    course,
    enrollment,
    exam,
    book,
    copy,
    code,
    reserve,
    loan,
    charge,
    plan,
  };
}
const stat = (page: Page, label: string) =>
  page.locator(".stat").filter({ has: page.getByText(label, { exact: true }) });

export { journey, contextFor, login, post, stat, headers, rootAccount };
