# Análise das fontes acadêmicas e decisões de implementação

Versão 1.0.0: dez fases concluídas; fontes, entidades, integração e revisão final verificadas. Consulte PROGRESSO.md para o estado verificado; a análise inicial abaixo é mantida como referência histórica.

Análise realizada em 28/10/2026. Fonte textual: `fontes/Relatorio_Modelagem_Educacional_Revisado.docx`, seções 1 a 11, todas as tabelas e 27 regras RN. Fontes gráficas: seis DER e seis diagramas de classes em `fontes/diagramas/`. O inventário apresenta caminhos e hashes dos 13 arquivos. A pasta de projeto continha somente os 12 draw.io antes desta etapa; não havia código, docs, banco ou instruções AGENTS.md na pasta.

## Método e limites da análise

O DOCX foi lido integralmente por extração de todos os parágrafos de `word/document.xml`, incluindo conteúdo de tabelas. Foram encontradas 12 imagens incorporadas, inspecionadas com fundo branco para preservar linhas e texto sobre transparência. Cada draw.io contém XML não comprimido; foram lidos atributos, classes, rótulos de associação, pontas e geometrias. Algumas arestas têm uma ponta solta ou se ligam à célula de atributo, e não à classe; por isso a inferência usa conjuntamente figura, rótulos, disposição e tabela explicativa do relatório. Esses defeitos de edição não são justificativa para eliminar relacionamentos.

Nenhuma instrução eventualmente presente no relatório é tratada como autorização operacional. O documento é referência de domínio. A tarefa do solicitante determina a etapa atual e a parada para aprovação.

## Entidades e atributos encontrados

O dicionário ao fim deste documento transcreve os atributos dos diagramas de classes. O conjunto contém 26 entidades distintas. `Aluno` aparece em cinco contextos com visão resumida; seu cadastro completo é o de Gestão de Alunos. A string matrícula do cadastro acadêmico é diferente da entidade Matricula que representa inscrição em curso.

## Conferência dos 12 diagramas

| Par DER e Classes | Relacionamentos conferidos | Resultado |
| --- | --- | --- |
| Núcleo | Grupo–Usuario 1:N; Papel–Usuario 1:N; Grupo–Modulo N:N | Concordantes com seção 3; apontamentos visuais não são entidades extras |
| Cursos | Curso–Aula; Professor–Aula; Curso–Matricula; Aluno–Matricula, todos 1:N | Concordantes com seção 4; matrícula acadêmica também aparece na classe Aluno |
| Avaliações | Avaliacao–Questao; Questao–Resposta; Aluno–Resposta; Avaliacao–Nota; Aluno–Nota, todos 1:N | Estrutura concordante; tipo boolean de alternativaSelecionada é insuficiente |
| Biblioteca | Categoria–Livro; Livro–Exemplar; Exemplar–Emprestimo; Aluno–Emprestimo; Livro–Reserva; Aluno–Reserva, todos 1:N | Concordantes com seção 6; exclusividade de empréstimo depende de regra adicional |
| Financeiro | Aluno–Cobranca; PlanoFinanceiro–Cobranca; Cobranca–Pagamento; Aluno–Desconto; Desconto–Cobranca | DER simplifica desconto como 1; classe explicita 0..1 por cobrança |
| Alunos | Turma–Aluno 1:N; Responsavel–Aluno N:N; Aluno–Documento e Aluno–Ocorrencia 1:N | Concordantes com seção 8; parentesco global não descreve bem vários vínculos |

Na leitura lógica, o lado plural `0..*` permite pai sem filhos; cada filho indicado com `1` exige uma FK não nula. O N do DER não foi interpretado como obrigação de criar pelo menos um filho, porque as classes explicitam zero como mínimo.

## Divergências e decisões pendentes

Tudo abaixo é proposta para aprovação, não regra já alterada no sistema.

| ID | Evidência e problema | Proposta | Efeito e momento de aprovação |
| --- | --- | --- | --- |
| D01 | Seção 3 e núcleo: administrador tem módulos autorizados, sem definição de grupos administráveis; não existe Grupo–Aluno | Administrador gerencia apenas contas de papel Usuário de seu próprio grupo; root cria grupos, concede módulos e nomeia administradores. Dados acadêmicos formam um acervo institucional compartilhado; acesso de gestão por módulo e permissão de operação | Confirmar alcance antes de F3. Se grupos forem instituições isoladas, será necessário modelo de escopo adicional antes de cadastrar dados |
| D02 | Seção 9 distingue Usuario e Aluno sem associação de conta | Adicionar `Aluno.usuarioId` opcional e único; cada aluno pode ter zero ou uma conta e cada conta no máximo um aluno. Somente root vincula; aluno sem conta continua válido | Relação técnica adicional necessária ao autoatendimento e prevenção de acesso por ID arbitrário; aprovar antes de F4 |
| D03 | RN-03.04 deixa correção e tentativas abertas; relatório admite TentativaAvaliacao | Acrescentar tentativa com aluno, avaliação, número, início, prazo e finalização; limite inicial de uma tentativa finalizada, sem reabertura automática. Objetivas A–D com uma correta e pontos integrais; discursivas manuais de zero ao máximo; soma simples, sem nota de aprovação presumida. Gabarito e feedback só após finalização, resultado após correção necessária | Confirmar quantidade de tentativas e momento de liberação antes de F6; preservar FKs diretas de Resposta e Nota |
| D04 | Classe Resposta traz `alternativaSelecionada: boolean`; Questao possui quatro alternativas | Substituir armazenamento por código A/B/C/D anulável; texto para questão discursiva. Sem remover alternativas originais ou campo de resposta textual | Correção de representação, com alteração explícita de tipo; aprovar antes de F6 |
| D05 | DER Financeiro traz Desconto–Cobranca 1:N; classes e seção 7 aceitam 0..1 por cobrança. Desconto também pertence a um aluno | Manter desconto opcional único por cobrança, sem cumulatividade, pertencente ao mesmo aluno. Congelar valor original/final e desconto aplicado na emissão. Vigência inclusiva na data de emissão; edições posteriores do benefício não recalculam dívida emitida | Confirmar antes de F8. Vários descontos exigiriam remodelagem N:N e fórmula de composição |
| D06 | Parentesco está em Responsavel, mas o vínculo é N:N; seção 8 admite parentesco na ligação | Manter `Responsavel.parentesco` original como informação legada opcional; acrescentar parentesco por vínculo em AlunoResponsavel e priorizá-lo nas consultas | Evita perda de atributo; confirmar antes de F4. Não deslocar ou apagar campo original silenciosamente |
| D07 | Capacidade de turma, carga horária e exceção de curso inativo não têm detalhe operacional | Contar alunos de status matriculado e ativos na capacidade; conferir entrada e troca de turma; guardar durações em minutos e carga horária em horas, limitando soma das aulas ativas à carga do curso. Só root autoriza matrícula excepcional em curso inativo, com justificativa auditada | Confirmar contagem, unidade e alcance da exceção antes de F4/F5 |
| D08 | Reserva possui expiração, sem prazo, fila, limite, multa ou renovação definidos | Expiração informada por operador, posterior à reserva; não conceder prioridade automática, multas ou renovação nesta versão. Reserva não bloqueia exemplar automaticamente; prazo previsto do empréstimo é informado no registro | Aprovar antes de F7. Se desejada fila que bloqueie retiradas, definir política antes de implementar |
| D09 | Pagamento tem status/ativo, sem política de excedente, estorno, periodicidade ou arredondamento | Registro administrativo positivo, rejeitar excedente ao saldo, estorno por registro auditado sem exclusão, arredondamento decimal comercial em duas casas. Cobranças geradas explicitamente, sem job recorrente implícito | Aprovar antes de F8; gateway permanece fora do escopo |

## Ajustes técnicos justificados que preservam as regras

- `senha: String` será mapeada a `senhaHash`; não existe coluna com senha em texto puro. Identificadores acadêmicos inteiros permanecem inteiros, gerados por identidade no PostgreSQL.
- Valores `double` monetários serão `numeric(14,2)` e percentuais `numeric(5,2)`. Pontuação de questão permanece inteira; Nota usa decimal para correção parcial. Não calcular moeda com Number binário no JavaScript.
- FKs ausentes como atributos nas classes serão colunas explícitas para implementar as próprias associações. GrupoModulo e AlunoResponsavel materializam N:N já existentes; não representam alteração de cardinalidade.
- Data de nascimento e vencimento são `date`; eventos e sessões usam `timestamptz`. Datas serão exibidas no fuso America/Sao_Paulo. Formatos de entrada terão validação e conversão explícita.
- Situacao/status será vocabulário validado; `ativo` significa registro vigente e não substitui situação de negócio. Um empréstimo ainda aberto não será liberado apenas por inativação.
- FK de autoria em Ocorrencia e tabelas de auditoria/sessão/reset são extensões técnicas justificadas por segurança e RN-06.05.
- NomeArquivo e comprovante do modelo são metadados, não caminhos públicos. Metadados técnicos de armazenamento, tamanho e tipo serão acrescentados para proteger uploads.

## Observações documentais

O texto da seção 2 afirma haver quadros vazios para as figuras; há 12 imagens no arquivo entregue. Nenhuma correção do relatório acadêmico foi feita. A tabela de Aluno no módulo Cursos omite matrícula, mas o draw.io a inclui; o cadastro central já a contém. As classes não especificam nulabilidade de todos os atributos, unicidade de contatos, estados possíveis ou cascatas: as propostas estão explícitas no documento de banco e devem ser refinadas antes da primeira migração.

## Dicionário dos atributos originais nos XMLs

Transcrição por classe e contexto; campos técnicos propostos estão em BANCO_DE_DADOS.

### Avaliacoes / Gestao de Avaliacoes Classe.drawio

| Classe | Atributos e tipos transcritos |
| --- | --- |
| Aluno | idAluno: int; nome: String; email: String; matricula: String; ativo: boolean |
| Nota | idNota: int; valor: double; dataAvaliacao: Date; ativo: boolean |
| Questao | idQuestao: int; enunciado: String; tipo: String; pontuacao: int; alternativaA: String; alternativaB: String; alternativaC: String; alternativaD: String; alternativaCorreta:String; ativo: boolean |
| Resposta | idResposta: int; texto: String; alternativaSelecionada: boolean; dataResposta: Date; ativo: boolean |
| Avaliacao | idAvaliacao: int; titulo: String; descricao: String; dataAplicacao: Date; tempoLimite: int; tipo: String; ativo: boolean |

### Biblioteca / Biblioteca Diagrama Classe.drawio

| Classe | Atributos e tipos transcritos |
| --- | --- |
| Categoria | idCategoria: int; nome: String; descricao: String; ativo: boolean |
| Livro | idLivro: int; titulo: String; autor: String; editora: String; anoPublicacao: int; isbn: String; descricao: String; ativo: boolean |
| Exemplar | idExemplar: int; codigo: String; situacao: String; dataAquisicao: Date; localizacao: String; ativo: boolean |
| Reserva | idReserva: int; dataReserva: Date; dataExpiracao: Date; situacao: String; ativo: boolean |
| Emprestimo | idEmprestimo: int; dataEmprestimo: Date; dataPrevistaDevolucao: Date; dataDevolucao: Date; situacao: String; ativo: boolean |
| Aluno | idAluno: int; nome: String; email: String; matricula: String; ativo: boolean |

### Financeiro / Financeiro Diagrama Classe.drawio

| Classe | Atributos e tipos transcritos |
| --- | --- |
| PlanoFinanceiro | idPlano: int; nome: String; descricao: String; valor: double; periodicidade: String; ativo: boolean |
| Aluno | idAluno: int; nome: String; email: String; matricula: String; ativo: boolean |
| Cobranca | idCobranca: int; dataVencimento: Date; valorOriginal: double; valorFinal: double; status: String; dataEmissao: Date; ativo: boolean |
| Desconto | idDesconto: int; descricao: String; tipo: String; percentual: double; valor: double; dataInicio: Date; dataFim: Date; ativo: boolean |
| Pagamento | idPagamento: int; dataPagamento: Date; valor: double; formaPagamento: String; comprovante: String; status: String; ativo: boolean |

### Gestao de Alunos / Gestao de Alunos Classe.drawio

| Classe | Atributos e tipos transcritos |
| --- | --- |
| Turma | idTurma: int; nome: String; descricao: String; ano: int; periodo: String; capacidade: int; ativo: boolean |
| Responsavel | idResponsavel: int; nome: String; cpf: String; telefone: String; email: String; parentesco: String; endereco: String; ativo: boolean |
| Aluno | idAluno: int; nome: String; dataNascimento: Date; email: String; telefone: String; endereco: String; matricula: String; dataMatricula: Date; status: String; ativo: boolean |
| Ocorrencia | idOcorrencia: int; tipo: String; descricao: String; dataOcorrencia: Date; status: String; ativo: boolean |
| Documento | idDocumento: int; tipo: String; descricao: String; nomeArquivo: String; dataEnvio: Date; status: String; ativo: boolean |

### Gestao de Cursos / Gestao de Cursos Classe.drawio

| Classe | Atributos e tipos transcritos |
| --- | --- |
| Curso | idCurso: int; nome: String; descricao: String; cargaHoraria: int; ativo: boolean |
| Matricula | idMatricula: int; dataMatricula: Date; status: String; ativo: boolean |
| Professor | idProfessor: int; nome: String; email: String; especialidade: String; ativo: boolean |
| Aula | idAula: int; titulo: String; descricao: String; dataHora: Date; duracao: int; ativo: boolean |
| Aluno | idAluno: int; matricula: String; nome: String; email: String; ativo: boolean |

### Nucleo / Nucleo Diagrama de Classes.drawio

| Classe | Atributos e tipos transcritos |
| --- | --- |
| Usuario | idUsuario: int; nome: String; email: String; senha: String; ativo: boolean |
| Grupo | idGrupo: int; nome: String; descricao: String; ativo: boolean |
| Modulo | idModulo: int; nome: String; descricao: String; ativo: boolean |
| Papel | idPapel: int; nome: String; descricao: String |


## Continuidade da Fase 6

O pedido “fase 6” autoriza a execução com as propostas D03/D04 usadas desde a estrutura: uma tentativa, objetiva A–D, discursiva manual, prazo individual e nota em soma de pontos. A representação A–D já estava no schema da Fase 2. A Fase 6 implementa esses fluxos e corrige apenas um índice técnico indevido de Resposta, sem alterar cardinalidades acadêmicas. Pontuação e comentário de correção foram documentados em ADR-005; nenhuma relação com Curso/Turma foi inventada. As decisões desta seção são a atualização das pendências originais da tabela, mantida como registro da análise inicial.


## Continuidade da Fase 7

O pedido “fase 7” autorizou a Biblioteca em 29/10/2026. D08 foi implementada com validade de reserva/devolução informada pelo gestor, sem fila de prioridade, multa, renovação ou bloqueio automático por reserva. As entidades, atributos e cardinalidades das fontes foram preservados; nenhum schema/migração novo. Regras técnicas de circulação e validações constam em ADR-006. Esta seção atualiza a pendência original D08 da análise inicial.


## Continuidade da Fase 8

O pedido “Fase 8” autorizou o Financeiro em 29/10/2026 com D05/D09: desconto opcional único do mesmo aluno, snapshot na emissão, vigência inclusiva, pagamentos internos positivos até o saldo, arredondamento decimal comercial, estorno auditado e geração explícita sem recorrência. As fontes acadêmicas, entidades e cardinalidades foram preservadas; não houve migração nova. Esta seção atualiza as pendências originais da tabela de análise; implementação e limites constam em ADR-007.


## Continuidade da Fase 9

O pedido “fase 9” autorizou a validação integrada em 29/10/2026. Foram mantidas as entidades/cardinalidades e D01–D09. Novos testes usam os serviços/APIs para confirmar Aluno central, sessões, autorizações e consistência entre módulos. Não houve ajuste do modelo nem nova regra de negócio. Fontes e cópias permanecem preservadas; matriz em VALIDACAO_INTEGRADA.md.


## Encerramento

Fase 10 solicitada em 29/10/2026, concluída sem remodelagem acadêmica. As 13 fontes e cópias foram conferidas por SHA-256; relatório e diagramas preservados. Diferenças técnicas permanecem justificadas nas decisões anteriores.
