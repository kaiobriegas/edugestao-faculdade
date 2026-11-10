# EduGestão — roteiro para apresentação

Fase 11 complementar: preparação da apresentação acadêmica. Aplicação 1.0.0. Este roteiro descreve o sistema implementado; não acrescenta funcionalidades ao escopo das dez fases originais.

## Antes de apresentar

- Abra `INICIAR_PROJETO.cmd` na pasta `C:\Trabalho_Banco_de_Dados` e mantenha a janela aberta. Entre em http://localhost:3000/login.
- Se ainda não existir sua conta root, execute `npm.cmd run bootstrap:root` em outro terminal nessa pasta e escolha suas credenciais. Não compartilhe a senha na apresentação.
- Prepare os registros abaixo pela própria interface, usando apenas dados inventados e um prefixo como `DEMO`. Nenhum dado de apresentação foi inserido automaticamente nesta fase.
- Use uma janela normal para o gestor e uma janela anônima para a conta Usuário vinculada ao aluno. Confira ambas antes da aula.
- Ensaie a avaliação uma vez com um aluno separado: o sistema permite uma tentativa por aluno/avaliação. Para a apresentação, use outra avaliação ou outro aluno, preparados pela interface.
- Reserve aproximadamente 8 minutos. Deixe o projeto aberto antes de iniciar sua fala.

## Preparação dos dados pela interface

| Área | Preparar | Finalidade |
| --- | --- | --- |
| Administração | Grupo DEMO com os cinco módulos e uma conta de papel Usuário | Mostrar acesso restrito e histórico próprio |
| Alunos | Turma DEMO com capacidade suficiente; aluno DEMO com matrícula exclusiva | Identidade acadêmica usada em todos os módulos |
| Vínculo | Como root, vincular a conta Usuário ao aluno e confirmar com sua senha | Mostrar que conta e cadastro acadêmico são diferentes |
| Cursos | Curso ativo DEMO, professor e aula com duração/data válidas | Demonstrar programação e matrícula |
| Avaliações | Avaliação ativa e liberada, dentro da janela aplicável, com tempo suficiente; objetiva de 2 pontos e discursiva de 3 | Mostrar aplicação e correção |
| Biblioteca | Categoria, livro e exemplar ativo disponível; datas de retirada/devolução coerentes | Demonstrar retirada e retorno ao acervo |
| Financeiro | Plano de R$ 100,50 e desconto percentual de 10% válido para o aluno | Demonstrar cobrança de R$ 90,45 e pagamentos parciais |

Use os formulários para preencher os demais campos obrigatórios. Caso um registro já esteja preparado, apenas abra sua ficha; cadastrar tudo durante a fala ultrapassa o tempo. Na prova, mantenha uma alternativa correta conhecida por você. Não abra a tela administrativa do gabarito na janela do aluno.

## Roteiro de 8 minutos

| Tempo | O que mostrar | Sugestão de fala |
| --- | --- | --- |
| 0:00–0:40 | Login e dashboard | “O EduGestão integra cinco áreas de uma instituição de ensino. A proposta é organizar os registros em um banco relacional e controlar quem pode consultar ou alterar cada informação.” |
| 0:40–1:30 | Ficha do aluno e turma | “Este é o cadastro central. O mesmo aluno será usado em cursos, avaliações, biblioteca e financeiro. A conta de acesso é um cadastro separado, e o aluno pode existir sem login.” |
| 1:30–2:15 | Curso, aula e matrícula | “Uma aula pertence a um curso e possui um professor. A matrícula relaciona aluno e curso. Ao tentar repetir uma matrícula ativa, o sistema bloqueia a duplicidade.” |
| 2:15–3:35 | Janela do aluno: responder, salvar e finalizar; gestor: corrigir discursiva | “A questão objetiva é corrigida pelo servidor. A discursiva depende da correção do gestor. Neste exemplo, 2 pontos da objetiva mais 2,5 da discursiva resultam em 4,5 de 5. O gabarito fica protegido durante a realização.” |
| 3:35–4:30 | Empréstimo e devolução do exemplar | “Livro representa a obra ou edição; exemplar representa a unidade física. O exemplar pode ter vários empréstimos ao longo do tempo, mas apenas um aberto. Ao devolver, a disponibilidade é atualizada.” |
| 4:30–5:35 | Cobrança e dois pagamentos | “O valor do plano é R$ 100,50. Com 10% de desconto válido, a cobrança fica em R$ 90,45. Um pagamento de R$ 40,20 deixa saldo de R$ 50,25. O segundo pagamento quita a cobrança. São registros administrativos internos.” |
| 5:35–6:25 | Histórico na janela do aluno; habilitações do grupo | “O aluno consulta seus próprios registros. O servidor verifica papel, módulo habilitado e dono do registro. Se o root remover um módulo do grupo, a próxima operação desse módulo será bloqueada.” |
| 6:25–7:30 | `prisma/schema.prisma` e um arquivo de migração | “O banco usa chaves primárias, estrangeiras, tabelas associativas, índices e restrições. As migrações versionam sua estrutura. Transações protegem operações que precisam acontecer juntas.” |
| 7:30–8:00 | Revisão final e encerramento | “A versão entregue foi verificada com 191 testes: 36 unitários, 119 de integração e 36 de interface. O resultado é um sistema local funcional, com banco real e módulos integrados.” |

As falas são sugestões: adapte às suas palavras e entenda cada operação antes de apresentá-la. Os 191 testes são o resultado registrado da fase 10, não uma nova execução nesta fase.

## Demonstrações opcionais de bloqueio

Escolha no máximo uma ou duas para não estourar o tempo:

1. Tentar repetir a matrícula ativa do mesmo aluno no mesmo curso.
2. Tentar emprestar o exemplar enquanto sua primeira retirada continua aberta.
3. Tentar registrar pagamento maior que o saldo restante.
4. Remover Biblioteca do grupo da conta Usuário, atualizar a janela do aluno e demonstrar o bloqueio. Reabilitar depois, se necessário.

Faça os testes com registros DEMO. Não apague históricos nem mude sua própria conta root para preparar uma demonstração. A retirada de módulo deve ser feita no grupo da conta Usuário; o root mantém administração global.

## Se houver apenas 3 minutos

Mostre a ficha central do aluno, uma matrícula, a devolução de um exemplar e a cobrança com pagamentos. Explique os demais módulos verbalmente. Termine com os relacionamentos do banco e o controle de acesso. Não tente cadastrar todos os dados ao vivo.

## Se algo falhar durante a aula

Confira a mensagem do formulário: vínculo da conta, módulo habilitado, registro ativo, data ou saldo podem impedir a operação por regra de negócio. Se o servidor não responder, confira a janela do iniciador. Não use reset de banco. Se não houver tempo de corrigir, explique a regra usando o schema e as evidências em `docs/REVISAO_FINAL.md`. As capturas da entrega são de testes temporários e devem ser identificadas como evidências de testes.

## Encerramento sugerido

“O principal resultado foi transformar a modelagem acadêmica em operações reais, mantendo uma identidade de aluno compartilhada. Os relacionamentos e as restrições ajudam a preservar a consistência, enquanto a aplicação controla permissões e regras de cada módulo. Como evolução futura, seria possível ampliar relatórios, automatizações e implantação, após definir essas necessidades.”
