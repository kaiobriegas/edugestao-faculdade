import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { studentDetail } from "@/modules/alunos/repositories/queries";
import { listCourses } from "@/modules/cursos/repositories/queries";
import { attemptDetail } from "@/modules/avaliacoes/repositories/queries";
import { libraryList } from "@/modules/biblioteca/repositories/queries";
import { chargeDetail } from "@/modules/financeiro/repositories/queries";
import { localLessonTime } from "@/lib/academic-time";
import {
  setup,
  cleanup,
  db,
  prefix,
  password,
  auth,
  core,
  students,
  courses,
  exams,
  library,
  finance,
  rootId,
  adminId,
  groupId,
  turmaId,
  userRole,
  modules,
  today,
  future,
  actor,
  scenario,
  privateLists,
  setGroup,
  finalize,
  user,
} from "../support/integrated-platform";
beforeAll(setup);
afterAll(cleanup);
describe("integração funcional dos cinco módulos", () => {
  it("um único Aluno percorre matrícula, prova, empréstimo e cobrança por serviços reais", async () => {
    const s = await scenario();
    await finalize(s);
    await library.save("situacao-reserva", adminId, {
      reservaId: s.reserve.id,
      situacao: "ATENDIDA",
    });
    await library.save("devolver", adminId, { emprestimoId: s.loan.id });
    await finance.save("pagamentos", adminId, {
      cobrancaId: s.charge.id,
      valor: "50.25",
      dataPagamento: localLessonTime(new Date()),
      formaPagamento: "DINHEIRO",
      chaveIdempotencia: randomUUID(),
    });
    const refs = [
      (
        await db.matricula.findUniqueOrThrow({
          where: { idMatricula: s.enrollment.id },
        })
      ).alunoId,
      (
        await db.tentativaAvaliacao.findUniqueOrThrow({
          where: { idTentativa: s.attempt.id },
        })
      ).alunoId,
      ...(
        await db.resposta.findMany({ where: { tentativaId: s.attempt.id } })
      ).map((r) => r.alunoId),
      (
        await db.nota.findUniqueOrThrow({
          where: { tentativaId: s.attempt.id },
        })
      ).alunoId,
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
      (
        await db.desconto.findUniqueOrThrow({
          where: { idDesconto: s.discount.id },
        })
      ).alunoId,
    ];
    expect(new Set(refs)).toEqual(new Set([s.aluno.id]));
    expect(
      await db.aluno.count({ where: { matricula: s.data.matricula } }),
    ).toBe(1);
    expect(
      await chargeDetail(db, await actor(s.u.id), s.charge.id),
    ).toMatchObject({ status: "PAGA", pago: "90.45", saldo: "0.00" });
    const academic = await studentDetail(db, await actor(s.u.id), s.aluno.id);
    expect(academic.historico.matriculas[0].curso).toBe(s.data.nome);
    expect(academic.historico.notas[0].valor).toBe("4.5");
  });
  it("os seis históricos privados conservam o proprietário mesmo com filtros de outro aluno", async () => {
    const a = await scenario(),
      b = await scenario();
    const own = await privateLists(a, a.u.id),
      other = await privateLists(a, b.u.id);
    for (const x of Object.values(own)) expect(x.total).toBe(1);
    for (const x of Object.values(other)) expect(x.total).toBe(0);
    await expect(
      studentDetail(db, await actor(b.u.id), a.aluno.id),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      attemptDetail(db, await actor(b.u.id), a.attempt.id),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      chargeDetail(db, await actor(b.u.id), a.charge.id),
    ).rejects.toMatchObject({ status: 404 });
    expect(JSON.stringify(own)).not.toContain(b.data.matricula);
  });
  it("retirar cada módulo do grupo afeta a sessão existente sem apagar os registros", async () => {
    const s = await scenario(),
      login = await auth.login({ email: s.u.email, senha: password });
    await finalize(s);
    for (const disabled of modules) {
      await setGroup(
        modules
          .filter((m) => m.idModulo !== disabled.idModulo)
          .map((m) => m.idModulo),
      );
      try {
        const current = await auth.session(login.token);
        expect(current.modulos).toHaveLength(4);
        expect(current.modulos.some((m) => m.codigo === disabled.codigo)).toBe(
          false,
        );
        const calls = {
          alunos: () => studentDetail(db, current, s.aluno.id),
          cursos: () =>
            listCourses(db, current, "matriculas", new URLSearchParams()),
          avaliacoes: () => attemptDetail(db, current, s.attempt.id),
          biblioteca: () =>
            libraryList(db, current, "emprestimos", new URLSearchParams()),
          financeiro: () => chargeDetail(db, current, s.charge.id),
        };
        await expect(
          calls[disabled.codigo as keyof typeof calls](),
        ).rejects.toMatchObject({ status: 403 });
        for (const [code, read] of Object.entries(calls))
          if (code !== disabled.codigo)
            await expect(read()).resolves.toBeDefined();
        if (disabled.codigo !== "alunos") {
          const student = await studentDetail(db, current, s.aluno.id);
          if (disabled.codigo === "cursos")
            expect(student.historico.matriculas).toEqual([]);
          if (disabled.codigo === "avaliacoes")
            expect(student.historico.notas).toEqual([]);
        }
      } finally {
        await setGroup();
      }
    }
    expect(
      (
        await db.cobranca.findUniqueOrThrow({
          where: { idCobranca: s.charge.id },
        })
      ).alunoId,
    ).toBe(s.aluno.id);
    await auth.logout(login.token);
  });
  it("inativar Aluno bloqueia novas operações mas permite encerrar os históricos existentes", async () => {
    const s = await scenario();
    await students.save("alunos", rootId, {
      ...s.data,
      id: s.aluno.id,
      ativo: false,
    });
    await expect(
      courses.save("matriculas", adminId, {
        alunoId: s.aluno.id,
        cursoId: s.course.id,
        dataMatricula: today(),
        status: "ATIVA",
        ativo: true,
      }),
    ).rejects.toThrow();
    await expect(
      exams.save("respostas", s.u.id, {
        tentativaId: s.attempt.id,
        respostas: s.respostas,
      }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      library.save("reservas", adminId, {
        alunoId: s.aluno.id,
        livroId: s.book.id,
        dataExpiracao: future(),
      }),
    ).rejects.toThrow();
    await expect(
      finance.save("cobrancas", adminId, {
        alunoId: s.aluno.id,
        planoId: s.plan.id,
        dataVencimento: future().slice(0, 10),
      }),
    ).rejects.toThrow();
    await courses.save("matriculas", adminId, {
      id: s.enrollment.id,
      alunoId: s.aluno.id,
      cursoId: s.course.id,
      dataMatricula: today(),
      status: "CONCLUIDA",
      ativo: true,
    });
    await library.save("devolver", adminId, { emprestimoId: s.loan.id });
    await finance.save("pagamentos", adminId, {
      cobrancaId: s.charge.id,
      valor: "50.25",
      dataPagamento: localLessonTime(new Date()),
      formaPagamento: "PIX",
      chaveIdempotencia: randomUUID(),
    });
    await db.$executeRaw`UPDATE tentativa_avaliacao SET iniciada_em=clock_timestamp()-interval '2 minutes',prazo_em=clock_timestamp()-interval '1 minute' WHERE id_tentativa=${s.attempt.id}`;
    await exams.save("encerrar-expirada", adminId, {
      tentativaId: s.attempt.id,
    });
    const answer = await db.resposta.findUniqueOrThrow({
      where: {
        tentativaId_questaoId: {
          tentativaId: s.attempt.id,
          questaoId: s.discursive.id,
        },
      },
    });
    await exams.save("corrigir", adminId, {
      respostaId: answer.idResposta,
      pontuacao: 3,
    });
    expect(
      (await studentDetail(db, await actor(s.u.id), s.aluno.id)).aluno.ativo,
    ).toBe(false);
    expect(
      (await chargeDetail(db, await actor(s.u.id), s.charge.id)).status,
    ).toBe("PAGA");
  });
  it("troca de conta autorizada transfere acesso aos históricos sem duplicar Aluno ou tentativas", async () => {
    const s = await scenario(),
      target = await user(),
      oldLogin = await auth.login({ email: s.u.email, senha: password });
    await expect(
      students.save("alunos", rootId, {
        ...s.data,
        id: s.aluno.id,
        usuarioId: target.id,
        confirmacaoSenha: "incorreta",
      }),
    ).rejects.toMatchObject({ status: 403 });
    expect(
      (await db.aluno.findUniqueOrThrow({ where: { idAluno: s.aluno.id } }))
        .usuarioId,
    ).toBe(s.u.id);
    await students.save("alunos", rootId, {
      ...s.data,
      id: s.aluno.id,
      usuarioId: target.id,
    });
    const oldActor = await auth.session(oldLogin.token);
    await expect(studentDetail(db, oldActor, s.aluno.id)).rejects.toMatchObject(
      { status: 404 },
    );
    for (const x of Object.values(await privateLists(s, s.u.id)))
      expect(x.total).toBe(0);
    for (const x of Object.values(await privateLists(s, target.id)))
      expect(x.total).toBe(1);
    expect(
      (await exams.save("iniciar", target.id, { avaliacaoId: s.exam.id })).id,
    ).toBe(s.attempt.id);
    await expect(
      exams.save("iniciar", s.u.id, { avaliacaoId: s.exam.id }),
    ).rejects.toMatchObject({ status: 403 });
    expect(
      await db.aluno.count({ where: { matricula: s.data.matricula } }),
    ).toBe(1);
    expect(
      await db.tentativaAvaliacao.count({ where: { avaliacaoId: s.exam.id } }),
    ).toBe(1);
    await auth.logout(oldLogin.token);
  });
  it("vínculo com conta já usada é recusado sem alterar nenhum histórico", async () => {
    const a = await scenario(),
      b = await scenario();
    await expect(
      students.save("alunos", rootId, {
        ...a.data,
        id: a.aluno.id,
        usuarioId: b.u.id,
      }),
    ).rejects.toMatchObject({ code: "P2002" });
    expect(
      (await db.aluno.findUniqueOrThrow({ where: { idAluno: a.aluno.id } }))
        .usuarioId,
    ).toBe(a.u.id);
    for (const x of Object.values(await privateLists(a, a.u.id)))
      expect(x.total).toBe(1);
  });
  it("falhas de matrícula, prova e pagamento fazem rollback sem corromper os outros módulos", async () => {
    const s = await scenario(),
      before = await db.resposta.findMany({
        where: { tentativaId: s.attempt.id },
        orderBy: { idResposta: "asc" },
      });
    const results = await Promise.allSettled([
      courses.save("matriculas", adminId, {
        alunoId: s.aluno.id,
        cursoId: s.course.id,
        dataMatricula: today(),
        status: "ATIVA",
        ativo: true,
      }),
      exams.save("respostas", s.u.id, {
        tentativaId: s.attempt.id,
        respostas: [
          { questaoId: s.objective.id, alternativaSelecionada: "B" },
          { questaoId: 2147483647, texto: "Inválida" },
        ],
      }),
      finance.save("pagamentos", adminId, {
        cobrancaId: s.charge.id,
        valor: "1000.00",
        dataPagamento: localLessonTime(new Date()),
        formaPagamento: "PIX",
        chaveIdempotencia: randomUUID(),
      }),
    ]);
    expect(results.every((r) => r.status === "rejected")).toBe(true);
    expect(
      await db.resposta.findMany({
        where: { tentativaId: s.attempt.id },
        orderBy: { idResposta: "asc" },
      }),
    ).toEqual(before);
    expect(
      (
        await db.exemplar.findUniqueOrThrow({
          where: { idExemplar: s.copy.id },
        })
      ).situacao,
    ).toBe("EMPRESTADO");
    expect(
      (await chargeDetail(db, await actor(s.u.id), s.charge.id)).saldo,
    ).toBe("50.25");
    expect(await db.matricula.count({ where: { alunoId: s.aluno.id } })).toBe(
      1,
    );
  });
  it("inativar grupo revoga a sessão central e bloqueia os cinco serviços", async () => {
    const s = await scenario(),
      login = await auth.login({ email: s.u.email, senha: password });
    await setGroup(
      modules.map((m) => m.idModulo),
      false,
    );
    try {
      await expect(auth.session(login.token)).rejects.toMatchObject({
        status: 401,
      });
      for (const service of [students, courses, exams, library, finance])
        await expect(
          service.save("invalido", adminId, {}),
        ).rejects.toMatchObject({ status: 401 });
    } finally {
      await setGroup();
    }
    expect(
      (await chargeDetail(db, await actor(s.u.id), s.charge.id)).saldo,
    ).toBe("50.25");
  });
  it("inativar conta revoga todas as sessões sem apagar o cadastro acadêmico", async () => {
    const s = await scenario(),
      a = await auth.login({ email: s.u.email, senha: password }),
      b = await auth.login({ email: s.u.email, senha: password });
    await core.save("usuarios", rootId, {
      id: s.u.id,
      nome: prefix + "conta",
      email: s.u.email,
      grupoId: groupId,
      papelId: userRole,
      ativo: false,
      confirmacaoSenha: password,
    });
    for (const login of [a, b])
      await expect(auth.session(login.token)).rejects.toMatchObject({
        status: 401,
      });
    expect(
      (await db.aluno.findUniqueOrThrow({ where: { idAluno: s.aluno.id } }))
        .ativo,
    ).toBe(true);
    expect(
      (
        await db.matricula.findUniqueOrThrow({
          where: { idMatricula: s.enrollment.id },
        })
      ).status,
    ).toBe("ATIVA");
  });
  it("FKs impedem exclusão do Aluno que possui histórico nos cinco módulos", async () => {
    const s = await scenario();
    await expect(
      db.aluno.delete({ where: { idAluno: s.aluno.id } }),
    ).rejects.toMatchObject({ code: "P2003" });
    for (const x of Object.values(await privateLists(s, s.u.id)))
      expect(x.total).toBe(1);
    const logs = await db.eventoAdministrativo.findMany({
      where: { atorUsuarioId: { in: [rootId, adminId, s.u.id] } },
    });
    expect(JSON.stringify(logs)).not.toContain(password);
    expect(JSON.stringify(await privateLists(s, s.u.id))).not.toContain(
      "senhaHash",
    );
  });
  it("Aluno sem conta recebe registros administrativos e a conta posterior herda a mesma identidade", async () => {
    const s = await scenario(),
      u = await user(),
      tag = randomUUID().slice(0, 8),
      data = {
        nome: prefix + tag,
        matricula: prefix + tag,
        dataMatricula: today(),
        turmaId,
        status: "MATRICULADO",
        ativo: true,
      };
    const aluno = await students.save("alunos", adminId, data);
    await courses.save("matriculas", adminId, {
      alunoId: aluno.id,
      cursoId: s.course.id,
      dataMatricula: today(),
      status: "ATIVA",
      ativo: true,
    });
    await library.save("reservas", adminId, {
      alunoId: aluno.id,
      livroId: s.book.id,
      dataExpiracao: future(),
    });
    const charge = await finance.save("cobrancas", adminId, {
      alunoId: aluno.id,
      planoId: s.plan.id,
      dataVencimento: future().slice(0, 10),
    });
    await expect(
      exams.save("iniciar", u.id, { avaliacaoId: s.exam.id }),
    ).rejects.toMatchObject({ status: 403 });
    expect(
      (await db.aluno.findUniqueOrThrow({ where: { idAluno: aluno.id } }))
        .usuarioId,
    ).toBeNull();
    await students.save("alunos", rootId, {
      ...data,
      id: aluno.id,
      usuarioId: u.id,
      confirmacaoSenha: password,
    });
    expect((await chargeDetail(db, await actor(u.id), charge.id)).alunoId).toBe(
      aluno.id,
    );
    expect(
      (
        await listCourses(
          db,
          await actor(u.id),
          "matriculas",
          new URLSearchParams({ cursoId: String(s.course.id) }),
        )
      ).total,
    ).toBe(1);
    expect(
      (
        await libraryList(
          db,
          await actor(u.id),
          "reservas",
          new URLSearchParams({ livroId: String(s.book.id) }),
        )
      ).total,
    ).toBe(1);
    const attempt = await exams.save("iniciar", u.id, {
      avaliacaoId: s.exam.id,
    });
    expect(
      (
        await db.tentativaAvaliacao.findUniqueOrThrow({
          where: { idTentativa: attempt.id },
        })
      ).alunoId,
    ).toBe(aluno.id);
    expect(await db.aluno.count({ where: { matricula: data.matricula } })).toBe(
      1,
    );
  });
});
