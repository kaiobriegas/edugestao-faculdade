"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import {
  EntityEditor,
  type FormValues,
} from "@/components/forms/entity-editor";
import { isManager, isRoot, type Actor } from "@/modules/core/contracts/access";
import { api } from "@/modules/core/components/api";
import type { CourseOptions } from "../repositories/queries";
import { courseFields, emptyCourseOptions } from "./fields";
import { CourseNav } from "./course-nav";
type Row = {
  id: number;
  nome: string;
  detalhe: string;
  complemento: string;
  ativo: boolean;
  [key: string]: unknown;
};
type Resource = "cursos" | "professores" | "aulas" | "matriculas";
const titles = {
  cursos: "Gestão de Cursos",
  professores: "Professores",
  aulas: "Programação de aulas",
  matriculas: "Matrículas em cursos",
};
const newLabels = {
  cursos: "Novo curso",
  professores: "Novo professor",
  aulas: "Nova aula",
  matriculas: "Nova matrícula",
};
export function CourseList({
  resource,
  actor,
  initialCourse = "",
  initialStudent = "",
}: {
  resource: Resource;
  actor: Actor;
  initialCourse?: string;
  initialStudent?: string;
}) {
  const manager = isManager(actor);
  const [rows, setRows] = useState<Row[]>([]),
    [opts, setOpts] = useState<CourseOptions>(emptyCourseOptions),
    [total, setTotal] = useState(0);
  const [page, setPage] = useState(1),
    [search, setSearch] = useState(""),
    [active, setActive] = useState(""),
    [status, setStatus] = useState(""),
    [course, setCourse] = useState(initialCourse),
    [student, setStudent] = useState(initialStudent),
    [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [values, setValues] = useState<FormValues | null>(null),
    [editing, setEditing] = useState<Row | null>(null);
  const fields = useMemo(
    () => courseFields(resource, opts, isRoot(actor), !!editing),
    [resource, opts, actor, editing],
  );
  useEffect(() => {
    let ignore = false;
    async function load() {
      setLoading(true);
      try {
        const [data, options] = await Promise.all([
          api<{ rows: Row[]; total: number }>(
            `/api/cursos/${resource}?` +
              new URLSearchParams({
                pagina: String(page),
                busca: search,
                situacao: active,
                status,
                cursoId: course,
                alunoId: student,
              }),
          ),
          manager
            ? api<CourseOptions>("/api/cursos/opcoes")
            : Promise.resolve(emptyCourseOptions),
        ]);
        if (!ignore) {
          setRows(data.rows);
          setTotal(data.total);
          setOpts(options);
        }
      } catch (e) {
        if (!ignore)
          setError(
            e instanceof Error ? e.message : "Não foi possível carregar.",
          );
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    void load();
    return () => {
      ignore = true;
    };
  }, [
    resource,
    page,
    search,
    active,
    status,
    course,
    student,
    version,
    manager,
  ]);
  function edit(row?: Row) {
    const defaults: FormValues = {
      ativo: "true",
      status: "ATIVA",
      dataMatricula: new Date().toISOString().slice(0, 10),
      dataHora: new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 16),
      duracao: "60",
      cargaHoraria: "20",
      cursoId: course,
      alunoId: student,
    };
    for (const f of courseFields(resource, opts, isRoot(actor), !!row))
      if (row) defaults[f.name] = String(row[f.name] ?? "");
    defaults.justificativa = "";
    defaults.confirmacaoSenha = "";
    setValues(defaults);
    setEditing(row || null);
    setError("");
    setNotice("");
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!values) return;
    if (
      editing?.ativo &&
      values.ativo === "false" &&
      !window.confirm("Inativar este cadastro preservando o histórico?")
    )
      return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const body: Record<string, unknown> = editing ? { id: editing.id } : {};
      for (const f of fields) {
        const v = values[f.name] || "";
        body[f.name] =
          f.name === "ativo"
            ? v === "true"
            : f.type === "number" ||
                ["cursoId", "professorId", "alunoId"].includes(f.name)
              ? Number(v)
              : v;
      }
      await api(`/api/cursos/${resource}`, body);
      setValues(null);
      setNotice(
        resource === "matriculas"
          ? "Matrícula salva com sucesso."
          : "Cadastro salvo com sucesso.",
      );
      setVersion((v) => v + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }
  const showActive = manager || resource === "matriculas";
  return (
    <>
      <CourseNav manage={manager} />
      <div className="page-heading">
        <div>
          <p className="eyebrow">FORMAÇÃO E ENSINO</p>
          <h1>
            {resource === "matriculas" && !manager
              ? "Minhas matrículas"
              : titles[resource]}
          </h1>
          <p>
            {resource === "cursos"
              ? "Cursos, programação e vínculos com o cadastro central de alunos."
              : resource === "professores"
                ? "Docentes responsáveis por cada aula."
                : resource === "aulas"
                  ? "Programação em horário de Brasília; duração em minutos."
                  : manager
                    ? "Consulte por aluno ou curso e acompanhe a situação dos vínculos."
                    : "Somente os vínculos do seu cadastro acadêmico."}
          </p>
        </div>
        {manager && (
          <button
            className="btn primary"
            disabled={loading}
            onClick={() => edit()}
          >
            <Plus size={17} />
            {newLabels[resource]}
          </button>
        )}
      </div>
      {error && (
        <p className="alert error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="alert success" role="status">
          {notice}
        </p>
      )}
      {values && (
        <>
          <EntityEditor
            fields={fields}
            values={values}
            change={(name, value) =>
              setValues((v) => (v ? { ...v, [name]: value } : v))
            }
            submit={save}
            close={() => setValues(null)}
            saving={saving}
            editing={!!editing}
          />
          {resource === "matriculas" && (
            <p className="note">
              Aluno e curso são fixos após a criação. Para mudar o vínculo,
              cancele a matrícula e crie outra. Curso inativo exige autorização
              root, justificativa e senha atual.
            </p>
          )}
        </>
      )}
      <section className="panel">
        <div className="filters">
          <label className="search-field">
            <Search size={18} />
            <input
              aria-label="Pesquisar cursos e vínculos"
              placeholder={
                resource === "matriculas"
                  ? "Aluno, matrícula acadêmica ou curso…"
                  : "Pesquisar…"
              }
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </label>
          {showActive && (
            <select
              aria-label="Filtrar cadastro"
              value={active}
              onChange={(e) => {
                setActive(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Todos os cadastros</option>
              <option value="ativo">Ativos</option>
              <option value="inativo">Inativos</option>
            </select>
          )}
          {manager && ["aulas", "matriculas"].includes(resource) && (
            <select
              aria-label="Filtrar curso"
              value={course}
              onChange={(e) => {
                setCourse(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Todos os cursos</option>
              {opts.cursos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          )}
          {resource === "matriculas" && (
            <>
              <select
                aria-label="Filtrar status da matrícula"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Todos os status</option>
                {["ATIVA", "CONCLUIDA", "CANCELADA"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              {manager && (
                <select
                  aria-label="Filtrar aluno"
                  value={student}
                  onChange={(e) => {
                    setStudent(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">Todos os alunos</option>
                  {opts.alunos.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nome} · {a.matricula}
                    </option>
                  ))}
                </select>
              )}
            </>
          )}
        </div>
        {loading ? (
          <p className="empty" role="status">
            Carregando registros…
          </p>
        ) : !rows.length ? (
          <div className="empty">
            <h3>Nenhum registro encontrado</h3>
            <p>
              {manager
                ? "Cadastre os dados ou ajuste os filtros."
                : "Não há registros disponíveis para seu acesso. Matrículas exigem um aluno vinculado à sua conta."}
            </p>
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>
                    {resource === "matriculas"
                      ? "Aluno"
                      : resource === "aulas"
                        ? "Aula"
                        : "Nome"}
                  </th>
                  <th>Informações</th>
                  <th>Situação</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <strong>{row.nome}</strong>
                      <small>#{row.id}</small>
                    </td>
                    <td>
                      {row.detalhe}
                      <small>{row.complemento}</small>
                    </td>
                    <td>
                      <span className={row.ativo ? "tag green" : "tag"}>
                        {resource === "matriculas"
                          ? String(row.status)
                          : row.ativo
                            ? "Ativo"
                            : "Inativo"}
                      </span>
                      {resource === "matriculas" && !row.ativo && (
                        <small>Cadastro inativo</small>
                      )}
                    </td>
                    <td>
                      <div className="actions">
                        {resource !== "professores" && (
                          <Link
                            className="btn small"
                            href={`/cursos/${resource === "cursos" ? row.id : row.cursoId}`}
                          >
                            Abrir curso
                          </Link>
                        )}
                        {manager && (
                          <button
                            className="btn small"
                            aria-label={`Editar ${row.nome}`}
                            onClick={() => edit(row)}
                          >
                            Editar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="pagination">
          <span>
            {total} registro(s) · Página {page} de{" "}
            {Math.max(1, Math.ceil(total / 10))}
          </span>
          <div className="actions">
            <button
              className="btn small"
              disabled={page === 1 || loading}
              onClick={() => setPage((p) => p - 1)}
            >
              Anterior
            </button>
            <button
              className="btn small"
              disabled={page * 10 >= total || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
