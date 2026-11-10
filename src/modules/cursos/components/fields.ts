import type { Field } from "@/components/forms/fields";
import type { CourseOptions } from "../repositories/queries";
export const emptyCourseOptions: CourseOptions = {
  cursos: [],
  professores: [],
  alunos: [],
};
const active: Field = {
  name: "ativo",
  label: "Situação do cadastro",
  type: "select",
  options: [
    { value: "true", label: "Ativo" },
    { value: "false", label: "Inativo" },
  ],
};
export function courseFields(
  resource: string,
  opts: CourseOptions,
  root: boolean,
  editing: boolean,
): Field[] {
  const name: Field = {
    name: "nome",
    label: "Nome",
    required: true,
    maxLength: 120,
  };
  const description: Field = {
    name: "descricao",
    label: "Descrição",
    type: "textarea",
    maxLength: 2000,
  };
  const course: Field = {
    name: "cursoId",
    label: "Curso",
    type: "select",
    required: true,
    disabled: resource === "matriculas" && editing,
    options: [
      { value: "", label: "Selecione um curso" },
      ...opts.cursos.map((c) => ({
        value: String(c.id),
        label: c.nome + (c.ativo ? "" : " · inativo"),
      })),
    ],
  };
  if (resource === "cursos")
    return [
      name,
      description,
      {
        name: "cargaHoraria",
        label: "Carga horária (horas)",
        type: "number",
        required: true,
        min: 1,
        max: 10000,
      },
      active,
    ];
  if (resource === "professores")
    return [
      name,
      {
        name: "email",
        label: "E-mail",
        type: "email",
        required: true,
        maxLength: 254,
      },
      { name: "especialidade", label: "Especialidade", maxLength: 200 },
      active,
    ];
  if (resource === "aulas")
    return [
      {
        name: "titulo",
        label: "Título da aula",
        required: true,
        maxLength: 120,
      },
      description,
      course,
      {
        name: "professorId",
        label: "Professor",
        type: "select",
        required: true,
        options: [
          { value: "", label: "Selecione um professor" },
          ...opts.professores.map((p) => ({
            value: String(p.id),
            label: p.nome + (p.ativo ? "" : " · inativo"),
          })),
        ],
      },
      {
        name: "dataHora",
        label: "Data e hora da aula (Brasília)",
        type: "datetime-local",
        required: true,
      },
      {
        name: "duracao",
        label: "Duração (minutos)",
        type: "number",
        required: true,
        min: 1,
        max: 86400,
      },
      active,
    ];
  return [
    course,
    {
      name: "alunoId",
      label: "Aluno",
      type: "select",
      required: true,
      disabled: editing,
      options: [
        { value: "", label: "Selecione um aluno" },
        ...opts.alunos.map((a) => ({
          value: String(a.id),
          label: `${a.nome} · ${a.matricula}${a.ativo ? "" : " · inativo"}`,
        })),
      ],
    },
    {
      name: "dataMatricula",
      label: "Data da matrícula",
      type: "date",
      required: true,
    },
    {
      name: "status",
      label: "Status da matrícula",
      type: "select",
      options: ["ATIVA", "CONCLUIDA", "CANCELADA"].map((v) => ({
        value: v,
        label: v,
      })),
    },
    active,
    ...(root
      ? [
          {
            name: "justificativa",
            label: "Justificativa para curso inativo (root)",
            type: "textarea" as const,
            maxLength: 1000,
          },
          {
            name: "confirmacaoSenha",
            label: "Sua senha (somente para autorizar curso inativo)",
            type: "password" as const,
            maxLength: 128,
          },
        ]
      : []),
  ];
}
