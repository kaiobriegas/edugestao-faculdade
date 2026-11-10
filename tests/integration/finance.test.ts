import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { createDatabaseClient } from "@/lib/database-client";
import { bootstrapRoot, actorForUser } from "@/modules/core/services/auth";
import { hashPassword } from "@/modules/core/services/security";
import { localLessonTime } from "@/lib/academic-time";
import { createFinanceService } from "@/modules/financeiro/services/finance";
import {
  financeList,
  financeOptions,
  chargeDetail,
} from "@/modules/financeiro/repositories/queries";
import { financialReport } from "@/modules/financeiro/repositories/report";
import { financeClock } from "@/modules/financeiro/services/money";
import { seedCatalog } from "../../prisma/seed-catalog";
const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith("_test"))
  throw new Error("Banco _test obrigatório.");
const db = createDatabaseClient(url),
  service = createFinanceService(db),
  prefix = "f-" + randomUUID().slice(0, 8),
  password = randomUUID(),
  groups: number[] = [];
let rootId: number,
  adminId: number,
  userId: number,
  peerId: number,
  deniedId: number,
  turmaId: number,
  own: number,
  peer: number,
  moduleId: number,
  today: string;
const date = (offset = 0) =>
  new Date(new Date(today + "T12:00:00Z").valueOf() + offset * 86400000)
    .toISOString()
    .slice(0, 10);
const save = (resource: string, input: unknown, id = rootId) =>
  service.save(resource, id, input);
const actor = (id: number) => actorForUser(db, id);
beforeAll(async () => {
  await seedCatalog(db);
  const root = await bootstrapRoot(db, {
    nome: "Root Financeiro",
    email: prefix + "root@example.test",
    senha: password,
    grupo: prefix + "root",
  });
  rootId = root.id;
  groups.push(
    (await db.usuario.findUniqueOrThrow({ where: { idUsuario: rootId } }))
      .grupoId,
  );
  for (const suffix of ["allowed", "denied"])
    groups.push(
      (await db.grupo.create({ data: { nome: prefix + suffix } })).idGrupo,
    );
  moduleId = (
    await db.modulo.findUniqueOrThrow({ where: { codigo: "financeiro" } })
  ).idModulo;
  await db.grupoModulo.create({
    data: { grupoId: groups[1], moduloId: moduleId },
  });
  const senhaHash = await hashPassword(password);
  for (const [name, role, gid] of [
    ["admin", "Administrador", groups[1]],
    ["user", "Usuário", groups[1]],
    ["peer", "Usuário", groups[1]],
    ["denied", "Administrador", groups[2]],
  ] as const) {
    const r = await db.papel.findUniqueOrThrow({ where: { nome: role } }),
      u = await db.usuario.create({
        data: {
          nome: name,
          email: prefix + name + "@example.test",
          senhaHash,
          papelId: r.idPapel,
          grupoId: gid,
        },
      });
    if (name === "admin") adminId = u.idUsuario;
    if (name === "user") userId = u.idUsuario;
    if (name === "peer") peerId = u.idUsuario;
    if (name === "denied") deniedId = u.idUsuario;
  }
  turmaId = (
    await db.turma.create({
      data: { nome: prefix, ano: 2026, periodo: "Manhã", capacidade: 100 },
    })
  ).idTurma;
  for (const [name, uid] of [
    ["own", userId],
    ["peer", peerId],
  ] as const) {
    const a = await db.aluno.create({
      data: {
        nome: prefix + name,
        matricula: prefix + name,
        dataMatricula: new Date(),
        turmaId,
        usuarioId: uid,
      },
    });
    if (name === "own") own = a.idAluno;
    else peer = a.idAluno;
  }
  today = (await financeClock(db)).today;
});
afterAll(async () => {
  const plans = await db.planoFinanceiro.findMany({
      where: { nome: { startsWith: prefix } },
      select: { idPlano: true },
    }),
    ids = plans.map((p) => p.idPlano);
  await db.pagamento.deleteMany({
    where: { cobranca: { planoId: { in: ids } } },
  });
  await db.cobranca.deleteMany({ where: { planoId: { in: ids } } });
  await db.desconto.deleteMany({ where: { aluno: { turmaId } } });
  await db.planoFinanceiro.deleteMany({ where: { idPlano: { in: ids } } });
  await db.aluno.deleteMany({ where: { turmaId } });
  await db.turma.deleteMany({ where: { idTurma: turmaId } });
  const users = await db.usuario.findMany({
      where: { grupoId: { in: groups } },
      select: { idUsuario: true },
    }),
    uids = users.map((u) => u.idUsuario);
  await db.eventoAdministrativo.deleteMany({
    where: { atorUsuarioId: { in: uids } },
  });
  await db.sessao.deleteMany({ where: { usuarioId: { in: uids } } });
  await db.tokenRedefinicaoSenha.deleteMany({
    where: { usuarioId: { in: uids } },
  });
  await db.usuario.deleteMany({ where: { idUsuario: { in: uids } } });
  await db.grupoModulo.deleteMany({ where: { grupoId: { in: groups } } });
  await db.grupo.deleteMany({ where: { idGrupo: { in: groups } } });
  await db.$disconnect();
});
async function plan(valor = "100.00") {
  return save(
    "planos",
    {
      nome: prefix + randomUUID(),
      descricao: "Plano de teste",
      valor,
      periodicidade: "Mensal",
      ativo: true,
    },
    adminId,
  );
}
async function discount(extra: Record<string, unknown> = {}) {
  return save("descontos", {
    alunoId: own,
    descricao: prefix + "bolsa",
    tipo: "PERCENTUAL",
    percentual: "10.00",
    dataInicio: date(),
    dataFim: date(),
    ativo: true,
    ...extra,
  });
}
const charge = (planoId: number, extra: Record<string, unknown> = {}) =>
  save("cobrancas", {
    alunoId: own,
    planoId,
    dataVencimento: date(7),
    ...extra,
  });
const paymentInput = (cobrancaId: number, valor = "10.00") => ({
  cobrancaId,
  valor,
  dataPagamento: localLessonTime(new Date()),
  formaPagamento: "PIX",
  comprovante: "Referência interna",
  chaveIdempotencia: randomUUID(),
});
const pay = (cobrancaId: number, valor = "10.00") =>
  save("pagamentos", paymentInput(cobrancaId, valor));
async function detail(id: number, uid = userId) {
  return chargeDetail(db, await actor(uid), id);
}
async function list(
  resource: string,
  uid = userId,
  q: Record<string, string> = {},
) {
  return financeList(db, await actor(uid), resource, new URLSearchParams(q));
}
describe("financeiro em PostgreSQL real", () => {
  it("exige módulo e gestor em toda mutação e protege relatórios e opções", async () => {
    for (const r of [
      "planos",
      "descontos",
      "cobrancas",
      "pagamentos",
      "estornar",
      "cancelar",
    ]) {
      await expect(save(r, {}, userId)).rejects.toMatchObject({ status: 403 });
      await expect(save(r, {}, deniedId)).rejects.toMatchObject({
        status: 403,
      });
    }
    await expect(financeOptions(db, await actor(userId))).rejects.toMatchObject(
      { status: 403 },
    );
    await expect(
      financialReport(db, await actor(userId), new URLSearchParams()),
    ).rejects.toMatchObject({ status: 403 });
    await expect(list("planos")).rejects.toMatchObject({ status: 403 });
  });
  it("emite do plano sem desconto usando o mesmo Aluno e sem valores do cliente", async () => {
    const p = await plan("123.45"),
      count = await db.aluno.count(),
      c = await charge(p.id),
      dto = await detail(c.id);
    expect(dto.alunoId).toBe(own);
    expect(dto.valorOriginal).toBe("123.45");
    expect(dto.valorFinal).toBe("123.45");
    expect(dto.descontoTipoAplicado).toBeNull();
    expect(dto.status).toBe("PENDENTE");
    expect(await db.aluno.count()).toBe(count);
    await expect(charge(p.id, { valorFinal: "0.00" })).rejects.toThrow();
  });
  it("aplica desconto percentual com arredondamento comercial e validade inclusiva", async () => {
    const p = await plan("0.05"),
      d = await discount(),
      c = await charge(p.id, { descontoId: d.id });
    const dto = await detail(c.id);
    expect(dto.valorFinal).toBe("0.05");
    expect(dto.descontoPercentualAplicado).toBe("10.00");
    expect(dto.dataEmissao).toBe(today);
  });
  it("aceita benefício fixo e quita automaticamente valores finais zero", async () => {
    const p = await plan("10.00"),
      d = await discount({ tipo: "FIXO", percentual: null, valor: "15.00" }),
      c = await charge(p.id, { descontoId: d.id });
    expect(await detail(c.id)).toMatchObject({
      valorFinal: "0.00",
      status: "PAGA",
      saldo: "0.00",
    });
    await expect(pay(c.id, "0.01")).rejects.toMatchObject({ status: 409 });
    const zero = await plan("0.00"),
      z = await charge(zero.id);
    expect((await detail(z.id)).status).toBe("PAGA");
    const hundred = await discount({ percentual: "100.00" }),
      all = await charge(p.id, { descontoId: hundred.id });
    expect((await detail(all.id)).valorFinal).toBe("0.00");
  });
  it("bloqueia desconto vencido futuro inativo e de outro aluno sem emitir dívida", async () => {
    const p = await plan();
    for (const extra of [
      { dataInicio: date(-2), dataFim: date(-1) },
      { dataInicio: date(1), dataFim: date(2) },
      { ativo: false },
      { alunoId: peer },
    ]) {
      const d = await discount(extra);
      await expect(charge(p.id, { descontoId: d.id })).rejects.toMatchObject({
        status: 409,
      });
    }
    expect(await db.cobranca.count({ where: { planoId: p.id } })).toBe(0);
  });
  it("alterações em plano e desconto não recalculam cobranças emitidas", async () => {
    const p = await plan(),
      d = await discount({ percentual: "20.00" }),
      c = await charge(p.id, { descontoId: d.id });
    await save("planos", {
      id: p.id,
      nome: prefix + "alterado",
      valor: "300.00",
      periodicidade: "Anual",
      ativo: true,
    });
    await save("descontos", {
      id: d.id,
      alunoId: own,
      descricao: prefix + "benefício alterado",
      tipo: "PERCENTUAL",
      percentual: "50.00",
      dataInicio: date(),
      dataFim: date(2),
      ativo: true,
    });
    expect(await detail(c.id)).toMatchObject({
      valorOriginal: "100.00",
      valorFinal: "80.00",
      descontoPercentualAplicado: "20.00",
    });
    const next = await charge(p.id, { descontoId: d.id });
    expect((await detail(next.id)).valorFinal).toBe("150.00");
  });
  it("pagamentos parciais somam centavos exatamente e atualizam status", async () => {
    const p = await plan("0.30"),
      c = await charge(p.id);
    await pay(c.id, "0.10");
    expect(await detail(c.id)).toMatchObject({
      pago: "0.10",
      saldo: "0.20",
      status: "PARCIAL",
    });
    await pay(c.id, "0.20");
    expect(await detail(c.id)).toMatchObject({
      pago: "0.30",
      saldo: "0.00",
      status: "PAGA",
    });
  });
  it("rejeita valor não positivo três casas e excedente ao saldo", async () => {
    const p = await plan("10.00"),
      c = await charge(p.id);
    for (const v of ["0.00", "-1.00", "1.001"])
      await expect(pay(c.id, v)).rejects.toThrow();
    await expect(pay(c.id, "10.01")).rejects.toMatchObject({ status: 409 });
    expect((await detail(c.id)).totalPagamentos).toBe(0);
  });
  it("repetição concorrente com mesma chave cria um pagamento e uma auditoria", async () => {
    const p = await plan(),
      c = await charge(p.id),
      input = paymentInput(c.id, "40.00"),
      [a, b] = await Promise.all([
        save("pagamentos", input),
        save("pagamentos", input),
      ]);
    expect(a.id).toBe(b.id);
    expect((await detail(c.id)).pago).toBe("40.00");
    expect(await db.pagamento.count({ where: { cobrancaId: c.id } })).toBe(1);
    expect(
      await db.eventoAdministrativo.count({
        where: { acao: "PAGAMENTO_REGISTRADO", registroId: String(a.id) },
      }),
    ).toBe(1);
    await expect(
      save("pagamentos", { ...input, valor: "30.00" }),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("pagamentos concorrentes diferentes não excedem o saldo", async () => {
    const p = await plan(),
      c = await charge(p.id),
      results = await Promise.allSettled([
        pay(c.id, "60.00"),
        pay(c.id, "60.00"),
      ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await detail(c.id)).toMatchObject({
      pago: "60.00",
      saldo: "40.00",
      status: "PARCIAL",
    });
  });
  it("estorno mantém o registro e autor, recalcula saldo e é idempotente", async () => {
    const p = await plan(),
      c = await charge(p.id),
      input = paymentInput(c.id, "100.00"),
      payment = await save("pagamentos", input);
    await save(
      "estornar",
      { pagamentoId: payment.id, motivo: "Lançamento em duplicidade" },
      adminId,
    );
    await save(
      "estornar",
      { pagamentoId: payment.id, motivo: "Lançamento em duplicidade" },
      adminId,
    );
    const dto = await detail(c.id);
    expect(dto).toMatchObject({
      pago: "0.00",
      saldo: "100.00",
      status: "PENDENTE",
    });
    expect(dto.pagamentos[0].status).toBe("ESTORNADO");
    expect(dto.pagamentos[0]).not.toHaveProperty("autorEstorno");
    expect(
      (
        await db.pagamento.findUniqueOrThrow({
          where: { idPagamento: payment.id },
        })
      ).estornadoPorId,
    ).toBe(adminId);
    expect(
      await db.eventoAdministrativo.count({
        where: { acao: "PAGAMENTO_ESTORNADO", registroId: String(payment.id) },
      }),
    ).toBe(1);
    await save("pagamentos", input);
    expect((await detail(c.id)).pago).toBe("0.00");
    await pay(c.id, "100.00");
    expect((await detail(c.id)).status).toBe("PAGA");
  });
  it("cancelamento exige estorno do saldo recebido e conserva histórico", async () => {
    const p = await plan(),
      c = await charge(p.id),
      payment = await pay(c.id, "10.00");
    await expect(
      save("cancelar", { cobrancaId: c.id, motivo: "Cadastro incorreto" }),
    ).rejects.toMatchObject({ status: 409 });
    await save("estornar", {
      pagamentoId: payment.id,
      motivo: "Cobrança emitida por engano",
    });
    await save("cancelar", { cobrancaId: c.id, motivo: "Cadastro incorreto" });
    await save("cancelar", { cobrancaId: c.id, motivo: "Cadastro incorreto" });
    expect(await detail(c.id)).toMatchObject({
      status: "CANCELADA",
      saldo: "0.00",
      totalPagamentos: 1,
    });
    await expect(pay(c.id, "1.00")).rejects.toMatchObject({ status: 409 });
    expect(
      await db.eventoAdministrativo.count({
        where: { acao: "COBRANCA_CANCELADA", registroId: String(c.id) },
      }),
    ).toBe(1);
  });
  it("inativos não recebem nova emissão mas dívida antiga pode ser liquidada", async () => {
    const p = await plan(),
      c = await charge(p.id);
    await db.aluno.update({ where: { idAluno: own }, data: { ativo: false } });
    await db.planoFinanceiro.update({
      where: { idPlano: p.id },
      data: { ativo: false },
    });
    try {
      await expect(charge(p.id)).rejects.toMatchObject({ status: 409 });
      await pay(c.id, "100.00");
      expect((await detail(c.id)).status).toBe("PAGA");
    } finally {
      await db.aluno.update({ where: { idAluno: own }, data: { ativo: true } });
    }
  });
  it("datas de pagamento não podem anteceder emissão nem estar no futuro", async () => {
    const p = await plan(),
      c = await charge(p.id);
    for (const d of ["2000-01-01T09:00", "2099-01-01T09:00"])
      await expect(
        save("pagamentos", { ...paymentInput(c.id), dataPagamento: d }),
      ).rejects.toThrow("Data do pagamento");
    await expect(charge(p.id, { dataVencimento: date(-1) })).rejects.toThrow(
      "Vencimento",
    );
    expect((await detail(c.id)).totalPagamentos).toBe(0);
  });
  it("aluno do desconto é imutável e conta comum só consulta seu financeiro", async () => {
    const p = await plan(),
      c = await charge(p.id),
      d = await discount();
    await expect(
      save("descontos", {
        id: d.id,
        alunoId: peer,
        descricao: "Outro aluno",
        tipo: "PERCENTUAL",
        percentual: "10.00",
        dataInicio: date(),
        dataFim: date(),
        ativo: true,
      }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(detail(c.id, peerId)).rejects.toMatchObject({ status: 404 });
    expect(
      (await list("cobrancas", peerId, { planoId: String(p.id) })).total,
    ).toBe(0);
    await expect(
      list("cobrancas", userId, { alunoId: String(peer) }),
    ).rejects.toMatchObject({ status: 403 });
    await pay(c.id);
    expect(
      (await list("pagamentos", peerId, { cobrancaId: String(c.id) })).total,
    ).toBe(0);
    expect(
      (await list("pagamentos", userId, { cobrancaId: String(c.id) })).total,
    ).toBe(1);
    expect(
      JSON.stringify(await financeOptions(db, await actor(adminId))),
    ).not.toContain("senhaHash");
  });
  it("relatório soma cobranças e pagamentos sem canceladas e calcula vencidas", async () => {
    const p = await plan(),
      a = await charge(p.id),
      b = await charge(p.id),
      c = await charge(p.id);
    await db.cobranca.update({
      where: { idCobranca: a.id },
      data: {
        dataEmissao: new Date(date(-2) + "T12:00:00Z"),
        dataVencimento: new Date(date(-1) + "T12:00:00Z"),
      },
    });
    await pay(a.id, "40.00");
    await pay(b.id, "100.00");
    await save("cancelar", { cobrancaId: c.id, motivo: "Cobrança duplicada" });
    const dto = await financialReport(
      db,
      await actor(adminId),
      new URLSearchParams({
        planoId: String(p.id),
        inicio: date(-2),
        fim: date(),
      }),
    );
    expect(dto).toMatchObject({
      cobrado: "200.00",
      recebido: "140.00",
      saldo: "60.00",
      vencido: "60.00",
      quantidade: 2,
      quantidadeVencida: 1,
    });
    const late = await detail(a.id);
    expect(late).toMatchObject({ status: "PARCIAL", situacao: "VENCIDA" });
    expect(
      (
        await list("cobrancas", userId, {
          planoId: String(p.id),
          status: "VENCIDA",
        })
      ).total,
    ).toBe(1);
    const onlyToday = await financialReport(
      db,
      await actor(rootId),
      new URLSearchParams({
        planoId: String(p.id),
        inicio: date(),
        fim: date(),
      }),
    );
    expect(onlyToday.cobrado).toBe("100.00");
    expect(
      (await db.cobranca.findUniqueOrThrow({ where: { idCobranca: a.id } }))
        .status,
    ).toBe("PARCIAL");
  });
  it("consultas são paginadas e não removem escopo quando filtros mudam", async () => {
    const p = await plan();
    for (let i = 0; i < 12; i++) await charge(p.id);
    const a = await list("cobrancas", userId, { planoId: String(p.id) }),
      b = await list("cobrancas", userId, {
        planoId: String(p.id),
        pagina: "2",
      });
    expect(a.items).toHaveLength(10);
    expect(a.total).toBe(12);
    expect(b.items).toHaveLength(2);
    expect(
      (await list("cobrancas", peerId, { planoId: String(p.id), pagina: "2" }))
        .total,
    ).toBe(0);
  });
  it("módulo revogado bloqueia mutação antes de processar os valores", async () => {
    await db.grupoModulo.update({
      where: { grupoId_moduloId: { grupoId: groups[1], moduloId: moduleId } },
      data: { habilitado: false },
    });
    try {
      await expect(save("pagamentos", {}, adminId)).rejects.toMatchObject({
        status: 403,
      });
    } finally {
      await db.grupoModulo.update({
        where: { grupoId_moduloId: { grupoId: groups[1], moduloId: moduleId } },
        data: { habilitado: true },
      });
    }
  });
});
