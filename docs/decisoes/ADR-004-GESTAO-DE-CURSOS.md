# Gestão de Cursos

Fase 5 autorizada em 28/10/2026, mantendo a implementação simples para o trabalho acadêmico. Curso, Professor, Aula e Matricula usam as tabelas já migradas; Aluno é o mesmo cadastro central da Fase 4. Não foram adicionadas entidades, dependências ou migrações. O formulário reutilizável foi movido para components/forms, mantendo compatibilidade com Gestão de Alunos.

## Cadastros e programação

Root e administrador com módulo cursos habilitado criam/alteram/inativam cursos e professores, organizam aulas e gerenciam matrículas. Inativação preserva referências e histórico. Professor continua distinto de Usuario; cadastrar docente não cria conta. Aula tem exatamente um curso e um professor por FK obrigatória.

Carga horária do curso é inteira em horas; duração da aula, em minutos, conforme D07. Soma das aulas ativas não pode exceder cargaHoraria × 60. A mesma regra vale ao editar/mover/reativar uma aula ou reduzir a carga do curso, desconsiderando o próprio registro ao editar. Aulas inativas não entram na soma. Datas/horários são válidos, apresentados e capturados em Brasília UTC−03 e persistidos como timestamptz. Novas atribuições exigem professor ativo; inativar professor não apaga suas aulas históricas.

## Matrículas e exceções

Cada matrícula aponta para um aluno central e um curso. O par aluno/curso é imutável depois da criação: uma mudança de vínculo exige encerrar o anterior e criar outro, preservando histórico. Status disponíveis: ATIVA, CONCLUIDA, CANCELADA; ativo continua separado. O índice parcial existente impede duplicidade quando ativo=true e status=ATIVA. O serviço também valida e retorna mensagem de negócio, com transação/bloqueios para operações concorrentes.

Aluno inativo não recebe nova matrícula ou reativação. Curso inativo não recebe nova matrícula ou reativação sem exceção: somente root, com senha atual e justificativa de pelo menos cinco caracteres. O evento MATRICULA_EXCEPCIONAL guarda aluno, curso e justificativa, sem senha. Conclusão/cancelamento de vínculo existente funciona mesmo se o curso ou aluno foi inativado. Inativar um curso não cancela automaticamente matrículas existentes.

## Permissões e consultas

Usuário comum com módulo cursos consulta catálogo ativo, programação e somente suas próprias matrículas, via Aluno.usuarioId. Cadastro, alteração e diretório de professores são restritos a gestores. Programação expõe o nome do professor, sem seu e-mail. Um curso inativo continua consultável pelo aluno que já tenha vínculo histórico nele; curso inativo alheio retorna 404. A remoção da habilitação de cursos bloqueia a próxima consulta, inclusive de histórico.

O gestor de cursos recebe apenas ID, nome, matrícula e atividade de alunos no seletor, sem ganhar acesso a documentos, contatos ou ocorrências do módulo Alunos. Isso permite matrícula sem conceder acesso amplo ao outro módulo. A ficha acadêmica existente passa a mostrar os novos vínculos pelas mesmas FKs, respeitando habilitação de cursos.

Listagens têm busca, filtros por curso/aluno/status/atividade e paginação de 10 registros. Seletores carregam até 1.000 opções. A ficha do curso mostra até 200 aulas e 100 matrículas recentes, com links para as listagens paginadas. Usuário comum nunca recebe os colegas da turma no DTO do curso. Dados acadêmicos continuam institucionais compartilhados para gestores autorizados, sem introduzir Grupo–Aluno ou Grupo–Curso não previstos no relatório.

## Verificações

Novos testes: 4 unitários, 16 de integração e 4 E2E, totalizando 89 na suíte completa. Cobrem FKs, professor inativo, horário de Brasília, carga horária/concorrência, duplicidade de matrícula, histórico, encerramento/reativação, exceção root auditada, aluno inativo, par imutável, permissão de módulos e isolamento de dados. E2E repetiu o fluxo em desktop/celular, confirmou a matrícula na ficha central de aluno e a ausência de dados de colegas na conta Usuário. Build, lint, TypeScript e Prisma validate/diff aprovados. Fontes acadêmicas preservadas.
