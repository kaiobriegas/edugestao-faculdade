import type { Field } from "@/components/forms/fields";
import type { FormValues } from "@/components/forms/entity-editor";
import { localLessonTime } from "@/lib/academic-time";
export type Resource = "planos" | "descontos" | "cobrancas" | "pagamentos";
export type Option = {
  id: number;
  nome: string;
  ativo: boolean;
  valor?: string;
  saldo?: string;
};
export type Options = {
  alunos: Option[];
  planos: Option[];
  descontos: (Option & {
    alunoId: number;
    dataInicio: string;
    dataFim: string;
  })[];
  cobrancas: Option[];
};
export const emptyOptions: Options = {
  alunos: [],
  planos: [],
  descontos: [],
  cobrancas: [],
};
export const titles: Record<Resource, string> = {
  planos: "Planos financeiros",
  descontos: "Descontos",
  cobrancas: "Cobranças",
  pagamentos: "Pagamentos",
};
export const createLabels: Record<Resource, string> = {
  planos: "Novo plano",
  descontos: "Novo desconto",
  cobrancas: "Emitir cobrança",
  pagamentos: "Registrar pagamento",
};
export const currency = (v?: string | null) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number(v || 0),
  );
export const dayLabel = (v?: string) =>
  v ? v.split("-").reverse().join("/") : "—";
export const dateLabel = (v?: string | null) =>
  v
    ? new Date(v).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })
    : "—";
export const stateLabel = (v?: string) =>
  ({
    PENDENTE: "Pendente",
    PARCIAL: "Parcial",
    PAGA: "Paga",
    VENCIDA: "Vencida",
    CANCELADA: "Cancelada",
    CONFIRMADO: "Confirmado",
    ESTORNADO: "Estornado",
  })[v || ""] || v;
const active: Field = {
  name: "ativo",
  label: "Situação do cadastro",
  type: "select",
  options: [
    { value: "true", label: "Ativo" },
    { value: "false", label: "Inativo" },
  ],
};
const select = (
  name: string,
  label: string,
  options: Option[],
  onlyActive = false,
): Field => ({
  name,
  label,
  type: "select",
  required: true,
  options: [
    { value: "", label: "Selecione…" },
    ...options
      .filter((o) => !onlyActive || o.ativo)
      .map((o) => ({
        value: String(o.id),
        label:
          o.nome +
          (o.valor
            ? ` · ${currency(o.valor)}`
            : o.saldo
              ? ` · saldo ${currency(o.saldo)}`
              : "") +
          (o.ativo ? "" : " (inativo)"),
      })),
  ],
});
const amount = (name: string, label: string, min = 0): Field => ({
  name,
  label,
  type: "number",
  min,
  max: 999999999999.99,
  step: "0.01",
  required: true,
});
export function fieldsFor(
  resource: Resource,
  options: Options,
  values: FormValues,
): Field[] {
  if (resource === "planos")
    return [
      { name: "nome", label: "Nome", required: true, maxLength: 160 },
      {
        name: "descricao",
        label: "Descrição",
        type: "textarea",
        maxLength: 2000,
      },
      amount("valor", "Valor (R$)"),
      {
        name: "periodicidade",
        label: "Periodicidade (informativa)",
        required: true,
        maxLength: 80,
      },
      active,
    ];
  if (resource === "descontos")
    return [
      select("alunoId", "Aluno", options.alunos),
      {
        name: "descricao",
        label: "Descrição do desconto",
        required: true,
        maxLength: 160,
      },
      {
        name: "tipo",
        label: "Tipo de desconto",
        type: "select",
        required: true,
        options: [
          { value: "PERCENTUAL", label: "Percentual" },
          { value: "FIXO", label: "Valor fixo" },
        ],
      },
      values.tipo === "PERCENTUAL"
        ? { ...amount("percentual", "Percentual (%)"), max: 100 }
        : amount("valor", "Desconto (R$)"),
      {
        name: "dataInicio",
        label: "Início da validade",
        type: "date",
        required: true,
      },
      {
        name: "dataFim",
        label: "Fim da validade",
        type: "date",
        required: true,
      },
      active,
    ];
  if (resource === "cobrancas")
    return [
      select("alunoId", "Aluno", options.alunos, true),
      select("planoId", "Plano financeiro", options.planos, true),
      {
        name: "descontoId",
        label: "Desconto opcional",
        type: "select",
        options: [
          { value: "", label: "Sem desconto" },
          ...options.descontos
            .filter((d) => d.ativo && String(d.alunoId) === values.alunoId)
            .map((d) => ({
              value: String(d.id),
              label: `${d.nome} · ${dayLabel(d.dataInicio)} a ${dayLabel(d.dataFim)}`,
            })),
        ],
      },
      {
        name: "dataVencimento",
        label: "Vencimento",
        type: "date",
        required: true,
      },
    ];
  return [
    select("cobrancaId", "Cobrança", options.cobrancas, true),
    amount("valor", "Valor do pagamento (R$)", 0.01),
    {
      name: "dataPagamento",
      label: "Data do pagamento (Brasília)",
      type: "datetime-local",
      required: true,
    },
    {
      name: "formaPagamento",
      label: "Forma do pagamento (registro interno)",
      type: "select",
      required: true,
      options: [
        { value: "PIX", label: "Pix" },
        { value: "DINHEIRO", label: "Dinheiro" },
        { value: "TRANSFERENCIA", label: "Transferência" },
        { value: "CARTAO", label: "Cartão" },
        { value: "OUTRO", label: "Outro" },
      ],
    },
    {
      name: "comprovante",
      label: "Referência do comprovante (sem upload)",
      maxLength: 160,
    },
  ];
}
export function initialValues(
  resource: Resource,
  cobrancaId?: number,
): FormValues {
  const today = localLessonTime(new Date()).slice(0, 10);
  if (resource === "planos")
    return {
      nome: "",
      descricao: "",
      valor: "",
      periodicidade: "Mensal",
      ativo: "true",
    };
  if (resource === "descontos")
    return {
      alunoId: "",
      descricao: "",
      tipo: "PERCENTUAL",
      percentual: "",
      valor: "",
      dataInicio: today,
      dataFim: today,
      ativo: "true",
    };
  if (resource === "cobrancas")
    return { alunoId: "", planoId: "", descontoId: "", dataVencimento: today };
  return {
    cobrancaId: cobrancaId ? String(cobrancaId) : "",
    valor: "",
    dataPagamento: localLessonTime(new Date()),
    formaPagamento: "PIX",
    comprovante: "",
    chaveIdempotencia: crypto.randomUUID(),
  };
}
export function payload(resource: Resource, v: FormValues) {
  const values: Record<string, unknown> = { ...v };
  if (v.id) values.id = Number(v.id);
  for (const key of ["alunoId", "planoId", "cobrancaId"])
    if (key in v) values[key] = Number(v[key]);
  if ("ativo" in v) values.ativo = v.ativo === "true";
  if (resource === "cobrancas")
    values.descontoId = v.descontoId ? Number(v.descontoId) : null;
  if (resource === "descontos") {
    values.valor = v.tipo === "FIXO" ? v.valor : null;
    values.percentual = v.tipo === "PERCENTUAL" ? v.percentual : null;
  }
  return values;
}
