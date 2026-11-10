# Dados de apresentação preparados

Etapa 1 solicitada após o roteiro de apresentação. Dados fictícios gravados no PostgreSQL local do projeto; não há movimentação financeira real. Identificador da carga: DEMO_FACULDADE_V1.

## Encontrar os exemplos

Entre como root e atualize a página. Busque por **DEMO** nas listagens.

| Tela | Registro | O que mostrar |
| --- | --- | --- |
| Alunos | DEMO — Ana Silva, matrícula DEMO-2026-001 | Cadastro central, turma e histórico |
| Turmas | DEMO — Turma de apresentação | Capacidade de 30 e aluno associado |
| Cursos | DEMO — Banco de Dados | Matrícula ativa da Ana, professor e programação de aula |
| Avaliações | DEMO — Avaliação corrigida (histórico) | Objetiva de 2 pontos e discursiva de 3, com nota final 4,5 |
| Avaliações | DEMO — Prova para responder ao vivo | Segunda avaliação, sem tentativa iniciada, para usar após vincular uma conta ao aluno |
| Biblioteca | DEMO — Introdução aos Bancos de Dados | Exemplar DEMO-BD-001 emprestado à Ana |
| Financeiro | DEMO — Plano acadêmico | Plano de R$ 100,50, desconto de 10%, cobrança de R$ 90,45 |
| Cobrança | Cobrança da Ana, inicialmente Parcial | Pagamento fictício de R$ 40,20; saldo inicial R$ 50,25 |

A carga cria 24 registros de domínio e um evento técnico de identificação. Não cria contas, senhas, documentos nem responsáveis. O evento indica uma carga demonstrativa; respostas, correção e primeiro pagamento foram preparados pelo script, não executados por um aluno real na interface.

## Sequência simples para apresentar

1. Abra Ana Silva em Alunos e mostre que o histórico pertence a uma única identidade acadêmica.
2. Em Cursos, mostre a matrícula e a aula. Uma segunda matrícula ativa no mesmo curso deve ser recusada.
3. Em Avaliações/Resultados, mostre a nota 4,5 da avaliação de histórico.
4. Em Biblioteca/Empréstimos, localize o empréstimo da Ana e faça a devolução. Confira o exemplar disponível.
5. No Financeiro, abra a cobrança da Ana e registre **R$ 50,25**, usando data/hora válidas. A cobrança deve ficar Paga.

Devolução e pagamento alteram o estado dos exemplos. O script não desfaz essas operações; para repetir a apresentação, prepare novos registros pela interface. Datas de aula, empréstimo, vencimento e desconto foram calculadas no momento da criação; confira sua validade se apresentar em outra data.

## Próxima etapa: contas

A etapa 2 foi concluída: a conta aluno.demo@example.com foi vinculada à Ana, e admin.demo@example.com recebeu o papel Administrador. Consulte CONTAS_DEMONSTRACAO.md para testar os acessos. Sua conta root foi preservada.

## Script e verificação

`scripts/prepare-demo.ts` é uma carga opcional explícita, separada do seed padrão. Executar na pasta do projeto, com PostgreSQL local iniciado:

```powershell
npx.cmd tsx scripts/prepare-demo.ts --apply
```

Foi executado e conferido por leitura das relações, nota e valores financeiros. Uma segunda execução confirmou que não cria duplicatas. A transação inclui todos os registros ou desfaz a criação; um bloqueio coordena execuções simultâneas do mesmo script. O marcador impede recriação e não atualiza registros anteriores. Nenhuma conta existente, migração ou regra da aplicação foi alterada.

Lint do script e TypeScript aprovados. Os 191 testes anteriores não foram reexecutados nesta carga de dados; esta etapa verificou os registros criados e a repetição sem duplicação.
