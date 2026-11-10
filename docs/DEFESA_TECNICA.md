# EduGestão — explicação técnica e perguntas do professor

Material de apoio da fase 11. Base: schema Prisma, rotas e documentação final da versão 1.0.0. Leia para compreender o projeto; use respostas com suas próprias palavras.

## Explicação do banco em linguagem simples

Uma entidade representa algo que precisamos registrar, como Aluno ou Livro. Uma tabela guarda seus registros. A chave primária identifica cada registro, e a chave estrangeira aponta para um registro de outra tabela. Assim, uma matrícula guarda a referência ao aluno e ao curso, sem copiar todo o cadastro dos dois.

O modelo implementado tem 33 modelos: 26 entidades acadêmicas distintas, duas tabelas associativas, quatro tabelas de suporte ao acesso/auditoria e uma tabela de tentativa de avaliação. Há três migrações versionadas. A entidade Aluno aparece em vários diagramas acadêmicos, mas corresponde a uma única tabela compartilhada.

| Parte | Entidades acadêmicas | Relação principal |
| --- | --- | --- |
| Núcleo | Usuario, Grupo, Papel, Modulo | Usuario pertence a um Grupo e tem um Papel; Grupo e Modulo usam GrupoModulo |
| Alunos | Aluno, Turma, Responsavel, Documento, Ocorrencia | Turma tem vários alunos; Aluno e Responsavel usam AlunoResponsavel |
| Cursos | Curso, Aula, Professor, Matricula | Aula aponta para Curso e Professor; Matricula aponta para Aluno e Curso |
| Avaliações | Avaliacao, Questao, Resposta, Nota | Avaliação tem questões; resposta e nota referenciam o Aluno compartilhado |
| Biblioteca | Categoria, Livro, Exemplar, Emprestimo, Reserva | Livro tem exemplares; empréstimo aponta para exemplar e reserva aponta para livro |
| Financeiro | PlanoFinanceiro, Cobranca, Pagamento, Desconto | Cobrança aponta para aluno e plano, com desconto opcional; pagamento aponta para cobrança |

Aluno, usado nas cinco áreas acadêmicas, foi contado uma única vez. As quatro estruturas de suporte são Sessao, TokenRedefinicaoSenha, EventoAdministrativo e LimiteAutenticacao. TentativaAvaliacao registra início, prazo e finalização da prova, preservando as referências acadêmicas de Resposta e Nota.

## Cardinalidades que vale saber explicar

- **1:N — Turma e Aluno:** uma turma pode conter vários alunos; cada aluno pertence a uma turma no modelo atual.
- **N:N — Aluno e Responsavel:** um aluno pode ter vários responsáveis e um responsável pode acompanhar vários alunos. AlunoResponsavel representa os pares.
- **N:N — Grupo e Modulo:** vários grupos podem habilitar o mesmo módulo e um grupo pode habilitar vários módulos. GrupoModulo registra essa escolha.
- **Associação com dados próprios — Matricula:** além de unir aluno e curso, registra data e situação. Um novo vínculo deve respeitar a regra contra matrículas ativas duplicadas.
- **Histórico — Exemplar e Emprestimo:** um exemplar tem vários empréstimos ao longo do tempo, com apenas um aberto simultaneamente.
- **Vínculo opcional — Aluno e Usuario:** aluno pode não ter conta. Quando vinculado, a conta não pode pertencer simultaneamente a outro aluno.

## Arquitetura em uma fala

“Frontend e backend ficam no mesmo projeto Next.js com TypeScript. As páginas e componentes apresentam os dados. As rotas recebem as solicitações, e os serviços validam permissões e regras de negócio. Prisma acessa o PostgreSQL. O banco também possui restrições, para não depender exclusivamente da interface.”

Para localizar exemplos: `src/app` contém páginas e rotas; `src/modules` organiza módulos; `src/lib` contém recursos compartilhados; `prisma/schema.prisma` define os modelos e `prisma/migrations` guarda o SQL versionado. `tests` reúne a verificação automatizada. Confira o exemplo escolhido antes da apresentação.

## Perguntas e respostas

**1. Por que separar Usuario de Aluno?**

Usuario representa quem entra no sistema. Aluno representa a pessoa no cadastro acadêmico. É possível cadastrar um aluno sem criar uma conta, e um root pode administrar sem ser aluno. O vínculo é explícito, não inferido pelo e-mail.

**2. Por que não criar uma tabela Aluno para cada módulo?**

Isso duplicaria identidade e permitiria cadastros divergentes. As tabelas de matrícula, avaliação, biblioteca e financeiro referenciam o mesmo aluno por chave estrangeira.

**3. Qual a diferença entre grupo e papel?**

Papel determina o nível de atuação: root, Administrador ou Usuário. Grupo define os módulos habilitados. Também se verifica o dono do registro: habilitar Financeiro não permite que um aluno veja a cobrança do colega.

**4. Esconder um botão já protege a operação?**

Não. A autorização é feita no servidor em cada operação protegida. Conhecer a URL ou modificar um identificador não concede acesso.

**5. Como a senha é armazenada?**

Como hash Argon2id, sem senha em texto puro. A sessão usa um token e cookie protegido. Redefinição tem token com prazo e consumo único; trocar senha revoga sessões conforme a implementação.

**6. Por que uma tabela associativa?**

Para representar N:N em tabelas relacionais. Cada linha registra um par de referências. A chave composta evita repetir o mesmo par.

**7. Por que Matricula tem sua própria tabela?**

O relacionamento aluno–curso possui informações próprias, como data e status. A tabela também permite preservar o histórico sem colocar listas dentro de uma coluna de Aluno.

**8. Como impedir dois empréstimos simultâneos do mesmo exemplar?**

A operação usa transação e bloqueio do exemplar. O banco possui índice único parcial para empréstimo aberto. Se duas solicitações concorrerem, ambas não podem confirmar a mesma disponibilidade.

**9. O que é transação?**

Um conjunto de alterações que confirma por inteiro ou é desfeito. Na devolução, encerrar o empréstimo e atualizar o exemplar precisam acontecer juntos.

**10. Por que usar Decimal no dinheiro?**

Para representar valores decimais com precisão definida. O financeiro utiliza numeric/Decimal com duas casas nos valores monetários, evitando o uso de ponto flutuante comum nesses cálculos.

**11. Como o pagamento parcial funciona?**

O servidor calcula o saldo pelos pagamentos confirmados e não estornados. Recusa valor acima do saldo e protege a cobrança durante a gravação. Uma chave de idempotência evita duplicar o mesmo envio.

**12. Alterar um plano muda cobranças antigas?**

Não. A cobrança guarda os valores e o desconto aplicados na emissão. Esse registro preserva o histórico do cálculo.

**13. Por que não apagar pagamentos ou empréstimos antigos?**

Porque sustentam o histórico. Pagamentos podem ser estornados com justificativa e auditoria. Referências importantes usam exclusão restrita para evitar registros sem origem.

**14. Como a avaliação funciona?**

Questões pertencem a uma avaliação. Uma tentativa registra a realização pelo aluno, início, prazo e finalização. Objetivas têm correção automática; discursivas podem exigir correção manual. A nota é calculada pelo servidor, e o gabarito não é entregue ao aluno durante a realização.

**15. A tentativa alterou o modelo acadêmico?**

Foi uma extensão técnica documentada para registrar o processo da prova. Resposta continua ligada ao aluno e à questão; Nota continua ligada ao aluno e à avaliação. A versão atual permite uma tentativa por aluno/avaliação.

**16. Qual a diferença entre validação e restrição no banco?**

A validação da aplicação fornece mensagens e verifica regras contextuais. As restrições do banco protegem a integridade dos dados, como referências existentes e unicidade. As duas camadas se complementam.

**17. Para que servem índices e migrações?**

Índices ajudam consultas e alguns garantem unicidade. Migrações registram alterações da estrutura em arquivos versionados, permitindo preparar o banco de maneira reproduzível.

**18. Como foi testado?**

A fase 10 registrou 36 testes unitários, 119 de integração com PostgreSQL e 36 de interface, total de 191. Também foram aprovados lint, TypeScript e build. Uma cópia limpa passou pela instalação e por verificações de execução local. Os testes usam banco separado.

**19. O projeto já está pronto para uma instituição real?**

Foi entregue como sistema acadêmico local. Implantação de produção, capacidade, processos de operação e requisitos jurídicos exigem avaliação própria. Docker Compose foi fornecido, mas a execução verificada utilizou serviços nativos nesta máquina.

**20. Quais são os limites atuais?**

Pagamentos são registros internos, sem gateway. Cobranças são emitidas manualmente. Há uma tentativa por avaliação/aluno; reservas não têm fila automática. Não houve publicação nem teste de carga. Essas escolhas estão documentadas.

## Conferir antes de responder

Não diga que foi utilizado Auth.js: a autenticação entregue utiliza implementação própria documentada. Não diga que o banco é simulado, que Docker foi testado ou que há processamento bancário real. Sobre algo que não estudou, abra o arquivo correspondente e explique o que consegue verificar, sem inventar.
