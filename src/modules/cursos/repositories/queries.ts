import type { DatabaseClient } from "@/lib/database-client";
import {
  AppError,
  isManager,
  type Actor,
} from "@/modules/core/contracts/access";
import { readListQuery } from "@/modules/core/schemas/core";
import { assertCourseRecord, courseAccess } from "../services/access";
import { localLessonTime } from "../schemas/cursos";
export async function courseOptions(db: DatabaseClient, actor: Actor) {
  courseAccess(actor, true);
  const [cursos, professores, alunos] = await Promise.all([
    db.curso.findMany({
      take: 1000,
      orderBy: { nome: "asc" },
      select: { idCurso: true, nome: true, ativo: true, cargaHoraria: true },
    }),
    db.professor.findMany({
      take: 1000,
      orderBy: { nome: "asc" },
      select: { idProfessor: true, nome: true, ativo: true },
    }),
    db.aluno.findMany({
      take: 1000,
      orderBy: { nome: "asc" },
      select: { idAluno: true, nome: true, matricula: true, ativo: true },
    }),
  ]);
  return {
    cursos: cursos.map((c) => ({
      id: c.idCurso,
      nome: c.nome,
      ativo: c.ativo,
      cargaHoraria: c.cargaHoraria,
    })),
    professores: professores.map((p) => ({
      id: p.idProfessor,
      nome: p.nome,
      ativo: p.ativo,
    })),
    alunos: alunos.map((a) => ({
      id: a.idAluno,
      nome: a.nome,
      matricula: a.matricula,
      ativo: a.ativo,
    })),
  };
}
export async function listCourses(
  db: DatabaseClient,
  actor: Actor,
  resource: string,
  query: URLSearchParams,
) {
  courseAccess(actor, ["professores"].includes(resource));
  const manager = isManager(actor);
  const { pagina, busca, ativo } = readListQuery(query);
  const skip = (pagina - 1) * 10,
    take = 10;
  const courseId = Number(query.get("cursoId")),
    studentId = Number(query.get("alunoId"));
  if (resource === "cursos") {
    const where = {
      nome: { contains: busca, mode: "insensitive" as const },
      ...(manager ? { ativo } : { ativo: true }),
    };
    const [rows, total] = await Promise.all([
      db.curso.findMany({
        where,
        skip,
        take,
        orderBy: { idCurso: "desc" },
        include: {
          _count: {
            select: {
              aulaRegistros: { where: { ativo: true } },
              matriculaRegistros: { where: { ativo: true, status: "ATIVA" } },
            },
          },
        },
      }),
      db.curso.count({ where }),
    ]);
    return {
      rows: rows.map((c) => ({
        id: c.idCurso,
        nome: c.nome,
        descricao: c.descricao,
        cargaHoraria: c.cargaHoraria,
        ativo: c.ativo,
        detalhe: `${c.cargaHoraria} horas · ${c._count.aulaRegistros} aula(s)`,
        complemento: manager
          ? `${c._count.matriculaRegistros} matrícula(s) ativa(s)`
          : "Consulte a programação do curso",
      })),
      total,
      pagina,
    };
  }
  if (resource === "professores") {
    const where = {
      nome: { contains: busca, mode: "insensitive" as const },
      ativo,
    };
    const [rows, total] = await Promise.all([
      db.professor.findMany({
        where,
        skip,
        take,
        orderBy: { idProfessor: "desc" },
        include: { _count: { select: { aulaRegistros: true } } },
      }),
      db.professor.count({ where }),
    ]);
    return {
      rows: rows.map((p) => ({
        id: p.idProfessor,
        nome: p.nome,
        email: p.email,
        especialidade: p.especialidade,
        ativo: p.ativo,
        detalhe: p.email,
        complemento: `${p.especialidade || "Sem especialidade"} · ${p._count.aulaRegistros} aula(s)`,
      })),
      total,
      pagina,
    };
  }
  if (resource === "aulas") {
    const where = {
      ...(manager ? { ativo } : { ativo: true, curso: { ativo: true } }),
      ...(courseId > 0 && Number.isInteger(courseId)
        ? { cursoId: courseId }
        : {}),
      OR: [
        { titulo: { contains: busca, mode: "insensitive" as const } },
        { curso: { nome: { contains: busca, mode: "insensitive" as const } } },
        {
          professor: {
            nome: { contains: busca, mode: "insensitive" as const },
          },
        },
      ],
    };
    const [rows, total] = await Promise.all([
      db.aula.findMany({
        where,
        skip,
        take,
        orderBy: [{ dataHora: "asc" }, { idAula: "asc" }],
        include: {
          curso: { select: { nome: true } },
          professor: { select: { nome: true } },
        },
      }),
      db.aula.count({ where }),
    ]);
    return {
      rows: rows.map((a) => ({
        id: a.idAula,
        nome: a.titulo,
        titulo: a.titulo,
        descricao: a.descricao,
        cursoId: a.cursoId,
        professorId: a.professorId,
        ativo: a.ativo,
        duracao: a.duracao,
        dataHora: localLessonTime(a.dataHora),
        detalhe: `${localLessonTime(a.dataHora).replace("T", " ")} · ${a.duracao} min`,
        complemento: `${a.curso.nome} · ${a.professor.nome}`,
      })),
      total,
      pagina,
    };
  }
  if (resource === "matriculas") {
    const status = query.get("status");
    const valid = ["ATIVA", "CONCLUIDA", "CANCELADA"] as const;
    const where = {
      ...(manager ? {} : { aluno: { usuarioId: actor.id } }),
      ativo,
      ...(courseId > 0 && Number.isInteger(courseId)
        ? { cursoId: courseId }
        : {}),
      ...(studentId > 0 && Number.isInteger(studentId)
        ? { alunoId: studentId }
        : {}),
      ...(status && valid.includes(status as (typeof valid)[number])
        ? { status: status as (typeof valid)[number] }
        : {}),
      OR: [
        { curso: { nome: { contains: busca, mode: "insensitive" as const } } },
        { aluno: { nome: { contains: busca, mode: "insensitive" as const } } },
        {
          aluno: {
            matricula: { contains: busca, mode: "insensitive" as const },
          },
        },
      ],
    };
    const [rows, total] = await Promise.all([
      db.matricula.findMany({
        where,
        skip,
        take,
        orderBy: { idMatricula: "desc" },
        include: {
          curso: { select: { nome: true, ativo: true } },
          aluno: { select: { nome: true, matricula: true } },
        },
      }),
      db.matricula.count({ where }),
    ]);
    return {
      rows: rows.map((m) => ({
        id: m.idMatricula,
        nome: m.aluno.nome,
        cursoId: m.cursoId,
        alunoId: m.alunoId,
        status: m.status,
        ativo: m.ativo,
        dataMatricula: m.dataMatricula.toISOString().slice(0, 10),
        detalhe: m.curso.nome + (m.curso.ativo ? "" : " · curso inativo"),
        complemento: `Matrícula acadêmica ${m.aluno.matricula} · ${m.status} · ${m.dataMatricula.toISOString().slice(0, 10)}`,
      })),
      total,
      pagina,
    };
  }
  throw new AppError("Consulta não encontrada.", 404);
}
export async function courseDetail(
  db: DatabaseClient,
  actor: Actor,
  id: number,
) {
  const course = await assertCourseRecord(db, actor, id);
  const manager = isManager(actor);
  const [aulas, matriculas, count] = await Promise.all([
    db.aula.findMany({
      where: { cursoId: id, ...(manager ? {} : { ativo: true }) },
      orderBy: [{ dataHora: "asc" }, { idAula: "asc" }],
      take: 200,
      include: { professor: { select: { nome: true } } },
    }),
    db.matricula.findMany({
      where: {
        cursoId: id,
        ...(manager ? {} : { aluno: { usuarioId: actor.id } }),
      },
      orderBy: { idMatricula: "desc" },
      take: 100,
      include: { aluno: { select: { nome: true, matricula: true } } },
    }),
    manager
      ? db.matricula.count({
          where: { cursoId: id, ativo: true, status: "ATIVA" },
        })
      : Promise.resolve(null),
  ]);
  return {
    curso: {
      id: course.idCurso,
      nome: course.nome,
      descricao: course.descricao,
      cargaHoraria: course.cargaHoraria,
      ativo: course.ativo,
    },
    aulas: aulas.map((a) => ({
      id: a.idAula,
      titulo: a.titulo,
      descricao: a.descricao,
      dataHora: localLessonTime(a.dataHora),
      duracao: a.duracao,
      professor: a.professor.nome,
      ativo: a.ativo,
    })),
    matriculas: matriculas.map((m) => ({
      id: m.idMatricula,
      aluno: m.aluno.nome,
      matricula: m.aluno.matricula,
      status: m.status,
      ativo: m.ativo,
      data: m.dataMatricula.toISOString().slice(0, 10),
    })),
    matriculasAtivas: count,
  };
}
export type CourseOptions = Awaited<ReturnType<typeof courseOptions>>;
