import type { DatabaseClient } from "@/lib/database-client";
import {
  AppError,
  assertManager,
  assertRoot,
  isRoot,
  type Actor,
} from "../contracts/access";
import { readListQuery } from "../schemas/core";
export async function listCore(
  db: DatabaseClient,
  actor: Actor,
  resource: string,
  query: URLSearchParams,
) {
  assertManager(actor);
  if (["grupos", "papeis", "modulos"].includes(resource)) assertRoot(actor);
  const { pagina, busca, ativo } = readListQuery(query);
  const take = 10,
    skip = (pagina - 1) * take;
  if (resource === "usuarios") {
    const where = {
      ...(isRoot(actor)
        ? {}
        : { grupoId: actor.grupoId, papel: { nome: "Usuário" } }),
      ativo,
      OR: [
        { nome: { contains: busca, mode: "insensitive" as const } },
        { email: { contains: busca, mode: "insensitive" as const } },
      ],
    };
    const [rows, total] = await Promise.all([
      db.usuario.findMany({
        where,
        skip,
        take,
        orderBy: { idUsuario: "desc" },
        select: {
          idUsuario: true,
          nome: true,
          email: true,
          ativo: true,
          grupoId: true,
          papelId: true,
          grupo: { select: { nome: true } },
          papel: { select: { nome: true } },
        },
      }),
      db.usuario.count({ where }),
    ]);
    return {
      rows: rows.map((r) => ({
        ...r,
        id: r.idUsuario,
        detalhe: r.email,
        complemento: r.grupo.nome + " · " + r.papel.nome,
      })),
      total,
      pagina,
    };
  }
  if (resource === "grupos") {
    const where = {
      nome: { contains: busca, mode: "insensitive" as const },
      ativo,
    };
    const [rows, total] = await Promise.all([
      db.grupo.findMany({
        where,
        skip,
        take,
        orderBy: { idGrupo: "desc" },
        include: {
          grupoModuloRegistros: { where: { habilitado: true } },
          _count: { select: { usuarioRegistros: true } },
        },
      }),
      db.grupo.count({ where }),
    ]);
    return {
      rows: rows.map((r) => ({
        id: r.idGrupo,
        nome: r.nome,
        descricao: r.descricao,
        ativo: r.ativo,
        moduloIds: r.grupoModuloRegistros.map((m) => m.moduloId),
        detalhe: r.descricao || "Sem descrição",
        complemento:
          r._count.usuarioRegistros +
          " usuário(s) · " +
          r.grupoModuloRegistros.length +
          " módulo(s)",
      })),
      total,
      pagina,
    };
  }
  if (resource === "papeis") {
    const where = { nome: { contains: busca, mode: "insensitive" as const } };
    const [rows, total] = await Promise.all([
      db.papel.findMany({ where, skip, take, orderBy: { idPapel: "asc" } }),
      db.papel.count({ where }),
    ]);
    return {
      rows: rows.map((r) => ({
        id: r.idPapel,
        nome: r.nome,
        descricao: r.descricao,
        detalhe: r.descricao || "Sem descrição",
      })),
      total,
      pagina,
    };
  }
  if (resource === "modulos") {
    const where = {
      nome: { contains: busca, mode: "insensitive" as const },
      ativo,
    };
    const [rows, total] = await Promise.all([
      db.modulo.findMany({ where, skip, take, orderBy: { idModulo: "asc" } }),
      db.modulo.count({ where }),
    ]);
    return {
      rows: rows.map((r) => ({
        id: r.idModulo,
        nome: r.nome,
        descricao: r.descricao,
        ativo: r.ativo,
        detalhe: r.codigo,
      })),
      total,
      pagina,
    };
  }
  if (resource === "eventos") {
    const where = {
      ...(isRoot(actor)
        ? {}
        : { metadados: { path: ["grupoId"], equals: actor.grupoId } }),
      acao: { contains: busca, mode: "insensitive" as const },
    };
    const [rows, total] = await Promise.all([
      db.eventoAdministrativo.findMany({
        where,
        skip,
        take,
        orderBy: { idEvento: "desc" },
        select: {
          idEvento: true,
          acao: true,
          entidade: true,
          registroId: true,
          ocorridoEm: true,
          ator: { select: { nome: true } },
        },
      }),
      db.eventoAdministrativo.count({ where }),
    ]);
    return {
      rows: rows.map((r) => ({
        id: r.idEvento,
        nome: r.acao,
        detalhe: `${r.entidade} #${r.registroId || "—"} · ${r.ator?.nome || "Sistema"}`,
        complemento: r.ocorridoEm.toLocaleString("pt-BR", {
          timeZone: "America/Sao_Paulo",
        }),
      })),
      total,
      pagina,
    };
  }
  throw new AppError("Consulta não encontrada.", 404);
}
export async function dashboardData(db: DatabaseClient, actor: Actor) {
  if (!isRoot(actor))
    return {
      usuarios:
        actor.papel === "Administrador"
          ? await db.usuario.count({
              where: { grupoId: actor.grupoId, ativo: true },
            })
          : null,
      grupos: null,
      modulos: actor.modulos.length,
    };
  const [usuarios, grupos, modulos] = await Promise.all([
    db.usuario.count({ where: { ativo: true } }),
    db.grupo.count({ where: { ativo: true } }),
    db.modulo.count({ where: { ativo: true } }),
  ]);
  return { usuarios, grupos, modulos };
}
