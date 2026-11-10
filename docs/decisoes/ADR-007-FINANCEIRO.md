# Financeiro — Fase 8

Autorizado pelo pedido “Fase 8” em 29/10/2026, mantendo a aplicação local simples. Implementa D05/D09: um desconto opcional por cobrança, valores congelados, pagamento administrativo positivo limitado ao saldo, estorno auditado e emissão explícita. Reutiliza PlanoFinanceiro, Desconto, Cobranca, Pagamento e Aluno central. Não acrescenta tabela, dependência ou migração: 33 modelos e três migrações.

## Cadastros e emissão

Plano tem nome, descrição, valor decimal não negativo, periodicidade informativa e atividade. Não há job recorrente: cada cobrança é emitida explicitamente pelo gestor. Mudanças no plano só afetam emissões futuras.

Desconto pertence a exatamente um Aluno, tem descrição, tipo FIXO ou PERCENTUAL, valor/percentual exclusivo, validade inclusiva e atividade. Percentual entre 0 e 100; valor fixo não negativo. Aluno do benefício é imutável; outro beneficiário exige novo desconto. Edição de valor/vigência não recalcula cobranças antigas.

Emissão exige Aluno e plano ativos. A data de emissão é o dia atual de Brasília obtido do relógio PostgreSQL; o vencimento informado não pode ser anterior a ela. Valor original vem do plano, sem aceitar preço ou status do cliente. O desconto é opcional, único, não cumulativo, ativo, do mesmo aluno e vigente na data de emissão. Início/fim são inclusivos. Não se presume que todo Aluno possui Usuario.

A cobrança guarda valorOriginal, valorFinal e snapshot do tipo/percentual/valor aplicado. Edições posteriores do benefício/plano não alteram a dívida. Fórmula percentual: original × (1 − percentual/100), arredondada em duas casas com ROUND_HALF_UP. Fixo: máximo entre zero e original − desconto. Resultado zero já nasce PAGA, sem pagamento fictício. A cobrança emitida não tem edição livre de aluno, preço, plano ou desconto.

## Valores e pagamentos

Dinheiro é Decimal(14,2) no banco e Prisma.Decimal no servidor. Entrada aceita texto decimal canônico com até duas casas e máximo de 12 dígitos inteiros; não aceita float JSON, negativo, notação exponencial ou arredondamento silencioso de entrada com três casas. Respostas usam strings com duas casas. Number na interface serve somente para formatação visual, sem calcular saldo ou desconto.

O gestor registra pagamento interno com valor positivo, data/hora de Brasília, forma (PIX, DINHEIRO, TRANSFERENCIA, CARTAO ou OUTRO), referência opcional de comprovante e chave de idempotência UUID gerada pela tela. A referência é texto: não existe upload de comprovante, cobrança bancária, transferência, autorização de cartão ou gateway.

Data do pagamento não pode estar no futuro nem em dia anterior à emissão. Somente pagamentos CONFIRMADO e ativo entram na soma. Valor acima do saldo é recusado; não há crédito/excedente automático. Pagamento parcial muda a cobrança para PARCIAL; quitação, PAGA; sem recebido, PENDENTE. Plano/aluno inativos não impedem liquidar dívida já emitida; cobrança cancelada/inativa não recebe nova baixa.

Mutações usam transação, advisory lock 37108 e bloqueio da linha de cobrança para pagamentos, estornos e cancelamentos. Dois pagamentos concorrentes não ultrapassam o saldo. UNIQUE(cobrancaId, chaveIdempotencia) protege repetição. Mesma chave com payload idêntico retorna o registro existente, inclusive se depois estornado; com dados diferentes é conflito. A tela preserva a chave ao repetir uma tentativa com erro e cria outra para um novo registro. Isso não substitui conciliação bancária ou revisão de dois lançamentos manuais distintos.

## Estorno, cancelamento e histórico

Estorno exige justificativa de 5–1000 caracteres. Mantém Pagamento, valor, data e chave, muda status para ESTORNADO, grava autor/data/motivo e recalcula a cobrança. Repetição não duplica evento nem reaplica valor. Não há exclusão física, edição livre de valor ou troca de cobrança do pagamento. Todos os registros permanecem no histórico.

Cancelamento de cobrança exige justificativa e ausência de valor confirmado. Havendo pagamentos, devem ser estornados antes. Cobrança CANCELADA mantém valores emitidos para rastreabilidade, mas tem saldo exigível zero e fica fora dos totais não cancelados. A justificativa fica no EventoAdministrativo. Cancelamento repetido preserva o primeiro evento. Não há reabertura automática.

VENCIDA é situação calculada: cobrança ativa, PENDENTE/PARCIAL, com vencimento anterior ao dia atual de Brasília. O status de pagamento persistido continua distinguindo PENDENTE/PARCIAL. GET não atualiza estado nem executa jobs, multas ou juros.

## Consultas e relatório

Listagens paginadas de planos, descontos, cobranças e pagamentos, com busca/filtros por papel, aluno, plano e situação. Usuário vê apenas suas cobranças/pagamentos, usando Aluno.usuarioId da sessão. Ficha mostra original, benefício aplicado, valor final, recebido, saldo, situação e últimos 100 pagamentos, com acesso à lista paginada completa.

Relatório administrativo agrega cobranças emitidas no período inclusivo selecionado e por aluno/plano: total cobrado, recebido confirmado, saldo, saldo vencido e quantidades por status. Canceladas ficam fora dos valores, com contagem separada na tabela de situações; estornos ficam fora do recebido. Período filtra emissão, não data dos pagamentos: não é fluxo de caixa. Os agregados usam Decimal e transação RepeatableRead para uma posição consistente durante a leitura.

## Permissões e limites

Root e Administrador com Financeiro habilitado gerenciam cadastros, emitem, registram pagamentos, estornam, cancelam e consultam relatórios. Usuário não registra quitação ou estorno. IDs de cobranças alheias retornam 404; filtros de aluno em conta comum retornam 403. Catálogos/opções/relatórios são administrativos. Motivo de estorno é visível na própria cobrança; nome do autor de estorno só é serializado para gestor.

Servidor valida sessão, papel, módulo, proprietário, Origin e campos Zod. Gravação recarrega ator dentro da transação. Auditoria guarda autoria e referência; senhas/tokens não são registrados. O seletor de Aluno traz apenas ID/nome/matrícula/atividade, sem liberar contatos, documentos ou ocorrências.

Listas de 10 por página; seletores de até 1.000; ficha com até 100 pagamentos recentes. Sem lote, exportação fiscal, juros, multas, conciliação ou recorrência automática. É um controle interno para o trabalho acadêmico, sem execução de pagamentos reais.
