import { describe, it, expect } from "vitest";
import {
  assessmentSchema,
  questionSchema,
  answersSchema,
  correctionSchema,
} from "@/modules/avaliacoes/schemas/assessments";
import { modulePath } from "@/modules/core/contracts/access";
const objective = {
  avaliacaoId: 1,
  enunciado: "Qual alternativa?",
  tipo: "OBJETIVA",
  pontuacao: 2,
  alternativaA: "Um",
  alternativaB: "Dois",
  alternativaC: "Três",
  alternativaD: "Quatro",
  alternativaCorreta: "B",
  ativo: true,
};
describe("validação de avaliações", () => {
  it("exige quatro alternativas e gabarito somente na objetiva", () => {
    expect(questionSchema.parse(objective).pontuacao).toBe(2);
    expect(() =>
      questionSchema.parse({ ...objective, alternativaD: null }),
    ).toThrow();
    expect(() =>
      questionSchema.parse({ ...objective, tipo: "DISCURSIVA" }),
    ).toThrow();
    expect(
      questionSchema.parse({
        avaliacaoId: 1,
        enunciado: "Explique",
        tipo: "DISCURSIVA",
        pontuacao: 3,
        ativo: true,
      }).tipo,
    ).toBe("DISCURSIVA");
  });
  it("valida liberação real e prazo entre um minuto e um dia", () => {
    const value = {
      titulo: "Prova",
      tipo: "Prova",
      dataAplicacao: "2026-10-28T09:00",
      tempoLimite: 60,
      ativo: true,
    };
    expect(assessmentSchema.parse(value).tempoLimite).toBe(60);
    expect(() =>
      assessmentSchema.parse({ ...value, dataAplicacao: "2026-02-30T09:00" }),
    ).toThrow();
    expect(() =>
      assessmentSchema.parse({ ...value, tempoLimite: 0 }),
    ).toThrow();
  });
  it("rejeita identidade e pontuação forjadas e respostas enormes", () => {
    expect(() =>
      answersSchema.parse({ tentativaId: 1, alunoId: 2, respostas: [] }),
    ).toThrow();
    expect(() =>
      answersSchema.parse({
        tentativaId: 1,
        respostas: [{ questaoId: 1, pontuacaoObtida: 5 }],
      }),
    ).toThrow();
    expect(() =>
      answersSchema.parse({
        tentativaId: 1,
        respostas: [{ questaoId: 1, texto: "a".repeat(5001) }],
      }),
    ).toThrow();
  });
  it("permite correção parcial com duas casas decimais", () => {
    expect(
      correctionSchema.parse({ respostaId: 1, pontuacao: 1.25 }).pontuacao,
    ).toBe(1.25);
    expect(() =>
      correctionSchema.parse({ respostaId: 1, pontuacao: 1.234 }),
    ).toThrow();
    expect(() =>
      correctionSchema.parse({ respostaId: 1, pontuacao: -1 }),
    ).toThrow();
  });
  it("encaminha o menu para o módulo implementado", () =>
    expect(modulePath("avaliacoes")).toBe("/avaliacoes"));
});
