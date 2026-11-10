import type { StudentOptions } from "../repositories/queries";
import type { Field } from "@/components/forms/fields";
export type { Field } from "@/components/forms/fields";
export const studentStatuses = [
  "MATRICULADO",
  "TRANCADO",
  "CONCLUIDO",
  "CANCELADO",
];
export const emptyOptions: StudentOptions = {
  turmas: [],
  responsaveis: [],
  usuarios: [],
};
const statusField: Field = {
  name: "ativo",
  label: "Situação do cadastro",
  type: "select",
  options: [
    { value: "true", label: "Ativo" },
    { value: "false", label: "Inativo" },
  ],
};
export function fieldsFor(
  resource: string,
  options: StudentOptions,
  root: boolean,
): Field[] {
  const name: Field = {
    name: "nome",
    label: "Nome",
    required: true,
    maxLength: 120,
  };
  if (resource === "turmas")
    return [
      name,
      {
        name: "descricao",
        label: "Descrição",
        type: "textarea",
        maxLength: 1000,
      },
      {
        name: "ano",
        label: "Ano",
        type: "number",
        required: true,
        min: 1900,
        max: 9999,
      },
      { name: "periodo", label: "Período", required: true, maxLength: 50 },
      {
        name: "capacidade",
        label: "Capacidade",
        type: "number",
        required: true,
        min: 1,
        max: 10000,
      },
      statusField,
    ];
  if (resource === "responsaveis")
    return [
      name,
      { name: "cpf", label: "CPF (opcional)", maxLength: 20 },
      { name: "telefone", label: "Telefone", maxLength: 30 },
      { name: "email", label: "E-mail", type: "email", maxLength: 254 },
      { name: "endereco", label: "Endereço", maxLength: 300 },
      {
        name: "parentesco",
        label: "Parentesco padrão (opcional)",
        maxLength: 60,
      },
      statusField,
    ];
  return [
    name,
    {
      name: "matricula",
      label: "Matrícula acadêmica",
      required: true,
      maxLength: 40,
    },
    { name: "dataNascimento", label: "Data de nascimento", type: "date" },
    {
      name: "dataMatricula",
      label: "Data de matrícula",
      type: "date",
      required: true,
    },
    { name: "email", label: "E-mail", type: "email", maxLength: 254 },
    { name: "telefone", label: "Telefone", maxLength: 30 },
    { name: "endereco", label: "Endereço", maxLength: 300 },
    {
      name: "turmaId",
      label: "Turma",
      type: "select",
      required: true,
      options: [
        { value: "", label: "Selecione uma turma" },
        ...options.turmas.map((t) => ({
          value: String(t.id),
          label: `${t.nome} · ${t.vagas} vaga(s)${t.ativo ? "" : " · inativa"}`,
        })),
      ],
    },
    {
      name: "status",
      label: "Status acadêmico",
      type: "select",
      options: studentStatuses.map((s) => ({ value: s, label: s })),
    },
    statusField,
    ...(root
      ? [
          {
            name: "usuarioId",
            label: "Conta de acesso (opcional)",
            type: "select" as const,
            nullable: true,
            options: [
              { value: "", label: "Sem conta vinculada" },
              ...options.usuarios.map((u) => ({
                value: String(u.id),
                label: u.nome + (u.ativo ? "" : " · inativa"),
              })),
            ],
          },
          {
            name: "confirmacaoSenha",
            label: "Sua senha (somente ao alterar vínculo de conta)",
            type: "password" as const,
            maxLength: 128,
          },
        ]
      : []),
  ];
}
