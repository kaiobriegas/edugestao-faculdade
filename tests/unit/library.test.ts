import { describe, it, expect } from "vitest";
import {
  categorySchema,
  bookSchema,
  copySchema,
  loanSchema,
  reservationSchema,
  reservationStatusSchema,
} from "@/modules/biblioteca/schemas/library";
import { reservationState } from "@/modules/biblioteca/services/policy";
import { modulePath } from "@/modules/core/contracts/access";
describe("biblioteca", () => {
  it("valida título autor categoria e ano sem aceitar campos extras", () => {
    const v = {
      titulo: "Banco de Dados",
      autor: "Autora",
      categoriaId: 1,
      ativo: true,
      isbn: "  ",
    };
    expect(bookSchema.parse(v).isbn).toBeNull();
    expect(() => bookSchema.parse({ ...v, categoriaId: 0 })).toThrow();
    expect(() => bookSchema.parse({ ...v, anoPublicacao: 0 })).toThrow();
    expect(() => bookSchema.parse({ ...v, senhaHash: "forjada" })).toThrow();
    expect(() => categorySchema.parse({ nome: " ", ativo: true })).toThrow();
  });
  it("valida código, data de aquisição e estados do exemplar", () => {
    const v = {
      codigo: "EX-1",
      livroId: 1,
      situacao: "DISPONIVEL",
      ativo: true,
    };
    expect(copySchema.parse(v).codigo).toBe("EX-1");
    expect(() =>
      copySchema.parse({ ...v, dataAquisicao: "2026-02-30" }),
    ).toThrow();
    expect(() => copySchema.parse({ ...v, situacao: "PERDIDO" })).toThrow();
  });
  it("datas de circulação são válidas e não aceita datas de retirada ou identidade livre", () => {
    const v = {
      alunoId: 1,
      exemplarId: 2,
      dataPrevistaDevolucao: "2026-11-20T09:00",
    };
    expect(loanSchema.parse(v).alunoId).toBe(1);
    expect(() =>
      loanSchema.parse({ ...v, dataEmprestimo: "2020-01-01" }),
    ).toThrow();
    expect(() =>
      loanSchema.parse({ ...v, dataPrevistaDevolucao: "2026-02-30T09:00" }),
    ).toThrow();
    expect(() =>
      reservationSchema.parse({
        alunoId: 1,
        livroId: 2,
        dataExpiracao: "inválida",
      }),
    ).toThrow();
  });
  it("somente permite encerrar reservas e calcula expiração no limite exato", () => {
    expect(() =>
      reservationStatusSchema.parse({ reservaId: 1, situacao: "ATIVA" }),
    ).toThrow();
    const now = new Date("2026-11-01T12:00:00Z");
    expect(
      reservationState({ situacao: "ATIVA", dataExpiracao: now }, now),
    ).toBe("EXPIRADA");
    expect(
      reservationState(
        { situacao: "ATIVA", dataExpiracao: new Date(now.valueOf() + 1) },
        now,
      ),
    ).toBe("ATIVA");
    expect(
      reservationState({ situacao: "ATENDIDA", dataExpiracao: now }, now),
    ).toBe("ATENDIDA");
  });
  it("menu aponta para a biblioteca implementada", () =>
    expect(modulePath("biblioteca")).toBe("/biblioteca"));
});
