# Requisitos e critérios de aceite

Versão 1.0.0: núcleo, cinco módulos, integração e revisão final concluídos no escopo do MVP local. Consulte PROGRESSO.md para o estado verificado.

Fonte principal: relatório revisado e diagramas. A solicitação acrescenta autenticação operacional, segurança, interface, testes e recursos não detalhados no modelo acadêmico. O quadro abaixo preserva as 27 regras numeradas do relatório; decisões novas estão identificadas em ANALISE_FONTES.

## Rastreabilidade das regras acadêmicas

| Regra | Comportamento a implementar | Evidência de aceite planejada |
| --- | --- | --- |
| RN-01.01 | Usuário com um grupo e um papel | NOT NULL/FKs e cadastro com referências inválidas rejeitado |
| RN-01.02 | Root total; demais papéis limitados | Matriz de acesso direto ao servidor, tentativa de elevação negada |
| RN-01.03 | Habilitar módulo não muda papel | Alteração da ligação sem alteração de papel; teste de regressão |
| RN-01.04 | Módulo pode existir sem habilitação | Grupo sem ligação não acessa endpoint nem dashboard do módulo |
| RN-02.01 | Matrícula liga aluno e curso com status | Persistência real e consultas nos dois sentidos |
| RN-02.02 | Aula exige curso e professor | FKs e validação; criação sem referência rejeitada |
| RN-02.03 | Carga e datas coerentes | Unidades explícitas, duração positiva e programação conforme D07 |
| RN-02.04 | Inativo sem matrícula automática | Operação comum negada; exceção aprovada e auditada |
| RN-03.01 | Questão de avaliação definida | FK e exclusão restrita |
| RN-03.02 | Resposta identifica aluno e questão | Sem troca de aluno; questão da prova correta |
| RN-03.03 | Nota identifica aluno e avaliação | FKs e nota única por tentativa se aprovada |
| RN-03.04 | Correção e limite definidos | Política D03 aprovada, objetiva automática e discursiva manual testadas |
| RN-04.01 | Um empréstimo aberto por exemplar | Duas transações concorrentes; só uma efetivada |
| RN-04.02 | Empréstimo com aluno e exemplar | Integridade referencial em banco de testes |
| RN-04.03 | Reserva com livro e aluno | Persistência, expiração e histórico |
| RN-04.04 | Disponibilidade depende da situação | Bloquear exemplar indisponível e verificar empréstimo aberto |
| RN-04.05 | Devolução atualiza duas entidades | Transação e repetição idempotente verificadas |
| RN-05.01 | Cobrança com aluno e plano | FKs e emissão real |
| RN-05.02 | Pagamento vinculado à cobrança | Saldo e histórico por cobrança |
| RN-05.03 | Total considera desconto válido | Cálculo percentual/fixo, sem benefício e snapshot |
| RN-05.04 | Benefício fora da validade recusado | Limites de início/fim e dia fora do intervalo |
| RN-05.05 | Estado acompanha pagamentos | Parcial, quitação, vencimento e estorno conforme D09 |
| RN-06.01 | Cadastro e matrícula identificáveis | Matrícula acadêmica única e campos validados |
| RN-06.02 | Respeitar capacidade | Corrida de cadastro/transferência e redução de capacidade |
| RN-06.03 | Múltiplos responsáveis | Duas ligações por aluno e responsável com dois alunos |
| RN-06.04 | Documento/ocorrência do aluno correto | FK, upload privado e acesso com ID trocado negado |
| RN-06.05 | Ocorrência por usuário autorizado | Ator derivado da sessão e evento de auditoria |

## Funcionalidades complementares solicitadas

Núcleo: login/logout, recuperação e redefinição, CRUD de usuários e grupos, atribuição de papéis, catálogo dos cinco módulos, habilitação por grupo, sidebar dinâmica, indicadores reais, perfil e eventos administrativos. Bootstrap sem credenciais fixas. Hash seguro e sessão revogável.

Alunos: cadastro completo com os atributos originais, edição acadêmica, turmas, vínculos de responsáveis, documentos, ocorrências, status e histórico integrado. Aluno sem conta permitido. Cadastro central único referenciado pelos demais módulos.

Cursos: cadastro e gestão de cursos/docentes, aulas com professor único, programação, matrículas/status, cursos por aluno e alunos por curso. Não duplicar vínculo ativo. Não introduzir relação direta Curso–Professor que substitua Professor–Aula.

Avaliações: avaliações, questões e alternativas A–D, pontos, aplicação, envio, correção automática e manual, notas, resultados e histórico. Gabarito protegido no servidor. Prazo individual, tentativa única, liberação e correção seguem D03 e ADR-005, implementados na Fase 6. Não pressupor que avaliação pertence a curso ou turma: não consta das fontes.

Biblioteca: categorias, livros, exemplares, busca e disponibilidade, retirada, devolução, reservas e históricos. D08 e ADR-006 definem a política operacional implementada na Fase 7. Reserva aponta para Livro; empréstimo aponta para Exemplar.

Financeiro: planos, emissão de cobranças por aluno, pagamentos internos totais/parciais, benefícios por aluno, validade e cálculo, pendentes/pagas/vencidas, histórico e relatórios. Sem gateway real. Não aplicar desconto de outro aluno nem compor descontos sem aprovação.

## Requisitos de interface e segurança

Interface em português, responsiva em desktop/tablet/celular, menu por permissão, cabeçalho com usuário. Tabelas com pesquisa/filtro/paginação no servidor. Formulários identificados, erros acessíveis, confirmação para ações relevantes, estados de carregamento e vazio. Foco visível, diálogos operáveis por teclado e sem perder foco após fechamento.

Validação Zod no servidor e formulários, consultas parametrizadas, campos permitidos explícitos, proteção de mutações contra CSRF, limitação de abuso, cookie seguro, autorização em cada operação, armazenamento privado de arquivos e logs mínimos. Configuração e segredos externos; sem segredos no frontend ou na documentação. Regras de privacidade precisam incluir finalidade dos dados, retenção e procedimento de atendimento antes de produção; não declarar conformidade legal apenas por existir login.

## Plano de testes

| Camada | Casos prioritários | Ambiente e aceite |
| --- | --- | --- |
| Vitest unitário | Fórmulas decimais, estados, prazo, correção objetiva, schemas, políticas puras | Determinístico; relógio controlado nos limites de prazo |
| Vitest integração | Auth, reset único, revogação, módulos, N:N, FKs, capacidade, duplicidade, empréstimos, pagamentos | PostgreSQL separado, migrações reais, transações concorrentes e limpeza apenas do banco de testes |
| Playwright E2E | Bootstrap/entrada, gestor cadastra aluno, matrícula, prova, devolução, parcela e consulta pelo aluno | Backend real, contextos por papel, sem mocks permanentes de dados |
| Interface | Busca, filtros, páginas vazias, erros e teclado em tamanhos desktop e móvel | Ações e nomes acessíveis, captura em falhas |
| Qualidade | Lint, typecheck, build, instalação limpa e dependências | Comandos e resultados em PROGRESSO |

Nos testes de autenticação, incluir senha incorreta, conta/grupo inativo, token vencido/reutilizado, logout, limite de tentativas e desativação de sessão. Nas permissões, incluir usuário sem módulo, alteração de papel, outro grupo e ID de outro aluno. Nas avaliações, incluir questão de outra prova, prazo encerrado e nota adulterada. No financeiro, incluir centavos, desconto vencido, outra titularidade, repetição idempotente, excedente e dois pagamentos disputando o mesmo saldo.

## Definição de conclusão

Cada funcionalidade precisa de persistência real, autorização no servidor, validação, interface operável e evidência do teste aplicável. Não basta existir rota ou componente. Fase concluída exige registrar o que passou, falhou ou não pôde ser executado. Na Fase 1 foram verificadas fontes e consistência documental. A Fase 2 passou em 3 testes unitários, 14 de integração de banco e 2 E2E da infraestrutura; testes funcionais de autenticação e dos módulos ainda dependem das próximas fases.


## Evidência do núcleo na Fase 3

A suíte atual passou com 6 testes unitários, 29 de integração e 8 E2E, incluindo fluxo real de e-mail em Mailpit, acesso por papéis e grupo, cadastros e inativação. Não se usa exclusão física nos cadastros; históricos são preservados. O catálogo usa os três papéis e cinco códigos de módulo, sem criação de políticas arbitrárias. As funcionalidades dos módulos continuam pendentes.


## Evidência da Gestão de Alunos

RN-06.01–05 implementadas: cadastro/matrícula identificável, capacidade em transação, responsáveis N:N, documentos/ocorrências do aluno correto e autoria de usuário autorizado. Há cinco novos testes unitários, treze de integração e quatro E2E, elevando o total para 65. Cadastro de alunos sem conta é permitido; conta opcional única usa a FK preparada no modelo. Históricos acadêmicos leem as tabelas compartilhadas, sem dados estáticos de demonstração.


## Evidência da Gestão de Cursos

RN-02.01–04 implementadas: vínculo aluno/curso com status, curso e professor obrigatórios por aula, duração/programação válidas e exceção administrativa para curso inativo. D07 foi implementada conforme a proposta: horas no curso, minutos na aula, soma das aulas ativas limitada à carga, exceção somente root com justificativa auditada. Matrícula ativa duplicada é bloqueada, cancelamentos mantidos, e o cadastro acadêmico central não é duplicado. Foram acrescentados 24 testes, elevando a suíte a 89 aprovados. Programação, matrículas e escopo foram verificados em desktop/celular.


## Aceite da Fase 6

RN-03.01–04 verificadas com PostgreSQL e navegador: várias questões por prova, resposta do aluno/questão/tentativa corretos, proteção do gabarito, correção automática, discursiva parcial/manual e nota única. Envio fora do prazo, IDs alheios, pontos/identidade forjados e módulo revogado foram testados. Repetição concorrente do início e da finalização preserva uma tentativa/nota. Prova com questão discursiva respondida não publica nota antes da correção. Regras adicionais explícitas em ADR-005.


## Aceite da Fase 7

RN-04.01–05 implementadas e verificadas: retirada concorrente produz um único empréstimo; histórico identifica mesmo Aluno e exemplar; reserva identifica Aluno/Livro com validade; disponibilidade cruza estado/atividade/empréstimo aberto; devolução muda as duas entidades na transação e repetição não desfaz nova retirada. Acervo/históricos têm busca/filtros/paginação e autorização no servidor. Usuário não recebe histórico de colegas. Sem fila, multa ou renovação presumidas; expiração efetiva calculada sem escrever por GET, com encerramento administrativo explícito.


## Aceite da Fase 8

RN-05.01–05 verificadas: cobrança do Aluno/plano corretos; pagamento de cobrança existente; valor final com desconto opcional próprio e vigente; validade inclusiva; soma decimal determina parcial/quitação. Concorrência não excede o saldo; repetição da mesma solicitação não duplica o pagamento; estorno preserva registro e recalcula. Snapshot conserva dívida emitida apesar de edições no plano/benefício. Relatório filtra emissão e exclui cancelamentos/estornos dos valores. Conta comum só lê o próprio histórico; nenhum gateway real foi integrado. Decisões e limites em ADR-007.


## Aceite da Fase 9

Identidade compartilhada comprovada com serviços reais e jornada HTTP/UI: Aluno, matrícula, tentativa/respostas/nota, empréstimo/reserva e cobrança/pagamentos. Revogação por módulo mantém os outros acessos e não remove registros. Grupo/conta inativos invalidam sessões; Aluno acadêmico inativo preserva encerramentos/históricos. Troca de conta respeita reautenticação/uniquidade e o acesso muda pelo vínculo existente. Operações recusadas fazem rollback local, FKs preservam históricos e colega não lê dados alheios. Matriz/evidências em VALIDACAO_INTEGRADA.md e VERIFICACAO_FASE9.json.


## Aceite final

Dez fases concluídas com persistência real, autorização, validação, interface responsiva e 191 testes. Instalação limpa executada, Prisma gerado antes da checagem de tipos e iniciador Windows verificado. Revisão/evidências em REVISAO_FINAL.md e VERIFICACAO_FASE10.json; procedimentos e limites em GUIA_EXECUCAO.md. Não se declara implantação de produção nem certificação jurídica de privacidade.
