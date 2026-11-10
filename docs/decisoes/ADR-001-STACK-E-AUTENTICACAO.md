# Stack da estrutura inicial e estratégia de autenticação

Decisão em 28/10/2026. O pedido “fase 2” autoriza a continuidade do planejamento apresentado. As escolhas D01–D09 foram usadas como base da estrutura; nenhum endpoint de negócio ou autenticação está liberado nesta etapa. Alterações futuras dessas regras continuarão exigindo revisão explícita.

## Versões

Versões exatas constam de package.json e package-lock.json. Node usado: 24.15.0; Next.js 16.4.3; React 19.3.1; TypeScript 5.9.3; Prisma/client/adapter-pg 7.10.1; PostgreSQL 18.4; Tailwind 4.3.3; Vitest 5.0.5; Playwright 1.64.1; Zod 4.6.7. Não se adotou Prisma 8 porque a tag consultada era release candidate. Instalação sem force e sem legacy-peer-deps.

ESLint ficou em 9.39.5 porque os plugins React, acessibilidade e import do eslint-config-next ainda não aceitam ESLint 10 em suas peerDependencies. O npm sinaliza depreciação do ESLint 9; é uma limitação de ferramenta registrada, sem efeito na execução da aplicação. Não forçar uma árvore incompatível. Reavaliar quando os plugins suportarem a nova versão. A detecção de ciclos usa import-x.

## Autenticação a implementar na Fase 3

Manter o contrato de sessões opacas e revogáveis previsto no plano, com token aleatório via node:crypto, somente hash SHA-256 na tabela Sessao, cookie HttpOnly/SameSite, Secure sob HTTPS e Argon2id via @node-rs/argon2 para senhas. A biblioteca de hashing já foi instalada; login, sessão, recuperação, CSRF e bootstrap ainda não foram implementados.

Auth.js não é obrigatório no pedido (“se adequado”). A documentação v5 consultada usa tag beta; o Credentials provider v4 exige sessões JWT, que não correspondem diretamente ao contrato proposto de token opaco no banco. Better Auth estável foi examinado, mas seu esquema padrão usa user/session/account/verification e senha em Account, exigindo extensões de identidade além das previstas. Nesta implementação, as rotinas de autenticação serão um módulo servidor pequeno, baseado nas primitivas padrão citadas, com os testes obrigatórios de revogação, expiração, CSRF, reset, limitação e escopo antes de considerar a Fase 3 pronta. Esta decisão não representa autenticação já entregue.

Referências oficiais: [Credentials v4](https://next-auth.js.org/providers/credentials), [Auth.js](https://authjs.dev/getting-started/installation?framework=Next.js), [esquema Better Auth](https://better-auth.com/docs/concepts/database), [Prisma 7](https://www.prisma.io/docs/orm/v7), [Next.js App Router](https://nextjs.org/docs/app/getting-started/installation).

## Ambiente local

Docker não foi encontrado na máquina. compose.yaml é o caminho principal reproduzível para PostgreSQL e Mailpit, com imagens fixadas e portas apenas em 127.0.0.1. O Compose não pôde ser executado aqui. Foi usado PostgreSQL nativo 18.4, instalado somente em .local, com SCRAM, porta 54329 e dados isolados; nenhum serviço global foi criado. Mailpit 1.32.0 nativo captura mensagens de teste localmente.

Os binários PostgreSQL foram obtidos do pacote de distribuição @embedded-postgres/windows-x64 18.4.0-beta.17, que tem sufixo beta no empacotador; `postgres --version` confirmou o servidor PostgreSQL estável 18.4. Esse pacote fica fora das dependências de produção e do lockfile da aplicação, em .local/pg-runtime. É uma alternativa exclusiva de desenvolvimento; para produção usar a imagem estável ou instalação oficial. Também é possível apontar POSTGRES_BIN para binários oficiais previamente instalados. [Distribuidor dos binários](https://github.com/leinelissen/embedded-postgres), [PostgreSQL Windows](https://www.postgresql.org/download/windows/).

A conexão npm inicialmente falhou por autoridade certificadora do ambiente; NODE_USE_SYSTEM_CA=1 resolveu sem desativar TLS. Segredos foram gerados aleatoriamente em .env ignorado pelo Git, sem exibição no terminal. env:init preserva configuração existente. Não há root padrão ou dados pessoais demonstrativos no seed.
