# Validação integrada — Fase 9

Solicitada por “fase 9” em 29/10/2026. Versão 0.9.0. Valida o núcleo e os cinco módulos no PostgreSQL e na interface, mantendo as regras acadêmicas das fases anteriores. Não adiciona entidade, migração, dependência ou regra de negócio. Os cenários executados não exigiram correção de comportamento da aplicação.

## Como repetir

Nesta máquina, dependências e Chromium já estão preparados. Na primeira instalação, siga o README, incluindo env:init, configuração de TEST_DATABASE_URL e test:e2e:install.

```powershell
Set-Location C:\Trabalho_Banco_de_Dados
npm.cmd run db:local:start
npm.cmd run mail:local:start
npm.cmd run test:all
```

O comando executa, em sequência: Prisma validate, lint, TypeScript, 31 unitários, build, migrações/testes de integração e Playwright desktop/celular. Integração exige banco _test diferente da aplicação. Fixtures usam nomes/credenciais aleatórios, referências próprias e limpeza por IDs/prefixo; não há reset/truncate nem carga de alunos fictícios na aplicação. Playwright inicia/encerra temporariamente o servidor de teste na porta 3001. Não executar duas suítes sobre o mesmo banco simultaneamente.

## Matriz de integração

| Cenário | Verificação |
| --- | --- |
| Aluno único | Curso/matrícula, tentativa/respostas/nota, empréstimo/reserva e desconto/cobrança/pagamentos apontam para a mesma identidade; não surge cadastro duplicado |
| Serviços reais | Cadastro por Gestão de Alunos; regras de cada módulo processadas por seus serviços e transações, sem substituir operações por INSERTs de fixture |
| Operações concorrentes entre módulos | Matrícula, início da prova, retirada e emissão concorrentes para o mesmo Aluno terminam sem conflito de identidade; concorrência crítica de exemplar/saldo permanece coberta pelas suítes específicas |
| Jornada pela interface | Cadastro/vínculo de conta por formulário; programação e matrícula consultadas; prova enviada; discursiva corrigida em outra conta; devolução e parcelas refletidas na conta do aluno |
| Histórico acadêmico | A ficha central mostra a mesma matrícula e a nota final, sem copiar registros ou criar avaliações por curso/turma |
| Histórico privado | Colega não recebe ficha, tentativa, cobrança, matrículas, empréstimos, reservas ou pagamentos alheios |
| Retirada de módulo | Sessão já aberta passa a receber 403 só na área removida; outros módulos continuam acessíveis; sidebar é atualizada na próxima navegação carregada do servidor |
| Histórico com módulo removido | Notas/matrículas ficam ocultas na ficha conforme as habilitações, mantendo registros no banco |
| Inativação de Aluno | Novas operações acadêmicas são recusadas; consulta, conclusão de matrícula, devolução e liquidação de dívida existente preservadas; prova expirada encerrada/corrigida pelo gestor |
| Troca autorizada de conta | Root com senha move o vínculo; conta antiga perde os históricos e a nova os recebe pela mesma FK, sem recriar Aluno/tentativa |
| Vínculo inválido | Senha incorreta ou conta já vinculada são recusadas; Aluno e históricos anteriores permanecem íntegros |
| Aluno sem conta | Recebe matrícula, reserva e cobrança administrativas; após vincular Usuario, passa a consultar os mesmos registros e pode iniciar prova |
| Grupo/conta inativos | Todas as sessões centrais são revogadas e as áreas protegidas retornam 401; reativação de grupo exige novo login, sem apagar históricos |
| Rollback de operação | Matrícula duplicada, resposta inválida e pagamento excedente não deixam alterações parciais nem corrompem registros dos outros módulos |
| FKs e exclusão | Aluno com históricos não pode ser removido fisicamente; consultas e vínculos permanecem íntegros após a recusa |
| Segurança HTTP | Mutação de Usuário comum e Origin externo recusados em todos os módulos; gabarito permanece fora do DTO em andamento |
| Auditoria | Autoria/referência dos eventos preservadas; senha e hash não são enviados nos históricos |

Transações são por operação de cada módulo. A jornada completa não é uma transação única: etapas administrativas anteriores permanecem registradas quando outra operação é recusada. Grupo continua sendo um conjunto de habilitações, não uma instituição com propriedade dos dados acadêmicos; a integração mantém D01.

## Arquivos de teste

- tests/integration/platform.test.ts: 11 casos novos com serviços reais, concorrência entre módulos, vínculo de conta, histórico, revogação e integridade.
- tests/support/integrated-platform.ts: preparação/limpeza e construção do cenário com serviços; dados separados do código da aplicação.
- tests/e2e/platform.spec.ts: duas jornadas executadas em Chromium desktop e Pixel 7, totalizando quatro testes novos.
- tests/e2e/support/platform-fixture.ts: identidades temporárias e preparação por APIs reais; o cadastro do Aluno da jornada principal é feito pela interface.

Total da suíte ao concluir a Fase 9: 182 testes — 31 unitários, 119 de integração e 32 E2E. O banco mantém 33 modelos e três migrações; diff/status conferidos. As 13 fontes acadêmicas e cópias foram verificadas por SHA-256. Evidências em VERIFICACAO_FASE9.json.

## Roteiro para apresentar na faculdade

1. Como root, crie grupo com os cinco módulos e uma conta Usuário. Em Alunos, crie turma/Aluno e vincule essa conta com sua senha root. Guarde a matrícula e use sempre esse mesmo cadastro.
2. Em Cursos, cadastre curso, professor e aula, e matricule esse Aluno.
3. Em Avaliações, crie prova já liberada com uma objetiva de 2 pontos e uma discursiva de 3 pontos.
4. Na Biblioteca, crie categoria/livro/exemplar, registre reserva e empréstimo para o Aluno.
5. No Financeiro, crie plano de R$ 100,50, desconto de 10% válido para o Aluno e uma cobrança: valor final de R$ 90,45.
6. Abra a conta do aluno em janela anônima, mantendo root na janela normal. Consulte matrícula/programação, responda a prova, salve e finalize.
7. Como root, corrija a discursiva com 2,5 pontos. O aluno passa a ver 4,5 de 5 pontos, inclusive no histórico da ficha acadêmica.
8. Registre devolução e atendimento da reserva. Registre parcelas de R$ 40,20 e R$ 50,25. Atualize a janela do aluno e confira empréstimo devolvido, reserva atendida, cobrança paga e saldo zero.
9. Remova um módulo do grupo e confira a recusa no acesso pela conta já aberta. Reabilite. Inative o grupo e confira necessidade de novo login; dados permanecem no banco.

## Limites da verificação

A entrega cobre o MVP local com os fluxos e papéis definidos. Não foi feito teste de carga, pentest externo, auditoria jurídica/LGPD, publicação ou homologação de infraestrutura de produção. Docker Compose permanece sem execução porque Docker não está disponível nesta máquina. Não se alteraram as políticas já documentadas de tentativa única, reserva sem fila e pagamentos internos sem gateway. A revisão final está em REVISAO_FINAL.md; procedimentos, em GUIA_EXECUCAO.md.
