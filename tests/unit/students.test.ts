import { describe, expect, it } from "vitest";
import {
  studentSchema,
  responsibleSchema,
  validCpf,
} from "@/modules/alunos/schemas/alunos";
import {
  inspectFile,
  documentStorage,
  readMultipart,
} from "@/modules/alunos/services/files";
describe("validações acadêmicas e arquivos", () => {
  it("aceita aluno sem conta e rejeita data impossível", () => {
    const base = {
      nome: "Aluno Teste",
      matricula: "2026-01",
      dataMatricula: "2026-10-28",
      turmaId: 1,
      status: "MATRICULADO",
      ativo: true,
    };
    expect(studentSchema.parse(base).usuarioId).toBeUndefined();
    expect(() =>
      studentSchema.parse({ ...base, dataNascimento: "2026-02-30" }),
    ).toThrow();
  });
  it("valida CPF e exige contato do responsável", () => {
    expect(validCpf("52998224725")).toBe(true);
    expect(validCpf("11111111111")).toBe(false);
    expect(() =>
      responsibleSchema.parse({ nome: "Responsável", ativo: true }),
    ).toThrow("telefone");
  });
  it("confere assinatura, MIME, extensão e tamanho", () => {
    const pdf = Buffer.from("%PDF-1.4\n%%EOF");
    expect(inspectFile("cadastro.pdf", "application/pdf", pdf, 1000).ext).toBe(
      "pdf",
    );
    expect(() =>
      inspectFile(
        "malicioso.pdf",
        "application/pdf",
        Buffer.from("<html>"),
        1000,
      ),
    ).toThrow("válido");
    expect(() =>
      inspectFile("arquivo.html", "application/pdf", pdf, 1000),
    ).toThrow("válido");
    expect(() => inspectFile("arquivo.pdf", "application/pdf", pdf, 2)).toThrow(
      "limite",
    );
  });
  it("não aceita caminho arbitrário nem diretório público", async () => {
    expect(() => documentStorage("public/uploads")).toThrow("privado");
    await expect(
      documentStorage(".local/file-test").get("../../.env"),
    ).rejects.toThrow("Chave");
  });
  it("limita o corpo multipart antes de carregar arquivo inteiro", async () => {
    const request = new Request("http://localhost/upload", {
      method: "POST",
      body: new Uint8Array(70000),
    });
    await expect(readMultipart(request, 1000)).rejects.toMatchObject({
      status: 413,
    });
  });
});
