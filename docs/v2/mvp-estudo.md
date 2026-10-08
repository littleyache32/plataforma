# MVP operacional, 08/10/2026

Escopo substitui temporariamente o fechamento estratégico 3.17 e o lote 4.11 a 4.17. As correções de revisão interrompidas estão preservadas no commit `2bbd645`; foram retiradas do caminho do MVP por patches explícitos. A migration de revisão inacabada não pertence ao MVP nem foi aplicada. FSRS, reteste avançado e progressão continuam fora de escopo.

## Contrato

O início factual é 08/10. A Semana mantém sua organização segunda a domingo: o primeiro preparo usa semana de 05/10, mas cria somente 08 a 11/10. Configuração inicial: dois estudos de concurso e um de Faculdade por dia, 50 minutos cada, dentro da disponibilidade factual. Ausência de disponibilidade não autoriza inventar tempo disponível.

As identidades incluem ciclo, semana e slot. A origem da configuração inicial é `INITIAL_CYCLE_BOOTSTRAP`. Recalcular não sobrescreve demandas feitas, deslocadas ou excluídas. Execução de 08 a 11 permanece como entrada factual nas semanas seguintes. Não há escada, dívida ou prática gerada rotineiramente.

Concurso segue o primeiro material aceito não concluído na ordem real de curso, preferindo matérias diferentes no dia. Faculdade preserva prazos reais; materiais acadêmicos aceitos sem sequência curricular são selecionados deterministicamente por cadastro/ID, sem fabricar ordem de curso. Seleção específica de aula presencial ainda depende de associação factual disponível, não do nome do PDF.

## Execução

A demanda abre o módulo Tempo com seu ID e contexto; não inicia automaticamente. O timer exige Iniciar foco. Backend protege pausa, retomada e conclusão por estado; concluído não reabre. Tempo concluído vinculado reconcilia a soma real na demanda sem marcá-la feita. Marcar/desmarcar demanda sem duração não apaga duração existente. Progresso do material continua canônico em `material_progresso`; sessão feita não equivale a material concluído.

Reconciliação de tempo neste MVP não é uma transação PostgreSQL entre tabelas. Falha é reportada, não ignorada; concorrência/rollback entre tempo e duração permanece um débito delimitado. Não reivindicar as garantias da antiga migration 0069 de outro ciclo.

## Ativação real pendente

A leitura autorizada do banco em 08/10 confirmou contexto antigo (02/10), policy ativa legada e ausência de disponibilidade V2. Nenhuma linha foi alterada nessa inspeção. A ativação exige disponibilidade factual confirmada para os quatro dias e alinhamento da policy/contexto V2 antes de cancelar planos antigos e inserir novos. Não usar runtime V1 para fingir geração V2.

Sem essa confirmação, não há demandas reais do bootstrap materializadas. Dados de produção não foram alterados, não houve deploy. Cancelamento de planos antigos deve preservar qualquer sessão com tempo iniciado ou concluído, e histórico já executado.
