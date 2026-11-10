import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabaseClient } from "@/lib/database-client";
import { bootstrapRoot, createAuthService } from "@/modules/core/services/auth";
import { createAdministration } from "@/modules/core/services/administration";
import {
  hashPassword,
  rateKey,
  tokenDigest,
  verifyPassword,
} from "@/modules/core/services/security";
import { listCore } from "@/modules/core/repositories/queries";
import { seedCatalog } from "../../prisma/seed-catalog";
const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith("_test"))
  throw new Error("Banco exclusivo de testes obrigatório.");
const db = createDatabaseClient(url);
const prefix = randomUUID();
const password = randomUUID() + "!";
const secret = randomUUID();
const auth = createAuthService(db, secret);
const admin = createAdministration(db);
let rootId: number,
  groupA: number,
  groupB: number,
  rootGroup: number,
  userId: number,
  adminId: number,
  otherId: number,
  userRole: number,
  rootRole: number,
  adminRole: number,
  moduleId: number;
let rootEmail: string;
const email = (part: string) => `${part}-${prefix}@example.test`;
beforeAll(async () => {
  await seedCatalog(db);
  rootEmail = email("root");
  const root = await bootstrapRoot(db, {
    nome: "Root Teste",
    email: rootEmail,
    grupo: prefix + "-root",
    senha: password,
  });
  rootId = root.id;
  rootGroup = (
    await db.usuario.findUniqueOrThrow({ where: { idUsuario: rootId } })
  ).grupoId;
  groupA = (await db.grupo.create({ data: { nome: prefix + "-A" } })).idGrupo;
  groupB = (await db.grupo.create({ data: { nome: prefix + "-B" } })).idGrupo;
  const roles = await db.papel.findMany();
  userRole = roles.find((r) => r.nome === "Usuário")!.idPapel;
  rootRole = roles.find((r) => r.nome === "root")!.idPapel;
  adminRole = roles.find((r) => r.nome === "Administrador")!.idPapel;
  moduleId = (
    await db.modulo.findUniqueOrThrow({ where: { codigo: "biblioteca" } })
  ).idModulo;
  const senhaHash = await hashPassword(password);
  for (const [part, role, group] of [
    ["user", userRole, groupA],
    ["admin", adminRole, groupA],
    ["other", userRole, groupB],
  ] as const) {
    const u = await db.usuario.create({
      data: {
        nome: part,
        email: email(part),
        senhaHash,
        papelId: role,
        grupoId: group,
      },
    });
    if (part === "user") userId = u.idUsuario;
    if (part === "admin") adminId = u.idUsuario;
    if (part === "other") otherId = u.idUsuario;
  }
});
afterAll(async () => {
  const groups = await db.grupo.findMany({
    where: { nome: { startsWith: prefix } },
    select: { idGrupo: true },
  });
  const ids = groups.map((g) => g.idGrupo);
  const users = await db.usuario.findMany({
    where: { grupoId: { in: ids } },
    select: { idUsuario: true },
  });
  const uids = users.map((u) => u.idUsuario);
  await db.eventoAdministrativo.deleteMany({
    where: { atorUsuarioId: { in: uids } },
  });
  await db.sessao.deleteMany({ where: { usuarioId: { in: uids } } });
  await db.tokenRedefinicaoSenha.deleteMany({
    where: { usuarioId: { in: uids } },
  });
  await db.usuario.deleteMany({ where: { idUsuario: { in: uids } } });
  await db.grupoModulo.deleteMany({ where: { grupoId: { in: ids } } });
  await db.grupo.deleteMany({ where: { idGrupo: { in: ids } } });
  const keys = ["root", "user", "admin", "other", "unknown", "absent"].flatMap(
    (part) =>
      ["login:", "recovery:"].map((action) =>
        rateKey(secret, action + email(part)),
      ),
  );
  await db.limiteAutenticacao.deleteMany({
    where: { chaveHash: { in: keys } },
  });
  await db.$disconnect();
});
async function userActor() {
  return auth.session(
    (await auth.login({ email: email("user"), senha: password })).token,
  );
}
describe("autenticação e administração reais", () => {
  it("armazena apenas Argon2id e impede repetir bootstrap", async () => {
    const user = await db.usuario.findUniqueOrThrow({
      where: { idUsuario: rootId },
    });
    expect(user.senhaHash.startsWith("$argon2id$")).toBe(true);
    expect(await verifyPassword(user.senhaHash, password)).toBe(true);
    await expect(
      bootstrapRoot(db, {
        nome: "Outro Root",
        email: email("extra"),
        senha: password,
        grupo: "Outro",
      }),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("normaliza e-mail, mantém token somente por hash e revoga logout", async () => {
    const session = await auth.login({
      email: "  " + rootEmail.toUpperCase() + "  ",
      senha: password,
    });
    const stored = await db.sessao.findUniqueOrThrow({
      where: { tokenHash: tokenDigest(session.token) },
    });
    expect(stored.tokenHash).not.toBe(session.token);
    expect((await auth.session(session.token)).id).toBe(rootId);
    expect(JSON.stringify(await auth.session(session.token))).not.toContain(
      "senhaHash",
    );
    await auth.logout(session.token);
    await expect(auth.session(session.token)).rejects.toMatchObject({
      status: 401,
    });
  });
  it("rejeita senha incorreta e sessão expirada", async () => {
    await expect(
      auth.login({ email: rootEmail, senha: "incorreta" }),
    ).rejects.toMatchObject({ status: 401 });
    const s = await auth.login({ email: rootEmail, senha: password });
    await db.sessao.update({
      where: { tokenHash: tokenDigest(s.token) },
      data: { expiraEm: new Date(0) },
    });
    await expect(auth.session(s.token)).rejects.toMatchObject({ status: 401 });
  });
  it("limita tentativas persistidas sem e-mail em claro", async () => {
    for (let i = 0; i < 10; i++)
      await expect(
        auth.login({ email: email("unknown"), senha: "errada" }),
      ).rejects.toMatchObject({ status: 401 });
    await expect(
      auth.login({ email: email("unknown"), senha: "errada" }),
    ).rejects.toMatchObject({ status: 429 });
    expect(
      (
        await db.limiteAutenticacao.findUniqueOrThrow({
          where: { chaveHash: rateKey(secret, "login:" + email("unknown")) },
        })
      ).contador,
    ).toBe(11);
  });
  it("revalida atividade do usuário e grupo em cada acesso", async () => {
    const s = await auth.login({ email: email("other"), senha: password });
    try {
      await db.usuario.update({
        where: { idUsuario: otherId },
        data: { ativo: false },
      });
      await expect(auth.session(s.token)).rejects.toMatchObject({
        status: 401,
      });
      await db.usuario.update({
        where: { idUsuario: otherId },
        data: { ativo: true },
      });
      await db.grupo.update({
        where: { idGrupo: groupB },
        data: { ativo: false },
      });
      await expect(
        auth.login({ email: email("other"), senha: password }),
      ).rejects.toMatchObject({ status: 401 });
      await expect(auth.session(s.token)).rejects.toMatchObject({
        status: 401,
      });
    } finally {
      await db.usuario.update({
        where: { idUsuario: otherId },
        data: { ativo: true },
      });
      await db.grupo.update({
        where: { idGrupo: groupB },
        data: { ativo: true },
      });
    }
  });
  it("administrador não eleva privilégios nem altera outro grupo", async () => {
    const base = {
      nome: "Nova Conta",
      email: email("new"),
      senha: password,
      grupoId: groupA,
      papelId: rootRole,
      ativo: true,
      confirmacaoSenha: password,
    };
    await expect(admin.save("usuarios", adminId, base)).rejects.toMatchObject({
      status: 403,
    });
    await expect(
      admin.save("usuarios", adminId, {
        ...base,
        papelId: userRole,
        grupoId: groupB,
      }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      admin.save("usuarios", adminId, {
        ...base,
        id: otherId,
        email: email("other"),
        papelId: userRole,
      }),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("permite administrador cadastrar usuário comum e registra autoria", async () => {
    const result = await admin.save("usuarios", adminId, {
      nome: "Nova Conta",
      email: email("new"),
      senha: password,
      grupoId: groupA,
      papelId: userRole,
      ativo: true,
      confirmacaoSenha: password,
    });
    expect(result.id).toBeTypeOf("number");
    expect(
      await db.eventoAdministrativo.count({
        where: { atorUsuarioId: adminId, acao: "USUARIO_CRIADO" },
      }),
    ).toBe(1);
  });
  it("filtra listagem e opções antes da paginação por escopo", async () => {
    const actor = await auth.session(
      (await auth.login({ email: email("admin"), senha: password })).token,
    );
    const listing = await listCore(
      db,
      actor,
      "usuarios",
      new URLSearchParams(),
    );
    expect(
      listing.rows.every((r) => "grupoId" in r && r.grupoId === groupA),
    ).toBe(true);
    const options = await admin.options(actor);
    expect(options.papeis.map((r) => r.nome)).toEqual(["Usuário"]);
    expect(options.grupos.map((r) => r.idGrupo)).toEqual([groupA]);
    await expect(
      listCore(db, actor, "grupos", new URLSearchParams()),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("nega operações administrativas ao usuário e exige confirmação de senha", async () => {
    const body = {
      nome: prefix + "-new",
      descricao: "",
      ativo: true,
      moduloIds: [],
      confirmacaoSenha: password,
    };
    await expect(admin.save("grupos", userId, body)).rejects.toMatchObject({
      status: 403,
    });
    await expect(admin.save("grupos", adminId, body)).rejects.toMatchObject({
      status: 403,
    });
    await expect(
      admin.save("grupos", rootId, { ...body, confirmacaoSenha: "errada" }),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("preserva último root ativo e seu grupo", async () => {
    await expect(
      admin.save("usuarios", rootId, {
        id: rootId,
        nome: "Root Teste",
        email: rootEmail,
        grupoId: rootGroup,
        papelId: rootRole,
        ativo: false,
        confirmacaoSenha: password,
      }),
    ).rejects.toThrow("último root");
    await expect(
      admin.save("grupos", rootId, {
        id: rootGroup,
        nome: prefix + "-root",
        descricao: "",
        ativo: false,
        moduloIds: [],
        confirmacaoSenha: password,
      }),
    ).rejects.toThrow("último root");
  });
  it("habilita e desabilita módulo com efeito imediato", async () => {
    expect((await userActor()).modulos).toHaveLength(0);
    const body = {
      id: groupA,
      nome: prefix + "-A",
      descricao: "Teste",
      ativo: true,
      moduloIds: [moduleId],
      confirmacaoSenha: password,
    };
    await admin.save("grupos", rootId, body);
    expect((await userActor()).modulos.map((m) => m.codigo)).toEqual([
      "biblioteca",
    ]);
    try {
      await db.modulo.update({
        where: { idModulo: moduleId },
        data: { ativo: false },
      });
      expect((await userActor()).modulos).toHaveLength(0);
    } finally {
      await db.modulo.update({
        where: { idModulo: moduleId },
        data: { ativo: true },
      });
    }
    await admin.save("grupos", rootId, { ...body, moduloIds: [] });
    expect((await userActor()).modulos).toHaveLength(0);
  });
  it("edição de usuário revoga sessões existentes", async () => {
    const session = await auth.login({
      email: email("other"),
      senha: password,
    });
    await admin.save("usuarios", rootId, {
      id: otherId,
      nome: "Atualizado",
      email: email("other"),
      grupoId: groupB,
      papelId: userRole,
      ativo: true,
      confirmacaoSenha: password,
    });
    await expect(auth.session(session.token)).rejects.toMatchObject({
      status: 401,
    });
  });
  it("recuperação uniforme e redefinição de uso único revogam sessões", async () => {
    let captured = "";
    let calls = 0;
    const known = await auth.recover(
      { email: email("other") },
      async (_email, token) => {
        captured = token;
        calls++;
      },
    );
    const unknown = await auth.recover({ email: email("absent") }, async () => {
      calls++;
    });
    expect(known).toBe(unknown);
    expect(calls).toBe(1);
    const session = await auth.login({
      email: email("other"),
      senha: password,
    });
    const nova = randomUUID();
    const results = await Promise.allSettled([
      auth.reset({ token: captured, senha: nova }),
      auth.reset({ token: captured, senha: nova }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    await expect(auth.session(session.token)).rejects.toMatchObject({
      status: 401,
    });
    expect(
      (await auth.login({ email: email("other"), senha: nova })).token,
    ).toHaveLength(64);
    await db.usuario.update({
      where: { idUsuario: otherId },
      data: { senhaHash: await hashPassword(password) },
    });
  });
  it("rejeita recuperação expirada e campos extras no perfil", async () => {
    let token = "";
    await auth.recover({ email: email("other") }, async (_e, t) => {
      token = t;
    });
    await db.tokenRedefinicaoSenha.update({
      where: { tokenHash: tokenDigest(token) },
      data: { expiraEm: new Date(0) },
    });
    await expect(auth.reset({ token, senha: password })).rejects.toThrow(
      "expirado",
    );
    await expect(
      admin.save("perfil", userId, {
        nome: "Nome",
        email: email("user"),
        confirmacaoSenha: password,
        papelId: rootRole,
      }),
    ).rejects.toThrow();
  });
  it("perfil permite nome e revoga acesso ao alterar e-mail", async () => {
    expect(
      (
        await admin.save("perfil", userId, {
          nome: "Nome Atualizado",
          email: email("user"),
          confirmacaoSenha: password,
        })
      ).relogin,
    ).toBe(false);
    const session = await auth.login({ email: email("user"), senha: password });
    expect(
      (
        await admin.save("perfil", userId, {
          nome: "Nome Atualizado",
          email: email("changed"),
          confirmacaoSenha: password,
        })
      ).relogin,
    ).toBe(true);
    await expect(auth.session(session.token)).rejects.toMatchObject({
      status: 401,
    });
    await db.usuario.update({
      where: { idUsuario: userId },
      data: { email: email("user") },
    });
  });
});
