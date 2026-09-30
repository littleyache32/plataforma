# Mentor, Fase 1: inventário e fonte de verdade

Data da revisão: 24/09/2026. Este documento descreve o estado do código e do banco inspecionados; não inaugura uma segunda lógica de decisão.

## Classificação do que já existia

| Classe | Conhecimento ou regra | Situação após a consolidação |
| --- | --- | --- |
| Permanente | Recuperação ativa, espaçamento, feedback, evidência tardia, confiança versus acerto, não alterar plano por evento isolado, sequência original das aulas do Estratégia | Preservado em `conhecimento_modulo` e nas funções determinísticas de `shared/mentor.js` e `shared/planner.js`. A prática só será aplicada quando a fase permitir. |
| Permanente | Limiar de amostra, pesos, ordenação de prioridades e critérios de aderência | Preservados como parâmetros operacionais calibráveis, não fatos científicos universais. O planner é a implementação, não uma segunda política. |
| Contexto atual | Concurso prioritário; hábito e base teórica; três blocos diários, dois concurso e um Faculdade; quatro matérias; aulas presenciais de segunda a quinta; estudo acadêmico todos os dias; PDFs do Estratégia; prática fora da rotina | `mentor_contexto`, uma linha ativa. Vigência em 24/09 e aplicação ao plano a partir da semana de 28/09. |
| Temporário | Prova de Teoria do Crime em 22/09, prova de Constituição em 01/10, Justiça em 14/10 e trabalho em 19/10; encontro semanal e carga percebida | `compromisso` e `mentor_encontro_semanal`. A semana excepcional de 21/09 é preservada pelo planner histórico. |
| Histórico/obsoleto | Semanas iniciais de agosto; reinício de 14/09; antiga liberação por data de questões/cards; mínimo 180/120 minutos da versão 22/09 | Mantidos para reprodutibilidade histórica, mas o contexto vigente prevalece na fase e na geração das próximas semanas. |
| Duplicado | Cópia integral da política em `mentor_conhecimento` e `conhecimento_modulo/mentor` | `mentor_conhecimento` é desativado pela migration 0062; as APIs passam a ler somente `conhecimento_modulo/mentor`. Os registros antigos permanecem como histórico. |
| Contraditório | Data antiga indicava fase adaptativa em setembro, enquanto o mentorado ainda constrói base; recuperação acadêmica antiga produzia dois blocos de Faculdade em dias úteis; risco de esquecimento surgia sem primeira resposta | Fase e carga passam a obedecer `mentor_contexto`; ausência de resposta não gera risco de esquecimento; tempo e aula concluída não confirmam domínio. |

## Fonte de verdade e fluxo

1. `conhecimento_modulo/mentor`: princípios e parâmetros relativamente permanentes. Os seis módulos especialistas preservam conhecimento de escopo, mas não emitem comandos independentes.
2. `mentor_contexto`: fatos vigentes do mentorado. `compromisso`, `sessao`, `tempo_estudo`, `registro` e `mentor_encontro_semanal` fornecem eventos e evidências reais, sem substituir o contexto de fase.
3. `shared/mentor.js` calcula diagnósticos/sinais; `shared/planner.js` produz a proposta; `api/_lib/plano-handler.js` integra e persiste. `api/mentor.js` apresenta a leitura. A decisão final permanece no Mentor principal.

O schema real, configurações da Vercel e os dados operacionais do Supabase não são versionados integralmente no repositório. A migration deve ser aplicada antes de publicar o código que consulta `mentor_contexto`.

## Especialistas existentes

| Especialista | Função existente e uso real | Sinal ao Mentor principal |
| --- | --- | --- |
| Planejamento | Conhecimento armazenado; distribuição e remanejamento efetivos estão em `shared/planner.js` e `plano-handler.js`. | Aderência, pendências, carga possível e proposta semanal. |
| Trilha | Conhecimento armazenado; seleção sequencial efetiva dos materiais está em `nextBacenLesson` no planner. | Próxima aula incompleta de cada disciplina. |
| Revisão | Conhecimento armazenado; diagnóstico de itens vencidos e revisão já existe no motor, mas fica fora da rotina da fase atual. | Itens vencidos e erros, apenas quando a fase permitir prática. |
| Desempenho | Conhecimento armazenado; diagnósticos de questões, confiança, retenção e eficiência são calculados em `shared/mentor.js`. | Evidência suficiente ou insuficiente, sem inferir domínio pelo tempo. |
| Acadêmico | Conhecimento armazenado; agenda por disciplina e compromissos entram no planner. | Aula do dia, avaliações próximas e necessidade de preparação dentro do bloco acadêmico. |
| Previsão | Conhecimento armazenado; `buildScenarios` calcula cenários somente quando há data-alvo e ritmo medido. | Projeção provisória e incerteza, nunca ordem autônoma de aumentar carga. |

As responsabilidades de planejamento, acadêmico e trilha se encontram no planner por necessidade de montar uma única semana. Isso não cria três planners. Os registros dos especialistas no banco são descritivos e ainda não são lidos diretamente na execução; a integração funcional se dá pelas funções existentes. Não foi criado especialista nem motor paralelo nesta fase.

## Encontro e limites

O formulário aceita carga percebida, atraso acadêmico, dificuldade, material e observações sobre exceções. A opção de escolher prioridade foi removida da interface e rejeitada pela API. `prioridade_percebida` pode permanecer em encontros históricos, mas não comanda o planner. Questões, cards e revisão teórica não receberam lógica nova. A passagem futura para prática requer uma fase posterior; a data antiga de elegibilidade não a ativa automaticamente.
