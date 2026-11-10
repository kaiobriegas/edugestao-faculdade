# Levar o EduGestão para o notebook Windows

O repositório privado leva código, diagramas e documentação. Contas, registros e arquivos enviados ficam fora do Git. Para manter as contas e os dados DEMO atuais, copie o backup pelo seu pendrive ou outro meio privado.

Preparação verificada em 10/11/2026: backup e restauração em banco temporário exclusivo, contagem das 33 tabelas da aplicação mais migrações, preservação das contas/hashes e recusa de sobrescrita de banco preenchido. O banco temporário foi removido após o teste. A instalação no notebook ainda deve ser executada nesse equipamento.

## Neste computador

Feche a aplicação durante a preparação da cópia para evitar alterações após o backup. Mantenha PostgreSQL disponível e execute na pasta do projeto:

```powershell
cd C:\Trabalho_Banco_de_Dados
npm.cmd run db:local:start
powershell -NoProfile -File scripts/setup-transfer-tools.ps1
node scripts/transfer-database.mjs backup
```

O comando mostra uma pasta nova dentro de `backups`. Copie essa pasta inteira para o notebook: inclui `educacional.dump` e seu checksum. Contém dados privados e hashes de senha; mantenha fora do GitHub. Se houver documentos enviados, copie também `storage\private` pelo mesmo meio, preservando nomes e conteúdo. O backup é uma fotografia dos dados no instante da execução.

## No notebook — instalar e clonar

Instale Git para Windows e Node.js 24 LTS compatível com `package.json` (>=24.11 e <25), com npm. Use sua conta GitHub kaiobriegas na autenticação do Git; repositórios privados exigem login. Não digite sua senha do GitHub como senha de Git: use o fluxo do Git Credential Manager que abrir no navegador.

O repositório é https://github.com/kaiobriegas/edugestao-faculdade (privado). Execute:

```powershell
cd C:\
git clone https://github.com/kaiobriegas/edugestao-faculdade.git Trabalho_Banco_de_Dados
cd C:\Trabalho_Banco_de_Dados
$env:NODE_USE_SYSTEM_CA = '1'
npm.cmd ci
npm.cmd run env:init
powershell -NoProfile -File scripts/setup-native.ps1
npm.cmd run db:local:init
npm.cmd run db:local:start
npm.cmd run db:generate
```

Essa preparação requer internet para baixar código, dependências e serviços. `.env` é gerado com novas credenciais locais; não copie o `.env` antigo nem publique o arquivo. Os comandos abaixo usam os binários PostgreSQL preparados pelo projeto, sem exigir Docker. Fluxo indicado para Windows x64.

## Opção A — manter as contas e os dados atuais

Com o banco de destino ainda vazio, copie a pasta de backup para uma pasta local do notebook e informe o caminho real do arquivo:

```powershell
powershell -NoProfile -File scripts/setup-transfer-tools.ps1
node scripts/transfer-database.mjs restore "C:\CAMINHO_DO_BACKUP\educacional.dump" --apply
npm.cmd run db:status
```

**Antes dessa restauração, não execute migrações, seed ou bootstrap:** o backup já contém estrutura, migrações e contas. A ferramenta confere o checksum e recusa banco com tabelas, sequências ou outros objetos de dados existentes. Não apaga nem substitui um banco já preparado.

Se houver documentos, copie seu conteúdo de volta para `C:\Trabalho_Banco_de_Dados\storage\private`. Inicie `INICIAR_PROJETO.cmd`, abra http://localhost:3000/login e use as mesmas contas/senhas que utilizava neste computador. Confira aluno, matrícula, avaliação, biblioteca e cobrança. A nova configuração do banco não altera as senhas de login das contas restauradas.

## Opção B — começar com banco novo

Se não quiser levar os dados atuais, não restaure backup. Execute:

```powershell
npm.cmd run db:migrate:deploy
npm.cmd run db:seed
npm.cmd run bootstrap:root
npx.cmd tsx scripts/prepare-demo.ts --apply
npx.cmd tsx scripts/prepare-demo-accounts.ts --apply
```

O bootstrap solicita sua nova conta root. Os scripts DEMO criam os exemplos e informam novas senhas para as contas demonstrativas; não serão as senhas do outro computador. Depois abra `INICIAR_PROJETO.cmd` e http://localhost:3000/login.

## Atualizar o código depois

No computador em que editou, revise `git status`, faça commit e push. No notebook, com trabalho local salvo, execute `git pull --ff-only` e `npm.cmd ci`. Migrações novas, quando houver, usam `npm.cmd run db:migrate:deploy`. O Git sincroniza código; as duas bases locais continuam independentes. Mudanças de dados feitas depois do backup não aparecem automaticamente no outro computador.

## Conferência antes da apresentação

- Confirme o selo **Private** no repositório e preserve essa visibilidade.
- Abra e teste o projeto no notebook antes do dia da apresentação.
- Confira as contas root, Administrador e Usuário, além do vínculo da Ana DEMO.
- Confira datas e estados dos exemplos: prova ainda não usada, empréstimo aberto e saldo a pagar.
- Depois que as dependências e serviços estiverem preparados, as funções locais não dependem de hospedar o site na internet.
