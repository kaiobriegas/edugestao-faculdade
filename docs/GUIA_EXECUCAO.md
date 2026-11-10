# Guia de execução e apresentação — EduGestão 1.0.0

Projeto em C:\Trabalho_Banco_de_Dados. Núcleo e cinco módulos integrados, com PostgreSQL real e um Aluno central. Não existe conta ou senha padrão.

## Abrir nesta máquina

Dê dois cliques em **INICIAR_PROJETO.cmd** na raiz do projeto. Ele inicia PostgreSQL/Mailpit nativos e a aplicação na porta 3000. Mantenha a janela aberta e acesse http://localhost:3000/login.

Se for o primeiro acesso, abra outro terminal na pasta e execute `npm.cmd run bootstrap:root`. Escolha nome, e-mail, grupo e senha com pelo menos dez caracteres. A senha fica oculta e deve ser digitada duas vezes. O comando recusa criar outro root inicial. Depois, entre normalmente.

Alternativa ao duplo clique:

```powershell
Set-Location C:\Trabalho_Banco_de_Dados
npm.cmd run db:local:start
npm.cmd run mail:local:start
npm.cmd run dev -- --port 3000
```

Para encerrar a aplicação, pressione Ctrl+C e confirme S se o Windows perguntar. Os dados permanecem. Para parar também os serviços, execute `npm.cmd run mail:local:stop` e `npm.cmd run db:local:stop`.

“Esqueci minha senha” envia a recuperação para http://localhost:8025. Mailpit é local e não envia mensagens externas.

## Instalar a partir do ZIP

Extraia em uma pasta nova. O pacote não contém .env, banco, uploads, dependências, navegadores ou build. Preserve seus dados locais ao atualizar uma instalação existente.

Requisitos: Node.js 24 LTS, npm 11, PostgreSQL 18.4 e Mailpit 1.32.0. Verificados Node 24.15.0 e npm 11.12.1. Na pasta extraída:

```powershell
$env:NODE_USE_SYSTEM_CA = '1'
npm.cmd ci
npm.cmd run env:init
```

env:init cria segredos aleatórios sem exibi-los e preserva um .env existente. Ajuste URLs/portas ao ambiente. APP_URL precisa ser HTTP/HTTPS sem credenciais; para a demonstração, http://localhost:3000.

Com Docker, execute `docker compose up -d db mailpit`. Sem Docker no Windows:

```powershell
powershell -NoProfile -File scripts/setup-native.ps1
npm.cmd run db:local:init
npm.cmd run db:local:start
npm.cmd run mail:local:start
```

Primeira configuração do banco:

```powershell
npm.cmd run db:generate
npm.cmd run db:migrate:deploy
npm.cmd run db:seed
npm.cmd run bootstrap:root
npm.cmd run dev -- --port 3000
```

O seed cria somente três papéis e cinco módulos, sem root ou alunos fictícios. Docker Compose foi fornecido, mas não executado nesta máquina por ausência do Docker; os serviços nativos foram verificados.

## Verificações e modo otimizado

```powershell
npm.cmd run test:e2e:install
npm.cmd run test:all
```

A instalação do Chromium só é necessária na primeira vez. test:all gera Prisma antes de TypeScript, valida schema/lint/tipos/unidade, faz build e executa integração/interface. TEST_DATABASE_URL deve ser PostgreSQL, terminar em _test e ser distinto da aplicação. O guard reconhece aliases de loopback e porta padrão, sem expor URLs em erros. Não rode duas suítes no mesmo banco simultaneamente.

Para execução otimizada local: `npm.cmd run build` e `npm.cmd run start -- --port 3000`.

Uma cópia limpa instalou dependências com npm ci e passou por check/build. O servidor de produção local respondeu login/health 200, banco conectado, redirecionamento privado 307, API privada 401 e /.env 404. Usou banco exclusivo de testes e não criou contas de apresentação. Publicação/homologação em produção não fazem parte da entrega.

## Apresentação em 5–8 minutos

1. Como root, mostre usuários, grupos, papéis e módulos. Crie uma conta Usuário em grupo com os cinco módulos.
2. Crie turma/Aluno e vincule a conta com sua senha root. Use sempre a mesma matrícula acadêmica.
3. Crie curso, professor e aula; matricule o Aluno e mostre a programação.
4. Crie prova liberada com objetiva de 2 pontos e discursiva de 3. Na conta do aluno em janela anônima, responda, salve e finalize. Como gestor, atribua 2,5 na discursiva: nota 4,5 de 5, também na ficha acadêmica.
5. Cadastre categoria/livro/exemplar; registre reserva, empréstimo e devolução. Confira disponibilidade e histórico.
6. Use plano de R$ 100,50 e desconto válido de 10%. Emita R$ 90,45 e registre parcelas de R$ 40,20 e R$ 50,25: Parcial → Paga, saldo zero. Mostre o relatório.
7. Remova um módulo do grupo: o acesso é bloqueado também no servidor. Mostre Eventos e histórico preservado.

Use dados fictícios na apresentação. Os testes não deixam dados permanentes. Para repetir uma prova já iniciada, crie outra avaliação: a política é uma tentativa, sem reabertura automática.

## Dúvidas rápidas

| Situação | Ação |
| --- | --- |
| npm.ps1 bloqueado | Use npm.cmd |
| Banco indisponível | Inicie PostgreSQL/Compose; confira porta e URLs |
| Porta 3000 ocupada | Feche outra execução; outra porta exige APP_URL correspondente |
| Recuperação não chegou | Inicie Mailpit e abra localhost:8025 |
| Módulo ausente | Root deve habilitá-lo para o grupo; conta/grupo precisam estar ativos |
| Histórico próprio vazio | Root deve vincular Usuario ao Aluno correto |
| Empréstimo recusado | Confira atividade do catálogo/aluno e ausência de empréstimo aberto |
| Desconto recusado | Confira titularidade e validade na emissão |
| Plano editado não mudou dívida | Valores ficam congelados na emissão |

## Dados e backup

Banco, .env e storage/private não entram no ZIP. Guarde-os em local protegido. Faça backup lógico com pg_dump do PostgreSQL, solicitando a senha interativamente, e preserve também os uploads e a configuração. O dump não inclui arquivos enviados. Planeje restauração para um banco novo; nenhuma restauração foi executada sobre seus dados nesta entrega. Não remova volumes ou arquivos locais para reiniciar a apresentação.

## Escopo final

Tentativa única; reservas sem fila/multa/renovação automática; pagamentos internos sem gateway; emissão financeira manual. Limites de listas/fichas permanecem documentados. Não houve teste de carga, pentest externo, auditoria jurídica/LGPD formal ou implantação pública. Revisão e evidências em REVISAO_FINAL.md e VERIFICACAO_FASE10.json.
