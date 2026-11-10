import type { DatabaseClient } from "../src/lib/database-client";
export async function seedCatalog(db: DatabaseClient) {
  await db.$transaction(async (tx) => {
    for (const [nome, descricao] of [
      ["root", "Administração global da plataforma"],
      ["Administrador", "Administração dentro do escopo autorizado"],
      ["Usuário", "Acesso às funcionalidades autorizadas"],
    ]) await tx.papel.upsert({ where: { nome }, update: {}, create: { nome, descricao } });
    for (const [codigo, nome] of [
      ["alunos", "Gestão de Alunos"], ["cursos", "Gestão de Cursos"], ["avaliacoes", "Gestão de Avaliações"],
      ["biblioteca", "Biblioteca"], ["financeiro", "Financeiro"],
    ]) await tx.modulo.upsert({ where: { codigo }, update: {}, create: { codigo, nome } });
  });
}
