import { randomUUID } from "node:crypto";
import { createDatabaseClient } from "@/lib/database-client";
import {
  bootstrapRoot,
  createAuthService,
  actorForUser,
} from "@/modules/core/services/auth";
import { createAdministration } from "@/modules/core/services/administration";
import { rateKey } from "@/modules/core/services/security";
import { createStudentService } from "@/modules/alunos/services/students";
import { createCourseService } from "@/modules/cursos/services/courses";
import { listCourses } from "@/modules/cursos/repositories/queries";
import { createAssessmentService } from "@/modules/avaliacoes/services/assessments";
import { assessmentList } from "@/modules/avaliacoes/repositories/queries";
import { createLibraryService } from "@/modules/biblioteca/services/library";
import { libraryList } from "@/modules/biblioteca/repositories/queries";
import { createFinanceService } from "@/modules/financeiro/services/finance";
import { financeList } from "@/modules/financeiro/repositories/queries";
import { localLessonTime } from "@/lib/academic-time";
import { seedCatalog } from "../../prisma/seed-catalog";
const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith("_test"))
  throw new Error("Banco _test obrigatório.");
const db = createDatabaseClient(url),
  prefix = "integrado-" + randomUUID().slice(0, 8),
  password = randomUUID() + "!",
  secret = randomUUID(),
  auth = createAuthService(db, secret),
  administration = createAdministration(db),
  students = createStudentService(db),
  courses = createCourseService(db),
  exams = createAssessmentService(db),
  library = createLibraryService(db),
  finance = createFinanceService(db);
let rootId: number,
  rootGroup: number,
  adminId: number,
  groupId: number,
  turmaId: number,
  userRole: number;
let modules: { idModulo: number; codigo: string }[] = [];

const today = () => localLessonTime(new Date()).slice(0, 10),
  future = () => localLessonTime(new Date(Date.now() + 7 * 86400000));
const actor = (id: number) => actorForUser(db, id);
const core = {
  async save(resource: string, id: number, input: unknown) {
    const result = await administration.save(resource, id, input);
    if (typeof result.id !== "number")
      throw new Error("Operação da fixture não retornou ID.");
    return { id: result.id };
  },
};

export async function setup() {
  await seedCatalog(db);
  const root = await bootstrapRoot(db, {
    nome: "Root integrado",
    email: prefix + "root@example.test",
    senha: password,
    grupo: prefix + "root",
  });
  rootId = root.id;
  rootGroup = (
    await db.usuario.findUniqueOrThrow({ where: { idUsuario: rootId } })
  ).grupoId;
  modules = await db.modulo.findMany({
    select: { idModulo: true, codigo: true },
  });
  const roles = await db.papel.findMany();
  userRole = roles.find((r) => r.nome === "Usuário")!.idPapel;
  groupId = (
    await core.save("grupos", rootId, {
      nome: prefix + "grupo",
      descricao: "Integração dos cinco módulos",
      ativo: true,
      moduloIds: modules.map((m) => m.idModulo),
      confirmacaoSenha: password,
    })
  ).id;
  adminId = (
    await core.save("usuarios", rootId, {
      nome: "Administrador integrado",
      email: prefix + "admin@example.test",
      senha: password,
      grupoId: groupId,
      papelId: roles.find((r) => r.nome === "Administrador")!.idPapel,
      ativo: true,
      confirmacaoSenha: password,
    })
  ).id;
  turmaId = (
    await students.save("turmas", adminId, {
      nome: prefix + "turma",
      ano: 2026,
      periodo: "Manhã",
      capacidade: 100,
      ativo: true,
    })
  ).id;
}
export async function cleanup() {
  const a = await db.aluno.findMany({
      where: { turmaId },
      select: { idAluno: true },
    }),
    ids = a.map((r) => r.idAluno);
  const cs = await db.curso.findMany({
      where: { nome: { startsWith: prefix } },
      select: { idCurso: true },
    }),
    cids = cs.map((c) => c.idCurso);
  await db.matricula.deleteMany({ where: { cursoId: { in: cids } } });
  await db.aula.deleteMany({ where: { cursoId: { in: cids } } });
  await db.curso.deleteMany({ where: { idCurso: { in: cids } } });
  await db.professor.deleteMany({ where: { nome: { startsWith: prefix } } });
  const es = await db.avaliacao.findMany({
      where: { titulo: { startsWith: prefix } },
      select: { idAvaliacao: true },
    }),
    eids = es.map((e) => e.idAvaliacao);
  await db.nota.deleteMany({ where: { avaliacaoId: { in: eids } } });
  await db.resposta.deleteMany({ where: { avaliacaoId: { in: eids } } });
  await db.tentativaAvaliacao.deleteMany({
    where: { avaliacaoId: { in: eids } },
  });
  await db.questao.deleteMany({ where: { avaliacaoId: { in: eids } } });
  await db.avaliacao.deleteMany({ where: { idAvaliacao: { in: eids } } });
  const books = await db.livro.findMany({
      where: { titulo: { startsWith: prefix } },
      select: { idLivro: true },
    }),
    bids = books.map((b) => b.idLivro);
  await db.emprestimo.deleteMany({
    where: { exemplar: { livroId: { in: bids } } },
  });
  await db.reserva.deleteMany({ where: { livroId: { in: bids } } });
  await db.exemplar.deleteMany({ where: { livroId: { in: bids } } });
  await db.livro.deleteMany({ where: { idLivro: { in: bids } } });
  await db.categoria.deleteMany({ where: { nome: { startsWith: prefix } } });
  await db.pagamento.deleteMany({
    where: { cobranca: { alunoId: { in: ids } } },
  });
  await db.cobranca.deleteMany({ where: { alunoId: { in: ids } } });
  await db.desconto.deleteMany({ where: { alunoId: { in: ids } } });
  await db.planoFinanceiro.deleteMany({
    where: { nome: { startsWith: prefix } },
  });
  await db.aluno.deleteMany({ where: { idAluno: { in: ids } } });
  await db.turma.deleteMany({ where: { idTurma: turmaId } });
  const gids = [rootGroup, groupId],
    us = await db.usuario.findMany({
      where: { grupoId: { in: gids } },
      select: { idUsuario: true, email: true },
    }),
    uids = us.map((u) => u.idUsuario);
  await db.eventoAdministrativo.deleteMany({
    where: { atorUsuarioId: { in: uids } },
  });
  await db.sessao.deleteMany({ where: { usuarioId: { in: uids } } });
  await db.tokenRedefinicaoSenha.deleteMany({
    where: { usuarioId: { in: uids } },
  });
  await db.usuario.deleteMany({ where: { idUsuario: { in: uids } } });
  await db.grupoModulo.deleteMany({ where: { grupoId: { in: gids } } });
  await db.grupo.deleteMany({ where: { idGrupo: { in: gids } } });
  await db.limiteAutenticacao.deleteMany({
    where: {
      chaveHash: {
        in: us.flatMap((u) => [
          rateKey(secret, "login:" + u.email),
          rateKey(secret, "recovery:" + u.email),
        ]),
      },
    },
  });
  await db.$disconnect();
}
async function user() {
  const email = prefix + randomUUID() + "@example.test";

  return {
    email,
    id: (
      await core.save("usuarios", rootId, {
        nome: prefix + "conta",
        email,
        senha: password,
        grupoId: groupId,
        papelId: userRole,
        ativo: true,
        confirmacaoSenha: password,
      })
    ).id,
  };
}
async function scenario() {
  const u = await user(),
    tag = randomUUID().slice(0, 8);
  const data = {
    nome: prefix + tag,
    matricula: prefix + tag,
    dataMatricula: today(),
    turmaId,
    status: "MATRICULADO",
    ativo: true,
    usuarioId: u.id,
    confirmacaoSenha: password,
  };
  const aluno = await students.save("alunos", rootId, data),
    course = await courses.save("cursos", adminId, {
      nome: prefix + tag,
      descricao: "Curso integrado",
      cargaHoraria: 4,
      ativo: true,
    }),
    exam = await exams.save("avaliacoes", adminId, {
      titulo: prefix + tag,
      descricao: "Prova integrada",
      tipo: "Prova",
      dataAplicacao: "2026-01-01T08:00",
      tempoLimite: 60,
      ativo: true,
    });
  const objective = await exams.save("questoes", adminId, {
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
    }),
    discursive = await exams.save("questoes", adminId, {
      avaliacaoId: exam.id,
      enunciado: "Explique a integridade referencial.",
      tipo: "DISCURSIVA",
      pontuacao: 3,
      ativo: true,
    });
  const category = await library.save("categorias", adminId, {
      nome: prefix + tag,
      ativo: true,
    }),
    book = await library.save("livros", adminId, {
      titulo: prefix + tag,
      autor: "Autora integrada",
      categoriaId: category.id,
      ativo: true,
    }),
    copy = await library.save("exemplares", adminId, {
      livroId: book.id,
      codigo: prefix + tag,
      situacao: "DISPONIVEL",
      ativo: true,
    }),
    reserve = await library.save("reservas", adminId, {
      alunoId: aluno.id,
      livroId: book.id,
      dataExpiracao: future(),
    });
  const plan = await finance.save("planos", adminId, {
      nome: prefix + tag,
      valor: "100.50",
      periodicidade: "Mensal",
      ativo: true,
    }),
    discount = await finance.save("descontos", adminId, {
      alunoId: aluno.id,
      descricao: prefix + "bolsa",
      tipo: "PERCENTUAL",
      percentual: "10.00",
      dataInicio: today(),
      dataFim: future().slice(0, 10),
      ativo: true,
    });
  const [enrollment, attempt, loan, charge] = await Promise.all([
    courses.save("matriculas", adminId, {
      alunoId: aluno.id,
      cursoId: course.id,
      dataMatricula: today(),
      status: "ATIVA",
      ativo: true,
    }),
    exams.save("iniciar", u.id, { avaliacaoId: exam.id }),
    library.save("emprestimos", adminId, {
      alunoId: aluno.id,
      exemplarId: copy.id,
      dataPrevistaDevolucao: future(),
    }),
    finance.save("cobrancas", adminId, {
      alunoId: aluno.id,
      planoId: plan.id,
      descontoId: discount.id,
      dataVencimento: future().slice(0, 10),
    }),
  ]);
  const respostas = [
    { questaoId: objective.id, alternativaSelecionada: "A" },
    {
      questaoId: discursive.id,
      texto: "O vínculo aponta para um registro existente.",
    },
  ];
  await exams.save("respostas", u.id, { tentativaId: attempt.id, respostas });
  const payment = await finance.save("pagamentos", adminId, {
    cobrancaId: charge.id,
    valor: "40.20",
    dataPagamento: localLessonTime(new Date()),
    formaPagamento: "PIX",
    chaveIdempotencia: randomUUID(),
  });
  return {
    u,
    aluno,
    data,
    course,
    exam,
    objective,
    discursive,
    book,
    copy,
    reserve,
    enrollment,
    attempt,
    loan,
    charge,
    plan,
    discount,
    payment,
    respostas,
  };
}
type Scenario = Awaited<ReturnType<typeof scenario>>;
async function privateLists(s: Scenario, id: number) {
  const a = await actor(id);
  return {
    courses: await listCourses(
      db,
      a,
      "matriculas",
      new URLSearchParams({ cursoId: String(s.course.id) }),
    ),
    exams: await assessmentList(
      db,
      a,
      "resultados",
      new URLSearchParams({ avaliacaoId: String(s.exam.id) }),
    ),
    loans: await libraryList(
      db,
      a,
      "emprestimos",
      new URLSearchParams({ livroId: String(s.book.id) }),
    ),
    reservations: await libraryList(
      db,
      a,
      "reservas",
      new URLSearchParams({ livroId: String(s.book.id) }),
    ),
    charges: await financeList(
      db,
      a,
      "cobrancas",
      new URLSearchParams({ planoId: String(s.plan.id) }),
    ),
    payments: await financeList(
      db,
      a,
      "pagamentos",
      new URLSearchParams({ cobrancaId: String(s.charge.id) }),
    ),
  };
}
async function setGroup(
  allowed = modules.map((m) => m.idModulo),
  ativo = true,
) {
  await core.save("grupos", rootId, {
    id: groupId,
    nome: prefix + "grupo",
    descricao: "Integração dos cinco módulos",
    ativo,
    moduloIds: allowed,
    confirmacaoSenha: password,
  });
}
async function finalize(s: Scenario) {
  await exams.save("finalizar", s.u.id, {
    tentativaId: s.attempt.id,
    respostas: s.respostas,
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
    pontuacao: 2.5,
    comentario: "Integração validada.",
  });
}

export {
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
};
