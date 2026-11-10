# Gestão de Avaliações — Fase 6

Autorizada pelo pedido “fase 6”, mantendo a aplicação acadêmica simples. Preserva Avaliacao, Questao, Resposta, Nota e Aluno central; usa a TentativaAvaliacao técnica já prevista na Fase 2. Não cria relação Avaliacao–Curso/Turma, ausente das fontes, nem conta obrigatória para todo aluno. Somente quem vai realizar a prova precisa vincular Usuario ao Aluno.

## Ajuste técnico do schema

A migração 20261028193000_avaliacoes_respostas remove apenas o índice único Resposta(tentativaId, alunoId, avaliacaoId): ele impediria duas respostas na mesma prova, contrariando o modelo 1:N. Mantém a unicidade por tentativa/questão, as FKs compostas que impedem troca de aluno/avaliação e a nota única por tentativa. Nenhuma linha é removida. São acrescentados pontuacaoObtida Decimal(10,2), opcional, com CHECK não negativo, e comentarioCorrecao opcional em Resposta. Eles guardam correção automática/manual e feedback, preservando notas parciais; limite superior é validado contra Questao.pontuacao no serviço. Permanecem 33 modelos; passam a existir três migrações.

## Aplicação e prazo

D03: uma tentativa por aluno/avaliação, número 1; iniciar novamente abre a tentativa existente, sem permitir refazer a prova. Aluno ativo e conta vinculada são exigidos para iniciar/responder. Avaliação ativa com ao menos uma questão fica disponível após dataAplicacao, interpretada como liberação em Brasília, UTC−03. Não se inventa vínculo com curso, turma ou seleção de alunos: avaliações ativas são do catálogo institucional para contas com o módulo habilitado.

O prazo individual é início + tempoLimite em minutos (1–1440). O relógio autoritativo vem do PostgreSQL, consultado depois do bloqueio transacional como epoch em milissegundos para evitar ambiguidades de fuso do adaptador. O navegador exibe contagem regressiva e pede finalização ao chegar a zero. O servidor recusa salvar após o prazo; na finalização tardia ignora o novo conteúdo e considera somente respostas salvas antes do prazo.

Não existe cron/worker: fechar o navegador deixa a tentativa em andamento, porém sem direito de continuar respondendo depois do prazo. Ao reabrir, o navegador finaliza; o gestor também pode encerrar explicitamente uma tentativa vencida. GET não altera estado. Sem respostas salvas, a nota é zero. A finalização repetida é idempotente.

Salvar mescla as questões informadas no rascunho; conteúdo vazio remove logicamente a resposta daquela questão. A tela envia todas as questões. Questões omitidas no pedido preservam o rascunho anterior. O aluno deve usar Salvar respostas durante a prova; não há promessa de salvamento automático a cada tecla.

## Correção e histórico

Objetiva tem quatro alternativas A–D e uma correta, com pontuação inteira positiva (1–10000). Acerto vale os pontos da questão, erro/em branco vale zero. Discursiva respondida exige correção manual, entre zero e o valor da questão, com até duas casas decimais e comentário opcional. Discursiva em branco vale zero.

Finalização com discursivas pendentes gera status FINALIZADA, exibido como Aguardando correção, e ainda não cria Nota. Após todas as correções: CORRIGIDA e Nota com soma decimal. Sem conversão para escala 0–10, média mínima ou desconto por erro. Reavaliação manual atualiza a mesma nota; EventoAdministrativo registra autor, resposta, valor anterior e novo, sem texto do aluno ou senha. Histórico da ficha central usa essa mesma Nota.

Após a primeira tentativa, conteúdo, liberação, duração, pontos e questões ficam bloqueados. Apenas ativo da avaliação pode mudar; inativar impede novos inícios, mas preserva finalização/consulta das tentativas existentes. Questões podem ser editadas/inativadas/reativadas antes de iniciar; não há exclusão física. Limite técnico: 100 questões ativas, 5000 caracteres por enunciado/resposta, alternativas/comentários até 2000. Pedidos de respostas até 1 MiB; demais JSON até 16000 bytes.

## Permissões e proteção

Root/Administrador com o módulo habilitado gerenciam provas/questões, consultam tentativas e corrigem discursivas. Usuário só realiza e consulta sua tentativa, identificado por Aluno.usuarioId da sessão. Não aceita alunoId, nota ou pontuação obtida nos pedidos de respostas. IDs alheios retornam 404. Catálogo e detalhes públicos omitem todas as questões; o conteúdo é entregue ao aluno somente após iniciar. Durante a tentativa, DTO/HTML do aluno omitem alternativaCorreta, pontuacaoObtida e comentário. Após finalizar, gabarito e feedback ficam disponíveis ao dono; gestor tem acesso explícito para configuração/correção.

Todas as operações verificam autenticação, módulo e papel no servidor; gravações recarregam o ator dentro da transação e validam Origin. Bloqueio transacional 37106 serializa mutações acadêmicas deste módulo, adequado ao uso local da faculdade. Não é uma solução de aplicação de provas em grande escala.
