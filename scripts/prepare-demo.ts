import "dotenv/config";
import assert from "node:assert/strict";
import { createDatabaseClient } from "../src/lib/database-client";

// Carga fictícia solicitada para apresentação: somente inclusões, sem contas/senhas.
// Não integra o seed padrão e não reabre provas nem altera dados existentes.
const marker = "DEMO_FACULDADE_V1";
async function main() {
  if (!process.argv.includes("--apply"))
    throw new Error("Para criar os registros fictícios locais, use --apply.");
  const connection = process.env.DATABASE_URL;
  if (!connection) throw new Error("Configure o ambiente do projeto.");
  const url = new URL(connection);
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
    throw new Error("Este preparo é exclusivo do banco local.");
  const db = createDatabaseClient(connection);
  try {
    const result = await db.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT true AS locked FROM pg_advisory_xact_lock(37111)`;
        const previous = await tx.eventoAdministrativo.findFirst({
          where: { acao: marker, entidade: "Demonstracao" },
        });
        if (previous) return { criadoAgora: false, ids: previous.metadados };
        const root = await tx.usuario.findFirst({
          where: {
            ativo: true,
            grupo: { ativo: true },
            papel: { nome: "root" },
          },
          select: { idUsuario: true },
        });
        if (!root)
          throw new Error(
            "Crie sua conta root antes de preparar a demonstração.",
          );
        if (
          await tx.aluno.findUnique({ where: { matricula: "DEMO-2026-001" } })
        )
          throw new Error(
            "Já existe a matrícula DEMO. Nenhum registro foi alterado.",
          );
        const now = new Date();
        const localDay = new Intl.DateTimeFormat("en-CA", {
          timeZone: "America/Sao_Paulo",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(now);
        const today = new Date(`${localDay}T00:00:00.000Z`);
        const future = (days: number) =>
          new Date(today.valueOf() + days * 86400000);
        const turma = await tx.turma.create({
          data: {
            nome: "DEMO — Turma de apresentação",
            ano: Number(localDay.slice(0, 4)),
            periodo: "Noturno",
            capacidade: 30,
            descricao: "Dados fictícios para apresentação acadêmica.",
          },
        });
        const aluno = await tx.aluno.create({
          data: {
            nome: "DEMO — Ana Silva",
            matricula: "DEMO-2026-001",
            turmaId: turma.idTurma,
            dataMatricula: today,
            email: "aluno.demo@example.com",
            status: "MATRICULADO",
          },
        });
        const curso = await tx.curso.create({
          data: {
            nome: "DEMO — Banco de Dados",
            descricao: "Curso fictício para demonstrar a integração.",
            cargaHoraria: 40,
          },
        });
        const professor = await tx.professor.create({
          data: {
            nome: "DEMO — Carlos Souza",
            email: "professor.demo@example.com",
            especialidade: "Banco de Dados",
          },
        });
        await tx.aula.create({
          data: {
            titulo: "DEMO — Relacionamentos e chaves",
            duracao: 60,
            dataHora: new Date(now.valueOf() + 86400000),
            cursoId: curso.idCurso,
            professorId: professor.idProfessor,
          },
        });
        const matricula = await tx.matricula.create({
          data: {
            alunoId: aluno.idAluno,
            cursoId: curso.idCurso,
            dataMatricula: today,
          },
        });
        async function exam(title: string) {
          const row = await tx.avaliacao.create({
            data: {
              titulo: title,
              descricao: "Conteúdo fictício de apresentação acadêmica.",
              tipo: "DIAGNOSTICA",
              dataAplicacao: new Date(now.valueOf() - 3600000),
              tempoLimite: 60,
            },
          });
          const objective = await tx.questao.create({
            data: {
              avaliacaoId: row.idAvaliacao,
              tipo: "OBJETIVA",
              pontuacao: 2,
              enunciado: "Qual chave referencia um registro de outra tabela?",
              alternativaA: "Chave estrangeira",
              alternativaB: "Título da página",
              alternativaC: "Nome do usuário",
              alternativaD: "Cor do formulário",
              alternativaCorreta: "A",
            },
          });
          const essay = await tx.questao.create({
            data: {
              avaliacaoId: row.idAvaliacao,
              tipo: "DISCURSIVA",
              pontuacao: 3,
              enunciado:
                "Por que manter um único cadastro de aluno para os cinco módulos?",
            },
          });
          return { row, objective, essay };
        }
        const history = await exam("DEMO — Avaliação corrigida (histórico)");
        const attempt = await tx.tentativaAvaliacao.create({
          data: {
            alunoId: aluno.idAluno,
            avaliacaoId: history.row.idAvaliacao,
            status: "CORRIGIDA",
            iniciadaEm: new Date(now.valueOf() - 1800000),
            prazoEm: new Date(now.valueOf() + 1800000),
            finalizadaEm: new Date(now.valueOf() - 600000),
          },
        });
        const base = {
          alunoId: aluno.idAluno,
          avaliacaoId: history.row.idAvaliacao,
          tentativaId: attempt.idTentativa,
          dataResposta: new Date(now.valueOf() - 900000),
        };
        await tx.resposta.create({
          data: {
            ...base,
            questaoId: history.objective.idQuestao,
            alternativaSelecionada: "A",
            pontuacaoObtida: "2.00",
          },
        });
        await tx.resposta.create({
          data: {
            ...base,
            questaoId: history.essay.idQuestao,
            texto:
              "Evita duplicar os dados e mantém o histórico do mesmo aluno integrado.",
            pontuacaoObtida: "2.50",
            comentarioCorrecao:
              "DEMO — Boa explicação; faltou detalhar as referências por chave estrangeira.",
          },
        });
        await tx.nota.create({
          data: {
            alunoId: aluno.idAluno,
            avaliacaoId: history.row.idAvaliacao,
            tentativaId: attempt.idTentativa,
            valor: "4.50",
            dataAvaliacao: now,
          },
        });
        const live = await exam("DEMO — Prova para responder ao vivo");
        const categoria = await tx.categoria.create({
          data: { nome: "DEMO — Tecnologia" },
        });
        const livro = await tx.livro.create({
          data: {
            titulo: "DEMO — Introdução aos Bancos de Dados",
            autor: "Autor Fictício",
            categoriaId: categoria.idCategoria,
            descricao: "Obra fictícia para demonstração.",
          },
        });
        const exemplar = await tx.exemplar.create({
          data: {
            livroId: livro.idLivro,
            codigo: "DEMO-BD-001",
            situacao: "EMPRESTADO",
            localizacao: "DEMO — Estante A",
          },
        });
        const emprestimo = await tx.emprestimo.create({
          data: {
            alunoId: aluno.idAluno,
            exemplarId: exemplar.idExemplar,
            dataEmprestimo: now,
            dataPrevistaDevolucao: new Date(now.valueOf() + 7 * 86400000),
          },
        });
        const plano = await tx.planoFinanceiro.create({
          data: {
            nome: "DEMO — Plano acadêmico",
            valor: "100.50",
            periodicidade: "Mensal",
          },
        });
        const desconto = await tx.desconto.create({
          data: {
            alunoId: aluno.idAluno,
            descricao: "DEMO — Desconto de apresentação",
            tipo: "PERCENTUAL",
            percentual: "10.00",
            dataInicio: today,
            dataFim: future(365),
          },
        });
        const cobranca = await tx.cobranca.create({
          data: {
            alunoId: aluno.idAluno,
            planoId: plano.idPlano,
            descontoId: desconto.idDesconto,
            dataEmissao: today,
            dataVencimento: future(30),
            valorOriginal: "100.50",
            valorFinal: "90.45",
            descontoTipoAplicado: "PERCENTUAL",
            descontoPercentualAplicado: "10.00",
            status: "PARCIAL",
          },
        });
        await tx.pagamento.create({
          data: {
            cobrancaId: cobranca.idCobranca,
            valor: "40.20",
            dataPagamento: now,
            formaPagamento: "Dinheiro",
            comprovante: "DEMO — Registro fictício, sem movimentação real",
            chaveIdempotencia: `${marker}-pagamento-1`,
          },
        });
        const ids = {
          aluno: aluno.idAluno,
          turma: turma.idTurma,
          curso: curso.idCurso,
          matricula: matricula.idMatricula,
          avaliacaoHistorico: history.row.idAvaliacao,
          avaliacaoAoVivo: live.row.idAvaliacao,
          livro: livro.idLivro,
          exemplar: exemplar.idExemplar,
          emprestimo: emprestimo.idEmprestimo,
          cobranca: cobranca.idCobranca,
        };
        await tx.eventoAdministrativo.create({
          data: {
            acao: marker,
            entidade: "Demonstracao",
            registroId: String(aluno.idAluno),
            metadados: ids,
          },
        });
        return { criadoAgora: true, ids };
      },
      { timeout: 30000 },
    );
    const aluno = await db.aluno.findUniqueOrThrow({
      where: { matricula: "DEMO-2026-001" },
      include: {
        matriculaRegistros: true,
        notaRegistros: true,
        emprestimoRegistros: true,
        cobrancaRegistros: { include: { pagamentoRegistros: true } },
      },
    });
    assert.equal(aluno.matriculaRegistros.length, 1);
    assert.equal(aluno.notaRegistros[0].valor.toFixed(2), "4.50");
    assert.equal(aluno.emprestimoRegistros.length, 1);
    const charge = aluno.cobrancaRegistros[0];
    assert.equal(charge.valorFinal.toFixed(2), "90.45");
    const paid = charge.pagamentoRegistros
      .filter((p) => p.status === "CONFIRMADO")
      .reduce(
        (total, p) => total.add(p.valor),
        charge.valorFinal.sub(charge.valorFinal),
      );
    console.log(
      JSON.stringify(
        {
          ...result,
          verificado: true,
          aluno: aluno.nome,
          matricula: aluno.matricula,
          nota: "4.50",
          valorCobranca: "90.45",
          pago: paid.toFixed(2),
          saldo: charge.valorFinal.sub(paid).toFixed(2),
          contaCriada: false,
        },
        null,
        2,
      ),
    );
  } finally {
    await db.$disconnect();
  }
}
main().catch((error: unknown) => {
  if (error instanceof Error) {
    const diagnostic = error as Error & {
      code?: string;
      meta?: { constraint?: string };
    };
    console.error(
      "Diagnóstico:",
      diagnostic.name,
      diagnostic.code ?? "sem código",
      diagnostic.meta?.constraint ?? "",
    );
  }
  console.error(
    "Não foi possível preparar/verificar a demonstração. Confira PostgreSQL local, ambiente, root e identificadores DEMO. Nenhum dado existente é atualizado pelo script.",
  );
  process.exitCode = 1;
});
