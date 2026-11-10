import { test, expect } from "@playwright/test";
import { createDatabaseClient } from "../../src/lib/database-client";
import {
  headers,
  journey,
  contextFor,
  login,
  post,
  stat,
} from "./support/platform-fixture";
test("jornada de um Aluno nos cinco módulos, com atualização entre contas e saldo real", async ({
  page,
  browser,
}, info) => {
  const s = await journey(page, info.project.name, true),
    studentContext = await contextFor(
      browser,
      page,
      info.project.name === "mobile",
    ),
    student = await studentContext.newPage();
  try {
    await login(student, s.email, s.f.senha);
    const menu = () =>
      student.getByRole("navigation", { name: "Menu principal" });
    for (const label of [
      "Alunos",
      "Cursos",
      "Avaliações",
      "Biblioteca",
      "Financeiro",
    ])
      await expect(
        menu().getByRole("link", { name: label, exact: true }),
      ).toBeVisible();
    await student.goto(`/cursos/matriculas?cursoId=${s.course.id}`);
    await expect(
      student.getByRole("row").filter({ hasText: s.matricula }),
    ).toBeVisible();
    await student.goto(`/cursos/${s.course.id}`);
    await expect(
      student.getByText("Aula integrada de banco de dados", { exact: true }),
    ).toBeVisible();
    await student.goto(`/avaliacoes/${s.exam.id}`);
    student.once("dialog", (d) => d.accept());
    await student
      .getByRole("button", { name: "Iniciar avaliação", exact: true })
      .click();
    await expect(student).toHaveURL(/\/avaliacoes\/tentativas\/\d+$/);
    const attemptId = Number(new URL(student.url()).pathname.split("/").pop());
    expect(
      JSON.stringify(
        await (
          await student.request.get(`/api/avaliacoes/tentativa?id=${attemptId}`)
        ).json(),
      ),
    ).not.toContain("alternativaCorreta");
    await student
      .getByRole("radio", { name: "A. Estrangeira", exact: true })
      .check();
    await student
      .getByRole("textbox", { name: "Resposta da questão 2", exact: true })
      .fill("A chave estrangeira mantém o vínculo com registros existentes.");
    await student
      .getByRole("button", { name: "Salvar respostas", exact: true })
      .click();
    await expect(
      student.getByText("Respostas salvas com sucesso.", { exact: true }),
    ).toBeVisible();
    student.once("dialog", (d) => d.accept());
    await student
      .getByRole("button", { name: "Finalizar avaliação", exact: true })
      .click();
    await expect(
      student.getByText("Aguardando correção", { exact: true }),
    ).toBeVisible();
    await page.goto(`/avaliacoes/tentativas/${attemptId}`);
    await page.getByLabel("Pontos da questão 2", { exact: true }).fill("2.5");
    await page
      .getByRole("textbox", { name: "Comentário da questão 2", exact: true })
      .fill("Integração e vínculo acadêmico conferidos.");
    await page
      .getByRole("button", { name: "Salvar correção 2", exact: true })
      .click();
    await expect(
      page.getByText("Correção salva com sucesso.", { exact: true }),
    ).toBeVisible();
    await student.reload();
    await expect(student.getByText("4.50 / 5", { exact: true })).toBeVisible();
    await page.goto(`/biblioteca/emprestimos?livroId=${s.book.id}`);
    page.once("dialog", (d) => d.accept());
    await page
      .getByRole("row")
      .filter({ hasText: s.code })
      .getByRole("button", { name: "Devolver", exact: true })
      .click();
    await expect(
      page.getByText("Devolução registrada com sucesso.", { exact: true }),
    ).toBeVisible();
    await post(page, "biblioteca", "situacao-reserva", {
      reservaId: s.reserve.id,
      situacao: "ATENDIDA",
    });
    await page.goto(`/financeiro/cobrancas/${s.charge.id}`);
    for (const [amount, balance] of [
      ["40.20", "R$ 50,25"],
      ["50.25", "R$ 0,00"],
    ]) {
      await page
        .getByRole("button", { name: "Registrar pagamento", exact: true })
        .click();
      await page
        .getByLabel("Valor do pagamento (R$)", { exact: true })
        .fill(amount);
      await page
        .getByRole("button", { name: "Salvar cadastro", exact: true })
        .click();
      await expect(
        page.getByText("Pagamento registrado com sucesso.", { exact: true }),
      ).toBeVisible();
      await expect(
        stat(page, "Saldo a pagar").getByText(balance, { exact: true }),
      ).toBeVisible();
    }
    await student.goto(`/biblioteca/emprestimos?livroId=${s.book.id}`);
    await expect(
      student
        .getByRole("row")
        .filter({ hasText: s.code })
        .getByText("Devolvido", { exact: true }),
    ).toBeVisible();
    await student.goto(`/biblioteca/reservas?livroId=${s.book.id}`);
    await expect(
      student
        .getByRole("row")
        .filter({ hasText: s.matricula })
        .getByText("Atendida", { exact: true }),
    ).toBeVisible();
    await student.goto(`/financeiro/cobrancas/${s.charge.id}`);
    await expect(
      stat(student, "Situação").getByText("Paga", { exact: true }),
    ).toBeVisible();
    await expect(
      stat(student, "Pago confirmado").getByText("R$ 90,45", { exact: true }),
    ).toBeVisible();
    await student.goto(`/alunos/${s.alunoId}`);
    await expect(
      student.getByRole("heading", { name: s.studentData.nome, exact: true }),
    ).toBeVisible();
    await expect(
      student.locator(".history-list").filter({ hasText: "Nota 4.5" }),
    ).toBeVisible();
    const history = await (
      await student.request.get(`/api/alunos/detalhes?id=${s.alunoId}`)
    ).json();
    expect(
      history.historico.matriculas.some(
        (m: { id: number }) => m.id === s.enrollment.id,
      ),
    ).toBe(true);
    expect(
      history.historico.notas.some((n: { valor: string }) => n.valor === "4.5"),
    ).toBe(true);
    await expect
      .poll(() =>
        student.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      )
      .toBe(true);
    await student.screenshot({
      path: `.local/integracao-${info.project.name}.png`,
      fullPage: true,
    });
    const db = createDatabaseClient(process.env.TEST_DATABASE_URL!);
    try {
      const ids = [
        (
          await db.matricula.findUniqueOrThrow({
            where: { idMatricula: s.enrollment.id },
          })
        ).alunoId,
        (await db.nota.findUniqueOrThrow({ where: { tentativaId: attemptId } }))
          .alunoId,
        (
          await db.emprestimo.findUniqueOrThrow({
            where: { idEmprestimo: s.loan.id },
          })
        ).alunoId,
        (
          await db.reserva.findUniqueOrThrow({
            where: { idReserva: s.reserve.id },
          })
        ).alunoId,
        (
          await db.cobranca.findUniqueOrThrow({
            where: { idCobranca: s.charge.id },
          })
        ).alunoId,
      ];
      expect(new Set(ids)).toEqual(new Set([s.alunoId]));
      expect(await db.aluno.count({ where: { matricula: s.matricula } })).toBe(
        1,
      );
    } finally {
      await db.$disconnect();
    }
    const peerContext = await contextFor(
      browser,
      page,
      info.project.name === "mobile",
    );
    try {
      const peer = await peerContext.newPage();
      await login(peer, s.peerEmail, s.f.senha);
      for (const route of [
        `/api/alunos/detalhes?id=${s.alunoId}`,
        `/api/avaliacoes/tentativa?id=${attemptId}`,
        `/api/financeiro/detalhes?id=${s.charge.id}`,
      ])
        expect((await peer.request.get(route)).status()).toBe(404);
      for (const route of [
        `/api/cursos/matriculas?cursoId=${s.course.id}`,
        `/api/biblioteca/emprestimos?livroId=${s.book.id}`,
        `/api/financeiro/pagamentos?cobrancaId=${s.charge.id}`,
      ])
        expect((await (await peer.request.get(route)).json()).total).toBe(0);
    } finally {
      await peerContext.close();
    }
  } finally {
    await studentContext.close();
  }
});
test("sessão aberta respeita revogação por módulo e inativação do grupo em todas as APIs", async ({
  page,
  browser,
}, info) => {
  const s = await journey(page, info.project.name),
    studentContext = await contextFor(
      browser,
      page,
      info.project.name === "mobile",
    );
  try {
    const student = await studentContext.newPage();
    await login(student, s.email, s.f.senha);
    const attempt = await post(student, "avaliacoes", "iniciar", {
      avaliacaoId: s.exam.id,
    });
    const paths: Record<string, string> = {
      alunos: `/api/alunos/detalhes?id=${s.alunoId}`,
      cursos: `/api/cursos/matriculas?cursoId=${s.course.id}`,
      avaliacoes: `/api/avaliacoes/tentativa?id=${attempt.id}`,
      biblioteca: `/api/biblioteca/emprestimos?livroId=${s.book.id}`,
      financeiro: `/api/financeiro/detalhes?id=${s.charge.id}`,
    };
    for (const m of s.r.modules) {
      await post(page, "core", "grupos", {
        ...s.groupData,
        id: s.group.id,
        moduloIds: s.r.modules
          .filter((x) => x.idModulo !== m.idModulo)
          .map((x) => x.idModulo),
      });
      for (const [code, path] of Object.entries(paths))
        expect((await student.request.get(path)).status()).toBe(
          code === m.codigo ? 403 : 200,
        );
      await student.goto("/dashboard");
      await expect(
        student
          .getByRole("navigation", { name: "Menu principal" })
          .getByRole("link", {
            name: m.nome.replace("Gestão de ", ""),
            exact: true,
          }),
      ).toHaveCount(0);
      await post(page, "core", "grupos", { ...s.groupData, id: s.group.id });
    }
    for (const [area, resource] of [
      ["alunos", "alunos"],
      ["cursos", "matriculas"],
      ["avaliacoes", "questoes"],
      ["biblioteca", "emprestimos"],
      ["financeiro", "pagamentos"],
    ]) {
      expect(
        (
          await student.request.post(`/api/${area}/${resource}`, {
            headers,
            data: {},
          })
        ).status(),
      ).toBe(403);
      expect(
        (
          await page.request.post(`/api/${area}/${resource}`, {
            headers: { Origin: "https://indevido.example" },
            data: {},
          })
        ).status(),
      ).toBe(403);
    }
    await post(page, "core", "grupos", {
      ...s.groupData,
      id: s.group.id,
      ativo: false,
    });
    for (const path of Object.values(paths))
      expect((await student.request.get(path)).status()).toBe(401);
    await post(page, "core", "grupos", { ...s.groupData, id: s.group.id });
    expect((await student.request.get(paths.financeiro)).status()).toBe(401);
    await login(student, s.email, s.f.senha);
    for (const path of Object.values(paths))
      expect((await student.request.get(path)).status()).toBe(200);
    const charge = await (await student.request.get(paths.financeiro)).json();
    expect(charge.alunoId).toBe(s.alunoId);
    expect(charge.saldo).toBe("90.45");
  } finally {
    await studentContext.close();
  }
});
