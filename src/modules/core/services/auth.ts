import type { DatabaseClient } from "@/lib/database-client";
import type { Prisma } from "@/generated/prisma/client";
import { AppError, type Actor } from "../contracts/access";
import {
  bootstrapSchema,
  loginSchema,
  recoverySchema,
  resetSchema,
} from "../schemas/core";
import {
  hashPassword,
  randomToken,
  rateKey,
  tokenDigest,
  verifyPassword,
} from "./security";
export type Transaction = Prisma.TransactionClient;
export const SESSION_SECONDS = 60 * 60 * 8;
export async function lockAdministration(tx: Transaction) {
  await tx.$queryRaw`SELECT true AS locked FROM pg_advisory_xact_lock(37103)`;
}
export async function actorForUser(
  tx: Transaction | DatabaseClient,
  id: number,
): Promise<Actor> {
  const user = await tx.usuario.findUnique({
    where: { idUsuario: id },
    include: { papel: true, grupo: true },
  });
  if (!user?.ativo || !user.grupo.ativo)
    throw new AppError("Sessão inválida. Entre novamente.", 401);
  const modulos = await tx.modulo.findMany({
    where:
      user.papel.nome === "root"
        ? {}
        : {
            ativo: true,
            grupoModuloRegistros: {
              some: { grupoId: user.grupoId, habilitado: true },
            },
          },
    select: { idModulo: true, codigo: true, nome: true },
    orderBy: { idModulo: "asc" },
  });
  return {
    id: user.idUsuario,
    nome: user.nome,
    email: user.email,
    papel: user.papel.nome,
    grupoId: user.grupoId,
    grupo: user.grupo.nome,
    modulos: modulos.map((m) => ({
      id: m.idModulo,
      codigo: m.codigo,
      nome: m.nome,
    })),
  };
}
export async function audit(
  tx: Transaction,
  actorId: number | null,
  action: string,
  entity: string,
  id?: number,
  groupId?: number,
) {
  await tx.eventoAdministrativo.create({
    data: {
      atorUsuarioId: actorId,
      acao: action,
      entidade: entity,
      registroId: id?.toString(),
      metadados: groupId ? { grupoId: groupId } : undefined,
    },
  });
}
export function createAuthService(db: DatabaseClient, secret: string) {
  async function throttle(value: string, limit = 10) {
    const key = rateKey(secret, value);
    const rows = await db.$queryRaw<{ contador: number }[]>`
      INSERT INTO limite_autenticacao (chave_hash, janela_inicio, contador, criado_em, atualizado_em)
      VALUES (${key}, now(), 1, now(), now())
      ON CONFLICT (chave_hash) DO UPDATE SET
        contador = CASE WHEN limite_autenticacao.janela_inicio < now() - interval '15 minutes' THEN 1 ELSE limite_autenticacao.contador + 1 END,
        janela_inicio = CASE WHEN limite_autenticacao.janela_inicio < now() - interval '15 minutes' THEN now() ELSE limite_autenticacao.janela_inicio END,
        atualizado_em = now()
      RETURNING contador`;
    if (rows[0].contador > limit)
      throw new AppError("Muitas tentativas. Aguarde 15 minutos.", 429);
  }
  async function session(token: string | undefined): Promise<Actor> {
    if (!token || !/^[a-f0-9]{64}$/.test(token))
      throw new AppError("Entre para continuar.", 401);
    const row = await db.sessao.findUnique({
      where: { tokenHash: tokenDigest(token) },
    });
    if (!row || row.revogadoEm || row.expiraEm <= new Date())
      throw new AppError("Sessão encerrada. Entre novamente.", 401);
    return actorForUser(db, row.usuarioId);
  }
  async function login(input: unknown) {
    const data = loginSchema.parse(input);
    await throttle("login:" + data.email);
    const user = await db.usuario.findUnique({
      where: { email: data.email },
      include: { grupo: true },
    });
    // Equalize password work for an unknown account; hashes never leave the server.
    const valid = user
      ? await verifyPassword(user.senhaHash, data.senha)
      : (await hashPassword(data.senha), false);
    if (!valid || !user?.ativo || !user.grupo.ativo)
      throw new AppError("E-mail ou senha inválidos.", 401);
    const token = randomToken();
    const expiraEm = new Date(Date.now() + SESSION_SECONDS * 1000);
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id_usuario FROM usuario WHERE id_usuario = ${user.idUsuario} FOR UPDATE`;
      const current = await tx.usuario.findUniqueOrThrow({
        where: { idUsuario: user.idUsuario },
        include: { grupo: true },
      });
      if (
        !current.ativo ||
        !current.grupo.ativo ||
        current.senhaHash !== user.senhaHash
      )
        throw new AppError("E-mail ou senha inválidos.", 401);
      await tx.sessao.create({
        data: {
          usuarioId: user.idUsuario,
          tokenHash: tokenDigest(token),
          expiraEm,
        },
      });
      await audit(
        tx,
        user.idUsuario,
        "LOGIN",
        "Usuario",
        user.idUsuario,
        user.grupoId,
      );
    });
    return { token, expiraEm };
  }
  async function logout(token: string | undefined) {
    if (!token) return;
    await db.$transaction(async (tx) => {
      const existing = await tx.sessao.findUnique({
        where: { tokenHash: tokenDigest(token) },
      });
      if (!existing || existing.revogadoEm) return;
      await tx.sessao.update({
        where: { id: existing.id },
        data: { revogadoEm: new Date() },
      });
      await audit(
        tx,
        existing.usuarioId,
        "LOGOUT",
        "Usuario",
        existing.usuarioId,
      );
    });
  }
  async function recover(
    input: unknown,
    send: (email: string, token: string) => Promise<void>,
  ) {
    const { email } = recoverySchema.parse(input);
    await throttle("recovery:" + email, 4);
    const user = await db.usuario.findUnique({
      where: { email },
      include: { grupo: true },
    });
    if (user?.ativo && user.grupo.ativo) {
      const token = randomToken();
      await db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id_usuario FROM usuario WHERE id_usuario = ${user.idUsuario} FOR UPDATE`;
        await tx.tokenRedefinicaoSenha.updateMany({
          where: { usuarioId: user.idUsuario, consumidoEm: null },
          data: { consumidoEm: new Date() },
        });
        await tx.tokenRedefinicaoSenha.create({
          data: {
            usuarioId: user.idUsuario,
            tokenHash: tokenDigest(token),
            expiraEm: new Date(Date.now() + 30 * 60 * 1000),
          },
        });
      });
      try {
        await send(email, token);
      } catch {
        await db.tokenRedefinicaoSenha.updateMany({
          where: { tokenHash: tokenDigest(token) },
          data: { consumidoEm: new Date() },
        });
        console.error(
          "Falha no transporte SMTP de recuperação; verifique o serviço de e-mail.",
        );
      }
    }
    return "Se houver uma conta ativa, enviaremos um link de recuperação para esse e-mail.";
  }
  async function reset(input: unknown) {
    const { token, senha } = resetSchema.parse(input);
    const tokenHash = tokenDigest(token);
    const row = await db.tokenRedefinicaoSenha.findUnique({
      where: { tokenHash },
    });
    if (!row) throw new AppError("Link inválido ou expirado.");
    const senhaHash = await hashPassword(senha);
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id_usuario FROM usuario WHERE id_usuario = ${row.usuarioId} FOR UPDATE`;
      const user = await tx.usuario.findUniqueOrThrow({
        where: { idUsuario: row.usuarioId },
        include: { grupo: true },
      });
      if (!user.ativo || !user.grupo.ativo)
        throw new AppError("Link inválido ou expirado.");
      const consumed = await tx.tokenRedefinicaoSenha.updateMany({
        where: { tokenHash, consumidoEm: null, expiraEm: { gt: new Date() } },
        data: { consumidoEm: new Date() },
      });
      if (consumed.count !== 1)
        throw new AppError("Link inválido ou expirado.");
      await tx.usuario.update({
        where: { idUsuario: row.usuarioId },
        data: { senhaHash },
      });
      await tx.sessao.updateMany({
        where: { usuarioId: row.usuarioId, revogadoEm: null },
        data: { revogadoEm: new Date() },
      });
      await tx.tokenRedefinicaoSenha.updateMany({
        where: { usuarioId: row.usuarioId, consumidoEm: null },
        data: { consumidoEm: new Date() },
      });
      await audit(
        tx,
        row.usuarioId,
        "SENHA_REDEFINIDA",
        "Usuario",
        row.usuarioId,
        user.grupoId,
      );
    });
  }
  return { login, logout, session, recover, reset, throttle };
}
export async function bootstrapRoot(db: DatabaseClient, input: unknown) {
  const data = bootstrapSchema.parse(input);
  const senhaHash = await hashPassword(data.senha);
  return db.$transaction(async (tx) => {
    await lockAdministration(tx);
    if (await tx.usuario.count({ where: { papel: { nome: "root" } } }))
      throw new AppError(
        "O primeiro root já existe. Use o gerenciamento de usuários.",
        409,
      );
    const papel = await tx.papel.findUnique({ where: { nome: "root" } });
    if (!papel) throw new AppError("Execute db:seed antes do bootstrap.");
    const group = await tx.grupo.create({
      data: { nome: data.grupo, descricao: "Grupo de administração inicial" },
    });
    const user = await tx.usuario.create({
      data: {
        nome: data.nome,
        email: data.email,
        senhaHash,
        grupoId: group.idGrupo,
        papelId: papel.idPapel,
      },
    });
    await audit(
      tx,
      user.idUsuario,
      "ROOT_INICIAL_CRIADO",
      "Usuario",
      user.idUsuario,
      group.idGrupo,
    );
    return { id: user.idUsuario, nome: user.nome };
  });
}
