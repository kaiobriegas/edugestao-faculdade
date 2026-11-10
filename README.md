# Plataforma de Gerenciamento de Módulos Educacionais

Projeto acadêmico em `C:\Trabalho_Banco_de_Dados`, **versão 1.0.0 — dez fases concluídas**. Núcleo e cinco módulos integrados: Alunos, Cursos, Avaliações, Biblioteca e Financeiro. PostgreSQL real, permissões no servidor e um Aluno central. Revisão final, instalação limpa e 191 testes verificados. Consulte o [guia de execução e apresentação](docs/GUIA_EXECUCAO.md) e a [revisão final](docs/REVISAO_FINAL.md).

## Apresentação da faculdade — fase 11 complementar

Prepare a demonstração com o [roteiro de 8 minutos](docs/APRESENTACAO_FACULDADE.md), estude as [perguntas e explicações do banco](docs/DEFESA_TECNICA.md) e ensaie com a [consulta rápida](docs/COLA_APRESENTACAO.md). Material baseado na versão 1.0.0; os dados DEMO são preparados manualmente pela interface.

## Abrir nesta máquina

Para levar o código e os dados para outro computador Windows, consulte [Transferir para o notebook](docs/TRANSFERIR_NOTEBOOK.md). O Git não inclui banco, senhas de ambiente ou uploads.

Dê dois cliques em **INICIAR_PROJETO.cmd** na pasta do projeto para iniciar os serviços nativos e a aplicação. Mantenha a janela aberta. O primeiro root é configurado pela CLI, uma única vez. Alternativamente:

```powershell
Set-Location C:\Trabalho_Banco_de_Dados
npm.cmd run db:local:start
npm.cmd run mail:local:start
npm.cmd run bootstrap:root
npm.cmd run dev
```

Apenas na primeira vez, bootstrap:root solicita seu nome, e-mail, nome do grupo e senha com pelo menos 10 caracteres. A senha fica oculta e deve ser digitada duas vezes. O comando se recusa a criar um segundo root de inicialização. **Não existe senha padrão nem conta automática.** Nas execuções seguintes, basta iniciar os serviços e executar dev.

Abra [login](http://localhost:3000/login). Entre com o e-mail e senha que você escolheu. Para testar “Esqueci minha senha”, abra a [caixa local do Mailpit](http://localhost:8025), acesse o e-mail recebido e use seu link. Mailpit é apenas para desenvolvimento; não envia mensagens externas.

## Demonstração rápida na faculdade

1. Entre como root e abra Usuários e Grupos pelo menu.
2. Crie um grupo e marque, por exemplo, Biblioteca e Gestão de Cursos. Confirme com a senha da sua conta root.
3. Crie uma conta com papel Usuário nesse grupo e escolha a senha dela. Saia e entre nessa conta: o menu mostra somente os módulos liberados.
4. Volte como root, desmarque um módulo no grupo e entre como usuário: o acesso é removido também no servidor.
5. Confira Eventos para ver o registro das alterações. Perfil permite editar nome/e-mail e trocar a senha.

Para demonstrar Administrador, root atribui esse papel a uma conta. Ela poderá gerenciar somente usuários comuns do próprio grupo. Mudanças no cadastro de uma conta encerram suas sessões. O último root ativo e seu grupo são preservados. Inativação é usada no lugar de exclusão física do histórico.

## Demonstrar a Gestão de Alunos

1. Entre como root e abra **Alunos** no menu. Acesse **Turmas**, crie uma turma e defina a capacidade.
2. Em **Responsáveis**, cadastre um contato. CPF é opcional; informe telefone ou e-mail.
3. Volte a **Alunos**, cadastre o estudante com matrícula única e selecione a turma. A conta de acesso é opcional.
4. Clique em **Abrir ficha**. Vincule os responsáveis e informe o parentesco de cada vínculo.
5. Na ficha, envie um PDF/PNG/JPEG, faça download e registre uma ocorrência. A autoria é preenchida pelo sistema.
6. Para demonstrar acesso do aluno, crie uma conta Usuário em grupo com Gestão de Alunos habilitada. Como root, edite o aluno, selecione essa conta e confirme sua senha. Ao entrar na conta, ela só verá a própria ficha e documentos ativos; ocorrências internas ficam ocultas.

Inclusão, transferência e reativação respeitam as vagas. A inativação preserva registros. Histórico recente usa as mesmas matrículas/notas das tabelas compartilhadas, respeitando habilitações dos módulos. A ficha mostra até 100 documentos/ocorrências e 20 matrículas/notas recentes, com os limites indicados na tela.

## Demonstrar a Gestão de Cursos

1. Entre como root e abra **Cursos** no menu. Crie um curso com carga horária em horas.
2. Em **Professores**, cadastre um docente. Em **Programação**, crie a aula, escolhendo curso/professor, horário de Brasília e duração em minutos.
3. Em **Matrículas**, selecione um aluno já cadastrado na Gestão de Alunos e o curso. Não se cria outra identidade de aluno.
4. Pesquise por aluno ou filtre por curso/status. Abra o curso para ver aulas e matrículas, ou consulte os cursos no histórico da ficha de aluno.
5. Teste repetir uma matrícula ativa: o sistema bloqueia. Conclua ou cancele a anterior para preservar histórico e permitir novo vínculo.
6. Para demonstrar exceção, inative o curso e tente uma nova matrícula: apenas root pode autorizar, preenchendo justificativa e sua senha atual. A operação aparece em Eventos como MATRICULA_EXCEPCIONAL.

Uma conta Usuário com módulo Cursos habilitado pode consultar catálogo/programação e **Minhas matrículas**, mas não cadastrar nem ver os colegas. Ela precisa estar vinculada ao Aluno para ter matrículas próprias. Cursos inativos ficam fora do catálogo comum; o aluno ainda pode consultar seu curso histórico pela própria matrícula. O diretório de professores e alterações são administrativos.

Carga horária não pode ficar abaixo da soma das aulas ativas. Aluno inativo não recebe nova inscrição. Aluno e curso de uma matrícula criada são fixos; corrija o vínculo por cancelamento e novo cadastro. Os códigos de módulo, permissões e demais regras seguem os documentos de planejamento.

## Demonstrar a Gestão de Avaliações

1. Como root, abra **Avaliações**, crie uma prova com liberação no passado (horário de Brasília) e tempo limite em minutos.
2. Em **Gerenciar**, cadastre questões objetivas (alternativas A–D, gabarito e pontos) e discursivas (enunciado e pontos).
3. Crie uma conta Usuário em grupo com **Avaliações** habilitado. Em Alunos, vincule essa conta ao estudante central usando sua senha root. Um Aluno sem conta continua permitido, mas não pode realizar prova pela web.
4. Entre nessa conta, abra a prova e clique **Iniciar avaliação**. Marque as alternativas, escreva as discursivas e use **Salvar respostas** durante a realização. Recarregue para conferir o rascunho.
5. Clique **Finalizar avaliação**. Objetivas são corrigidas automaticamente; provas mistas ficam **Aguardando correção** até o gestor corrigir as discursivas.
6. Como gestor, abra **Resultados e histórico → Ver tentativa**, atribua pontos às discursivas e salve. Como aluno, consulte a nota e o comentário nos próprios resultados. A nota também aparece no histórico da ficha central, com as permissões necessárias.

Uma tentativa por avaliação; não há refazer. Após o primeiro início, conteúdo/pontos/prazo ficam bloqueados. O gabarito do aluno só é revelado ao finalizar. A nota é soma dos pontos, sem conversão de escala. Depois do prazo, somente respostas já salvas contam. O navegador finaliza ao expirar; se estiver fechado, a prova será encerrada ao reabrir ou por ação do gestor. Não há cron em segundo plano. Detalhes e limites em ADR-005.

## Demonstrar a Biblioteca

1. Como root ou Administrador com Biblioteca habilitada, abra **Biblioteca → Categorias** e cadastre uma categoria.
2. Em **Acervo**, cadastre um livro com título, autor e categoria. ISBN é opcional e único.
3. Em **Exemplares**, cadastre um código único, selecione o livro, localização e estado Disponível.
4. Em **Reservas**, escolha um Aluno já cadastrado e um livro; informe a validade futura em Brasília. Reserva não bloqueia exemplar automaticamente.
5. Em **Empréstimos**, escolha o mesmo aluno e um exemplar disponível, com devolução prevista futura. Tente emprestar novamente o mesmo exemplar: será bloqueado.
6. Após registrar o empréstimo, volte à reserva e clique **Atender**. Na lista de empréstimos, clique **Devolver** e confirme. O exemplar fica disponível novamente e o histórico permanece.
7. Abra **Ver livro** no acervo para conferir disponibilidade, exemplares e links para históricos. Pesquise por título/autor/ISBN ou use os filtros.
8. Para acesso do aluno, use uma conta Usuário vinculada ao Aluno e em grupo com Biblioteca habilitada. Ela consulta acervo, **Meus empréstimos** e **Minhas reservas**, sem dados dos colegas. Solicitações e registros de circulação são feitos pelo gestor.

Reservas vencidas aparecem como Expirada; o gestor pode registrar o encerramento por **Registrar expiração**. Não há fila automática, multa, renovação ou cron. Atrasos são calculados pela previsão e ausência de devolução. Repetir uma devolução não desfaz um empréstimo posterior do mesmo exemplar. Regras e limites em ADR-006.

## Demonstrar o Financeiro

1. Como root ou Administrador com Financeiro habilitado, abra **Financeiro → Planos** e crie um plano com valor em reais e periodicidade informativa.
2. Em **Descontos**, selecione um Aluno já cadastrado, tipo percentual/fixo, valor e validade incluindo o dia atual. O desconto é opcional e pertence ao aluno escolhido.
3. Em **Cobranças**, clique **Emitir cobrança**, selecione aluno/plano, desconto opcional e vencimento de hoje ou futuro. Abra **Ver cobrança** para conferir os valores congelados.
4. Clique **Registrar pagamento**, informe parte do saldo, data/hora de Brasília, forma e referência opcional. O estado passa a Parcial. Registre o restante: Paga. Valores superiores ao saldo são bloqueados.
5. Em **Relatórios**, selecione plano/aluno/período de emissão e consulte cobrado, recebido, saldo e vencido. Não é fluxo de caixa por data de pagamento.
6. Para demonstrar estorno, abra a cobrança, clique **Estornar pagamento**, justifique e confirme. O registro fica no histórico e o saldo é recalculado. Após estornar todos os valores recebidos, é possível cancelar a cobrança com justificativa.
7. Use conta Usuário vinculada ao Aluno e em grupo com Financeiro habilitado para consultar **Minhas cobranças** e **Meus pagamentos**. Ela não pode registrar quitação nem ver dados dos colegas.

Pagamentos são registros internos: Pix/cartão são formas informativas, sem acionar bancos ou gateway. Não há cobranças recorrentes, multas/juros ou transferência real. Valores usam decimais; desconto é único por cobrança e válido na emissão. Alterar plano/benefício não muda dívida já emitida. Detalhes em ADR-007.

## Instalação em uma cópia nova

Requisitos: Node.js 24 LTS (testado 24.15.0), npm 11, PostgreSQL 18.4 e Mailpit 1.32.0. Dependências fixadas no package-lock.json. Use Docker com Compose ou a alternativa nativa Windows. Não substitua PostgreSQL por dados em memória.

```powershell
Set-Location C:\Trabalho_Banco_de_Dados
$env:NODE_USE_SYSTEM_CA = '1'
npm.cmd ci
npm.cmd run env:init
docker compose up -d db mailpit
npm.cmd run db:generate
npm.cmd run db:migrate:deploy
npm.cmd run db:seed
npm.cmd run bootstrap:root
npm.cmd run dev
```

Nesta máquina, o Node precisa das autoridades certificadoras do Windows para downloads. NODE_USE_SYSTEM_CA permite isso sem desativar TLS. env:init cria .env com segredos aleatórios sem exibi-los e preserva configurações existentes. O seed cria apenas três papéis e cinco módulos, sem root ou registros acadêmicos fictícios. Preencha SMTP/APP_URL conforme o ambiente; em produção use SMTP real e HTTPS. SMTP_SECURE=true habilita TLS direto conforme a porta do provedor.

Docker não foi encontrado no ambiente de desenvolvimento; a execução do Compose permanece não verificada. O PostgreSQL e Mailpit nativos já estão preparados nesta máquina, em .local, sem serviço global. Para uma cópia nova no Windows sem Docker:

```powershell
npm.cmd ci
powershell -NoProfile -File scripts/setup-native.ps1
npm.cmd run env:init
npm.cmd run db:local:init
npm.cmd run db:local:start
npm.cmd run mail:local:start
npm.cmd run db:generate
npm.cmd run db:migrate:deploy
npm.cmd run db:seed
npm.cmd run bootstrap:root
npm.cmd run dev
```

O empacotador opcional de binários Windows tem sufixo beta, mas o servidor executado é PostgreSQL estável 18.4. Detalhes em ADR-001. Também é possível configurar POSTGRES_BIN com binários oficiais instalados. Não executar Docker e serviços nativos simultaneamente nas mesmas portas.

## Testes e execução de produção local

```powershell
npm.cmd run check
npm.cmd run test:integration
npm.cmd run test:e2e:install
npm.cmd run test:e2e
```

Verificados nesta fase: 36 testes unitários, 119 de integração e 36 E2E, total de 191. check gera o cliente Prisma antes de validar schema, lint, TypeScript, unidade e build. Integração exige TEST_DATABASE_URL distinto da aplicação e terminado em _test, aplica migrações e cria somente fixtures de teste. E2E usa esse banco separado, inicia temporariamente o build na porta 3001 e testa desktop e celular. Execute integração antes do primeiro E2E para preparar o banco e mantenha Mailpit disponível. Não execute integração e E2E simultaneamente sobre o mesmo banco de testes.

Os navegadores ficam em .local/playwright; test:e2e:install só precisa ser executado na primeira vez. As credenciais E2E são aleatórias e removidas ao terminar. Rastros de falhas ficam em test-results, fora do pacote de entrega. Para produção local: `npm.cmd run build` e `npm.cmd run start`. Para parar os serviços nativos: `npm.cmd run mail:local:stop` e `npm.cmd run db:local:stop`.

## Validação integrada e apresentação

Para repetir todos os checks e testes em sequência, use `npm.cmd run test:all`, com PostgreSQL/Mailpit iniciados e TEST_DATABASE_URL configurado. O comando faz check/build, integração com migrações e E2E; não cria alunos de apresentação no banco da aplicação. Na primeira instalação, execute também test:e2e:install.

O [roteiro integrado](docs/VALIDACAO_INTEGRADA.md) apresenta um único Aluno nos cinco módulos, com prova/correção, devolução e duas parcelas que quitam a cobrança. Inclui a matriz de revogação, troca de conta, inativação, rollback e acesso privado. Testes novos ficam em tests/integration/platform.test.ts e tests/e2e/platform.spec.ts; fixtures foram separadas em arquivos de suporte.

## Banco e manutenção

33 tabelas, incluindo as 26 entidades acadêmicas e um Aluno centralizado. Migrações versionadas, FKs, índices parciais, decimais, constraints e triggers. As Fases 3–5 usaram a estrutura existente. A Fase 6 adiciona uma migração que permite múltiplas respostas por tentativa e guarda pontuação/comentário da correção, sem apagar registros.

Comandos: db:validate, db:generate, db:migrate:deploy, db:status, db:seed e db:studio. Para desenvolver nova migração: `npm.cmd run db:migrate:dev -- --name nome_da_mudanca`. Não executar reset, drop de banco ou remoção de volume com dados sem autorização. Arquivos e segredos ficam fora do versionamento. Uploads acadêmicos usam storage/private, fora de public, com tamanho e tipo validados no servidor.

## Documentação

- [Progresso](docs/PROGRESSO.md) e [evidências finais](docs/VERIFICACAO_FASE10.json).
- [Planejamento](docs/PLANO_DESENVOLVIMENTO.md) e [fontes acadêmicas](docs/ANALISE_FONTES.md).
- [Banco](docs/BANCO_DE_DADOS.md), [requisitos](docs/REQUISITOS.md) e [permissões](docs/PERMISSOES.md).
- [Decisão da stack](docs/decisoes/ADR-001-STACK-E-AUTENTICACAO.md) , [núcleo simplificado](docs/decisoes/ADR-002-NUCLEO-ACADEMICO-SIMPLES.md) e [Gestão de Alunos](docs/decisoes/ADR-003-GESTAO-DE-ALUNOS.md).

A decisão de Gestão de Cursos está em [ADR-004](docs/decisoes/ADR-004-GESTAO-DE-CURSOS.md). As listagens são paginadas; a ficha do curso mostra até 200 aulas/100 matrículas recentes, com links para consulta completa.

A implementação de Avaliações está documentada em [ADR-005](docs/decisoes/ADR-005-GESTAO-DE-AVALIACOES.md).

A Biblioteca usa as tabelas existentes, sem nova migração, e está descrita em [ADR-006](docs/decisoes/ADR-006-BIBLIOTECA.md).

O Financeiro usa as tabelas existentes, sem nova migração, conforme [ADR-007](docs/decisoes/ADR-007-FINANCEIRO.md).
