import type { Aluno } from "@/generated/prisma/client";
import type { DatabaseClient } from "@/lib/database-client";
import {
  AppError,
  isManager,
  isRoot,
  type Actor,
} from "@/modules/core/contracts/access";
import { readListQuery } from "@/modules/core/schemas/core";
import { assertStudentRecord, studentAccess } from "../services/access";
function studentRow(row: Aluno & { turma: { nome: string } }) {
  return {
    id: row.idAluno,
    nome: row.nome,
    matricula: row.matricula,
    dataNascimento: row.dataNascimento?.toISOString().slice(0, 10) || "",
    email: row.email,
    telefone: row.telefone,
    endereco: row.endereco,
    dataMatricula: row.dataMatricula.toISOString().slice(0, 10),
    turmaId: row.turmaId,
    turma: row.turma.nome,
    status: row.status,
    ativo: row.ativo,
    usuarioId: row.usuarioId,
    detalhe: "Matrícula " + row.matricula,
    complemento: row.turma.nome + " · " + row.status,
  };
}
export async function studentOptions(db: DatabaseClient, actor: Actor) {
  studentAccess(actor, true);
  const [turmas, responsaveis, usuarios] = await Promise.all([
    db.turma.findMany({
      orderBy: { nome: "asc" },
      take: 1000,
      include: {
        _count: {
          select: {
            alunoRegistros: { where: { ativo: true, status: "MATRICULADO" } },
          },
        },
      },
    }),
    db.responsavel.findMany({
      orderBy: { nome: "asc" },
      take: 1000,
      select: { idResponsavel: true, nome: true, ativo: true },
    }),
    isRoot(actor)
      ? db.usuario.findMany({
          orderBy: { nome: "asc" },
          take: 1000,
          select: { idUsuario: true, nome: true, email: true, ativo: true },
        })
      : Promise.resolve([]),
  ]);
  return {
    turmas: turmas.map((t) => ({
      id: t.idTurma,
      nome: t.nome,
      ativo: t.ativo,
      vagas: Math.max(0, t.capacidade - t._count.alunoRegistros),
      capacidade: t.capacidade,
    })),
    responsaveis: responsaveis.map((r) => ({
      id: r.idResponsavel,
      nome: r.nome,
      ativo: r.ativo,
    })),
    usuarios: usuarios.map((u) => ({
      id: u.idUsuario,
      nome: u.nome + " · " + u.email,
      ativo: u.ativo,
    })),
  };
}
export async function listStudents(
  db: DatabaseClient,
  actor: Actor,
  resource: string,
  query: URLSearchParams,
) {
  studentAccess(actor, resource !== "alunos");
  const { pagina, busca, ativo } = readListQuery(query);
  const take = 10,
    skip = (pagina - 1) * take;
  if (resource === "alunos") {
    const turma = Number(query.get("turmaId"));
    const status = query.get("status");
    const validStatuses = [
      "MATRICULADO",
      "TRANCADO",
      "CONCLUIDO",
      "CANCELADO",
    ] as const;
    const where = {
      ...(isManager(actor) ? {} : { usuarioId: actor.id }),
      ativo,
      ...(Number.isInteger(turma) && turma > 0 && isManager(actor)
        ? { turmaId: turma }
        : {}),
      ...(status &&
      validStatuses.includes(status as (typeof validStatuses)[number])
        ? { status: status as (typeof validStatuses)[number] }
        : {}),
      OR: [
        { nome: { contains: busca, mode: "insensitive" as const } },
        { matricula: { contains: busca, mode: "insensitive" as const } },
      ],
    };
    const [rows, total] = await Promise.all([
      db.aluno.findMany({
        where,
        skip,
        take,
        orderBy: { idAluno: "desc" },
        include: { turma: { select: { nome: true } } },
      }),
      db.aluno.count({ where }),
    ]);
    return { rows: rows.map(studentRow), total, pagina };
  }
  if (resource === "turmas") {
    const where = {
      nome: { contains: busca, mode: "insensitive" as const },
      ativo,
    };
    const [rows, total] = await Promise.all([
      db.turma.findMany({
        where,
        skip,
        take,
        orderBy: { idTurma: "desc" },
        include: {
          _count: {
            select: {
              alunoRegistros: { where: { ativo: true, status: "MATRICULADO" } },
            },
          },
        },
      }),
      db.turma.count({ where }),
    ]);
    return {
      rows: rows.map((t) => ({
        id: t.idTurma,
        nome: t.nome,
        descricao: t.descricao,
        ano: t.ano,
        periodo: t.periodo,
        capacidade: t.capacidade,
        ativo: t.ativo,
        detalhe: `${t.ano} · ${t.periodo}`,
        complemento: `${t._count.alunoRegistros}/${t.capacidade} vagas ocupadas`,
      })),
      total,
      pagina,
    };
  }
  if (resource === "responsaveis") {
    const where = {
      ativo,
      OR: [
        { nome: { contains: busca, mode: "insensitive" as const } },
        { cpf: { contains: busca.replace(/\D/g, "") || busca } },
      ],
    };
    const [rows, total] = await Promise.all([
      db.responsavel.findMany({
        where,
        skip,
        take,
        orderBy: { idResponsavel: "desc" },
        include: { _count: { select: { alunoResponsavelRegistros: true } } },
      }),
      db.responsavel.count({ where }),
    ]);
    return {
      rows: rows.map((r) => ({
        id: r.idResponsavel,
        nome: r.nome,
        cpf: r.cpf,
        email: r.email,
        telefone: r.telefone,
        endereco: r.endereco,
        parentesco: r.parentesco,
        ativo: r.ativo,
        detalhe: [r.telefone, r.email].filter(Boolean).join(" · "),
        complemento: `${r._count.alunoResponsavelRegistros} aluno(s) vinculado(s)`,
      })),
      total,
      pagina,
    };
  }
  throw new AppError("Consulta não encontrada.", 404);
}
export async function studentDetail(
  db: DatabaseClient,
  actor: Actor,
  id: number,
) {
  await assertStudentRecord(db, actor, id);
  const manager = isManager(actor);
  const row = await db.aluno.findUniqueOrThrow({
    where: { idAluno: id },
    include: {
      turma: { select: { nome: true } },
      alunoResponsavelRegistros: {
        include: { responsavel: true },
        orderBy: { responsavelId: "asc" },
      },
      documentoRegistros: {
        where: manager ? {} : { ativo: true },
        orderBy: { idDocumento: "desc" },
        take: 100,
        select: {
          idDocumento: true,
          tipo: true,
          descricao: true,
          nomeArquivo: true,
          dataEnvio: true,
          status: true,
          ativo: true,
          tamanhoBytes: true,
        },
      },
    },
  });
  const [occurrences, enrollments, grades] = await Promise.all([
    manager
      ? db.ocorrencia.findMany({
          where: { alunoId: id },
          take: 100,
          orderBy: { dataOcorrencia: "desc" },
          include: { autor: { select: { nome: true } } },
        })
      : Promise.resolve([]),
    actor.modulos.some((m) => m.codigo === "cursos")
      ? db.matricula.findMany({
          where: { alunoId: id },
          take: 20,
          orderBy: { dataMatricula: "desc" },
          include: { curso: { select: { nome: true } } },
        })
      : Promise.resolve([]),
    actor.modulos.some((m) => m.codigo === "avaliacoes")
      ? db.nota.findMany({
          where: { alunoId: id },
          take: 20,
          orderBy: { dataAvaliacao: "desc" },
          include: { avaliacao: { select: { titulo: true } } },
        })
      : Promise.resolve([]),
  ]);
  return {
    aluno: studentRow(row),
    responsaveis: row.alunoResponsavelRegistros.map((r) => ({
      id: r.responsavelId,
      nome: r.responsavel.nome,
      parentesco: r.parentesco || r.responsavel.parentesco || "Responsável",
      telefone: r.responsavel.telefone,
      email: r.responsavel.email,
      ativo: r.responsavel.ativo,
    })),
    documentos: row.documentoRegistros.map((d) => ({
      id: d.idDocumento,
      tipo: d.tipo,
      descricao: d.descricao,
      nomeArquivo: d.nomeArquivo,
      dataEnvio: d.dataEnvio.toISOString(),
      status: d.status,
      ativo: d.ativo,
      tamanhoBytes: d.tamanhoBytes,
    })),
    ocorrencias: occurrences.map((o) => ({
      id: o.idOcorrencia,
      tipo: o.tipo,
      descricao: o.descricao,
      dataOcorrencia: o.dataOcorrencia.toISOString().slice(0, 10),
      status: o.status,
      ativo: o.ativo,
      autor: o.autor.nome,
    })),
    historico: {
      criadoEm: row.criadoEm.toISOString(),
      atualizadoEm: row.atualizadoEm.toISOString(),
      cursosPermitidos: actor.modulos.some((m) => m.codigo === "cursos"),
      avaliacoesPermitidas: actor.modulos.some(
        (m) => m.codigo === "avaliacoes",
      ),
      matriculas: enrollments.map((m) => ({
        id: m.idMatricula,
        curso: m.curso.nome,
        status: m.status,
        data: m.dataMatricula.toISOString().slice(0, 10),
      })),
      notas: grades.map((n) => ({
        id: n.idNota,
        avaliacao: n.avaliacao.titulo,
        valor: n.valor.toString(),
        data: n.dataAvaliacao.toISOString(),
      })),
    },
  };
}
export type StudentDetail = Awaited<ReturnType<typeof studentDetail>>;
export type StudentOptions = Awaited<ReturnType<typeof studentOptions>>;
