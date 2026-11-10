# Modelagem lógica proposta para PostgreSQL

Fase 2: esquema implementado em prisma/schema.prisma e migração inicial em prisma/migrations/20261028180000_initial/migration.sql, aplicada em PostgreSQL local vazio de desenvolvimento e testes. As regras de serviço dos módulos ainda não foram implementadas. Base: relatório seções 3–9 e 12 arquivos draw.io. Decisões D01–D09 constam em ANALISE_FONTES. As 26 entidades acadêmicas permanecem presentes. Há duas tabelas de ligação obrigatórias, quatro tabelas técnicas de suporte propostas e uma extensão de tentativa sujeita a aprovação.

## Convenções

Modelo Prisma em português sem acentos, com nomes de tabelas/colunas SQL em snake_case por mapeamento. PK das entidades acadêmicas: `integer generated ... as identity`, mantendo o tipo int original; cada FK usa o mesmo tipo. Todas as tabelas têm PK, exceto que ligações usam PK composta. Campos técnicos `criadoEm` e `atualizadoEm` com horário do servidor nas tabelas mutáveis. Campos boolean `ativo` são NOT NULL com padrão true onde constam do modelo.

Nomes/títulos e identificadores obrigatórios serão NOT NULL e não vazios; descrições e contatos secundários podem ser nulos. Contatos de aluno não serão tornados únicos: irmãos ou alunos sem conta podem compartilhar e-mail. E-mail de Usuario será obrigatório e único após normalização; a conta não será inferida por igualdade de e-mail com Aluno. Descrições originais serão preservadas mesmo quando opcionais. A tabela a seguir explicita as outras nulabilidades propostas; `?` significa opcional, o restante é obrigatório. Tipos dos atributos originais estão transcritos em ANALISE_FONTES.

## Tabelas acadêmicas e ligações

| Tabela lógica | Campos principais e finalidade | FKs e restrições propostas |
| --- | --- | --- |
| Usuario | idUsuario, nome, email, senhaHash, ativo; identidade de acesso | grupoId → Grupo e papelId → Papel obrigatórios; e-mail normalizado único |
| Grupo | idGrupo, nome, descricao?, ativo; conjunto de habilitações | Nome não vazio; exclusão restrita enquanto houver usuários |
| Papel | idPapel, nome, descricao?; papel global | Nome único; catálogo root, Administrador, Usuário; alteração privilegiada |
| Modulo | idModulo, nome, descricao?, ativo, codigo técnico único | Cinco códigos estáveis; nome não determina autorização |
| GrupoModulo | grupoId, moduloId, habilitado, atualizadoEm | PK(grupoId,moduloId); duas FKs obrigatórias; histórico da mudança na auditoria |
| Turma | idTurma, nome, descricao?, ano, periodo, capacidade, ativo | Capacidade > 0; aluno aponta para turma; redução de capacidade também verifica ocupação |
| Aluno | idAluno, nome, dataNascimento?, email?, telefone?, endereco?, matricula, dataMatricula, status, ativo | turmaId obrigatório → Turma; matricula única; usuarioId? único → Usuario, se D02 aprovada |
| Responsavel | idResponsavel, nome, cpf?, telefone?, email?, parentesco?, endereco?, ativo | CPF normalizado validado e único quando informado; ao menos um contato proposto |
| AlunoResponsavel | alunoId, responsavelId, parentesco? | PK(alunoId,responsavelId), FKs obrigatórias; parentesco por vínculo depende de D06 |
| Documento | idDocumento, tipo, descricao?, nomeArquivo, dataEnvio, status, ativo | alunoId obrigatório; chaveArmazenamento única, mimeType, tamanhoBytes; arquivo privado |
| Ocorrencia | idOcorrencia, tipo, descricao, dataOcorrencia, status, ativo | alunoId e autorUsuarioId obrigatórios; sujeito acadêmico separado do autor |
| Curso | idCurso, nome, descricao?, cargaHoraria, ativo | CargaHoraria > 0; unidade em horas sujeita a D07 |
| Professor | idProfessor, nome, email, especialidade?, ativo | E-mail validado, sem presunção de conta de acesso; professor não é Usuario |
| Aula | idAula, titulo, descricao?, dataHora, duracao, ativo | cursoId e professorId obrigatórios; duração positiva em minutos; programação validada |
| Matricula | idMatricula, dataMatricula, status, ativo | alunoId e cursoId obrigatórios; índice único parcial para vínculo ativo |
| Avaliacao | idAvaliacao, titulo, descricao?, dataAplicacao, tempoLimite, tipo, ativo | TempoLimite positivo em minutos; não há FK de curso ou turma inventada no original |
| Questao | idQuestao, enunciado, tipo, pontuacao, alternativaA?, alternativaB?, alternativaC?, alternativaD?, alternativaCorreta?, ativo | avaliacaoId obrigatório; pontos > 0; objetivas exigem A–D e correta; discursivas não exigem alternativas |
| Resposta | idResposta, texto?, alternativaSelecionada?, dataResposta, ativo | alunoId e questaoId obrigatórios; tentativaId obrigatório se D03; código A–D depende de D04 |
| Nota | idNota, valor, dataAvaliacao, ativo | alunoId e avaliacaoId obrigatórios; tentativaId único se D03; valor não negativo |
| Categoria | idCategoria, nome, descricao?, ativo | Classificação bibliográfica; nome não vazio |
| Livro | idLivro, titulo, autor, editora?, anoPublicacao?, isbn?, descricao?, ativo | categoriaId obrigatório; ISBN normalizado e validado quando informado; unicidade proposta por edição |
| Exemplar | idExemplar, codigo, situacao, dataAquisicao?, localizacao?, ativo | livroId obrigatório; código único; disponível depende também da inexistência de empréstimo aberto |
| Emprestimo | idEmprestimo, dataEmprestimo, dataPrevistaDevolucao, dataDevolucao?, situacao, ativo | alunoId e exemplarId obrigatórios; datas coerentes e índice exclusivo de empréstimo aberto |
| Reserva | idReserva, dataReserva, dataExpiracao, situacao, ativo | alunoId e livroId obrigatórios; expiração posterior à reserva |
| PlanoFinanceiro | idPlano, nome, descricao?, valor, periodicidade, ativo | Valor numeric(14,2) não negativo; periodicidade descritiva validada |
| Desconto | idDesconto, descricao, tipo, percentual?, valor?, dataInicio, dataFim, ativo | alunoId obrigatório; percentual entre 0 e 100 ou valor fixo não negativo; tipos mutuamente exclusivos |
| Cobranca | idCobranca, dataVencimento, valorOriginal, valorFinal, status, dataEmissao, ativo | alunoId e planoId obrigatórios, descontoId? opcional; desconto do mesmo aluno; valores numeric(14,2) não negativos |
| Pagamento | idPagamento, dataPagamento, valor, formaPagamento, comprovante?, status, ativo | cobrancaId obrigatório; valor numeric(14,2) > 0; chave de idempotência única por cobrança; comprovante privado se houver |

Campos técnicos propostos para Cobranca: `descontoTipoAplicado?`, `descontoValorAplicado?` e `descontoPercentualAplicado?`, que preservam o cálculo histórico aprovado em D05. Para Pagamento, dados de estorno incluem motivo, ator e instante; não se apaga o lançamento. Valores monetários e percentuais trafegam como strings decimais nos DTOs.

## Cardinalidades físicas

- Grupo 1 → 0..N Usuario; Papel 1 → 0..N Usuario; ambos obrigatórios em Usuario.
- Grupo N ↔ N Modulo por GrupoModulo; ligação habilitada não concede papel.
- Turma 1 → 0..N Aluno; Aluno N ↔ N Responsavel por AlunoResponsavel.
- Aluno 1 → 0..N Documento e Ocorrencia.
- Curso 1 → 0..N Aula e Matricula; Professor 1 → 0..N Aula; Aluno 1 → 0..N Matricula.
- Avaliacao 1 → 0..N Questao e Nota; Questao 1 → 0..N Resposta; Aluno 1 → 0..N Resposta e Nota.
- Categoria 1 → 0..N Livro; Livro 1 → 0..N Exemplar e Reserva; Exemplar 1 → 0..N Emprestimo histórico; Aluno 1 → 0..N Emprestimo e Reserva.
- PlanoFinanceiro 1 → 0..N Cobranca; Aluno 1 → 0..N Cobranca e Desconto; Cobranca 1 → 0..N Pagamento; Desconto 1 → 0..N Cobranca, com 0..1 desconto por cobrança.

## Estruturas adicionais justificadas

| Estrutura | Campos propostos | Justificativa |
| --- | --- | --- |
| Sessao | id, usuarioId, tokenHash único, criadoEm, expiraEm, revogadoEm? | Logout e revogação real após troca de senha, desativação e alterações de acesso |
| TokenRedefinicaoSenha | id, usuarioId, tokenHash único, expiraEm, consumidoEm? | Recuperação segura e consumo atômico único |
| EventoAdministrativo | id, atorUsuarioId?, acao, entidade, registroId?, ocorridoEm, metadados mínimos | Auditoria e rastreabilidade; ator nulo apenas em eventos técnicos explicitamente definidos |
| LimiteAutenticacao | chaveHash, janelaInicio, contador, bloqueadoAte? | Controle persistente de abuso, com expurgo após expiração e sem e-mail/IP em claro |
| TentativaAvaliacao, sujeita a D03 | idTentativa, alunoId, avaliacaoId, numero, iniciadaEm, prazoEm, finalizadaEm?, status | Diferencia sessão da prova, gravação e envio final; não redefine o Aluno original |

Com D03: UNIQUE(alunoId,avaliacaoId,numero) e UNIQUE(tentativaId,questaoId) em Resposta; uma Nota por tentativa. Resposta preserva suas FKs aluno/questão e Nota suas FKs aluno/avaliação. FKs compostas e chaves candidatas garantirão que aluno/avaliação da resposta ou nota correspondam à tentativa e que a questão pertença à mesma avaliação; uma coluna técnica avaliacaoId em Resposta permite essa verificação sem depender só do frontend. A questão não poderá trocar de avaliação após receber respostas.

Sem D03: seria necessário UNIQUE(alunoId,questaoId) e UNIQUE(alunoId,avaliacaoId), mas isso não registra início e prazo individual nem distingue retomada de nova aplicação. Por isso a extensão é recomendada, sem assumir autorização para múltiplas tentativas.

## Índices e integridade

Índices B-tree em todas as FKs de consulta, e compostos para listagens: aluno(turmaId,status), aula(cursoId,dataHora), matricula(cursoId,status), tentativa(alunoId,avaliacaoId), emprestimo(alunoId,dataEmprestimo), reserva(livroId,situacao), cobranca(alunoId,dataVencimento,status), pagamento(cobrancaId,dataPagamento), evento(ocorridoEm). Índices únicos de e-mail normalizado, matrícula, código de exemplar, códigos de módulo e tokens. Busca textual paginada será primeiro implementada por campos normalizados; otimização com índice específico dependerá de medição.

CHECKs: capacidade/duração/pontuação positivas; valores e notas não negativos; percentual 0–100; dataFim ≥ dataInicio; devolução ≥ empréstimo; prevista ≥ empréstimo; coerência de tipo de desconto; código de resposta válido e coerente com tipo da questão nos serviços. Regras entre tabelas terão FKs compostas ou transação/trigger, conforme viabilidade no Prisma. Notas manuais não excederão a soma das pontuações e serão corrigidas com auditoria.

Proposta de índice exclusivo para empréstimos: UNIQUE(exemplarId) WHERE dataDevolucao IS NULL. Um empréstimo só é criado quando efetivamente ocorre retirada e só se encerra por devolução explícita. Alterar `ativo` isoladamente não libera o exemplar. Perda/baixa não foi definida; não simular devolução nesse caso.

Proposta para matrícula: UNIQUE(alunoId,cursoId) WHERE ativo = true AND status = 'ATIVA'. Estados admitidos, transições e predicado serão alinhados; cancelamento e conclusão preservam histórico. Os índices parciais serão entregues em migração SQL versionada e testados também por escrita direta no banco de testes.

## Transações e concorrência

1. **Turma:** bloquear linha da turma, contar ocupação e inserir/transferir aluno na mesma transação; em transferência, bloquear turmas por ID crescente. Mudanças de ativo/status e redução de capacidade usam a mesma regra. Adicionar trigger de salvaguarda para operações diretas quando a migração for implementada.
2. **Matrícula:** validar autorização e curso, criar vínculo e confiar no índice parcial para arbitrar corrida; traduzir violação em erro de negócio. Exceção de inativo exige decisão D07 e evento na mesma transação.
3. **Empréstimo:** bloquear exemplar, verificar situação, atividade e inexistência de empréstimo aberto, inserir retirada e mudar situação. Índice único é a salvaguarda concorrente. Devolução bloqueia o mesmo exemplar e empréstimo e altera ambos atomicamente, com repetição idempotente.
4. **Pagamento:** bloquear cobrança, somar pagamentos confirmados não estornados, verificar saldo com Decimal, gravar lançamento idempotente e atualizar estado na mesma transação. Estorno recalcula saldo com o mesmo bloqueio. Pendência vencida é derivada da data atual e saldo, sem depender de tarefa agendada.
5. **Desconto:** validar vigência e pertencimento ao aluno na emissão; FK composta (descontoId,alunoId) e chave candidata em Desconto impedem associação cruzada. Sem desconto, valorFinal = valorOriginal. Com desconto percentual, arredondar uma única vez segundo D09; benefício nunca torna o total negativo.
6. **Avaliação:** início/finalização e correção protegidos por bloqueio e estado; prazo baseado no servidor e no menor limite aplicável. Gravação após finalização é rejeitada. Finalização repetida retorna o mesmo resultado. Somente o servidor calcula pontos e nota.
7. **Reset de senha:** consumir token ainda válido e não usado com condição atômica, atualizar hash e revogar sessões na mesma transação.

## Exclusão, atualização e histórico

Propor ON DELETE RESTRICT e ON UPDATE RESTRICT para referências acadêmicas, financeiras e de autoria; PKs imutáveis. Inativar em vez de apagar históricos. Ligações GrupoModulo e AlunoResponsavel podem ser removidas por operação autorizada, mantendo evento; aluno, pagamentos e respostas não sofrem cascata destrutiva. Tokens e sessões expirados podem ser expurgados por manutenção com prazo documentado. Não se pressupõe retenção indefinida de dados pessoais; política de retenção e atendimento ao titular será definida antes de produção.

## Migrações e dados iniciais futuros

Após aprovação, gerar schema, revisar SQL e aplicar em banco vazio de desenvolvimento. Migrations terão FKs, índices, CHECKs e triggers necessários, com validação de rollback lógico por restauração de backup. Nunca usar reset contra banco existente sem autorização. Seed base: três papéis e cinco módulos; seed demonstrativo separado, sem root fixo ou dados pessoais reais. Testes criarão fixtures isoladas. Docker Compose disponibilizará PostgreSQL e Mailpit com volume local, credenciais externas e sem acesso público desnecessário.


## Implementação efetiva da Fase 2

33 tabelas da aplicação: 26 entidades acadêmicas, GrupoModulo, AlunoResponsavel, Sessao, TokenRedefinicaoSenha, EventoAdministrativo, LimiteAutenticacao e TentativaAvaliacao. A tabela _prisma_migrations é infraestrutura do ORM, além dessas 33. O vínculo opcional e único Aluno.usuarioId está presente, sem conta obrigatória. Parentesco original foi preservado e acrescentado na ligação. IDs inteiros utilizam identity no SQL. A senha é exclusivamente senhaHash.

Enums implementados: StatusAluno (MATRICULADO, TRANCADO, CONCLUIDO, CANCELADO), StatusMatricula (ATIVA, CONCLUIDA, CANCELADA), TipoQuestao (OBJETIVA, DISCURSIVA), Alternativa (A–D), StatusTentativa (EM_ANDAMENTO, FINALIZADA, CORRIGIDA), SituacaoExemplar (DISPONIVEL, EMPRESTADO, INDISPONIVEL), SituacaoEmprestimo (ABERTO, DEVOLVIDO), SituacaoReserva (ATIVA, ATENDIDA, CANCELADA, EXPIRADA), TipoDesconto (PERCENTUAL, FIXO), StatusCobranca (PENDENTE, PARCIAL, PAGA, CANCELADA), StatusPagamento (CONFIRMADO, ESTORNADO). Cobrança vencida será derivada de saldo e data, não é enum persistido.

A migração inclui três índices parciais (matrícula ativa, empréstimo aberto e tentativa em andamento), CHECKs financeiros/de datas/conteúdo, nomes não vazios e dois triggers de capacidade. FKs compostas impedem respostas/notas incompatíveis com a tentativa e desconto de outro aluno. Cobranca preserva snapshot financeiro. Exclusões e atualizações das referências acadêmicas usam RESTRICT. O diff do schema contra o banco aplicado foi verificado sem diferenças estruturais.

Os testes da Fase 2 verificam integridade física e concorrência de vagas. Login, política de tentativa finalizada única, prazo/eligibilidade da prova, correção manual, validade do desconto durante emissão, limite do pagamento ao saldo, sincronização da devolução com Exemplar e exceção de curso inativo ainda dependem dos serviços nas Fases 3–8. A existência das tabelas não significa que essas funcionalidades já estejam disponíveis.

A migração complementar 20261028184000_discount_snapshot_guard exige tipo aplicado em cobrança com desconto, evitando que a semântica UNKNOWN de CHECK no PostgreSQL aceite snapshot incompleto. O caso possui teste de regressão. A migração inicial aplicada foi preservada.


## Uso das estruturas na Fase 3

Sessao, TokenRedefinicaoSenha, LimiteAutenticacao e EventoAdministrativo agora são usados pelo núcleo real. Tokens de sessão/reset são aleatórios e guardados somente por hash; contadores usam chave HMAC. Alterações de contas e redefinição revogam sessões. O catálogo foi mantido e nenhuma nova migração ou entidade foi necessária. O bootstrap protege primeiro root e concorrência com bloqueio transacional; a aplicação preserva o último root ativo. Os testes de interface usam banco _test separado, nunca o banco da apresentação.


## Uso efetivo na Fase 4

Aluno, Turma, Responsavel, AlunoResponsavel, Documento e Ocorrencia estão integrados por serviços e interface. Não se alteraram schema, FKs, atributos ou cardinalidades, portanto continuam 33 tabelas e duas migrações. O diff contra o banco foi conferido sem diferenças. Os triggers existentes protegem capacidade; o serviço acrescenta transação/bloqueio e validação de turma ativa. CPF é opcional e único quando informado. Aluno.usuarioId opcional/único só é alterado por root com reautenticação.

Documento guarda metadados/chave privada; conteúdo fica em storage/private/documentos com chave aleatória. Download não usa caminho informado pelo cliente. Status do documento: RECEBIDO, VALIDADO, REJEITADO ou ARQUIVADO, validados no serviço; arquivamento inativa sem apagar o arquivo. Ocorrências: REGISTRADA, EM_ACOMPANHAMENTO, CONCLUIDA; a inativação preserva registro e autor. Parentesco por vínculo prevalece sobre o campo original opcional. O histórico usa Matricula e Nota do mesmo Aluno, filtrando habilitação por módulo.


## Uso efetivo na Fase 5

Curso, Professor, Aula e Matricula agora possuem operações reais no módulo Cursos. Aula conserva cursoId/professorId obrigatórios; Matricula conserva alunoId/cursoId e o índice parcial de vínculo ativo. Aluno é o mesmo da Fase 4. Matrícula não troca o par aluno/curso após criação; usa mudança de status/inativação para preservar história. Professor não gera conta de acesso.

Validações de carga e exceções são realizadas no serviço dentro de transação, com bloqueio de operações de Cursos e linhas de curso/aluno. O índice SQL já existente arbitra duplicidades inclusive de escritas diretas. Não houve alteração de schema ou migração; diff verificado sem diferenças. Exceções gravam justificativa no JSON de EventoAdministrativo, sem senha. Horário capturado em Brasília é convertido a timestamptz; carga do curso em horas e duração da aula em minutos.


## Uso efetivo na Fase 6

Avaliacao → Questao (1:N); Aluno/Avaliacao → TentativaAvaliacao (1:N); Tentativa/Questao → Resposta; Tentativa → Nota (0:1). As FKs compostas preservam aluno e avaliação em cada resposta/nota. Não foi criado Aluno adicional nem relacionamento avaliação/curso/turma.

Migração 20261028193000_avaliacoes_respostas: remove de Resposta o índice único triplo tentativa/aluno/avaliação, que indevidamente impediria responder várias questões. Mantém UNIQUE(tentativa,questão), índices e FKs compostas. Adiciona pontuacao_obtida DECIMAL(10,2) NULL com CHECK >= 0 e comentario_correcao TEXT NULL; não apaga dados. Continua existindo nota única por tentativa. Total: 33 tabelas, três migrações. Correspondência banco/schema verificada após aplicação.

Prazo e correção são transacionais, serializados por advisory lock 37106. Serviço impede nova tentativa, alterações de conteúdo após início, resposta de outra questão/identidade, nota negativa/acima dos pontos e correção durante realização. Estados: EM_ANDAMENTO; FINALIZADA (discursiva pendente, sem Nota); CORRIGIDA (Nota com soma decimal). Ao expirar, novos conteúdos são ignorados na finalização e respostas não salvas valem zero. Auditoria da correção registra autor e valores, sem texto sensível. Os campos e restrições técnicas estão explicados em ADR-005.


## Uso efetivo na Fase 7 — Biblioteca

Categoria, Livro, Exemplar, Emprestimo e Reserva estão ligados ao mesmo Aluno central. Cardinalidades originais preservadas: categoria/livros, livro/exemplares, exemplar/empréstimos históricos, aluno/empréstimos e livro/aluno/reservas. Sem tabela nova ou alteração de schema; permanecem 33 modelos e três migrações.

O índice parcial emprestimo_aberto_unico (WHERE data_devolucao IS NULL), as FKs e constraints de datas/situação existentes são usados pelo serviço. Transação com advisory lock 37107 e linhas de exemplar/aluno coordena retirada e mudança para EMPRESTADO; devolução muda o empréstimo e disponibiliza exemplar atomicamente. Consulta verifica atividade de toda a cadeia, estado e ausência de empréstimo aberto. Não se troca o livro de exemplar com histórico.

Situações de empréstimo: ABERTO/DEVOLVIDO; ATRASADO é calculado pela previsão e falta de devolução. Reserva: ATIVA/ATENDIDA/CANCELADA/EXPIRADA; vencimento efetivo é calculado no GET, e a situação persistida pode ser encerrada pelo gestor. Reserva válida duplicada por aluno/livro é bloqueada pelo serviço serializado; não existe índice temporal com now() nem bloqueio automático de exemplar por reserva. Detalhes em ADR-006.


## Uso efetivo na Fase 8 — Financeiro

PlanoFinanceiro 1:N Cobranca; Aluno 1:N Cobranca/Desconto; Cobranca 1:N Pagamento; Desconto 0..1 por cobrança, do mesmo aluno via FK composta. Reutiliza atributos técnicos de snapshot, chave de idempotência e estorno já migrados. Não cria novas tabelas, atributos ou migrações; 33 modelos e três migrações.

Decimal(14,2) para dinheiro; percentual Decimal(5,2). Serviço calcula descontos com Prisma.Decimal/ROUND_HALF_UP e preserva original/final/aplicação na emissão. Pagamentos confirmados ativos definem saldo e status PENDENTE/PARCIAL/PAGA. Valor final zero é PAGA sem pagamento fictício. CANCELADA preserva valores/histórico e saldo exigível zero. VENCIDA é situação derivada de data/saldo, sem novo enum ou job.

Advisory lock 37108 e bloqueio de cobrança serializam pagamentos, estornos e cancelamentos. UNIQUE(cobranca_id,chave_idempotencia) evita duplicação da mesma solicitação. Valores excedentes são recusados no serviço transacional. Estorno conserva registro e guarda autor/motivo/data, usando FKs/constraints existentes. O relatório usa agregação decimal e RepeatableRead. Ver ADR-007 para validade, datas, cancelamento e limites.


## Validação integrada na Fase 9

Registros gerados pelos serviços e APIs nos cinco módulos foram conferidos pelo mesmo Aluno.idAluno, incluindo pagamentos via sua cobrança. FKs impedem excluir o Aluno com histórico. Troca autorizada de Usuario altera somente o vínculo de acesso e mantém todos os identificadores acadêmicos; conta já usada é recusada sem alteração parcial. Cadastro sem Usuario é permitido, e o vínculo posterior passa a acessar os registros existentes.

Operações de matrícula, início de prova, retirada e emissão concorrentes para o mesmo Aluno foram verificadas; falha em um módulo não corrompe registros dos demais. Inativar Aluno não apaga histórico nem impede devolução/liquidação/conclusão válidas. Mantêm-se 33 modelos, três migrações, índices e constraints anteriores, sem diff de schema. Nenhum reset ou alteração destrutiva foi executado no banco da aplicação.


## Encerramento técnico

Versão 1.0.0 mantém 33 modelos, três migrações e cardinalidades originais. Schema/status/diff conferidos, sem reset da aplicação. Guard comum exige PostgreSQL _test distinto, incluindo aliases de loopback e porta padrão. Operação e preservação de banco/arquivos estão no GUIA_EXECUCAO.md; dados e configuração local não entram no ZIP.
