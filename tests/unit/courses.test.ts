import { describe, expect, it } from "vitest";
import {
  brazilDateTime,
  localLessonTime,
  courseSchema,
  lessonSchema,
  enrollmentSchema,
} from "@/modules/cursos/schemas/cursos";
import { modulePath } from "@/modules/core/contracts/access";
describe("validações de cursos", () => {
  it("converte horário de Brasília sem depender do fuso do servidor", () => {
    const date = brazilDateTime("2026-10-28T09:30");
    expect(date.toISOString()).toBe("2026-10-28T12:30:00.000Z");
    expect(localLessonTime(date)).toBe("2026-10-28T09:30");
    expect(() => brazilDateTime("2026-02-30T09:00")).toThrow();
  });
  it("rejeita carga e duração não positivas e data inválida", () => {
    expect(() =>
      courseSchema.parse({ nome: "Curso", cargaHoraria: 0, ativo: true }),
    ).toThrow();
    const aula = {
      titulo: "Aula",
      cursoId: 1,
      professorId: 1,
      dataHora: "2026-10-28T09:00",
      duracao: 60,
      ativo: true,
    };
    expect(lessonSchema.parse(aula).duracao).toBe(60);
    expect(() => lessonSchema.parse({ ...aula, duracao: -1 })).toThrow();
    expect(() =>
      lessonSchema.parse({ ...aula, dataHora: "2026-13-01T08:00" }),
    ).toThrow();
  });
  it("valida status e impede atribuição em massa", () => {
    const base = {
      alunoId: 1,
      cursoId: 1,
      dataMatricula: "2026-10-28",
      status: "ATIVA",
      ativo: true,
    };
    expect(enrollmentSchema.parse(base).status).toBe("ATIVA");
    expect(() => enrollmentSchema.parse({ ...base, status: "PAGA" })).toThrow();
    expect(() =>
      enrollmentSchema.parse({ ...base, autorUsuarioId: 1 }),
    ).toThrow();
  });
  it("direciona os módulos prontos às páginas reais", () => {
    expect(modulePath("alunos")).toBe("/alunos");
    expect(modulePath("cursos")).toBe("/cursos");
    expect(modulePath("financeiro")).toBe("/financeiro");
  });
});
