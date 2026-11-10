import { Prisma } from "@/generated/prisma/client";
import type { DatabaseClient } from "@/lib/database-client";
import {
  AppError,
  isManager,
  type Actor,
} from "@/modules/core/contracts/access";
import { readListQuery } from "@/modules/core/schemas/core";
import { financeAccess } from "../services/access";
import { financeClock, paidTotal } from "../services/money";
import {
  filterId,
  chargeInclude,
  chargeFilters,
  chargeRow,
  paymentTotals,
} from "./shared";
export async function financeOptions(db: DatabaseClient, actor: Actor) {
  financeAccess(actor, true);
  const [planos, alunos, descontos, cobrancas] = await Promise.all([
    db.planoFinanceiro.findMany({ take: 1000, orderBy: { nome: "asc" } }),
    db.aluno.findMany({
      take: 1000,
      orderBy: { nome: "asc" },
      select: { idAluno: true, nome: true, matricula: true, ativo: true },
    }),
    db.desconto.findMany({ take: 1000, orderBy: { idDesconto: "desc" } }),
    db.cobranca.findMany({
      take: 1000,
      where: { ativo: true, status: { in: ["PENDENTE", "PARCIAL"] } },
      orderBy: { idCobranca: "desc" },
      include: chargeInclude,
    }),
  ]);
  const totals = await paymentTotals(
    db,
    cobrancas.map((c) => c.idCobranca),
  );
  return {
    planos: planos.map((p) => ({
      id: p.idPlano,
      nome: p.nome,
      valor: p.valor.toFixed(2),
      ativo: p.ativo,
    })),
    alunos: alunos.map((a) => ({
      id: a.idAluno,
      nome: `${a.nome} · ${a.matricula}`,
      ativo: a.ativo,
    })),
    descontos: descontos.map((d) => ({
      id: d.idDesconto,
      nome: d.descricao,
      alunoId: d.alunoId,
      ativo: d.ativo,
      dataInicio: d.dataInicio.toISOString().slice(0, 10),
      dataFim: d.dataFim.toISOString().slice(0, 10),
    })),
    cobrancas: cobrancas.map((c) => ({
      id: c.idCobranca,
      nome: `#${c.idCobranca} · ${c.aluno.nome} · ${c.plano.nome}`,
      saldo: c.valorFinal.minus(totals.get(c.idCobranca) || 0).toFixed(2),
      ativo: true,
    })),
  };
}
export async function financeList(
  db: DatabaseClient,
  actor: Actor,
  resource: string,
  query: URLSearchParams,
) {
  financeAccess(actor, ["planos", "descontos"].includes(resource));
  const manager = isManager(actor),
    { pagina, busca, ativo } = readListQuery(query),
    skip = (pagina - 1) * 10,
    take = 10,
    { today } = await financeClock(db);
  if (resource === "planos") {
    const where = {
      nome: { contains: busca, mode: "insensitive" as const },
      ativo,
    };
    const [rows, total] = await Promise.all([
      db.planoFinanceiro.findMany({
        where,
        skip,
        take,
        orderBy: { idPlano: "desc" },
      }),
      db.planoFinanceiro.count({ where }),
    ]);
    return {
      pagina,
      total,
      items: rows.map((p) => ({
        id: p.idPlano,
        nome: p.nome,
        descricao: p.descricao,
        valor: p.valor.toFixed(2),
        periodicidade: p.periodicidade,
        ativo: p.ativo,
      })),
    };
  }
  if (resource === "descontos") {
    const alunoId = filterId(query, "alunoId");
    const where: Prisma.DescontoWhereInput = {
      ativo,
      alunoId,
      OR: [
        { descricao: { contains: busca, mode: "insensitive" } },
        { aluno: { nome: { contains: busca, mode: "insensitive" } } },
        { aluno: { matricula: { contains: busca, mode: "insensitive" } } },
      ],
    };
    const [rows, total] = await Promise.all([
      db.desconto.findMany({
        where,
        skip,
        take,
        orderBy: { idDesconto: "desc" },
        include: { aluno: { select: { nome: true, matricula: true } } },
      }),
      db.desconto.count({ where }),
    ]);
    return {
      pagina,
      total,
      items: rows.map((d) => ({
        id: d.idDesconto,
        descricao: d.descricao,
        alunoId: d.alunoId,
        aluno: d.aluno.nome,
        matricula: d.aluno.matricula,
        tipo: d.tipo,
        valor: d.valor?.toFixed(2) || null,
        percentual: d.percentual?.toFixed(2) || null,
        dataInicio: d.dataInicio.toISOString().slice(0, 10),
        dataFim: d.dataFim.toISOString().slice(0, 10),
        ativo: d.ativo,
      })),
    };
  }
  if (resource === "cobrancas") {
    const where = chargeFilters(query, actor, today),
      [rows, total] = await Promise.all([
        db.cobranca.findMany({
          where,
          skip,
          take,
          orderBy: { idCobranca: "desc" },
          include: chargeInclude,
        }),
        db.cobranca.count({ where }),
      ]),
      totals = await paymentTotals(
        db,
        rows.map((r) => r.idCobranca),
      );
    return {
      pagina,
      total,
      items: rows.map((r) =>
        chargeRow(r, totals.get(r.idCobranca) || new Prisma.Decimal(0), today),
      ),
    };
  }
  if (resource === "pagamentos") {
    const status = query.get("status") || "";
    if (status && !["CONFIRMADO", "ESTORNADO"].includes(status))
      throw new AppError("Situação inválida.");
    const where: Prisma.PagamentoWhereInput = {
      cobranca: chargeFilters(query, actor, today, false),
      ...(status ? { status: status as "CONFIRMADO" | "ESTORNADO" } : {}),
    };
    const [rows, total] = await Promise.all([
      db.pagamento.findMany({
        where,
        skip,
        take,
        orderBy: { idPagamento: "desc" },
        include: {
          cobranca: { include: chargeInclude },
          autorEstorno: { select: { nome: true } },
        },
      }),
      db.pagamento.count({ where }),
    ]);
    return {
      pagina,
      total,
      items: rows.map((p) => ({
        id: p.idPagamento,
        cobrancaId: p.cobrancaId,
        aluno: p.cobranca.aluno.nome,
        matricula: p.cobranca.aluno.matricula,
        plano: p.cobranca.plano.nome,
        valor: p.valor.toFixed(2),
        dataPagamento: p.dataPagamento.toISOString(),
        formaPagamento: p.formaPagamento,
        comprovante: p.comprovante,
        status: p.status,
        estornadoEm: p.estornadoEm?.toISOString() || null,
        motivoEstorno: p.motivoEstorno,
        ...(manager ? { autorEstorno: p.autorEstorno?.nome || null } : {}),
      })),
    };
  }
  throw new AppError("Recurso não encontrado.", 404);
}
export async function chargeDetail(
  db: DatabaseClient,
  actor: Actor,
  id: number,
) {
  financeAccess(actor);
  const manager = isManager(actor),
    { today } = await financeClock(db);
  const row = await db.cobranca.findFirst({
    where: {
      idCobranca: id,
      ...(manager ? {} : { aluno: { usuarioId: actor.id } }),
    },
    include: chargeInclude,
  });
  if (!row) throw new AppError("Cobrança não encontrada.", 404);
  const [paid, payments, count] = await Promise.all([
    paidTotal(db, id),
    db.pagamento.findMany({
      where: { cobrancaId: id },
      take: 100,
      orderBy: { idPagamento: "desc" },
      include: { autorEstorno: { select: { nome: true } } },
    }),
    db.pagamento.count({ where: { cobrancaId: id } }),
  ]);
  return {
    ...chargeRow(row, paid, today),
    totalPagamentos: count,
    pagamentos: payments.map((p) => ({
      id: p.idPagamento,
      valor: p.valor.toFixed(2),
      dataPagamento: p.dataPagamento.toISOString(),
      formaPagamento: p.formaPagamento,
      comprovante: p.comprovante,
      status: p.status,
      estornadoEm: p.estornadoEm?.toISOString() || null,
      motivoEstorno: p.motivoEstorno,
      ...(manager ? { autorEstorno: p.autorEstorno?.nome || null } : {}),
    })),
  };
}
export type ChargeDetail = Awaited<ReturnType<typeof chargeDetail>>;
