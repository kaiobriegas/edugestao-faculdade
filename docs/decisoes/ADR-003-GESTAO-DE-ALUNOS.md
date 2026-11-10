# Gestão de Alunos para o trabalho acadêmico

Fase 4 autorizada em 28/10/2026, mantendo o pedido de simplicidade. Foram usados o banco, as permissões e os componentes existentes, sem nova dependência, entidade ou migração. As 26 entidades acadêmicas continuam preservadas e Aluno permanece único.

## Cadastro e vínculos

Gestores com Gestão de Alunos habilitada criam/editam/inativam alunos, turmas e responsáveis. Root possui administração global. Os dados acadêmicos são institucionais compartilhados; Grupo controla habilitações, sem propriedade artificial Grupo–Aluno. Datas válidas e matrícula acadêmica única são verificadas no servidor. Aluno continua obrigatório em uma turma e pode existir sem conta de acesso.

Somente root vincula ou desvincula Usuario de Aluno, confirmando sua senha atual. A relação é opcional e única; não se infere identidade por igualdade de e-mail. Alterações de outros campos por administrador preservam o vínculo existente, sem permitir que ele o modifique.

Cada responsável pode ser associado a vários alunos e cada aluno a vários responsáveis. Parentesco por vínculo é usado na ficha; Responsavel.parentesco original foi preservado como valor padrão opcional. Cadastro de responsável exige pelo menos um contato; CPF é opcional, normalizado e validado se informado. Remover ligação não apaga o responsável.

## Capacidade e situação

Ocupação considera somente alunos ativos com status MATRICULADO, conforme D07. Inclusão, transferência e reativação verificam vagas e bloqueiam as linhas de turma em transação, preservando os triggers existentes como salvaguarda. Redução de capacidade abaixo da ocupação é rejeitada. Turma inativa não recebe novas alocações; edição cadastral de aluno já nela pode manter seu vínculo. Cancelamento, conclusão, trancamento ou inativação deixam de ocupar vaga, mas mantêm o histórico.

As escritas acadêmicas usam um bloqueio transacional simples para serializar alterações neste MVP; isso evita introduzir infraestrutura adicional e foi testado com operações concorrentes. A tabela associativa de responsáveis e as FKs acadêmicas continuam as originais do planejamento.

## Documentos e ocorrências

Documentos aceitam PDF, PNG e JPEG até MAX_UPLOAD_BYTES, padrão 10 MiB. Servidor confere tamanho, extensão, MIME e assinatura inicial; o corpo multipart também tem limite. Conteúdo é salvo fora de public, com chave aleatória gerada no servidor e nome original sanitizado. O nome e chave do disco não são controlados pelo cliente. Falha na transação de metadados remove o arquivo recém-gravado.

Download exige sessão, módulo e autorização sobre o aluno, com Content-Disposition attachment, nosniff e no-store. A chave física não integra o DTO da ficha. Arquivamento preserva arquivo e metadados; o aluno não consegue baixar documentos arquivados, enquanto gestor mantém acesso ao histórico. Exclusão física não está disponível na interface.

Ocorrências são registradas e editadas por gestores, com autor derivado da sessão. Edição preserva autoria original e registra novo evento administrativo. Usuários comuns não recebem a descrição nem a listagem de ocorrências internas no HTML/JSON. Datas da ocorrência são capturadas como dia de calendário; criadoEm e auditoria guardam o instante real da operação.

## Consulta e limites explícitos

Gestor tem listagem paginada em 10 registros, com busca, atividade, turma e status acadêmico conforme a entidade. Usuário comum com módulo habilitado consulta apenas seu aluno vinculado e seus documentos ativos. Responsáveis retornados nessa consulta têm nome, parentesco e contato, sem CPF. Sem vínculo, a tela mostra estado vazio e não cria identidade fictícia.

A ficha apresenta até 100 documentos e ocorrências recentes e até 20 matrículas em cursos/notas recentes. Essas consultas leem as mesmas FKs do aluno; dados de cursos e avaliações só são retornados quando os respectivos módulos estão habilitados para o ator. As operações de criação de curso e avaliação seguem para as fases próprias. Os limites são identificados na interface e podem ser ampliados depois; não são política de retenção.

## Verificação

Novos testes: 5 unitários, 13 de integração e 4 E2E (dois fluxos em desktop/celular). A suíte completa passou com 65 testes, lint, TypeScript, Prisma validate, diff sem diferenças e build. Foram testadas corrida pela última vaga, transferência/reativação, redução de capacidade, responsáveis N:N, conta opcional/única com root, autoria, isolamento de ficha, upload privado, assinatura, arquivo alheio, arquivamento e compensação de falha. Testes usam banco _test e armazenamento .local/e2e-storage, com limpeza das próprias fixtures.
