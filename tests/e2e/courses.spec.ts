import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createDatabaseClient } from "../../src/lib/database-client";
import { hashPassword } from "../../src/modules/core/services/security";
type Fixture = {
  prefix: string;
  senha: string;
  rootEmail: string;
  groupId: number;
};
const fixture = (): Fixture =>
  JSON.parse(readFileSync(".local/e2e-credentials.json", "utf8"));
const headers = { Origin: "http://127.0.0.1:3001" };
async function login(page: Page, email: string, senha: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(senha);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}
test("curso professor aula e matrícula real com exceção auditada de curso inativo", async ({
  page,
}, info) => {
  const f = fixture();
  await login(page, f.rootEmail, f.senha);
  const nav = () => page.getByRole("navigation", { name: "Gestão de cursos" });
  await page
    .getByRole("navigation", { name: "Menu principal" })
    .getByRole("link", { name: "Cursos", exact: true })
    .click();
  await page.getByRole("button", { name: "Novo curso" }).click();
  const course = f.prefix + "-curso-" + info.project.name,
    professor = f.prefix + "-docente-" + info.project.name,
    studentName = "Aluno do Curso " + info.project.name,
    academic = "CR-" + randomUUID().slice(0, 8);
  await page.getByLabel("Nome", { exact: true }).fill(course);
  await page.getByLabel("Carga horária (horas)", { exact: true }).fill("2");
  await page.getByRole("button", { name: "Salvar cadastro" }).click();
  await expect(
    page.getByText("Cadastro salvo com sucesso.", { exact: true }),
  ).toBeVisible();
  await nav().getByRole("link", { name: "Professores", exact: true }).click();
  await page.getByRole("button", { name: "Novo professor" }).click();
  await page.getByLabel("Nome", { exact: true }).fill(professor);
  await page
    .getByLabel("E-mail", { exact: true })
    .fill(randomUUID() + "@example.test");
  await page
    .getByLabel("Especialidade", { exact: true })
    .fill("Banco de Dados");
  await page.getByRole("button", { name: "Salvar cadastro" }).click();
  await expect(
    page.getByText("Cadastro salvo com sucesso.", { exact: true }),
  ).toBeVisible();
  await nav().getByRole("link", { name: "Programação", exact: true }).click();
  await page.getByRole("button", { name: "Nova aula" }).click();
  await page
    .getByLabel("Título da aula", { exact: true })
    .fill("Introdução a Bancos de Dados");
  await page
    .getByRole("combobox", { name: "Curso", exact: true })
    .selectOption({ label: course });
  await page
    .getByRole("combobox", { name: "Professor", exact: true })
    .selectOption({ label: professor });
  await page
    .getByLabel("Data e hora da aula (Brasília)", { exact: true })
    .fill("2026-10-29T09:30");
  await page.getByLabel("Duração (minutos)", { exact: true }).fill("90");
  await page.getByRole("button", { name: "Salvar cadastro" }).click();
  await expect(
    page.getByText("Cadastro salvo com sucesso.", { exact: true }),
  ).toBeVisible();
  const cls = await page.request.post("/api/alunos/turmas", {
    headers,
    data: {
      nome: f.prefix + "-curso-turma-" + info.project.name,
      ano: 2026,
      periodo: "Manhã",
      capacidade: 5,
      ativo: true,
    },
  });
  expect(cls.status()).toBe(200);
  const turmaId = (await cls.json()).id;
  const student = await page.request.post("/api/alunos/alunos", {
    headers,
    data: {
      nome: studentName,
      matricula: academic,
      dataMatricula: "2026-10-28",
      turmaId,
      status: "MATRICULADO",
      ativo: true,
    },
  });
  expect(student.status()).toBe(200);
  const studentId = (await student.json()).id;
  await nav().getByRole("link", { name: "Matrículas", exact: true }).click();
  await page.getByRole("button", { name: "Nova matrícula" }).click();
  async function choose() {
    await page
      .getByRole("combobox", { name: "Curso", exact: true })
      .selectOption({ label: course });
    await page
      .getByRole("combobox", { name: "Aluno", exact: true })
      .selectOption({ label: studentName + " · " + academic });
  }
  await choose();
  await page.getByRole("button", { name: "Salvar cadastro" }).click();
  await expect(
    page.getByText("Matrícula salva com sucesso.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Nova matrícula" }).click();
  await choose();
  await page.getByRole("button", { name: "Salvar cadastro" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "já possui matrícula ativa" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Fechar", exact: true }).click();
  const row = () =>
    page
      .getByRole("row")
      .filter({ hasText: studentName })
      .filter({ hasText: course });
  await row()
    .getByRole("button", { name: `Editar ${studentName}` })
    .click();
  await page
    .getByRole("combobox", { name: "Status da matrícula", exact: true })
    .selectOption("CONCLUIDA");
  await page.getByRole("button", { name: "Salvar cadastro" }).click();
  await expect(
    page.getByText("Matrícula salva com sucesso.", { exact: true }),
  ).toBeVisible();
  await expect(row().getByText("CONCLUIDA", { exact: true })).toBeVisible();
  await row().getByRole("link", { name: "Abrir curso" }).click();
  await expect(
    page.getByRole("heading", { name: course, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Introdução a Bancos de Dados", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(studentName, { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `.local/course-detail-${info.project.name}.png`,
    fullPage: true,
  });
  const academicHistory = await (
    await page.request.get(`/api/alunos/detalhes?id=${studentId}`)
  ).json();
  expect(
    academicHistory.historico.matriculas.some(
      (m: { curso: string }) => m.curso === course,
    ),
  ).toBe(true);
  await nav().getByRole("link", { name: "Cursos", exact: true }).click();
  await page.getByLabel("Pesquisar cursos e vínculos").fill(course);
  await page.getByRole("button", { name: `Editar ${course}` }).click();
  await page
    .getByRole("combobox", { name: "Situação do cadastro", exact: true })
    .selectOption("false");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Salvar cadastro" }).click();
  await expect(
    page.getByText("Cadastro salvo com sucesso.", { exact: true }),
  ).toBeVisible();
  await nav().getByRole("link", { name: "Matrículas", exact: true }).click();
  await page.getByRole("button", { name: "Nova matrícula" }).click();
  await page
    .getByRole("combobox", { name: "Curso", exact: true })
    .selectOption({ label: course + " · inativo" });
  await page
    .getByRole("combobox", { name: "Aluno", exact: true })
    .selectOption({ label: studentName + " · " + academic });
  await page.getByRole("button", { name: "Salvar cadastro" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "justificativa" }),
  ).toBeVisible();
  await page
    .getByLabel("Justificativa para curso inativo (root)", { exact: true })
    .fill("Reabertura autorizada para demonstração");
  await page
    .getByLabel("Sua senha (somente para autorizar curso inativo)", {
      exact: true,
    })
    .fill(f.senha);
  await page.getByRole("button", { name: "Salvar cadastro" }).click();
  await expect(
    page.getByText("Matrícula salva com sucesso.", { exact: true }),
  ).toBeVisible();
  const events = await (
    await page.request.get("/api/core/eventos?busca=MATRICULA_EXCEPCIONAL")
  ).json();
  expect(events.total).toBeGreaterThan(0);
});
test("aluno consulta suas matrículas e programação sem receber dados de colegas", async ({
  page,
}, info) => {
  const f = fixture();
  await login(page, f.rootEmail, f.senha);
  const db = createDatabaseClient(process.env.TEST_DATABASE_URL!);
  const email = randomUUID() + "@example.test",
    teacherEmail = randomUUID() + "@example.test";
  try {
    const role = await db.papel.findUniqueOrThrow({
        where: { nome: "Usuário" },
      }),
      user = await db.usuario.create({
        data: {
          nome: "Aluno Leitor de Cursos",
          email,
          senhaHash: await hashPassword(f.senha),
          grupoId: f.groupId,
          papelId: role.idPapel,
        },
      });
    const cls = await page.request.post("/api/alunos/turmas", {
      headers,
      data: {
        nome: f.prefix + "-leitor-turma-" + info.project.name,
        ano: 2026,
        periodo: "Tarde",
        capacidade: 4,
        ativo: true,
      },
    });
    expect(cls.status()).toBe(200);
    const turmaId = (await cls.json()).id;
    async function aluno(nome: string, usuarioId: number | null) {
      const response = await page.request.post("/api/alunos/alunos", {
        headers,
        data: {
          nome,
          matricula: "LE-" + randomUUID().slice(0, 8),
          turmaId,
          dataMatricula: "2026-10-28",
          status: "MATRICULADO",
          ativo: true,
          usuarioId,
          confirmacaoSenha: f.senha,
        },
      });
      expect(response.status()).toBe(200);
      return (await response.json()).id;
    }
    const ownId = await aluno("Aluno Leitor Próprio", user.idUsuario),
      otherId = await aluno("Colega Privado", null);
    const courseName = f.prefix + "-leitura-" + info.project.name;
    const c = await page.request.post("/api/cursos/cursos", {
      headers,
      data: { nome: courseName, cargaHoraria: 1, ativo: true },
    });
    expect(c.status()).toBe(200);
    const cursoId = (await c.json()).id;
    const hidden = await page.request.post("/api/cursos/cursos", {
      headers,
      data: {
        nome: f.prefix + "-oculto-" + info.project.name,
        cargaHoraria: 1,
        ativo: false,
      },
    });
    const hiddenId = (await hidden.json()).id;
    const p = await page.request.post("/api/cursos/professores", {
      headers,
      data: {
        nome: f.prefix + "-prof-leitor-" + info.project.name,
        email: teacherEmail,
        ativo: true,
      },
    });
    const professorId = (await p.json()).id;
    expect(
      (
        await page.request.post("/api/cursos/aulas", {
          headers,
          data: {
            titulo: "Aula pública autorizada",
            cursoId,
            professorId,
            dataHora: "2026-10-29T13:00",
            duracao: 30,
            ativo: true,
          },
        })
      ).status(),
    ).toBe(200);
    for (const alunoId of [ownId, otherId])
      expect(
        (
          await page.request.post("/api/cursos/matriculas", {
            headers,
            data: {
              cursoId,
              alunoId,
              dataMatricula: "2026-10-28",
              status: "ATIVA",
              ativo: true,
            },
          })
        ).status(),
      ).toBe(200);
    await page.getByRole("button", { name: "Sair da conta" }).click();
    await page.waitForURL("**/login", { waitUntil: "load" });
    await login(page, email, f.senha);
    await page
      .getByRole("navigation", { name: "Menu principal" })
      .getByRole("link", { name: "Cursos", exact: true })
      .click();
    await expect(page.getByRole("button", { name: "Novo curso" })).toHaveCount(
      0,
    );
    await page
      .getByRole("navigation", { name: "Gestão de cursos" })
      .getByRole("link", { name: "Minhas matrículas", exact: true })
      .click();
    await expect(
      page.getByText("Aluno Leitor Próprio", { exact: true }),
    ).toBeVisible();
    expect(await page.content()).not.toContain("Colega Privado");
    const detail = await (
      await page.request.get(`/api/cursos/detalhes?id=${cursoId}`)
    ).json();
    expect(detail.matriculas).toHaveLength(1);
    expect(detail.matriculas[0].aluno).toBe("Aluno Leitor Próprio");
    expect(JSON.stringify(detail)).not.toContain(teacherEmail);
    expect(
      (
        await (
          await page.request.get(`/api/cursos/matriculas?alunoId=${otherId}`)
        ).json()
      ).total,
    ).toBe(0);
    expect((await page.request.get("/api/cursos/professores")).status()).toBe(
      403,
    );
    expect(
      (
        await page.request.post("/api/cursos/cursos", { headers, data: {} })
      ).status(),
    ).toBe(403);
    expect(
      (await page.request.get(`/api/cursos/detalhes?id=${hiddenId}`)).status(),
    ).toBe(404);
    await page.getByRole("link", { name: "Abrir curso", exact: true }).click();
    await expect(
      page.getByText("Aula pública autorizada", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Minhas matrículas neste curso" }),
    ).toBeVisible();
    expect(await page.content()).not.toContain("Colega Privado");
  } finally {
    await db.$disconnect();
  }
});
