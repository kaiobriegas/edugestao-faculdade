# Papéis grupos e autorizações

Versão 1.0.0: núcleo, cinco módulos, integração e revisão final concluídos. O escopo enxuto usa os três papéis globais fixos, sem permissões configuráveis extras.

Base: RN-01.01–04 e solicitação de autorização no servidor. O núcleo adota D01; o vínculo acadêmico D02 permanece preparado no schema para a Fase 4. Grupo é um conjunto de habilitações, não uma instituição ou proprietário de alunos no modelo acadêmico. Não afirmar isolamento por grupo para alunos sem uma relação de escopo aprovada.

## Política de acesso

Uma operação exige sessão válida, Usuario ativo e Grupo ativo, papel autorizado, módulo ativo/habilitado para o grupo e permissão sobre o registro. O root tem acesso administrativo global e pode gerenciar habilitações; não recebe acesso com conta desativada. Sua exceção à habilitação de módulos para administração é explícita, não aplicada aos demais papéis. O guard de rota melhora navegação; a decisão definitiva ocorre no serviço de cada operação e consulta.

Regra implementada para Administrador: gerenciar contas Usuário do próprio grupo, sem alterar o próprio papel/grupo, nomear administradores, conceder root, editar políticas ou aumentar habilitações. A concessão e remoção de módulos ficam com root. Administradores podem gerenciar registros acadêmicos institucionais apenas nos módulos habilitados, conforme confirmação D01. Caso o solicitante deseje delegações entre grupos, elas exigirão modelo explícito, sem permissões inferidas por nome.

Usuário comum tem perfil e consultas de catálogo/programação nos módulos habilitados. Autoatendimento com dados pessoais exige vínculo D02; o servidor obtém alunoId da sessão validada, nunca aceita identidade de outro aluno por parâmetro. Não há conta de responsável nem conta obrigatória de professor no modelo atual.

| Operação | Root | Administrador, proposta D01 | Usuário |
| --- | --- | --- | --- |
| Perfil e senha próprios | Sim | Sim | Sim |
| Papéis, grupos, administradores, catálogo e habilitações | Global | Consulta do próprio grupo | Não |
| Criar/editar/ativar contas | Global | Só contas Usuário do próprio grupo | Não |
| Vincular conta e aluno | Sim | Não | Não |
| Gerir alunos, turmas e responsáveis | Global | Módulo Alunos habilitado | Só perfil acadêmico próprio para leitura |
| Documentos de aluno | Gestão global auditada | Módulo Alunos habilitado | Consulta/download próprios, sem ocorrências internas |
| Registrar/consultar ocorrências | Global | Módulo Alunos habilitado | Não |
| Gerir cursos, aulas e professores | Global | Módulo Cursos habilitado | Catálogo e programação publicados |
| Criar e alterar matrículas | Global | Módulo Cursos habilitado | Consulta das próprias |
| Autorizar matrícula em curso inativo | Sim, se D07 | Não, proposta | Não |
| Gerir avaliações, gabaritos e correções | Global | Módulo Avaliações habilitado | Não |
| Responder prova e consultar resultados | Somente no contexto acadêmico vinculado | Somente no contexto acadêmico vinculado | Apenas próprios, D02/D03 |
| Acervo e disponibilidade | Sim | Biblioteca habilitada | Biblioteca habilitada |
| Empréstimos e devoluções | Global | Biblioteca habilitada | Histórico próprio |
| Criar/cancelar reservas | Global | Biblioteca habilitada | Próprias, se Biblioteca habilitada |
| Planos, descontos, cobranças e pagamentos | Global | Financeiro habilitado | Consulta própria, sem registrar quitação |
| Relatórios financeiros e auditoria | Global | Relatórios do módulo; eventos do próprio grupo e operações autorizadas | Não |

## Regras de implementação e teste

- Negar por padrão; validar permissão também em download, busca, exportação, dashboard, relações selecionáveis e endpoints chamados diretamente.
- Filtrar dados antes de paginação/contagem. Não buscar todos os registros para depois esconder no cliente. Retornar 401 para sessão ausente e 403 para acesso negado, com política uniforme para não revelar existência de registro alheio.
- Módulo desabilitado impede acesso mesmo com URL conhecida; mudança de papel, grupo, atividade ou habilitação tem efeito na próxima operação. Não usar papel de JWT desatualizado como fonte definitiva.
- Cadastro de matrícula/cobrança depende da identidade de aluno central, mas não deve liberar automaticamente todo o módulo Alunos. Expor apenas seletor mínimo com ID, matrícula e nome aos gestores autorizados do módulo consumidor.
- Não aceitar `papelId`, `grupoId`, `alunoId`, preço, nota ou privilégio por atribuição em massa. Cada caso de uso valida campos e alvos permitidos.
- Gabarito nunca integra DTO de realização, HTML, payload de componente servidor ou erro. Publicação de resultado obedece D03. Acesso de gestão ao gabarito é explícito.
- Alteração da última conta root ativa será bloqueada; mudanças de privilégios exigem reautenticação e auditoria. Conta comum não pode promover a si ou terceiros.
- Testar matriz por papel, módulo, grupo e dono do registro, incluindo chamadas diretas, IDs trocados, sessão revogada e exportação.

O pedido de continuidade autorizou o núcleo com esse alcance, mantido no MVP acadêmico. Alterações futuras de escopo e cardinalidade continuam exigindo confirmação. A interface confirma mutações com senha atual; não permite apagar fisicamente históricos.


## Catálogos e sessão implementados

Root edita descrições dos papéis existentes e nome/descrição/ativação dos cinco módulos; seus códigos e os três nomes de papéis são fixos. Usuários e grupos podem ser criados, editados e inativados. Cada API faz autorização no servidor e valida Origin nas mutações. Sessões duram oito horas e alterações de conta/e-mail/senha as revogam. Login admite até dez solicitações por conta em quinze minutos; recuperação admite quatro, com token de trinta minutos. As páginas de módulos nesta etapa informam implementação futura e não exibem dados acadêmicos.


## Gestão de Alunos implementada

Root e administrador com módulo alunos podem gerenciar o cadastro acadêmico institucional. Apenas root altera Aluno.usuarioId, com senha atual; não se vincula por e-mail automaticamente. Usuário com módulo habilitado lê somente o Aluno cujo usuarioId seja seu ID de sessão. Sem vínculo, a lista fica vazia. Listagens de turmas/responsáveis e todas as mutações exigem gestor. Conta inativa ou módulo removido bloqueiam a próxima operação.

Documentos são entregues exclusivamente pela API autenticada, após conferir vínculo; documento alheio ou arquivado retorna 404 para aluno. A chave de armazenamento não é enviada ao cliente. Ocorrências são internas aos gestores e seu autor vem da sessão; campo de autor informado pelo cliente é rejeitado. Histórico de cursos e notas depende da habilitação dos respectivos módulos, mesmo na ficha de aluno.


## Gestão de Cursos implementada

Root e administrador com cursos habilitado gerenciam cursos, professores, aulas e matrículas. Usuário consulta cursos ativos/programação e somente matrículas cujo Aluno.usuarioId seja sua própria conta. Não há autoinscrição nem diretório de professores para usuário comum. O nome do docente aparece na programação, sem seu e-mail. A ficha do curso não retorna colegas para Usuário; curso inativo sem vínculo próprio retorna 404.

O gestor pode selecionar o aluno por ID, nome, matrícula e atividade sem receber contatos, documentos ou ocorrências. Nova matrícula/reativação em curso inativo exige root, senha e justificativa; possuir papel Administrador ou conhecer senha root não substitui a sessão root. Desabilitar o módulo bloqueia a próxima consulta. Acesso ao histórico acadêmico obedece às mesmas habilitações.


## Gestão de Avaliações implementada

Root e Administrador com avaliacoes habilitado gerenciam avaliações e questões, consultam resultados institucionais, corrigem discursivas finalizadas e encerram tentativas expiradas. Usuário acessa catálogo ativo e somente suas tentativas/resultados, vinculadas pelo Aluno.usuarioId da sessão. Sem conta acadêmica vinculada, não inicia prova. Catálogo comum não inclui questões nem gabarito; tentativa só é entregue após conferir proprietário. Antes da finalização, não são serializados gabarito, pontuação obtida ou comentário para o aluno. Após finalizar, esses campos são liberados ao dono; a nota só existe quando todas as discursivas respondidas foram corrigidas.

Conteúdo e duração bloqueados após iniciar, inclusive para root. Inativação da avaliação preserva acesso à tentativa própria já existente e permite concluí-la. Sem autoatribuição de alunoId, nota, privilégios ou tentativas extras. Remover o módulo, inativar a conta/grupo ou trocar o dono bloqueia a próxima operação autenticada. Aluno acadêmico inativo não inicia/salva/envia, mas pode consultar o histórico; gestor pode encerrar prova expirada. IDs alheios retornam 404. Professor acadêmico não ganha acesso administrativo automaticamente.


## Biblioteca implementada

Root/Administrador com Biblioteca habilitada gerenciam categorias, livros, exemplares, empréstimos/devoluções e reservas/encerramentos. Usuário com módulo habilitado pesquisa acervo e exemplares ativos e consulta somente seus empréstimos/reservas via Aluno.usuarioId da sessão. Sem conta vinculada, o histórico próprio fica vazio. Retirada/reserva são solicitadas ao gestor, não criadas pelo Usuário.

Livro inativo só é consultável por gestor ou dono de histórico de empréstimo/reserva; não aparece no catálogo comum. A ficha do livro não lista tomadores nem seus dados. Filtros de aluno e opções de cadastro são administrativos; forjar alunoId no filtro resulta em 403. DTO do gestor seleciona apenas ID, nome, matrícula e atividade para operar com Aluno sem habilitar acesso amplo ao módulo Alunos. Todas as mutações checam papel/módulo novamente na transação e validam Origin/campos permitidos. Não é permitido devolver em nome de gestor apenas por conhecer um ID.


## Financeiro implementado

Root/Administrador com Financeiro habilitado gerenciam planos/descontos, emitem cobranças, registram pagamentos internos, estornam, cancelam e consultam relatórios. Usuário consulta apenas cobranças/pagamentos do Aluno.usuarioId da sessão; sem vínculo, a lista fica vazia. IDs alheios retornam 404 e filtro de aluno não administrativo, 403. Não aceita preço/status/aluno por atribuição em massa no pagamento.

Valor e desconto da cobrança vêm do servidor. Estorno/cancelamento exigem justificativa; estorno registra autor FK e auditoria. Nome do autor de estorno só é enviado ao gestor, mas motivo é consultável na própria cobrança. Seletor administrativo de Aluno expõe apenas ID/nome/matrícula/atividade, sem liberar outros dados acadêmicos. Gravações revalidam ator/papel/módulo dentro da transação e conferem Origin. Não há operação de pagamento real por qualquer papel.


## Verificação cruzada na Fase 9

Sessão aberta é reavaliada quando uma habilitação muda: só o módulo removido fica proibido e os demais continuam autorizados. Remover Alunos não remove a identidade acadêmica nem exige habilitá-lo para consultar o próprio financeiro/biblioteca. A ficha acadêmica filtra notas e matrículas conforme os respectivos módulos. Inativar grupo/conta revoga sessões globalmente; reabilitar o grupo não ressuscita o token revogado.

Troca de conta do Aluno exige root e senha válida; a conta antiga perde acesso aos históricos por FK, e a nova os recebe sem duplicação. Conta já vinculada é recusada. Colega não acessa ficha, tentativa, cobrança ou históricos alheios. Essas políticas foram verificadas nos serviços e nas cinco APIs, inclusive com cookies já existentes, IDs alterados e Origin externo. Ver VALIDACAO_INTEGRADA.md.


## Revisão final

Sessões/headers privados, limites JSON e proteção de arquivos/configuração reconferidos por E2E. O teclado permite pular menu, identificar página ativa e controlar foco dos formulários. A política de autorização não mudou; não há senha padrão. APP_URL aceita HTTP/HTTPS sem credenciais. Testes/credenciais temporários são separados da aplicação. Limites da revisão em REVISAO_FINAL.md.
