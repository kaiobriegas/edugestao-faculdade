# Plano de desenvolvimento da plataforma educacional

Plano aprovado para continuidade pelo pedido “fase 2” em 28/10/2026. O texto abaixo preserva o planejamento original; implementação efetiva e evidências estão em PROGRESSO.md.

Versão inicial apresentada em 28/10/2026. A análise inicial foi apresentada e a Fase 2 foi autorizada. Schema, migrações e estrutura executável agora existem; o núcleo foi implementado na Fase 3, e os serviços acadêmicos seguem a sequência abaixo.

## Fontes e escopo

Foram inventariados os 12 arquivos draw.io existentes em seis pastas e lido integralmente o conteúdo textual do relatório revisado, incluindo suas tabelas. As 12 imagens incorporadas foram extraídas e inspecionadas; atributos, conexões e rótulos dos 12 XMLs foram examinados. O relatório afirma que os quadros de figuras estão vazios, mas o DOCX recebido contém efetivamente 12 imagens. A análise considera os arquivos recebidos. Ver [ANALISE_FONTES](ANALISE_FONTES.md).

O produto terá núcleo e cinco módulos: alunos, cursos, avaliações, biblioteca e financeiro. São **26 entidades acadêmicas distintas**, contando Aluno uma única vez. As associações e estruturas técnicas adicionais estão justificadas no documento de banco. Nenhuma entidade original será descartada.

## Arquitetura proposta

Monólito modular em um único projeto Next.js com App Router e TypeScript. React com componentes de servidor para leitura e componentes cliente somente para interação. Tailwind CSS e componentes shadcn/ui para interface; React Hook Form e Zod para formulários. PostgreSQL real, Prisma para acesso e migrações; SQL complementar versionado quando a restrição não puder ser representada pelo ORM. Vitest para unidade e integração, Playwright para fluxos completos.

As rotas validam sessão e entrada e chamam serviços de aplicação. Serviços aplicam políticas e coordenam transações; repositórios executam consultas limitadas ao escopo autorizado. Apenas o servidor importa Prisma, hashes, transporte de e-mail e arquivos privados. DTOs de leitura selecionam campos explicitamente, impedindo serialização acidental de senha, token, gabarito ou dados financeiros.

Cada módulo possui schemas, serviços, repositórios e componentes próprios. A identidade acadêmica pertence ao módulo alunos. Os demais referenciam seu identificador e contratos públicos; o módulo alunos não importa seus consumidores. O dashboard usa consultas de leitura específicas. Dependências seguem `app → módulos → contratos/infraestrutura`; ciclos serão verificados por lint. Transações que envolvem mais de um módulo serão coordenadas por casos de uso, nunca por chamadas circulares entre interfaces.

## Tecnologias e compatibilidade

Propor Node.js 24 LTS e selecionar releases estáveis compatíveis de Next.js, React, Prisma, PostgreSQL e demais bibliotecas na Fase 2. Fixar patches e imagem do banco, registrar matriz de versões e validar instalação limpa, geração do client e build. Não usar `latest` em imagens ou instalações reproduzíveis. Esta fase não congela versões que ainda não foram testadas juntas.

A documentação oficial consultada indica mínimo Node 20.9 para Next.js e suporte a Node 24 no Prisma 7. A documentação atual do Prisma também apresenta a geração 8; sua adoção não será automática sem verificar estabilidade e migração de APIs. Auth.js v5 aparece documentado com instalação `next-auth@beta`, portanto não é tratado aqui como release estável. A Fase 2 deve comparar uma biblioteca de autenticação estável e compatível com o conjunto escolhido; registrar decisão antes de implementá-la. A arquitetura exige sessões revogáveis no servidor e login com senha, independentemente da biblioteca.

Referências de compatibilidade consultadas em 28/10/2026: [Next.js](https://nextjs.org/docs/pages/getting-started/installation), [Prisma 7](https://www.prisma.io/docs/orm/v7/reference/system-requirements), [Prisma versões](https://www.prisma.io/docs/orm/supported-versions), [Auth.js](https://authjs.dev/getting-started/installation?framework=Next.js). Essas fontes orientam tecnologia; regras acadêmicas continuam nos documentos locais.

## Organização proposta de pastas

```text
C:/Trabalho_Banco_de_Dados/
  README.md
  .env.example
  docs/
    fontes/                     # cópias íntegras do relatório e 12 draw.io
    PLANO_DESENVOLVIMENTO.md
    ANALISE_FONTES.md
    BANCO_DE_DADOS.md
    REQUISITOS.md
    PERMISSOES.md
    PROGRESSO.md
    INVENTARIO_FONTES.json
    decisoes/                   # ADRs futuros
  src/
    app/
      (publico)/login/ recuperar-senha/ redefinir-senha/
      (plataforma)/dashboard/ perfil/ administracao/
      (plataforma)/alunos/ cursos/ avaliacoes/ biblioteca/ financeiro/
      api/                      # endpoints e downloads autorizados
    modules/
      core/ alunos/ cursos/ avaliacoes/ biblioteca/ financeiro/
        schemas/ services/ repositories/ components/ contracts/
    application/                # coordenação de casos de uso compartilhados
    components/ui/              # componentes acessíveis reutilizáveis
    lib/                        # cliente DB, auth, políticas, e-mail, erros
  prisma/schema.prisma
  prisma/migrations/
  prisma/seed.ts
  scripts/                      # bootstrap e operações de manutenção
  tests/unit/ integration/ e2e/ fixtures/
  storage/private/              # ignorado pelo Git e fora de public/
  compose.yaml
```

A Fase 2 criou a base de src, prisma, scripts, testes e Compose. As rotas de negócio da árvore continuam previstas para as Fases 3–8. As pastas acadêmicas originais foram preservadas.

## Autenticação e autorização

Hash Argon2id com salt individual e parâmetros calibrados; sessão opaca revogável com token apenas em cookie HttpOnly, Secure em HTTPS, SameSite e validade limitada. Revalidar usuário, grupo, papel e habilitação a cada operação protegida. Logout, troca de senha e desativação invalidam sessões. Rotas de mutação verificam origem/CSRF e não usam GET.

Recuperação por token aleatório, de uso único, com hash no banco, expiração e consumo atômico. Resposta pública uniforme para evitar descoberta de contas; limites persistentes de tentativas para login e recuperação. SMTP local via Mailpit e SMTP configurável em produção; nunca expor token no frontend ou logs. Primeiro root por CLI interativa com transação e sem credenciais predeterminadas.

O escopo proposto de administradores e vínculo opcional Usuario–Aluno exigem aprovação. Não existe relação Grupo–Aluno nos modelos; não será introduzida uma separação por instituição silenciosamente. Ver [PERMISSOES](PERMISSOES.md).

## Integridade e operações críticas

Aluno permanece centralizado. Restrições FK impedem referências órfãs; exclusão de históricos é restrita, e inativação preserva registros. Regras que dependem de concorrência exigem transações com bloqueios em ordem consistente e índices únicos, descritas em BANCO_DE_DADOS.

As quatro operações prioritárias são: alocar aluno sem exceder turma; matricular sem duplicidade ativa; emprestar exemplar uma única vez; registrar pagamentos parciais sem saldo inconsistente. Avaliações exigem tempo controlado no servidor, submissão idempotente, gabarito protegido e integridade entre aluno, questão, tentativa e nota. Casos concorrentes serão testados com PostgreSQL real.

Arquivos terão metadados no banco, conteúdo em área privada, nomes internos aleatórios, limite de tamanho, lista permitida de formatos e inspeção do conteúdo. Download validará escopo. Nada de arquivos enviados em `public/` nem caminhos informados livremente pelo cliente. Eventos administrativos registrarão ator, ação, entidade, identificador e horário, com metadados mínimos e sem conteúdo sensível.

## Páginas e funcionalidades

Todas as listagens terão busca, filtros pertinentes e paginação no servidor; formulários terão validação no cliente e servidor. Confirmar ações relevantes em diálogo acessível, exibir carregamento, estados vazios, sucesso e erro. Sidebar dinâmica e cabeçalho com usuário. Layout responsivo e navegação por teclado. Indicadores virão do banco, respeitando permissões.

| Área e rotas propostas | Páginas e operações |
| --- | --- |
| `/login`, `/recuperar-senha`, `/redefinir-senha` | Entrar, solicitar e-mail, redefinir senha, sair com revogação |
| `/dashboard`, `/perfil` | Indicadores autorizados, dados da conta, alteração segura de senha |
| `/administracao/usuarios` | Busca, cadastro, edição, ativação, grupo e papel dentro do escopo |
| `/administracao/grupos`, `/papeis`, `/modulos` | Cadastros, atribuições, habilitação por grupo; catálogo funcional controlado |
| `/administracao/eventos` | Auditoria filtrável, dados mínimos e acesso restrito |
| `/alunos`, `/alunos/[id]` | Cadastro central, edição, turma, status e histórico integrado |
| `/alunos/turmas`, `/responsaveis` | Capacidade, alocação, vínculos N:N e contatos |
| `/alunos/[id]/documentos`, `/ocorrencias` | Upload/download privado e registros com autoria autorizada |
| `/cursos`, `/cursos/[id]`, `/cursos/professores` | Cursos, programação, aulas e professor por aula |
| `/cursos/matriculas` | Inscrição, status, alunos por curso e cursos por aluno |
| `/avaliacoes`, `/avaliacoes/[id]/questoes` | Avaliações, tipos, alternativas, gabaritos e pontos, acesso de gestão |
| `/avaliacoes/[id]/realizar` | Aplicação, prazo no servidor, respostas e envio final |
| `/avaliacoes/[id]/correcao`, `/resultados` | Correção manual, resultado, nota e histórico por aluno |
| `/biblioteca/acervo`, `/categorias`, `/exemplares` | Pesquisa, disponibilidade e gestão do acervo |
| `/biblioteca/emprestimos`, `/reservas` | Empréstimo, devolução, reserva, cancelamento e históricos |
| `/financeiro/planos`, `/descontos` | Planos, benefícios vinculados ao aluno e vigência |
| `/financeiro/cobrancas`, `/cobrancas/[id]` | Geração, saldo, pagamentos parciais internos e histórico |
| `/financeiro/relatorios` | Pendentes, quitadas, vencidas e exportação autorizada |

Os caminhos abreviados em uma linha pertencem ao prefixo da área. Nenhuma integração com gateway real faz parte do escopo. Criar um registro Modulo não instalará código executável; os cinco módulos serão entregues pelo projeto.

## Cronograma por fases e pontos de verificação

Prazo solicitado: **hoje, 28/10/2026**. A sequência abaixo é a ordem de execução após aprovação. A duração total não pode ser garantida antes de validar ambiente, resolver regras pendentes e executar testes. Não serão classificados como concluídos módulos visuais sem backend ou testes críticos. O prazo não autoriza redução silenciosa do escopo.

| Fase | Dependência | Entrega | Critério para encerrar |
| --- | --- | --- | --- |
| 1 Análise | Fontes recebidas | Este conjunto documental | 12 XMLs e relatório lidos; proposta apresentada para aprovação |
| 2 Estrutura | Aprovação da Fase 1 | Projeto, dependências fixadas, Compose, schema e primeira migração | Instalação limpa, DB saudável, migração em banco vazio e build |
| 3 Núcleo | F2 e escopo aprovado | Auth, recuperação, root, CRUD, políticas, menu, auditoria | Login/logout/reset, negação no servidor e revogação testados |
| 4 Alunos | F3 e vínculo acadêmico aprovado | Cadastro central, turmas, responsáveis, arquivos, ocorrências | Capacidade concorrente, N:N, upload e isolamento verificados |
| 5 Cursos | F4 | Cursos, docentes, aulas, matrículas e consultas cruzadas | Duplicidade e curso inativo bloqueados, exceção auditada |
| 6 Avaliações | F4 e política de tentativas aprovada | Aplicação, respostas, correção e notas | Sem vazamento de gabarito; prazo, repetição e autoria testados |
| 7 Biblioteca | F4 e política de reservas aprovada | Acervo, empréstimo, devolução e reserva | Duas retiradas concorrentes produzem só um empréstimo |
| 8 Financeiro | F4 e política financeira aprovada | Planos, cobranças, descontos, pagamentos e relatórios | Decimais, validade, parcelas e corrida de pagamentos testados |
| 9 Integração | F3–F8 | Testes integrados e E2E | Mesmo aluno nos cinco módulos, FKs e permissões comprovadas |
| 10 Finalização | F9 | Revisão responsiva, acessibilidade e guia operacional | Build, checks, execução limpa e limitações documentadas |

Fases 5–8 dependem do cadastro acadêmico comum, mas seguirão a ordem solicitada. Ao fim de cada fase, atualizar PROGRESSO com comandos executados, resultados, falhas e instruções de teste. Se o prazo ficar incompatível com o escopo, apresentar o estado real e pedir uma decisão explícita de prioridade; não inventar conclusão.

## Registro de continuidade

A continuidade foi autorizada pelo pedido “fase 2”; a estrutura usa as propostas D01–D09 de ANALISE_FONTES. Mudanças importantes futuras devem ser confirmadas antes das partes dependentes. As propostas preservam o modelo: um grupo e papel por conta, uma turma por aluno, professor único por aula, desconto opcional único por cobrança, responsáveis N:N e Aluno compartilhado. As extensões de schema são explícitas e já constam das migrações; seus serviços funcionais ainda não foram implementados.


## Ajuste de execução na Fase 3

A pedido do solicitante, a entrega prioriza simplicidade para apresentação acadêmica. O núcleo usa três papéis fixos, serviços no mesmo Next.js, PostgreSQL e SMTP local existentes. Não houve adição de provedor de identidade, filas ou dependências. Login, recuperação, administração e perfil estão verificados; os módulos acadêmicos continuam previstos. O procedimento de primeiro acesso exige que o solicitante execute a CLI para escolher a própria senha, sem credenciais padrão.


## Execução da Fase 4

Gestão de Alunos entregue como módulo local simples: cadastro central, turmas, responsáveis, documentos e ocorrências, com autorização no servidor e testes reais. O mesmo componente de formulário/lista atende os três cadastros, e a ficha é dividida em seções. Nenhuma dependência ou migração adicional. A próxima fase é Gestão de Cursos; os demais módulos ainda não foram apresentados como concluídos.


## Execução da Fase 5

Gestão de Cursos entregue com os cadastros originais, programação, professores, matrículas e consultas nos dois sentidos. Foram reutilizados os formulários e mantidas autorização/transações no servidor. A exceção de curso inativo segue D07 e não concede poder de elevação ao Administrador. Sem novas entidades, migrações, dependências ou serviços externos. Próxima fase: Gestão de Avaliações.


## Execução da Fase 6

Avaliações implementadas sem serviços externos ou novas dependências. Módulo em src/modules/avaliacoes, separado em schemas, services, repositories e components; rotas em app/(plataforma)/avaliacoes e API autenticada app/api/avaliacoes. Reutiliza formulário acadêmico e conversão de horário movida para lib/academic-time, evitando dependência circular com Cursos.

Fluxo completo gestor → prova/questões → aluno/rascunho/envio → correção/nota → histórico central. Migração técnica sem exclusão de dados remove unicidade indevida das respostas e acrescenta pontos/comentário; justificada em ADR-005. Testes cobrem operações críticas, proteção do gabarito, prazo, concorrência e permissões. Próxima fase: Biblioteca; demais fases permanecem no cronograma original.


## Execução da Fase 7 (29/10/2026)

Biblioteca entregue como módulo local simples em src/modules/biblioteca: schemas Zod, serviços de catálogo/circulação, políticas de disponibilidade, repositórios e componentes compartilhados de formulário/lista. Rotas em app/(plataforma)/biblioteca e API autenticada app/api/biblioteca. Não introduz serviços externos, dependências ou migrações. Reutiliza Aluno central e as constraints SQL existentes.

Fluxo verificado: categoria → livro → exemplar → reserva → empréstimo → atendimento → devolução → históricos próprios. D08 mantida: validade informada pelo gestor, sem prioridade/fila/multa/renovação. Interface e testes cobrem desktop/celular, dados reais e restrição de tomador único por exemplar. Decisões em ADR-006. Próxima fase: Financeiro.


## Execução da Fase 8 (29/10/2026)

Financeiro implementado em src/modules/financeiro com schemas, serviços decimais/catálogos/circulação financeira, consultas/relatório e componentes reutilizáveis. Páginas em app/(plataforma)/financeiro e API autenticada app/api/financeiro. O formulário comum passou a aceitar step decimal, preservando os demais módulos.

Fluxo gestor → plano/desconto → emissão → pagamentos parciais → quitação → estorno/cancelamento → histórico próprio/relatório. Plano/benefício ativos e Aluno central, snapshot imutável e prevenção de excedente com transação. D05/D09 preservadas em ADR-007. Sem novas entidades, dependências ou migrações. Próxima fase: integração completa dos cinco módulos; finalização após ela.


## Execução da Fase 9 (29/10/2026)

Integração completa verificada por serviços e HTTP/Playwright com o mesmo Aluno, em contas separadas. Foram adicionadas fixtures isoladas e testes de jornada, sessão, autorização, troca de vínculo e consistência; não houve mudança de modelo ou política. O comando test:all executa a suíte inteira em sequência. VALIDACAO_INTEGRADA.md mapeia cenários/limites e fornece roteiro de apresentação. Próxima fase: finalização.


## Encerramento da Fase 10

Dez fases concluídas na versão 1.0.0: execução reproduzível, teclado/foco, isolamento dos testes, configuração, cópia limpa e documentação operacional revisados. Sem mudança do modelo ou dependências. Procedimentos/evidências em GUIA_EXECUCAO.md, REVISAO_FINAL.md e VERIFICACAO_FASE10.json. Não houve publicação/homologação de produção.
