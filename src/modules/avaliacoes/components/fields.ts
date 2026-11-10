import type { Field } from "@/components/forms/fields";
export const assessmentFields: Field[] = [
  { name: "titulo", label: "Título", required: true, maxLength: 160 },
  { name: "descricao", label: "Descrição", type: "textarea", maxLength: 2000 },
  { name: "tipo", label: "Tipo de avaliação", required: true, maxLength: 80 },
  {
    name: "dataAplicacao",
    label: "Liberação (Brasília)",
    type: "datetime-local",
    required: true,
  },
  {
    name: "tempoLimite",
    label: "Tempo limite (minutos)",
    type: "number",
    min: 1,
    max: 1440,
    required: true,
  },
  {
    name: "ativo",
    label: "Situação",
    type: "select",
    options: [
      { value: "true", label: "Ativa" },
      { value: "false", label: "Inativa" },
    ],
  },
];
export function questionFields(objective: boolean): Field[] {
  return [
    {
      name: "enunciado",
      label: "Enunciado",
      type: "textarea",
      required: true,
      maxLength: 5000,
    },
    {
      name: "tipo",
      label: "Tipo de questão",
      type: "select",
      required: true,
      options: [
        { value: "OBJETIVA", label: "Objetiva" },
        { value: "DISCURSIVA", label: "Discursiva" },
      ],
    },
    {
      name: "pontuacao",
      label: "Pontuação",
      type: "number",
      min: 1,
      max: 10000,
      required: true,
    },
    ...(objective
      ? (["A", "B", "C", "D"].map((letter) => ({
          name: "alternativa" + letter,
          label: "Alternativa " + letter,
          required: true,
          maxLength: 2000,
        })) as Field[])
      : []),
    ...(objective
      ? [
          {
            name: "alternativaCorreta",
            label: "Gabarito",
            type: "select",
            required: true,
            options: ["A", "B", "C", "D"].map((value) => ({
              value,
              label: value,
            })),
          } as Field,
        ]
      : []),
    {
      name: "ativo",
      label: "Situação",
      type: "select",
      options: [
        { value: "true", label: "Ativa" },
        { value: "false", label: "Inativa" },
      ],
    },
  ];
}
export const dateLabel = (v: string) =>
  new Date(v).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
export const statusLabel = (v: string) =>
  ({
    EM_ANDAMENTO: "Em andamento",
    FINALIZADA: "Aguardando correção",
    CORRIGIDA: "Corrigida",
  })[v] || v;
