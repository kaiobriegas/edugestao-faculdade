# EduGestão — consulta rápida para ensaiar

## Abertura

“O EduGestão integra alunos, cursos, avaliações, biblioteca e financeiro. O cadastro de aluno é compartilhado e as operações usam PostgreSQL real, com controle de acesso no servidor.”

## Ordem das telas

Login → Dashboard → Aluno/Turma → Curso/Matrícula → Avaliação/Resultado → Biblioteca/Devolução → Cobrança/Pagamentos → Histórico do aluno → Schema.

## Números e exemplos

- 5 módulos; 3 papéis: root, Administrador e Usuário.
- 26 entidades acadêmicas distintas; 33 modelos implementados; 3 migrações.
- 191 testes aprovados na fase 10: 36 unitários + 119 integração + 36 interface.
- Prova: 2 + 2,5 = **4,5 de 5 pontos** após correção da discursiva.
- Financeiro: R$ 100,50 − 10% = **R$ 90,45**.
- Pagamentos: R$ 40,20 + R$ 50,25 = **R$ 90,45**.

## Banco em cinco frases

1. PK identifica um registro; FK referencia outro.
2. Turma–Aluno é 1:N; Aluno–Responsavel e Grupo–Modulo são N:N com tabelas associativas.
3. Matricula relaciona aluno e curso e guarda data/status.
4. Transação confirma todas as alterações de uma operação ou desfaz o conjunto.
5. O mesmo Aluno é referenciado nos cinco módulos; Usuario é a conta de acesso.

## Regras para lembrar

Sem matrícula ativa duplicada. Um empréstimo aberto por exemplar. Pagamento não excede saldo. Gabarito protegido durante a prova. Usuário consulta os próprios registros. Root gerencia habilitações; Administrador não se promove.

## Execução

Na pasta `C:\Trabalho_Banco_de_Dados`, abrir `INICIAR_PROJETO.cmd`. Login: http://localhost:3000/login. Se não houver root: `npm.cmd run bootstrap:root`. Usar conta do aluno em janela anônima. Preparar dados inventados antes; a prova demonstrada precisa de tentativa ainda não usada.

## Fechamento

“A modelagem virou um sistema funcional com relações consistentes, histórico e permissões. As limitações atuais e as possibilidades de evolução estão documentadas.”

Material para ensaio. Consulte APRESENTACAO_FACULDADE.md para o roteiro completo e DEFESA_TECNICA.md para as perguntas.
