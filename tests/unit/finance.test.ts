import { describe, it, expect } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import {
  moneySchema,
  planSchema,
  discountSchema,
  chargeSchema,
  paymentSchema,
} from "@/modules/financeiro/schemas/finance";
import {
  discountedTotal,
  chargeState,
  brazilDay,
} from "@/modules/financeiro/services/money";
const D = (v: string) => new Prisma.Decimal(v);
describe("regras financeiras", () => {
  it("exige valores decimais em texto sem notação exponencial, negativos ou três casas", () => {
    expect(moneySchema.parse("0.10")).toBe("0.10");
    for (const value of [0.1, "-1", "1e2", "1.001", "1,10", "1000000000000.00"])
      expect(() => moneySchema.parse(value)).toThrow();
    expect(() =>
      planSchema.parse({
        nome: "Plano",
        valor: "10",
        periodicidade: "Mensal",
        ativo: true,
        senha: "extra",
      }),
    ).toThrow();
  });
  it("arredonda percentuais de forma comercial e limita desconto fixo a zero", () => {
    expect(
      discountedTotal(D("0.05"), {
        tipo: "PERCENTUAL",
        percentual: D("10"),
        valor: null,
      }).toFixed(2),
    ).toBe("0.05");
    expect(
      discountedTotal(D("100"), {
        tipo: "PERCENTUAL",
        percentual: D("33.33"),
        valor: null,
      }).toFixed(2),
    ).toBe("66.67");
    expect(
      discountedTotal(D("10"), {
        tipo: "FIXO",
        percentual: null,
        valor: D("12"),
      }).toFixed(2),
    ).toBe("0.00");
    expect(discountedTotal(D("10.10"), null).toFixed(2)).toBe("10.10");
  });
  it("valida tipo exclusivo, percentual, período e datas reais do benefício", () => {
    const value = {
      alunoId: 1,
      descricao: "Bolsa",
      tipo: "PERCENTUAL",
      percentual: "20",
      dataInicio: "2026-10-01",
      dataFim: "2026-10-31",
      ativo: true,
    };
    expect(discountSchema.parse(value).percentual).toBe("20");
    for (const extra of [
      { percentual: "100.01" },
      { valor: "10" },
      { dataFim: "2026-09-01" },
      { dataInicio: "2026-02-30" },
    ])
      expect(() => discountSchema.parse({ ...value, ...extra })).toThrow();
  });
  it("não aceita preço, aluno ou status adulterados no pagamento e na emissão", () => {
    expect(() =>
      chargeSchema.parse({
        alunoId: 1,
        planoId: 2,
        dataVencimento: "2026-11-01",
        valorFinal: "0",
      }),
    ).toThrow();
    expect(() =>
      paymentSchema.parse({
        cobrancaId: 1,
        valor: "1",
        dataPagamento: "2026-10-29T09:00",
        formaPagamento: "PIX",
        chaveIdempotencia: "a",
        status: "CONFIRMADO",
      }),
    ).toThrow();
  });
  it("calcula quitação e parcial sem erro de soma binária", () => {
    const total = D("0.30"),
      paid = D("0.10").plus("0.20");
    expect(chargeState(total, D("0"))).toBe("PENDENTE");
    expect(chargeState(total, D("0.10"))).toBe("PARCIAL");
    expect(chargeState(total, paid)).toBe("PAGA");
    expect(chargeState(D("0"), D("0"))).toBe("PAGA");
  });
  it("vigência usa o dia de Brasília em ambos os lados da meia-noite", () => {
    expect(brazilDay(new Date("2026-10-29T02:59:59Z"))).toBe("2026-10-28");
    expect(brazilDay(new Date("2026-10-29T03:00:00Z"))).toBe("2026-10-29");
  });
});
