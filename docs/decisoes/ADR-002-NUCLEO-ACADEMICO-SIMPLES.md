# Núcleo simples para apresentação acadêmica

Em 28/10/2026, o solicitante pediu agilidade e menor complexidade para o trabalho da faculdade e autorizou a Fase 3. Mantivemos a arquitetura local existente, sem serviços novos, filas, provedor de identidade ou sistema de permissões configurável por ação.

O acesso usa três papéis fixos: root, Administrador e Usuário. Root cria/edita/inativa contas e grupos, atribui os papéis, altera descrições de papéis e nome/descrição/ativação dos cinco módulos. Os códigos dos módulos e os três nomes de papéis permanecem estáveis. Um registro novo arbitrário de módulo não instala funcionalidades; por isso não há criação de catálogos executáveis pela interface. Isso preserva o conjunto acadêmico, sem introduzir papéis sem política definida.

Administrador gerencia somente contas de papel Usuário do próprio grupo. Não concede módulos, não muda o próprio papel e não opera em outro grupo. Usuário usa perfil e módulos habilitados. Dados acadêmicos continuam centralizados; ainda não existem operações acadêmicas expostas. Os cadastros são removidos operacionalmente por inativação, preservando relacionamentos e auditoria. Não há exclusão física de histórico pela interface.

As rotas HTTP checam sessão no servidor. Mutações checam Origin contra APP_URL (com equivalência localhost/127.0.0.1 apenas no mesmo protocolo e porta local), validam JSON com Zod e exigem senha atual de confirmação nos cadastros administrativos e perfil. Três serviços pequenos cuidam de autenticação, administração e consultas. O cadastro central de Aluno e o modelo acadêmico não foram modificados nesta fase.

Senhas usam Argon2id com memória de 19 MiB, duas passagens e paralelismo 1. Sessões de oito horas possuem token aleatório de 32 bytes, somente hash SHA-256 no banco e cookie HttpOnly/SameSite=Lax; Secure quando APP_URL usa HTTPS. Alterações em contas e senha revogam sessões; sessão também revalida atividade, grupo, papel e módulos. O último root ativo e seu grupo não podem ser desativados. Mudanças administrativas são serializadas por bloqueio transacional do PostgreSQL.

Login permite até dez solicitações por e-mail em quinze minutos; recuperação, quatro. Contadores são persistentes e identificados por HMAC com segredo de ambiente, sem e-mail em claro. A recuperação responde uniformemente, cria token de trinta minutos com hash no banco, consome uma única vez e encerra sessões ao redefinir. No ambiente local, Mailpit captura o e-mail; produção exige SMTP configurado e HTTPS. A confirmação da interface usa diálogo nativo acessível.

O primeiro root não é criado com senha padrão. A CLI bootstrap:root pede nome, e-mail, grupo e senha oculta com confirmação; a operação recusa repetição e concorrência. O teste do serviço verifica criação, hash e bloqueio da segunda inicialização. O banco de trabalho permanece sem conta criada automaticamente, para o solicitante escolher seus dados no terminal.

A navegação inclui áreas dos cinco módulos, mas essas páginas apenas comprovam habilitação e informam as próximas fases. Não se apresentam cadastros acadêmicos como já entregues. Os testes E2E usam banco _test separado, contas temporárias aleatórias e Mailpit local, com limpeza dos registros próprios. Nenhuma senha de teste ou da aplicação integra o pacote de entrega.
