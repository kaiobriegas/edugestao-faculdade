import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { Pool, type PoolClient } from "pg";
import { createDatabaseClient } from "@/lib/database-client";
import { seedCatalog } from "../../prisma/seed-catalog";

const url = process.env.TEST_DATABASE_URL;
if (!url || !/^\/[a-z][a-z0-9_]*_test$/.test(new URL(url).pathname))
  throw new Error("Teste exige banco exclusivo com sufixo _test.");
const db = createDatabaseClient(url);
const pool = new Pool({ connectionString: url, max: 6 });
afterAll(async () => {
  await db.$disconnect();
  await pool.end();
});

async function inTransaction(run: (client: PoolClient) => Promise<void>) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await run(client);
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
}

async function fixture(client: PoolClient, capacity = 20) {
  const tag = randomUUID();
  const turma = (
    await client.query(
      "INSERT INTO turma(nome, ano, periodo, capacidade, atualizado_em) VALUES ($1,2026,'MANHA',$2,now()) RETURNING id_turma",
      [tag, capacity],
    )
  ).rows[0].id_turma as number;
  const aluno = (
    await client.query(
      "INSERT INTO aluno(nome,matricula,data_matricula,turma_id,atualizado_em) VALUES ('Aluno de teste',$1,CURRENT_DATE,$2,now()) RETURNING id_aluno",
      [tag, turma],
    )
  ).rows[0].id_aluno as number;
  const curso = (
    await client.query(
      "INSERT INTO curso(nome,carga_horaria,atualizado_em) VALUES ('Curso',20,now()) RETURNING id_curso",
    )
  ).rows[0].id_curso as number;
  const avaliacao = (
    await client.query(
      "INSERT INTO avaliacao(titulo,data_aplicacao,tempo_limite,tipo,atualizado_em) VALUES ('Prova',now(),60,'REGULAR',now()) RETURNING id_avaliacao",
    )
  ).rows[0].id_avaliacao as number;
  const questao = (
    await client.query(
      "INSERT INTO questao(enunciado,tipo,pontuacao,avaliacao_id,atualizado_em) VALUES ('Explique','DISCURSIVA',10,$1,now()) RETURNING id_questao",
      [avaliacao],
    )
  ).rows[0].id_questao as number;
  const tentativa = (
    await client.query(
      "INSERT INTO tentativa_avaliacao(aluno_id,avaliacao_id,prazo_em,atualizado_em) VALUES ($1,$2,now()+interval '1 hour',now()) RETURNING id_tentativa",
      [aluno, avaliacao],
    )
  ).rows[0].id_tentativa as number;
  const categoria = (
    await client.query(
      "INSERT INTO categoria(nome,atualizado_em) VALUES ('Literatura',now()) RETURNING id_categoria",
    )
  ).rows[0].id_categoria as number;
  const livro = (
    await client.query(
      "INSERT INTO livro(titulo,autor,categoria_id,atualizado_em) VALUES ('Livro','Autor',$1,now()) RETURNING id_livro",
      [categoria],
    )
  ).rows[0].id_livro as number;
  const exemplar = (
    await client.query(
      "INSERT INTO exemplar(codigo,livro_id,atualizado_em) VALUES ($1,$2,now()) RETURNING id_exemplar",
      [tag, livro],
    )
  ).rows[0].id_exemplar as number;
  const plano = (
    await client.query(
      "INSERT INTO plano_financeiro(nome,valor,periodicidade,atualizado_em) VALUES ('Plano',100,'MENSAL',now()) RETURNING id_plano",
    )
  ).rows[0].id_plano as number;
  return {
    tag,
    turma,
    aluno,
    curso,
    avaliacao,
    questao,
    tentativa,
    categoria,
    livro,
    exemplar,
    plano,
  };
}
async function insertLoan(
  client: PoolClient,
  aluno: number,
  exemplar: number,
  active = true,
) {
  return client.query(
    "INSERT INTO emprestimo(aluno_id,exemplar_id,data_prevista_devolucao,ativo,atualizado_em) VALUES ($1,$2,now()+interval '7 days',$3,now()) RETURNING id_emprestimo",
    [aluno, exemplar, active],
  );
}

describe("migração e integridade PostgreSQL", () => {
  it("aplica catálogo idempotente sem criar conta padrão", async () => {
    await seedCatalog(db);
    await seedCatalog(db);
    expect(await db.papel.count()).toBe(3);
    expect(await db.modulo.count()).toBe(5);
    expect(await db.usuario.count()).toBe(0);
    const result = await pool.query(
      "SELECT count(*)::int AS total FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' AND table_name <> '_prisma_migrations'",
    );
    expect(result.rows[0].total).toBe(33);
  });

  it("compartilha a mesma identidade de aluno nos cinco módulos", async () =>
    inTransaction(async (c) => {
      const f = await fixture(c);
      await c.query(
        "INSERT INTO matricula(aluno_id,curso_id,data_matricula,atualizado_em) VALUES ($1,$2,CURRENT_DATE,now())",
        [f.aluno, f.curso],
      );
      await c.query(
        "INSERT INTO resposta(aluno_id,questao_id,avaliacao_id,tentativa_id,texto,atualizado_em) VALUES ($1,$2,$3,$4,'Resposta de teste',now())",
        [f.aluno, f.questao, f.avaliacao, f.tentativa],
      );
      await insertLoan(c, f.aluno, f.exemplar);
      await c.query(
        "INSERT INTO cobranca(aluno_id,plano_id,data_vencimento,data_emissao,valor_original,valor_final,atualizado_em) VALUES ($1,$2,CURRENT_DATE,CURRENT_DATE,100,100,now())",
        [f.aluno, f.plano],
      );
      const result = await c.query(
        "SELECT a.id_aluno FROM aluno a JOIN matricula m ON m.aluno_id=a.id_aluno JOIN resposta r ON r.aluno_id=a.id_aluno JOIN emprestimo e ON e.aluno_id=a.id_aluno JOIN cobranca c ON c.aluno_id=a.id_aluno WHERE a.id_aluno=$1",
        [f.aluno],
      );
      expect(result.rows).toEqual([{ id_aluno: f.aluno }]);
    }));

  it("impede matrícula ativa duplicada, preservando vínculos encerrados", async () =>
    inTransaction(async (c) => {
      const f = await fixture(c);
      for (let i = 0; i < 2; i++)
        await c.query(
          "INSERT INTO matricula(aluno_id,curso_id,data_matricula,status,atualizado_em) VALUES ($1,$2,CURRENT_DATE,'CANCELADA',now())",
          [f.aluno, f.curso],
        );
      const sql =
        "INSERT INTO matricula(aluno_id,curso_id,data_matricula,atualizado_em) VALUES ($1,$2,CURRENT_DATE,now())";
      await c.query(sql, [f.aluno, f.curso]);
      await expect(c.query(sql, [f.aluno, f.curso])).rejects.toMatchObject({
        code: "23505",
      });
    }));

  it("impede segundo empréstimo aberto mesmo quando o primeiro foi inativado", async () =>
    inTransaction(async (c) => {
      const f = await fixture(c);
      await insertLoan(c, f.aluno, f.exemplar, false);
      await expect(insertLoan(c, f.aluno, f.exemplar)).rejects.toMatchObject({
        code: "23505",
      });
    }));

  it("permite novo empréstimo depois da devolução e conserva histórico", async () =>
    inTransaction(async (c) => {
      const f = await fixture(c);
      const first = await insertLoan(c, f.aluno, f.exemplar);
      await c.query(
        "UPDATE emprestimo SET data_devolucao=now(),situacao='DEVOLVIDO' WHERE id_emprestimo=$1",
        [first.rows[0].id_emprestimo],
      );
      await insertLoan(c, f.aluno, f.exemplar);
      expect(
        (
          await c.query(
            "SELECT count(*)::int AS total FROM emprestimo WHERE exemplar_id=$1",
            [f.exemplar],
          )
        ).rows[0].total,
      ).toBe(2);
    }));

  it("rejeita referência de aluno inexistente", async () =>
    inTransaction(async (c) => {
      const f = await fixture(c);
      await expect(
        c.query(
          "INSERT INTO matricula(aluno_id,curso_id,data_matricula,atualizado_em) VALUES (-1,$1,CURRENT_DATE,now())",
          [f.curso],
        ),
      ).rejects.toMatchObject({ code: "23503" });
    }));

  it("impede resposta com questão de outra avaliação", async () =>
    inTransaction(async (c) => {
      const f = await fixture(c);
      const other = (
        await c.query(
          "INSERT INTO avaliacao(titulo,data_aplicacao,tempo_limite,tipo,atualizado_em) VALUES ('Outra',now(),60,'REGULAR',now()) RETURNING id_avaliacao",
        )
      ).rows[0].id_avaliacao;
      await expect(
        c.query(
          "INSERT INTO resposta(aluno_id,questao_id,avaliacao_id,tentativa_id,texto,atualizado_em) VALUES ($1,$2,$3,$4,'Texto',now())",
          [f.aluno, f.questao, other, f.tentativa],
        ),
      ).rejects.toMatchObject({ code: "23503" });
    }));

  it("impede nota atribuída ao aluno diferente da tentativa", async () =>
    inTransaction(async (c) => {
      const f = await fixture(c);
      const other = (
        await c.query(
          "INSERT INTO aluno(nome,matricula,data_matricula,turma_id,atualizado_em) VALUES ('Outro',$1,CURRENT_DATE,$2,now()) RETURNING id_aluno",
          [randomUUID(), f.turma],
        )
      ).rows[0].id_aluno;
      await expect(
        c.query(
          "INSERT INTO nota(aluno_id,avaliacao_id,tentativa_id,valor,data_avaliacao,atualizado_em) VALUES ($1,$2,$3,5,now(),now())",
          [other, f.avaliacao, f.tentativa],
        ),
      ).rejects.toMatchObject({ code: "23503" });
    }));

  it("não aplica desconto pertencente a outro aluno", async () =>
    inTransaction(async (c) => {
      const f = await fixture(c);
      const other = (
        await c.query(
          "INSERT INTO aluno(nome,matricula,data_matricula,turma_id,atualizado_em) VALUES ('Outro',$1,CURRENT_DATE,$2,now()) RETURNING id_aluno",
          [randomUUID(), f.turma],
        )
      ).rows[0].id_aluno;
      const discount = (
        await c.query(
          "INSERT INTO desconto(aluno_id,descricao,tipo,valor,data_inicio,data_fim,atualizado_em) VALUES ($1,'Bolsa','FIXO',10,CURRENT_DATE,CURRENT_DATE,now()) RETURNING id_desconto",
          [other],
        )
      ).rows[0].id_desconto;
      await expect(
        c.query(
          "INSERT INTO cobranca(aluno_id,plano_id,desconto_id,desconto_tipo_aplicado,desconto_valor_aplicado,data_vencimento,data_emissao,valor_original,valor_final,atualizado_em) VALUES ($1,$2,$3,'FIXO',10,CURRENT_DATE,CURRENT_DATE,100,90,now())",
          [f.aluno, f.plano, discount],
        ),
      ).rejects.toMatchObject({ code: "23503" });
    }));

  it("rejeita snapshot de desconto sem tipo aplicado", async () =>
    inTransaction(async (c) => {
      const f = await fixture(c);
      const discount = (
        await c.query(
          "INSERT INTO desconto(aluno_id,descricao,tipo,percentual,data_inicio,data_fim,atualizado_em) VALUES ($1,'Benefício','PERCENTUAL',10,CURRENT_DATE,CURRENT_DATE,now()) RETURNING id_desconto",
          [f.aluno],
        )
      ).rows[0].id_desconto;
      await expect(
        c.query(
          "INSERT INTO cobranca(aluno_id,plano_id,desconto_id,desconto_percentual_aplicado,data_vencimento,data_emissao,valor_original,valor_final,atualizado_em) VALUES ($1,$2,$3,10,CURRENT_DATE,CURRENT_DATE,100,90,now())",
          [f.aluno, f.plano, discount],
        ),
      ).rejects.toMatchObject({ code: "23514" });
    }));

  it("mantém centavos exatos no banco e rejeita valor negativo", async () =>
    inTransaction(async (c) => {
      expect(
        (
          await c.query(
            "SELECT (0.10::numeric(14,2)+0.20::numeric(14,2))::text AS total",
          )
        ).rows[0].total,
      ).toBe("0.30");
      await expect(
        c.query(
          "INSERT INTO plano_financeiro(nome,valor,periodicidade,atualizado_em) VALUES ('Inválido',-1,'MENSAL',now())",
        ),
      ).rejects.toMatchObject({ code: "23514" });
    }));

  it("mantém os vínculos N:N de responsáveis", async () =>
    inTransaction(async (c) => {
      const f = await fixture(c);
      const responsible = (
        await c.query(
          "INSERT INTO responsavel(nome,email,atualizado_em) VALUES ('Responsável','teste@example.test',now()) RETURNING id_responsavel",
        )
      ).rows[0].id_responsavel;
      const other = (
        await c.query(
          "INSERT INTO aluno(nome,matricula,data_matricula,turma_id,atualizado_em) VALUES ('Outro',$1,CURRENT_DATE,$2,now()) RETURNING id_aluno",
          [randomUUID(), f.turma],
        )
      ).rows[0].id_aluno;
      for (const aluno of [f.aluno, other])
        await c.query(
          "INSERT INTO aluno_responsavel(aluno_id,responsavel_id,parentesco) VALUES ($1,$2,'Responsável')",
          [aluno, responsible],
        );
      expect(
        (
          await c.query(
            "SELECT count(*)::int AS total FROM aluno_responsavel WHERE responsavel_id=$1",
            [responsible],
          )
        ).rows[0].total,
      ).toBe(2);
    }));

  it("impede redução de turma abaixo da ocupação", async () =>
    inTransaction(async (c) => {
      const f = await fixture(c);
      await c.query(
        "INSERT INTO aluno(nome,matricula,data_matricula,turma_id,atualizado_em) VALUES ('Outro',$1,CURRENT_DATE,$2,now())",
        [randomUUID(), f.turma],
      );
      await expect(
        c.query("UPDATE turma SET capacidade=1 WHERE id_turma=$1", [f.turma]),
      ).rejects.toMatchObject({ code: "23514" });
    }));

  it("serializa cadastros concorrentes na última vaga da turma", async () => {
    const turma = await db.turma.create({
      data: { nome: randomUUID(), ano: 2026, periodo: "MANHA", capacidade: 1 },
    });
    const a = await pool.connect();
    const b = await pool.connect();
    try {
      await a.query("BEGIN");
      await b.query("BEGIN");
      const sql =
        "INSERT INTO aluno(nome,matricula,data_matricula,turma_id,atualizado_em) VALUES ('Concorrente',$1,CURRENT_DATE,$2,now())";
      await a.query(sql, [randomUUID(), turma.idTurma]);
      const competing = b.query(sql, [randomUUID(), turma.idTurma]).then(
        () => "accepted",
        (error: { code: string }) => error.code,
      );
      await a.query("COMMIT");
      expect(await competing).toBe("23514");
      await b.query("ROLLBACK");
      expect(await db.aluno.count({ where: { turmaId: turma.idTurma } })).toBe(
        1,
      );
    } finally {
      await a.query("ROLLBACK");
      await b.query("ROLLBACK");
      a.release();
      b.release();
      await db.aluno.deleteMany({ where: { turmaId: turma.idTurma } });
      await db.turma.delete({ where: { idTurma: turma.idTurma } });
    }
  });
});
