import Link from "next/link";
import { notFound } from "next/navigation";
import { pageActor } from "@/lib/core-server";
import { getDatabase } from "@/lib/db";
import { AppError, isManager } from "@/modules/core/contracts/access";
import { courseDetail } from "@/modules/cursos/repositories/queries";
import { CourseNav } from "@/modules/cursos/components/course-nav";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await pageActor();
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const result = await courseDetail(getDatabase(), actor, id).catch(
    (e: unknown) => {
      if (e instanceof AppError) return e;
      throw e;
    },
  );
  if (result instanceof AppError) {
    if (result.status === 404) notFound();
    return (
      <section className="panel">
        <h1>Acesso restrito</h1>
        <p>{result.message}</p>
      </section>
    );
  }
  const manager = isManager(actor),
    course = result.curso;
  return (
    <>
      <CourseNav manage={manager} />
      <div className="page-heading">
        <div>
          <p className="eyebrow">CURSO E PROGRAMAÇÃO</p>
          <h1>{course.nome}</h1>
          <p>{course.descricao || "Sem descrição cadastrada."}</p>
        </div>
        <span className={course.ativo ? "tag green" : "tag"}>
          {course.ativo ? "Ativo" : "Inativo"}
        </span>
      </div>
      <div className="stats">
        <div className="stat">
          <span>Carga horária</span>
          <strong>{course.cargaHoraria} h</strong>
          <small>Total de referência do curso</small>
        </div>
        <div className="stat">
          <span>Aulas exibidas</span>
          <strong>{result.aulas.length}</strong>
          <small>Programação em Brasília</small>
        </div>
        {manager && (
          <div className="stat">
            <span>Matrículas ativas</span>
            <strong>{result.matriculasAtivas}</strong>
            <small>Alunos com vínculo ativo</small>
          </div>
        )}
      </div>
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Programação de aulas</h2>
            <p>Horário de Brasília; duração em minutos.</p>
          </div>
          {manager && (
            <Link className="btn small" href={`/cursos/aulas?cursoId=${id}`}>
              Gerenciar aulas
            </Link>
          )}
        </div>
        {!result.aulas.length ? (
          <p className="empty">Nenhuma aula cadastrada.</p>
        ) : (
          <div className="record-list">
            {result.aulas.map((a) => (
              <article className="record-item" key={a.id}>
                <div>
                  <strong>{a.titulo}</strong>
                  <p>
                    {a.dataHora.slice(0, 10).split("-").reverse().join("/")} às{" "}
                    {a.dataHora.slice(11)} · {a.duracao} min · {a.professor}
                  </p>
                  {a.descricao && <p>{a.descricao}</p>}
                </div>
                <span className={a.ativo ? "tag green" : "tag"}>
                  {a.ativo ? "Ativa" : "Inativa"}
                </span>
              </article>
            ))}
          </div>
        )}
        <small className="muted">
          Até 200 aulas. A listagem Programação permite consulta paginada.
        </small>
      </section>
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>
              {manager
                ? "Alunos e matrículas"
                : "Minhas matrículas neste curso"}
            </h2>
            <p>Vínculos com o cadastro acadêmico central.</p>
          </div>
          {manager && (
            <Link
              className="btn primary"
              href={`/cursos/matriculas?cursoId=${id}`}
            >
              Gerenciar matrículas
            </Link>
          )}
        </div>
        {!result.matriculas.length ? (
          <p className="empty">Nenhuma matrícula para exibir.</p>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Aluno</th>
                  <th>Matrícula acadêmica</th>
                  <th>Data</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {result.matriculas.map((m) => (
                  <tr key={m.id}>
                    <td>{m.aluno}</td>
                    <td>{m.matricula}</td>
                    <td>{m.data.split("-").reverse().join("/")}</td>
                    <td>
                      {m.status}
                      {!m.ativo && " · cadastro inativo"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <small className="muted">
          Até 100 matrículas recentes. Use Matrículas para pesquisa e paginação.
        </small>
      </section>
    </>
  );
}
