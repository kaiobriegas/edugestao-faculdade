# Biblioteca — Fase 7

Autorizada pelo pedido “fase 7” em 29/10/2026. Mantém a aplicação simples para a faculdade e implementa a política D08 já proposta no planejamento. Reutiliza Categoria, Livro, Exemplar, Emprestimo, Reserva e Aluno central. Sem novas entidades, dependências ou migrações: permanecem 33 modelos e três migrações.

## Modelo preservado e cadastros

Categoria 1:N Livro; Livro 1:N Exemplar; Exemplar 1:N Emprestimo ao longo do tempo; Aluno 1:N Emprestimo; Livro e Aluno 1:N Reserva. Reserva refere-se ao livro e empréstimo ao exemplar. O Aluno não é duplicado e não precisa ter conta para receber empréstimo ou reserva registrados pelo gestor. Vínculo Usuario é necessário somente para consultar o histórico próprio pela web.

Gestor cria, edita e inativa categorias, livros e exemplares; não há exclusão física. ISBN é opcional e único quando preenchido; código de exemplar é obrigatório/único. Título, autor e categoria são obrigatórios. Livro novo, mudança de categoria ou reativação exigem categoria ativa. Exemplar novo, mudança de livro ou reativação exigem livro/categoria ativos. Metadados de registros antigos podem ser mantidos mesmo após inativação do catálogo.

Estado EMPRESTADO só é atribuído pelo fluxo de empréstimo. Com empréstimo aberto, não se permite inativar exemplar nem mudar sua disponibilidade; código/localização/metadados podem ser corrigidos. Após qualquer empréstimo histórico, não se troca o livro do exemplar, preservando a identidade do acervo no histórico. Correção de vínculo exige outro exemplar, sem mover empréstimos antigos.

## Empréstimos, transações e devolução

Somente root/administrador com Biblioteca habilitada registra retirada/devolução. Datas de retirada/devolução vêm do relógio do banco; a data prevista é informada pelo operador e precisa ser futura. Datas de formulário e interface são em Brasília UTC−03; persistência timestamptz. Sem renovação, multa ou prazo fixo presumido. Atrasado é um estado calculado: empréstimo sem devolução com previsão anterior ao relógio do banco. O estado persistido continua ABERTO até DEVOLVIDO.

Para emprestar: aluno ativo, categoria/livro/exemplar ativos, estado DISPONIVEL e ausência de empréstimo com dataDevolucao nula. Disponibilidade cruza esses fatores; não confia somente na coluna de estado. O índice parcial SQL emprestimo_aberto_unico, criado na Fase 2, impede dois registros sem devolução para o mesmo exemplar, inclusive de escritas diretas no banco.

As mutações são transacionais, com advisory lock 37107 do módulo e bloqueio da linha de exemplar/aluno na circulação. Criação de empréstimo e mudança de exemplar para EMPRESTADO acontecem juntas. Devolução muda empréstimo para DEVOLVIDO, preenche dataDevolucao e muda o exemplar para DISPONIVEL na mesma transação. Se livro/categoria estão inativos, ele continua fora da disponibilidade para nova retirada. Aluno ou catálogo inativados não impedem devolver registros existentes.

Devolução repetida retorna o mesmo registro sem repetir a auditoria ou alterar novamente a disponibilidade. Se o exemplar já foi emprestado de novo, repetir a devolução antiga não desfaz o novo empréstimo. Datas, aluno e exemplar do empréstimo não têm edição livre; histórico é preservado.

## Reservas e validade

Gestor registra reserva para aluno ativo e livro/categoria ativos; validade futura é informada no formulário. Não existe fila, prioridade automática ou bloqueio de exemplar. Um colega pode retirar exemplar mesmo havendo reserva de outra pessoa, conforme D08. O gestor não deve prometer disponibilidade garantida pela reserva.

Uma reserva ativa e ainda válida do mesmo livro/aluno não pode ser duplicada pelo serviço. Vencimento, cancelamento ou atendimento permitem novo registro. Não há limite global de reservas/empréstimos por aluno nesta versão. Reserva pode ser cancelada pelo gestor ou marcada como atendida após existir empréstimo desse livro para o mesmo aluno, registrado a partir da data da reserva. Atendimento não cria empréstimo silenciosamente; deve ser registrado pelo fluxo próprio.

Após dataExpiracao, consulta e filtros mostram EXPIRADA mesmo que a situação persistida ainda seja ATIVA. GET não atualiza registros. O botão Registrar expiração grava o encerramento; antes do prazo ele é recusado. Não há cron em segundo plano. Reserva vencida não pode ser atendida/cancelada como se ainda estivesse válida; deve ser encerrada como expirada. Encerramentos são idempotentes para o mesmo estado; não se reabre reserva concluída.

## Acesso e histórico

Usuário com Biblioteca habilitada pesquisa acervo ativo, consulta exemplares/disponibilidade e somente seu histórico de empréstimos/reservas. Cadastro de categorias, seletores de alunos e todas as mutações são administrativos. Para solicitar retirada/reserva, o aluno procura o gestor. Não há autoempréstimo ou autopreenchimento de prazo pelo aluno.

AlunoId nos filtros é administrativo: conta comum recebe 403, e os demais filtros não retiram o escopo Aluno.usuarioId da sessão. Acervo não retorna nomes/contatos dos tomadores. Livro inativo sai do catálogo comum, mas permanece consultável pelo dono de empréstimo/reserva histórica e pelo gestor. Usuário não recebe contatos, documentos, ocorrências, senhas ou histórico dos colegas.

Gestor com Biblioteca habilitada seleciona alunos por ID/nome/matrícula/atividade sem precisar do módulo Alunos nem receber seus dados sensíveis. Cada gravação revalida ator, módulo e papel dentro da transação; APIs autenticadas também verificam Origin e Zod com campos permitidos. Cadastro/retirada/devolução/reserva/encerramentos geram EventoAdministrativo com autor e referência, sem segredos.

## Interface e limites

Menu Biblioteca, acervo, categorias, exemplares, ficha do livro, empréstimos e reservas. Listagens com busca e paginação de 10; filtros de situação, categoria, livro, aluno e atividade conforme o recurso/perfil. Título/autor/ISBN pesquisáveis no acervo; histórico pesquisável por livro/exemplar e, para gestor, nome/matrícula. Ficha mostra até 100 exemplares; contagens consideram todos. Seletores até 1.000 opções. Tabelas com rolagem interna e foco por teclado, formulários identificados, confirmação de devolução/encerramento, erros/sucesso e estados vazios.

A versão é adequada à demonstração local; sem processamento em lote, exportação, fila, proctoring ou notificações de atraso. A capacidade de volume e a política de circulação podem ser ampliadas em etapa posterior, com regras explícitas.
