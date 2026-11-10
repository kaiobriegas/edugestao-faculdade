import { describe, expect, it } from "vitest";
import {
  assertModule,
  canManageUser,
  type Actor,
} from "@/modules/core/contracts/access";
import { assertOrigin } from "@/modules/core/services/security";
const base: Actor = {
  id: 1,
  nome: "Teste",
  email: "teste@example.test",
  grupoId: 2,
  grupo: "A",
  papel: "Administrador",
  modulos: [{ id: 1, codigo: "biblioteca", nome: "Biblioteca" }],
};
describe("políticas do núcleo", () => {
  it("limita administrador a usuário comum do próprio grupo", () => {
    expect(canManageUser(base, { grupoId: 2, papel: "Usuário" })).toBe(true);
    expect(canManageUser(base, { grupoId: 3, papel: "Usuário" })).toBe(false);
    expect(canManageUser(base, { grupoId: 2, papel: "root" })).toBe(false);
    expect(
      canManageUser(
        { ...base, papel: "Usuário" },
        { grupoId: 2, papel: "Usuário" },
      ),
    ).toBe(false);
  });
  it("nega módulo não habilitado", () => {
    expect(() => assertModule(base, "biblioteca")).not.toThrow();
    expect(() => assertModule(base, "financeiro")).toThrow(
      "Módulo não habilitado",
    );
  });
  it("confere origem e rejeita requisição sem origem", () => {
    for (const origin of ["http://localhost:3000", "http://127.0.0.1:3000"])
      expect(() =>
        assertOrigin(
          new Request("http://localhost:3000", { headers: { origin } }),
          "http://localhost:3000",
        ),
      ).not.toThrow();
    for (const origin of [
      "https://externo.example",
      "http://localhost:3001",
      "",
    ])
      expect(() =>
        assertOrigin(
          new Request("http://localhost:3000", { headers: { origin } }),
          "http://localhost:3000",
        ),
      ).toThrow("Origem");
  });
});
