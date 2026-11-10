# Progresso do desenvolvimento

## GitHub privado e transferência — 10/11/2026

Preparado repositório kaiobriegas/edugestao-faculdade privado, com código, fontes e documentação. Ambiente, banco, backups, dependências e uploads excluídos do Git. Guia TRANSFERIR_NOTEBOOK.md e utilitários opcionais de backup/restauração local. Ferramentas PostgreSQL obtidas do distribuidor EDB, checksum conferido. Backup local restaurado em banco temporário exclusivo, 34 tabelas incluindo migrações comparadas, contas/hashes preservados e segunda restauração recusada por banco preenchido. Sem reset ou exclusão de dados da aplicação. Sintaxe/lint dos novos scripts conferidos. Instalação no notebook depende de execução naquele equipamento.

## Contas de demonstração — etapa 2 complementar

Criadas contas Administrador e Usuário no grupo DEMO — Apresentação com cinco módulos habilitados. Usuário vinculado à Ana DEMO-2026-001. Senhas aleatórias, hashes Argon2id, sem credenciais no código/documentação. Root existente preservado. Login/sessão/papéis/módulos e vínculo verificados pelo serviço real; sessões da verificação encerradas. Lint e TypeScript aprovados. Script opcional prepare-demo-accounts.ts com transação, bloqueio e marcador para não sobrescrever contas ou vínculo. Orientações em CONTAS_DEMONSTRACAO.md.

## Dados de demonstração — etapa 1 complementar

Criados registros fictícios DEMO para um Aluno central com turma, curso/professor/aula/matrícula, prova corrigida (4,5/5), segunda prova ainda não iniciada, livro/exemplar/empréstimo e plano/desconto/cobrança/pagamento parcial. Sem novas contas ou mudança em registros existentes. Script opcional scripts/prepare-demo.ts transacional, local e sem recriação após marcador; duas execuções verificadas, sendo a segunda sem novas inclusões. Lint e TypeScript aprovados. Estado inicial financeiro: R$ 90,45, pago R$ 40,20, saldo R$ 50,25. Orientações em DADOS_DEMONSTRACAO.md.

## Fase 11 complementar — preparação da apresentação

Autorizada pelo solicitante após a entrega das dez fases originais. Criados APRESENTACAO_FACULDADE.md (preparação e roteiro de 8 minutos), DEFESA_TECNICA.md (modelagem, arquitetura e 20 perguntas) e COLA_APRESENTACAO.md (consulta rápida para ensaio). Conteúdo conferido com schema, rotas e documentação final da versão 1.0.0. Sem mudanças de código, regras ou banco; não foram inseridos dados DEMO. Os 191 testes citados são a evidência da fase 10, sem nova execução nesta etapa documental. Pacote de apresentação separado do ZIP da aplicação.

Atualizado em 29/10/2026, America/Sao_Paulo. O solicitante pediu uma implementação mais simples e ágil para o trabalho da faculdade e autorizou as Fases 3–10. Foram usados os serviços e o banco locais existentes, sem dependências novas, preservando o modelo acadêmico; ajustes técnicos da Fase 6 constam em ADR-005.

| Fase | Estado |
| --- | --- |
| 1 Análise | Concluída; relatório e 12 diagramas preservados |
| 2 Estrutura | Concluída e validada localmente; execução real do Compose depende de Docker |
| 3 Núcleo | Concluída e verificada; primeiro root de trabalho deve ser criado pelo solicitante na CLI |
| 4 Gestão de Alunos | Concluída e verificada; alunos, turmas, responsáveis, documentos e ocorrências |
| 5 Gestão de Cursos | Concluída e verificada; cursos, professores, aulas e matrículas |
| 6 Avaliações | Concluída e verificada; provas, questões, rascunhos, correção e histórico |
| 7 Biblioteca | Concluída e verificada; acervo, exemplares, empréstimos, devoluções e reservas |
| 8 Financeiro | Concluída e verificada; planos, descontos, cobranças, pagamentos, estornos e relatório |
| 9 Integração completa | Concluída e verificada; jornada do mesmo Aluno, acesso privado, sessões e consistência entre módulos |
| 10 Finalização | Concluída; revisão, teclado, segurança, instalação limpa e pacote final |

## Funcionalidades verificadas da Fase 3

Login/logout, hash Argon2id, sessão opaca de oito horas com cookie HttpOnly, token somente por hash no banco, revogação, verificação de conta/grupo/papel/módulos no servidor e limite persistente de tentativas. Recuperação por SMTP, validade de trinta minutos, token único com consumo transacional e encerramento de sessões após redefinição.

Bootstrap seguro do primeiro root por CLI interativa e senha oculta, sem credenciais padrão, com bloqueio de repetição/concorrência. O serviço de bootstrap foi testado no banco de testes; nenhuma conta foi criada automaticamente no banco de trabalho. O usuário deve executar npm run bootstrap:root para escolher suas credenciais.

Cadastro, edição, ativação/inativação e busca/paginação de usuários e grupos. Root atribui papéis, libera módulos por grupo e edita o catálogo existente; os três papéis e cinco códigos de módulo são fixos. Administrador gerencia apenas contas Usuário do próprio grupo. Último root e seu grupo preservados. Reautenticação com senha atual para mutações administrativas e de perfil. Sem exclusão física do histórico pela interface.

Dashboard com contagens reais e escopo por papel, perfil, menu dinâmico, eventos filtrados, formulários validados, mensagens de sucesso/erro, carregamento, vazios, confirmação de alterações e layout em desktop/celular. As páginas dos módulos apenas verificam acesso e indicam a etapa futura; nenhum cadastro acadêmico foi declarado concluído.

## Verificação desta entrega

| Comando ou inspeção | Resultado |
| --- | --- |
| npm run test:unit | 6 testes aprovados |
| npm run test:integration | 29 testes aprovados em PostgreSQL real |
| npm run test:e2e | 8 testes aprovados, Chromium desktop e celular |
| npm run lint | Sem erros ou avisos |
| npm run typecheck | Sem erros |
| npm run build | Build de produção aprovado |
| Inspeção visual | Login e dashboard conferidos em desktop/celular; sem rolagem horizontal da página |
| Recuperação real | E-mail capturado em Mailpit, link aberto, senha redefinida e novo login aprovado |
| Integridade das fontes | 13 originais e cópias preservados por SHA-256 |

Total histórico ao concluir a Fase 3: **43 testes aprovados**. Os testes do núcleo cobrem senha errada, expiração/logout, inativação, escopo, tentativa de elevação, campos extras, limite de tentativas, confirmação de senha, proteção do último root, habilitação imediata, perfil e reset concorrente/expirado. E2E usa banco separado na porta de aplicação 3001 e remove suas contas temporárias. Detalhes em VERIFICACAO_FASE3.json. Evidências históricas das Fases 1 e 2 permanecem nos arquivos próprios.

## Como testar manualmente

No diretório do projeto: npm.cmd run db:local:start; npm.cmd run mail:local:start; npm.cmd run bootstrap:root (uma vez); npm.cmd run dev. Abra http://localhost:3000/login. Para uma demonstração, crie um grupo com alguns módulos, atribua uma conta Usuário e compare seus menus. Acesse http://localhost:8025 para ler recuperação de senha. O README traz os comandos completos de instalação e testes.

## Limitações conhecidas

Docker continua ausente; Compose não foi executado. As limitações de empacotador nativo e ESLint constam de ADR-001. Produção exige HTTPS e SMTP adequado; o Mailpit é apenas local. O catálogo de papéis e códigos de módulos é fixo, com edição e habilitação; não há instalação de novo código por cadastro.

Os cinco módulos, integração e revisão final estão concluídos, preservando o único Aluno e as cardinalidades. Não foram introduzidos gateways reais, filas ou serviços extras.


## Entrega verificada da Fase 4

CRUD com inativação de Aluno, Turma e Responsavel, busca/filtros/paginação no servidor, seleção de turma e status, conta opcional/única vinculada somente por root com confirmação de senha. Respeito à capacidade na inclusão, transferência, reativação e redução de vagas. Não se criaram tabelas de aluno por módulo.

Vínculo N:N de responsáveis com parentesco específico, sem eliminar parentesco original. Ficha com documentos privados (PDF/PNG/JPEG, padrão 10 MiB), upload/download reais e situação/arquivamento. Autorização no servidor, chave aleatória e rollback do arquivo se falhar o registro. Ocorrências com autoria de sessão e histórico de edição/inativação. Usuário comum acessa apenas seu cadastro vinculado e documentos ativos, sem receber ocorrências internas ou CPF de responsáveis.

Histórico recente consulta matrículas e notas nas FKs do mesmo Aluno, somente quando os módulos correspondentes estiverem liberados. Limites informados: 100 documentos/ocorrências e 20 matrículas/notas recentes por ficha; listagens de cadastro são paginadas em 10. Seletores carregam até 1.000 opções, suficiente para a apresentação acadêmica.

**Suíte ao concluir a Fase 4: 65 testes aprovados — 11 unitários, 42 de integração e 12 E2E.** Lint sem avisos, TypeScript, Prisma validate, diff sem diferenças e build de produção também aprovados. Capturas de listagem e ficha conferidas em desktop/celular, sem rolagem horizontal da página. E2E confirmou cadastro completo, vínculo, ocorrência, upload, download e bloqueio de ficha/arquivo alheio. Fontes originais preservadas. Evidências em VERIFICACAO_FASE4.json.

Não foram adicionadas dependências, entidades ou migrações nesta fase. Testes usam banco e diretório de arquivos separados, removendo apenas as próprias fixtures. Nenhuma credencial ou dado acadêmico foi criado automaticamente no banco da apresentação.


## Entrega da Fase 5

Cursos e professores com cadastro/edição/inativação, aulas com curso/professor obrigatórios e programação em horário de Brasília, carga horária em horas e duração em minutos. Bloqueio de excesso de duração e redução indevida de carga, inclusive sob concorrência. Professor é um cadastro independente de Usuario.

Matrículas reais com Aluno central, busca/filtros por aluno, curso, atividade/status e paginação. Duplicidade ativa impedida no serviço e índice PostgreSQL. Cancelamento e conclusão preservados; aluno/curso do vínculo não podem ser trocados. Curso inativo exige autorização root, senha atual e justificativa registrada. Aluno inativo não recebe nova matrícula. Atualização de status não cancela silenciosamente outros vínculos.

Catálogo/programação para contas autorizadas; Usuário consulta somente suas matrículas e pode ver curso histórico próprio inativo. Não recebe nomes de colegas nem e-mail do professor no DTO. Gestor com Cursos habilitado recebe seletor mínimo de alunos, sem liberar o módulo Alunos inteiro. O histórico da ficha de Aluno mostra as novas matrículas pelas mesmas FKs.

**Suíte atual: 89 testes aprovados — 15 unitários, 58 de integração e 16 E2E.** Lint, TypeScript, build, Prisma validate/diff e capturas desktop/celular aprovados. As regressões do núcleo e da Gestão de Alunos também passaram. Evidências em VERIFICACAO_FASE5.json. Fontes preservadas; continuam 33 tabelas e duas migrações, sem novas dependências.

Para demonstrar: cadastre curso, professor e aula; matricule aluno existente; filtre os vínculos e abra o curso. Repita uma inscrição ativa para ver o bloqueio e consulte o histórico na ficha do aluno. O README descreve exceção e permissões. A ficha do curso limita exibição a 200 aulas/100 matrículas recentes e oferece listagens paginadas; seletores usam até 1.000 opções.


## Entrega da Fase 6 — Avaliações

Cadastro/edição/inativação de avaliações e questões objetivas/discursivas, pontos e gabarito, liberação, tentativa individual, rascunhos reais, cronômetro, finalização, correção automática e manual com pontuação parcial/comentário, nota única, pesquisa/filtros/paginação de resultados e histórico próprio. Navegação e dashboard atualizados. Aluno segue centralizado.

Uma migração não destrutiva corrige a unicidade equivocada de Resposta e acrescenta pontuação/comentário de correção. Sem novas dependências ou entidades. Conteúdo bloqueado após começar, gabarito omitido no DTO do aluno em andamento, IDs trocados/nota adulterada negados e prazo calculado no banco. Reavaliações são auditadas. Mais detalhes em ADR-005 e VERIFICACAO_FASE6.json.

Verificação atual: `npm run check` (schema, lint sem avisos, TypeScript, 20 unitários, build), `npm run test:integration` (73 testes reais), `npm run test:e2e` (20 testes desktop/celular), status e diff de migrações, SHA-256 das 13 fontes preservadas, capturas e ZIP. Total: 113 testes. Registros e credenciais dos testes são descartados no banco exclusivo, sem popular o banco da apresentação.

Limitações conscientes: uma tentativa, até 100 questões ativas, notas em pontos; catálogo institucional sem curso/turma; prazo só encerra por POST do navegador/gestor, sem worker. Respostas precisam ser salvas explicitamente. Sem proctoring, anexos em questões ou avaliações com mídia. Bootstrap da conta de trabalho permanece a cargo do solicitante; Docker Compose segue não executado por indisponibilidade do Docker. Biblioteca, Financeiro e integração completa continuam pendentes.

Para testar: seguir o roteiro “Demonstrar a Gestão de Avaliações” do README. Próxima fase: Biblioteca.


## Entrega da Fase 7 — Biblioteca (29/10/2026)

Acervo com cadastro/edição/inativação de categorias, livros e exemplares; ISBN/códigos únicos, pesquisa, filtros, paginação e ficha do livro com contagens reais de disponibilidade. Empréstimo e devolução transacionais, retirada duplicada impedida, histórico preservado e tratamento de atraso calculado. Reservas com validade informada, cancelamento, atendimento após empréstimo e registro de expiração. Aluno segue centralizado, inclusive quando não tem conta.

Usuário comum consulta acervo e apenas seus empréstimos/reservas. Gestor com módulo Biblioteca registra circulação, usando seletor mínimo de alunos; não recebe documentos/ocorrências ou senha. Histórico não é editado livremente; exemplar com empréstimos não troca de livro. Repetição de devolução é idempotente e não desfaz nova retirada. As políticas D08 estão implementadas conforme ADR-006, sem filas, multas ou renovação automática.

Verificação: 25 testes unitários, 90 de integração e 24 E2E desktop/celular, total de 139; schema, lint sem avisos, TypeScript, build, status/diff de banco e fontes por SHA-256. Capturas conferidas. Testes cobrem concorrência pelo exemplar, devoluções, reservas válidas/vencidas, estados inativos, prazo, unicidade, acesso próprio e integração por FK com o Aluno existente. Sem novas entidades, dependências ou migrações: 33 modelos e três migrações.

Limites: listas de 10 por página, seletores de até 1.000, ficha até 100 exemplares com contagens completas. Expiração/atraso calculados na leitura, sem mutação por GET nem cron; gestor registra fechamento da reserva vencida. Biblioteca funciona localmente com PostgreSQL/Mailpit; Docker Compose permanece não executado por ausência do Docker. Fase 8 (Financeiro), integração completa e finalização continuam pendentes.

Para demonstrar: seguir “Demonstrar a Biblioteca” no README. Evidências em VERIFICACAO_FASE7.json.


## Entrega da Fase 8 — Financeiro (29/10/2026)

Planos e descontos com cadastro/edição/inativação; emissão manual de cobranças a partir do plano e do Aluno central; desconto opcional válido, do mesmo aluno, com snapshot imutável. Pagamentos internos parciais/totais, rejeição de excedente, idempotência por solicitação, estorno com autor/data/motivo, cancelamento auditado e histórico preservado. Consulta de pendentes, parciais, pagas, vencidas e canceladas. Relatório agregado consistente por emissão/aluno/plano.

31 testes unitários, 108 de integração e 28 E2E, total de 167; schema, lint sem avisos, TypeScript, build, status/diff de banco e SHA-256 das fontes. Testados arredondamento, centavos, validade inclusiva, desconto alheio, preços congelados, concorrência pelo saldo, repetição de pagamento, estorno/cancelamento e isolamento do financeiro próprio. Telas desktop/celular e capturas conferidas. Sem novas tabelas, migrações ou dependências: 33 modelos, três migrações.

Políticas D05/D09 implementadas em ADR-007: um desconto, soma decimal, pagamentos positivos limitados ao saldo, estorno sem exclusão e emissão manual. Sem gateway, recorrência, multa/juros, conciliação ou exportação fiscal. Comprovante é referência textual sem upload. Vencida é calculada na consulta, sem mutação por GET. Seletores até 1.000; listas de 10; ficha até 100 pagamentos com lista paginada completa. Docker Compose segue não executado pela ausência do Docker.

Para demonstrar: “Demonstrar o Financeiro” no README. Evidências em VERIFICACAO_FASE8.json. Fases 9–10 seguem pendentes; a entrega não declara integração completa nem publicação em produção.


## Entrega da Fase 9 — Integração e testes (29/10/2026)

11 novos testes de integração processam a mesma identidade acadêmica nos serviços dos cinco módulos, com matrícula, prova/nota, empréstimo/reserva e cobrança/pagamentos. Incluem operações concorrentes entre módulos, conta vinculada posteriormente, troca de conta com senha, recusa de vínculo duplicado, inativação do Aluno/grupo/conta, rollback de mutações recusadas e FKs de exclusão restrita. Revogação de cada módulo é conferida na sessão existente, mantendo os demais acessos.

Quatro novos E2E (duas jornadas em desktop/celular) cadastram Aluno/vínculo pela interface, criam registros pelas APIs reais e validam leitura/ações em contas separadas. Prova respondida pelo aluno e corrigida pelo root, devolução e quitação em duas parcelas refletem na conta já aberta. Colega não acessa dados alheios; Origin externo e mutações comuns são recusados nos cinco módulos. Capturas conferidas.

Suíte completa: 182 testes — 31 unitários, 119 de integração e 32 E2E. Novo comando npm run test:all reúne schema/lint/TypeScript/build, integração e interface. Banco mantém 33 modelos e três migrações; status/diff sem diferenças e 13 fontes/cópias íntegras por SHA-256. Sem novas dependências, entidades ou regras. Os cenários não exigiram correção de comportamento da aplicação.

Evidências em VERIFICACAO_FASE9.json; matriz e roteiro em VALIDACAO_INTEGRADA.md. Testes usam banco exclusivo e removem somente seus dados/credenciais. Fase 10 pendente: revisão final, documentação operacional e acabamento. Não houve teste de carga, pentest externo ou homologação de produção; Docker Compose segue não executado por ausência do Docker.


## Fase 10 — Finalização (29/10/2026)

Versão 1.0.0. Navegação por teclado, foco/restauração dos formulários, aria-current, título e mensagens finais. APP_URL restrita a HTTP/HTTPS sem credenciais; guard compartilhado impede testes sobre o banco da aplicação, incluindo aliases de loopback. Cópia limpa revelou ordem incorreta da geração Prisma: check agora gera o cliente antes do TypeScript.

191 testes aprovados: 36 unitários, 119 integração e 36 E2E. Lint, TypeScript, schema e build aprovados. npm ci/check/build executados em cópia sem dependências/build prévios; produção local respondeu login/health 200, banco conectado, rota privada 307, API privada 401 e /.env 404. Código da cópia comparado ao final. INICIAR_PROJETO.cmd testado até login/health 200. npm audit --omit=dev retornou zero alertas conhecidos. Sem novas entidades, migrações ou dependências: 33 modelos, três migrações e 13 fontes/cópias íntegras.

Guias finais em GUIA_EXECUCAO.md, REVISAO_FINAL.md e VERIFICACAO_FASE10.json. ZIP sem segredos/dados locais. Dez fases concluídas no escopo do MVP local; primeiro root escolhido pelo usuário, pagamentos internos e políticas anteriores preservados. Não houve carga, pentest externo, auditoria jurídica/LGPD formal ou publicação. Docker Compose não executado por ausência do Docker; execução nativa verificada.
