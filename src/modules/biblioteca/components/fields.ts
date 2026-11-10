import type { Field } from "@/components/forms/fields";
import type { FormValues } from "@/components/forms/entity-editor";
import { localLessonTime } from "@/lib/academic-time";
export type Resource =
  "livros" | "categorias" | "exemplares" | "emprestimos" | "reservas";
export type Option = { id: number; nome: string; ativo: boolean };
export type Options = {
  categorias: Option[];
  livros: Option[];
  exemplares: Option[];
  alunos: Option[];
};
export const titles: Record<Resource, string> = {
  livros: "Acervo da biblioteca",
  categorias: "Categorias",
  exemplares: "Exemplares",
  emprestimos: "Empréstimos",
  reservas: "Reservas",
};
export const createLabels: Record<Resource, string> = {
  livros: "Novo livro",
  categorias: "Nova categoria",
  exemplares: "Novo exemplar",
  emprestimos: "Novo empréstimo",
  reservas: "Nova reserva",
};
const status: Field = {
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
  activeOnly = false,
): Field => ({
  name,
  label,
  type: "select",
  required: true,
  options: [
    { value: "", label: "Selecione…" },
    ...options
      .filter((o) => !activeOnly || o.ativo)
      .map((o) => ({
        value: String(o.id),
        label: o.nome + (o.ativo ? "" : " (inativo)"),
      })),
  ],
});
export function fieldsFor(
  resource: Resource,
  options: Options,
  values: FormValues,
): Field[] {
  if (resource === "categorias")
    return [
      { name: "nome", label: "Nome", required: true, maxLength: 160 },
      {
        name: "descricao",
        label: "Descrição",
        type: "textarea",
        maxLength: 2000,
      },
      status,
    ];
  if (resource === "livros")
    return [
      { name: "titulo", label: "Título", required: true, maxLength: 160 },
      { name: "autor", label: "Autor", required: true, maxLength: 160 },
      select("categoriaId", "Categoria", options.categorias),
      { name: "editora", label: "Editora", maxLength: 160 },
      {
        name: "anoPublicacao",
        label: "Ano de publicação",
        type: "number",
        min: 1,
        max: 9999,
      },
      { name: "isbn", label: "ISBN", maxLength: 40 },
      {
        name: "descricao",
        label: "Descrição",
        type: "textarea",
        maxLength: 2000,
      },
      status,
    ];
  if (resource === "exemplares")
    return [
      {
        name: "codigo",
        label: "Código do exemplar",
        required: true,
        maxLength: 80,
      },
      select("livroId", "Livro", options.livros),
      {
        name: "situacao",
        label: "Estado do exemplar",
        type: "select",
        required: true,
        options: [
          { value: "DISPONIVEL", label: "Disponível" },
          { value: "INDISPONIVEL", label: "Indisponível" },
          ...(values.situacao === "EMPRESTADO"
            ? [
                {
                  value: "EMPRESTADO",
                  label: "Emprestado (devolução pelo empréstimo)",
                },
              ]
            : []),
        ],
      },
      { name: "localizacao", label: "Localização", maxLength: 160 },
      { name: "dataAquisicao", label: "Data de aquisição", type: "date" },
      status,
    ];
  return [
    select("alunoId", "Aluno", options.alunos, true),
    resource === "emprestimos"
      ? select("exemplarId", "Exemplar disponível", options.exemplares, true)
      : select("livroId", "Livro", options.livros, true),
    {
      name:
        resource === "emprestimos" ? "dataPrevistaDevolucao" : "dataExpiracao",
      label:
        resource === "emprestimos"
          ? "Devolução prevista (Brasília)"
          : "Validade da reserva (Brasília)",
      type: "datetime-local",
      required: true,
    },
  ];
}
export function initialValues(resource: Resource): FormValues {
  const future = localLessonTime(new Date(Date.now() + 7 * 86400000));
  if (resource === "categorias")
    return { nome: "", descricao: "", ativo: "true" };
  if (resource === "livros")
    return {
      titulo: "",
      autor: "",
      categoriaId: "",
      editora: "",
      anoPublicacao: "",
      isbn: "",
      descricao: "",
      ativo: "true",
    };
  if (resource === "exemplares")
    return {
      codigo: "",
      livroId: "",
      situacao: "DISPONIVEL",
      localizacao: "",
      dataAquisicao: "",
      ativo: "true",
    };
  if (resource === "emprestimos")
    return { alunoId: "", exemplarId: "", dataPrevistaDevolucao: future };
  return { alunoId: "", livroId: "", dataExpiracao: future };
}
export function payload(resource: Resource, values: FormValues) {
  const v: Record<string, unknown> = { ...values };
  if (values.id) v.id = Number(values.id);
  if ("ativo" in values) v.ativo = values.ativo === "true";
  for (const k of ["categoriaId", "livroId", "alunoId", "exemplarId"])
    if (k in values) v[k] = Number(values[k]);
  if ("anoPublicacao" in values)
    v.anoPublicacao = values.anoPublicacao
      ? Number(values.anoPublicacao)
      : null;
  if (resource === "exemplares") v.dataAquisicao = values.dataAquisicao || null;
  return v;
}
export const dateLabel = (v?: string | null) =>
  v
    ? new Date(v).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })
    : "—";
export const stateLabel = (v?: string) =>
  ({
    DISPONIVEL: "Disponível",
    INDISPONIVEL: "Indisponível",
    EMPRESTADO: "Emprestado",
    ABERTO: "Aberto",
    DEVOLVIDO: "Devolvido",
    ATRASADO: "Atrasado",
    ATIVA: "Ativa",
    ATENDIDA: "Atendida",
    CANCELADA: "Cancelada",
    EXPIRADA: "Expirada",
  })[v || ""] || v;
