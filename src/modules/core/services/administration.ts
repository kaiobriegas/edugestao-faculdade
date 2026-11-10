import type { DatabaseClient } from "@/lib/database-client";
import {
  AppError,
  assertManager,
  assertRoot,
  canManageUser,
  isRoot,
  type Actor,
} from "../contracts/access";
import {
  groupSchema,
  moduleSchema,
  profileSchema,
  roleSchema,
  userSchema,
} from "../schemas/core";
import {
  actorForUser,
  audit,
  lockAdministration,
  type Transaction,
} from "./auth";
import { hashPassword, verifyPassword } from "./security";

export function createAdministration(db: DatabaseClient) {
  async function revoke(tx: Transaction, userId: number) {
    await tx.sessao.updateMany({
      where: { usuarioId: userId, revogadoEm: null },
      data: { revogadoEm: new Date() },
    });
  }
  async function confirm(tx: Transaction, actor: Actor, password: string) {
    const user = await tx.usuario.findUniqueOrThrow({
      where: { idUsuario: actor.id },
    });
    if (!(await verifyPassword(user.senhaHash, password)))
      throw new AppError("Sua senha de confirmação está incorreta.", 403);
  }
  async function save(resource: string, actorId: number, input: unknown) {
    return db.$transaction(
      async (tx) => {
        await lockAdministration(tx);
        const actor = await actorForUser(tx, actorId);
        if (resource === "perfil") {
          const data = profileSchema.parse(input);
          await tx.$queryRaw`SELECT id_usuario FROM usuario WHERE id_usuario = ${actor.id} FOR UPDATE`;
          await confirm(tx, actor, data.confirmacaoSenha);
          const emailChanged = data.email !== actor.email;
          await tx.usuario.update({
            where: { idUsuario: actor.id },
            data: {
              nome: data.nome,
              email: data.email,
              senhaHash: data.novaSenha
                ? await hashPassword(data.novaSenha)
                : undefined,
            },
          });
          if (emailChanged || data.novaSenha) {
            await revoke(tx, actor.id);
            await tx.tokenRedefinicaoSenha.updateMany({
              where: { usuarioId: actor.id, consumidoEm: null },
              data: { consumidoEm: new Date() },
            });
          }
          await audit(
            tx,
            actor.id,
            "PERFIL_ATUALIZADO",
            "Usuario",
            actor.id,
            actor.grupoId,
          );
          return { relogin: !!(emailChanged || data.novaSenha) };
        }
        assertManager(actor);
        if (resource === "usuarios") {
          const data = userSchema.parse(input);
          await confirm(tx, actor, data.confirmacaoSenha);
          const papel = await tx.papel.findUnique({
            where: { idPapel: data.papelId },
          });
          const group = await tx.grupo.findUnique({
            where: { idGrupo: data.grupoId },
          });
          if (
            !papel ||
            !["root", "Administrador", "Usuário"].includes(papel.nome) ||
            !group?.ativo
          )
            throw new AppError("Escolha grupo ativo e papel válidos.");
          if (
            !canManageUser(actor, { grupoId: data.grupoId, papel: papel.nome })
          )
            throw new AppError(
              "Não é permitido conceder esse grupo ou papel.",
              403,
            );
          const current = data.id
            ? await tx.usuario.findUnique({
                where: { idUsuario: data.id },
                include: { papel: true },
              })
            : null;
          if (data.id && !current)
            throw new AppError("Usuário não encontrado.", 404);
          if (
            current &&
            !canManageUser(actor, {
              grupoId: current.grupoId,
              papel: current.papel.nome,
            })
          )
            throw new AppError("Usuário fora do seu escopo.", 403);
          if (
            current?.papel.nome === "root" &&
            current.ativo &&
            (!data.ativo || papel.nome !== "root")
          ) {
            const otherRoots = await tx.usuario.count({
              where: {
                idUsuario: { not: current.idUsuario },
                ativo: true,
                grupo: { ativo: true },
                papel: { nome: "root" },
              },
            });
            if (!otherRoots)
              throw new AppError("O último root ativo deve ser preservado.");
          }
          if (!data.id && !data.senha)
            throw new AppError("Informe a senha do novo usuário.");
          const senhaHash = data.senha
            ? await hashPassword(data.senha)
            : undefined;
          const values = {
            nome: data.nome,
            email: data.email,
            ativo: data.ativo,
            grupoId: data.grupoId,
            papelId: data.papelId,
            senhaHash,
          };
          const user = current
            ? await tx.usuario.update({
                where: { idUsuario: current.idUsuario },
                data: values,
              })
            : await tx.usuario.create({
                data: { ...values, senhaHash: senhaHash! },
              });
          if (current) {
            await revoke(tx, current.idUsuario);
            await tx.tokenRedefinicaoSenha.updateMany({
              where: { usuarioId: current.idUsuario, consumidoEm: null },
              data: { consumidoEm: new Date() },
            });
          }
          await audit(
            tx,
            actor.id,
            current ? "USUARIO_ATUALIZADO" : "USUARIO_CRIADO",
            "Usuario",
            user.idUsuario,
            actor.grupoId,
          );
          return {
            id: user.idUsuario,
            relogin: current?.idUsuario === actor.id,
          };
        }
        assertRoot(actor);
        if (resource === "grupos") {
          const data = groupSchema.parse(input);
          await confirm(tx, actor, data.confirmacaoSenha);
          const ids = [...new Set(data.moduloIds)];
          if (
            (await tx.modulo.count({ where: { idModulo: { in: ids } } })) !==
            ids.length
          )
            throw new AppError("Módulos inválidos.");
          if (data.id && !data.ativo) {
            if (
              !(await tx.usuario.count({
                where: {
                  ativo: true,
                  grupoId: { not: data.id },
                  grupo: { ativo: true },
                  papel: { nome: "root" },
                },
              }))
            )
              throw new AppError("Não desative o grupo do último root ativo.");
          }
          const group = data.id
            ? await tx.grupo.update({
                where: { idGrupo: data.id },
                data: {
                  nome: data.nome,
                  descricao: data.descricao,
                  ativo: data.ativo,
                },
              })
            : await tx.grupo.create({
                data: {
                  nome: data.nome,
                  descricao: data.descricao,
                  ativo: data.ativo,
                },
              });
          for (const catalogModule of await tx.modulo.findMany({
            select: { idModulo: true },
          })) {
            await tx.grupoModulo.upsert({
              where: {
                grupoId_moduloId: {
                  grupoId: group.idGrupo,
                  moduloId: catalogModule.idModulo,
                },
              },
              create: {
                grupoId: group.idGrupo,
                moduloId: catalogModule.idModulo,
                habilitado: ids.includes(catalogModule.idModulo),
              },
              update: { habilitado: ids.includes(catalogModule.idModulo) },
            });
          }
          if (!data.ativo)
            await tx.sessao.updateMany({
              where: { usuario: { grupoId: group.idGrupo }, revogadoEm: null },
              data: { revogadoEm: new Date() },
            });
          await audit(
            tx,
            actor.id,
            data.id ? "GRUPO_ATUALIZADO" : "GRUPO_CRIADO",
            "Grupo",
            group.idGrupo,
            actor.grupoId,
          );
          return { id: group.idGrupo };
        }
        if (resource === "papeis") {
          const data = roleSchema.parse(input);
          await confirm(tx, actor, data.confirmacaoSenha);
          await tx.papel.update({
            where: { idPapel: data.id },
            data: { descricao: data.descricao },
          });
          await audit(
            tx,
            actor.id,
            "PAPEL_ATUALIZADO",
            "Papel",
            data.id,
            actor.grupoId,
          );
          return { id: data.id };
        }
        if (resource === "modulos") {
          const data = moduleSchema.parse(input);
          await confirm(tx, actor, data.confirmacaoSenha);
          await tx.modulo.update({
            where: { idModulo: data.id },
            data: {
              nome: data.nome,
              descricao: data.descricao,
              ativo: data.ativo,
            },
          });
          await audit(
            tx,
            actor.id,
            "MODULO_ATUALIZADO",
            "Modulo",
            data.id,
            actor.grupoId,
          );
          return { id: data.id };
        }
        throw new AppError("Operação não encontrada.", 404);
      },
      { timeout: 15000 },
    );
  }
  async function options(actor: Actor) {
    assertManager(actor);
    const root = isRoot(actor);
    const [grupos, papeis, modulos] = await Promise.all([
      db.grupo.findMany({
        where: root ? {} : { idGrupo: actor.grupoId },
        select: { idGrupo: true, nome: true, ativo: true },
        orderBy: { nome: "asc" },
      }),
      db.papel.findMany({
        where: root ? {} : { nome: "Usuário" },
        select: { idPapel: true, nome: true },
        orderBy: { idPapel: "asc" },
      }),
      root
        ? db.modulo.findMany({
            select: { idModulo: true, nome: true, ativo: true },
            orderBy: { idModulo: "asc" },
          })
        : Promise.resolve([]),
    ]);
    return { grupos, papeis, modulos };
  }
  return { save, options };
}
