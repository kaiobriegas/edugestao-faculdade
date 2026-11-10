# Contas de demonstração — etapa 2

Criadas no banco local, no grupo **DEMO — Apresentação**, com os cinco módulos habilitados. A conta root existente foi preservada.

| Papel | E-mail | Uso |
| --- | --- | --- |
| Administrador | admin.demo@example.com | Gestão dos módulos habilitados, sem concessão de root ou alteração global de habilitações |
| Usuário | aluno.demo@example.com | Vinculado à DEMO — Ana Silva, matrícula DEMO-2026-001; histórico próprio e realização da prova disponível |

As senhas foram geradas aleatoriamente e informadas no chat após a criação. Apenas seus hashes Argon2id são armazenados no banco; as senhas não integram este documento nem o código. Se precisar trocá-las, use o gerenciamento de usuários autenticado como root ou a recuperação de senha local.

## Testar no navegador

1. Mantenha sua sessão root aberta na janela normal.
2. Abra uma janela anônima e entre em http://localhost:3000/login com o Administrador. Confira o papel abaixo do nome e os módulos.
3. Saia dessa conta antes de entrar com aluno.demo@example.com na janela anônima. Janelas anônimas do mesmo navegador podem compartilhar a sessão.
4. Na conta da Ana, confira as matrículas, resultado da prova de histórico, empréstimo e cobrança preparados na etapa 1. Estados podem mudar se já houve devolução ou pagamento.
5. Para demonstrar uma prova, abra **DEMO — Prova para responder ao vivo**. Salve as respostas e finalize apenas quando desejar usar essa tentativa. O gabarito é protegido durante a realização.

## Verificação realizada

Login e sessão conferidos pelo serviço real de autenticação para os dois e-mails; cinco módulos disponíveis; papel correto; conta Usuário ligada ao aluno correto e sem permissão administrativa; Administrador sem poder conceder root. Sessões criadas pela verificação foram encerradas. Lint do script e TypeScript aprovados. Não houve nova execução da suíte completa ou teste visual nesta etapa.

O script opcional `scripts/prepare-demo-accounts.ts --apply`, executado com tsx na pasta do projeto, inclui as duas contas, grupo/habilitações e vínculo em transação, com evento técnico de carga. Recusa sobrescrever e-mails ou vínculo já utilizados e não altera módulos globais. Um marcador impede repetição da criação e troca de senhas; uma segunda execução foi conferida sem alterações.
