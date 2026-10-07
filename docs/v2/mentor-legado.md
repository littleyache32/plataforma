# Diagnóstico do Mentor legado para a V2

Data: 07/10/2026. Fase 3.1. Branch: `v2`. SHA inspecionado: `1d0fc4daf57acce2b8816dd665765ff861fc854c`.

## Escopo e limites da evidência

Diagnóstico por leitura de código, contratos V2, migrations e testes existentes. Não houve alteração funcional, execução de testes, migrations, cron, endpoints, banco ou produção. Este documento é o único arquivo criado nesta subfase.

Foram lidos `AGENTS.md`, [produto](produto.md), [domínio](dominio.md), [Mentor](mentor.md), [fontes de verdade](fontes-de-verdade.md) e [mapa de migração](mapa-migracao.md). A análise se limita aos consumidores e fontes relacionados ao motor decisório, sem reauditar a plataforma inteira.

**O banco real não foi consultado.** As configurações de banco abaixo são as declaradas nas migrations e as consultas encontradas nos handlers. Não se afirma qual versão está efetivamente ativa, quais migrations estão aplicadas, nem quais valores existem em `mentor_contexto` ou `objetivo.config`. Também não se identifica o checkout V2 com a versão publicada em produção. Essa é uma limitação objetiva para qualquer declaração de estado operacional real, não um motivo para executar scripts de manutenção.

O trabalho local anterior em `docs/v2/ux-ui.md`, `output/` e no ZIP de auditoria foi preservado. Nenhuma branch, commit ou arquivo histórico foi removido.

## Classificação

- **A. Compatível com V2:** responsabilidade/princípio reaproveitável sem impor nova decisão de produto. Não significa implementação integralmente validada.
- **B. Parcialmente reaproveitável:** existe base útil, mas contrato, parâmetros, origem ou integração precisam ser adaptados.
- **C. Concorrente/obsoleta:** regra executável ou fonte que conflita com os contratos V2; não deve ser promovida automaticamente a política V2.
- **D. Histórica:** registro/migration ou mecanismo sem consumidor operacional encontrado no recorte. Preservar história; ausência de uso encontrado não autoriza excluir tabela, arquivo ou dado.

Uma regra pode ter um princípio compatível e uma implementação concorrente. Nesses casos as duas responsabilidades estão separadas na tabela. Os números V1 não são thresholds aprovados para a V2.

## Caminhos atuais do motor

1. `module-knowledge.js` lê o registro ativo de `conhecimento_modulo/mentor`, com cache de cinco minutos, e exige os seis módulos `mentor_*`.
2. `api/mentor.js` monta diagnóstico para a interface. Classifica tentativas antes de calcular desempenho, consulta acervo, materiais, contexto, encontros e compromissos; recalcula uma decisão com `decideMentorCycle`.
3. `plano-handler.js` monta outro conjunto de inputs. Calcula prioridades por tópico **sem a mesma classificação prévia de tentativas**, depois sinais por domínio, prioridade por material, carga e propostas de demandas.
4. `mentor-decision.js` decide carga do ciclo de outubro; `planner.js` executa a seleção curricular, agenda acadêmica, distribuição e reconciliação. Ambos ainda contêm escolhas estratégicas, não apenas transformação mecânica de decisão em demandas.
5. O caminho `adaptacao_teorica_1/base_teorica_adaptativa` retorna demandas teóricas antes dos ramos antigos. Outros contextos podem alcançar construção de hábito, reinício, retomada e prática por calendário/aderência.
6. `prepareMentorWeek` persiste demandas, cancelamentos, contexto e auditoria em chamadas separadas. O cron faz backup, chama essa mesma preparação e registra execução. Não gera acervo no código atual.
7. POST do encontro registra fatos; no domingo chama preparação forçada da próxima semana. Em outros dias indica planejamento pendente. Abertura autenticada do App prepara a semana corrente, com corte fixo em 05/10/2026 e erro ignorado.

Não foi encontrada chamada LLM/JEV no caminho crítico desses arquivos. Os chamados especialistas são funções determinísticas locais, não agentes autônomos. Isso permite adaptação incremental para domínios internos de **um único Mentor**, sem reescrita total.

## Inventário de regras e destinos

| regra/origem | função atual | classificação | risco | destino V2 |
| --- | --- | --- | --- | --- |
| Motor sem LLM: `mentor.js`, `mentor-decision.js`, `planner.js`, handlers | Calcula sinais, carga e demandas por código. | A | Determinismo parcial não implica fontes coerentes. | Preservar núcleo determinístico; não adicionar IA operacional. |
| `conhecimento_modulo` + `loadModuleKnowledge` | Escolhe policy ativa do módulo Mentor. | A | Estado real e versão ativa não verificados. | Fonte versionada de política do único Mentor. |
| `DEFAULT_MENTOR_POLICY`, versão `2026.09.21.1` | Mantém estratégia e contexto antigos em código. | C | Uma versão modular nova continua utilizando parâmetros históricos não declarados nela. | Separar invariantes/algoritmo de estratégia; não usar default histórico como policy vigente. |
| `resolveMentorPolicy` e merges por seção | Repõem chaves omitidas pelo JSON modular, inclusive fases removidas nas 0062/0063. | C | Remover política do banco não a elimina do caminho de fallback. | Resolução única validada; ausência de configuração não ressuscita política V1. |
| Cache de cinco minutos em `module-knowledge.js` | Evita leituras repetidas, inclusive de resultado ausente. | B | Processos podem servir versões diferentes até expiração; erro de banco é lançado, não fallback conservador. | Cache só como projeção identificável da versão; definir comportamento para configuração ausente. |
| `mentor_contexto`, `id=1` | Guarda fase, datas, flags, carga e contexto pessoal. | A | JSON pode conter projeções sem origem e estratégias misturadas. | Preservar contexto mutável, com referências aos fatos/decisão vigente. |
| `carga_atual` no contexto + decisão calculada + totais do plano | Representam carga em três camadas. | B | Origem da projeção de carga não tem vínculo explícito com decisão registrada. | Decisão em `mentor_decisao`; plano em `sessao`; contexto somente projeção referenciada. |
| Etapas 02/10-08/10 e 09/10-15/10: `newCycleStage`, `mentorCycleState`, `mentorPhase`, 0063 | Aplicam 2+1 e 3+1 e descrevem adaptação. | B | Mesmo contexto duplicado em constantes, defaults, texto e JSON; sem aprovação como política permanente V2. | Preservar histórico/ciclo contextual válido; não fixar datas/quantidades no produto de longo prazo. |
| Transição depois de 15/10: `plano-handler.js` | Muda fase para base teórica adaptativa durante preparação. | B | Corte ainda tem fallback literal; prepara estado em separado da auditoria/demandas. | Transição pelo contexto/policy vigente, rastreável e sem calendário paralelo. |
| `construcao_habito_base_teorica`, 0062 e ramos do planner | Caminho alternativo 2+1 com aumento próprio. | C | Estratégia anterior continua executável quando essa fase é informada. | Migrar contexto quando autorizado; conservar resultados históricos, não outro motor. |
| Início 17/08, tabelas de semanas de agosto e fase adaptativa a partir de 07/09 | `mentorPhase` e planner oferecem fallback histórico. | C | Contexto ausente/não reconhecido pode apresentar prática ou planejamento antigo. | Arquivar a interpretação histórica; fase atual vem do contexto validado. |
| Reinício 14/09-27/09 e retomada 21/09: policy/planner | Criam rotina especial, preparação de Crime e sete blocos acadêmicos na segunda especial. | C | Branches ainda executáveis para datas antigas; não são fallback seguro V2. | Retirar da decisão operacional futura; preservar planos e migrations históricos. |
| `ensureResumptionCommitments` | Para contexto fora do novo ciclo insere provas/entrega da policy antiga se não existem. | C | Pode repor calendário de setembro/outubro durante preparação; contexto perde autoridade. | Compromissos factuais exclusivamente na entidade canônica, sem seed implícito. |
| `zerar_pendencias_anteriores`, `descartar_pendencias_anteriores`, limpeza no handler | Retomada pode apagar sessões não feitas anteriores; reinício descarta carryover. | C | Ramo de delete não possui guarda `!newCycle`; coincidência de semana/policy exige cuidado. | Nenhuma decisão do Mentor apaga história factual; separar reconciliação de preservação histórica. |
| `canGenerateMentorWeek` | Libera semana corrente ou próxima na abertura de domingo. | B | Cortes fixos 21/09 e 16/08 não representam vigência geral. | Reutilizar calendário semanal com contexto/instante explícitos. |
| `App.prepareCurrentWeek` | Prepara semana após autenticação desde 05/10, ignorando rejeição. | C | Bootstrap do plano depende de data histórica; falha fica silenciosa. | Gatilho contextual explícito, sem outro calendário estratégico. |
| `decideMentorCycle`: manter/reduzir/aumentar, janela e reason codes | Decide carga após adaptação; máximo um degrau e proteção de mesma semana. | B | 70/85%, mínimo de cinco demandas, backlog três e piso BACEN dois são parâmetros V1. | Reaproveitar contrato de decisão; aprovar parâmetros no domínio de policy V2 antes de reutilizar. |
| `adherenceAdjustment` versus `decideMentorCycle` | Duas implementações de progressão. | C | Legado usa minutos e exige +30 de capacidade real; novo motor usa contagem, cobertura e encontro; carga pesada reduz em condições distintas. | Uma decisão de carga, uma fórmula de aderência e uma policy. |
| `weeklyLoadProfile` | Resolve perfis por novo ciclo, construção de hábito, semanas iniciais ou progressão antiga. | C | Pode invocar ajuste sem transmitir custom policy; contém outra estratégia de carga. | Projeção da decisão única, sem redecisão independente. |
| Ausência de encontro não autoriza aumento no motor novo | Freio conservador `MEETING_NOT_HELD`. | A | Fallback ainda depende de formato/fase antiga; não cobre indisponibilidade de schema/policy. | Preservar estratégia conservadora, sem inventar evidência. |
| Carga percebida leve/adequada/pesada: API, widget, decisão, especialistas | Feedback antigo influencia carga e redução. | C | Produto V2 excluiu esse feedback por enquanto; ainda há controle e dependência operacional. | Preservar fatos históricos; não tornar esse feedback requisito V2. |
| Encontro factual e indisponibilidade: API/0068/planner | Registra exceções, dificuldades e fatos; dias indisponíveis não redistribuem carga. | B | Provas informadas vivem também em JSON do encontro, sem origem canônica única. | Reaproveitar fatos; compromissos na fonte própria com referência ao encontro. |
| Compromissos da tabela + `fatos.avaliacoes` | API/planner compõem calendários; planner deduplica por tipo/data/matéria/título. | C | GET não usa a mesma deduplicação; texto alterado pode representar o mesmo evento duas vezes. | Um compromisso canônico, snapshots/referências como derivados. |
| Plano provisório e replanejamento após encontro | Handler marca estado e permite recálculo idempotente. | A | Estado é resposta/auditoria, não fechamento definitivo; ainda há integrações a adaptar. | Preservar encontro contextual e planejamento atualizado pelo único Mentor. |
| `closeMentorWeek` + `reconcileMentorDemands` + 0068 | Distingue falta, cancelamento do Mentor e exclusão; protege feitas e cancelamento manual. | A | Proteção está vinculada a chave/ordem e não prova equivalência semântica geral. | Preservar história, exclusões e idempotência ao transformar planner. |
| Backlog novo: conteúdo perdido volta à seleção dentro da carga | Retoma materiais/matérias pendentes sem dívida de horas. | A | Fontes/limites do backlog diferem entre GET e preparação. | Preservar princípio e uniformizar sinal de conteúdo pendente. |
| `planOverdueMoves` e `reallocateOverdue` | No caminho antigo move até três objetos atrasados para dia de menor carga. | C | Não limita capacidade de destino e transporta sessões em vez de necessidade curricular. | Não usar como compensação automática; preservar fatos e decidir conteúdo futuro. |
| Blocos separados, estimativa 50 e validação no planner | Rejeita Estudo comum diferente de 50, sem fundir dois blocos. | B | É política operacional V1; V2 permite timer livre 30/50/personalizado, não aprova todos os limites do plano aqui. | Preservar separação timer/plano e registros independentes; explicitar duração de demanda na policy futura. |
| `MAX_BLOCKS_BY_WEEKDAY=[4,9,9,9,9,9,5]` | Teto diário e dias presenciais segunda-quinta. | C | Disponibilidade pessoal hardcoded concorre com contexto informado. | Disponibilidade contextual; limite não vira meta de carga. |
| `agenda_faculdade` e exclusão textual de Análise/Produção de Texto | Selecionam disciplina por dia/aliases e excluem conteúdo/cards. | B | Agenda pessoal não pertence à policy permanente; nomes produzem regras implícitas. | Preservar Faculdade e fatos de calendário; decisões por IDs/contexto, sem generalizar exclusão. |
| Prova/entrega próxima direciona bloco existente no ciclo novo | Usa compromisso e janela de dois dias. | B | Janela é número V1; planner acadêmico ainda decide seleção por conta própria. | Integrar precedência e método no único Mentor; confirmar janela antes de adotá-la. |
| Preparação adicional no ramo antigo de compromissos | Acrescenta um/dois blocos de 50; evento trabalho tem teto 90. | C | Aumenta carga fora da decisão principal. Teto 90 é para trabalho, não a antiga preparação comum de 100 convertida em 90. | Separar evento e preparação; toda carga preparada deriva da decisão única. |
| `material_progresso` + `completedMaterialIdsFromProgress` | Conclusão explícita filtra materiais do avanço. | A | Sem correspondência material-tópico, cobertura não sustenta elegibilidade de prática por tópico. | Preservar conclusão canônica e vínculo curricular verificável. |
| Critério de conclusão: `material-progress.js` versus GET/sinais | Helper usado pela preparação exige estado concluido **e concluido_em**; GET e sinais de trilha verificam somente estado. | C | Uma linha concluída sem data pode contar como coberta no diagnóstico, mas voltar a ser selecionada pelo planner. Não foi confirmado se existem linhas assim no banco. | Uma regra canônica de conclusão, com tratamento explícito de inconsistência histórica e sem reset de progresso. |
| `nextBacenLesson` | Mantém primeiro não concluído de cada curso, pode repetir material em andamento. | A | Ordem/associação ainda dependem de metadados e nomes conciliados. | Reutilizar sequência real, sem inferir conclusão pela demanda. |
| Seleção por material: score + backlog + penalidade de repetição 1,5 | Planner equilibra frequência curricular. | B | +2 de backlog e -1,5 por escolha são estratégia escondida fora da policy; pode alterar prioridade do Mentor. | Parâmetros/precedência únicos; diversidade como critério subordinado, não motor paralelo. |
| `rankMentorMaterials`: P0-P4 e metadados com evidência | Prioriza prazo, incidência, pré-requisito, backlog, peso e dificuldade. | B | Scores 5..1, peso >=4, +0,2 e janela de dois dias hardcoded; todos os prazos imediatos geram EXAM_NEAR inclusive entrega. | Reutilizar níveis/proveniência; harmonizar motivos e política sem fixar novos thresholds. |
| `material_prioridade_evidencia`: UNKNOWN/LOW/MEDIUM/HIGH | Preserva incidência/dificuldade desconhecida e origem verificável. | A | Sinal antigo numérico de tópico ainda coexiste. | Fonte de evidência curricular com UNKNOWN distinto de LOW. |
| `topico.incidencia` numérica default zero e `materia.peso_prova` | Alimentam score antigo e catálogo. | B | Zero não distingue desconhecido de baixa incidência; falta proveniência equivalente. | Conciliar evidência com fonte canônica, sem inventar incidência. |
| `calculateMentorSpecialistSignals` | Seis funções calculam sinais reais sem criar demandas. | B | Terminologia/contrato exigem seis módulos; duplicam análise de carga do motor. | Reaproveitar como funções/domínios internos do único Mentor, sem agentes independentes. |
| JSON dos seis módulos carregado por `loadMentorSpecialists` | Exige presença e expõe versões; conteúdo não é lido pelos calculadores. | C | Alterar conhecimento desses domínios no banco não altera as regras calculadas; ausência de qualquer módulo derruba ambos handlers. | Consolidar conhecimento realmente consumido e retirar dependência de supostos decisores independentes. |
| Trilha: cobertura, atual, próximo, pré-requisitos | Calcula materiais restantes e por disciplina. | B | `proxima_aula` é o vizinho imediato, sem filtrar conclusões posteriores; handlers não fornecem pré-requisitos embora função aceite. | Reutilizar métricas; próximo elegível e relações vindas do currículo canônico. |
| Desempenho no sinal novo: sempre mastery UNKNOWN | Não infere domínio de aula/tempo; expõe amostra, demais métricas null. | A | Futuro desempenho válido ainda não é calculado aqui, mesmo com respostas. | Manter desconhecido sem evidência; integrar prática apenas na fase autorizada. |
| Acadêmico: provas, entregas e aulas reais estudadas | Produz sinais de prazo e pendências por vínculo `aula_origem_id`. | A | Seleção final ainda está no planner e nem todo sinal alimenta decisão. | Reutilizar fatos/sinais no domínio acadêmico interno. |
| Previsão por ritmo de conclusão de materiais | Exige dois dias distintos e 14 observados; projeta cobertura. | B | Janela/fórmula V1, contagem de materiais com tamanhos distintos, datas de conclusão cortadas em UTC. | Projeção com evidência e instante explícitos; validar modelo/parametrização. |
| Data provisória BACEN 31/03/2027 | Fallback em policy, sinais e seeds antigos. | C | Prazo de objetivo pessoal tratado como política geral e usado sem contexto vigente. | Objetivo/compromisso/contexto com identificação oficial/provisória; nenhum prazo global. |
| `calculateTopicDiagnosis` | Beta, recência, confiança, amostra mínima e retestes distinguem evidência insuficiente. | B | Thresholds/pesos V1; gravidade e intervalos têm constantes adicionais; sem anotações assume amostra crua como inédita. | Reaproveitar princípios estatísticos; parâmetros versionados e evidência factual explícita. |
| `classifyQuestionAttempts` no GET, ausente na preparação | GET exclui repetição imediata de diagnóstico; planner usa respostas cruas. | C | Mesmo histórico pode gerar prioridade diferente nas duas rotas. | Pipeline único de evidência/tentativa antes de qualquer decisão ou diagnóstico. |
| `scoreboard`, `topicSignals` | Separam acerto/falsa certeza, calculam risco/ação e cobertura de uso de acervo. | B | Uso de questões não é cobertura curricular; Date.now e meia-vida fixa 21 divergem da policy; mastery ausente vira zero interno. | Métricas nomeadas e derivadas corretamente; instante explícito e UNKNOWN preservado. |
| `calculateCardRetention` e `calculateStudyEfficiency` | Amostra de cards e tempo apenas combinado com resultado. | B | Limiares 5/40/30%/40%, +20pp e 3 sessões/60min são V1; não definem Anki V2. | Preservar distinção execução/retenção; política futura e SRS escolhido pelo usuário. |
| `buildScenarios` antigo | Estima três horas por tópico e fatores 0,75/1/1,2. | C | Cobertura antes baseada em retenção e horas estimadas uniformes, não currículo real. | Não usar como prova de prazo/cobertura; projeção do domínio único com dados reais. |
| `practiceEligibility` | Libera prática a partir de 12/10 com semanas aderentes no caminho antigo. | C | Autorização por data histórica continua no planner, separada das flags reais. | Liberação única contextual/policy, sem calendário histórico. |
| `study-access.js`, início BACEN 31/08 e sessão feita por tópico | Gates adicionais em catálogo, questões e prática. | C | Data e cobertura por sessão competem com material/progresso/contexto. Flags atuais bloqueiam primeiro, mas regra antiga permanece ativa após liberação. | Elegibilidade única baseada em conteúdo estudado verificável e modalidade autorizada. |
| `currentPracticeFlags` | Lê quatro autorizações do contexto; erro de banco falha fechado. | A | Flags false por ausência de chave não substituem contrato de fase validado. | Reaproveitar bloqueio explícito; unificar com planejamento. |
| `simulationEligibility` | Helper com 07/09, aderência 75%, 40 respostas e backlog três. | C | Só importação em testes encontrada; regra antiga não deve virar liberação V2. | Simulados adiados; conservar teste como legado até substituição autorizada. |
| Cards diários 30min + questões + revisão no ramo antigo do planner | Produz modalidades em dias predefinidos e preenche estudo restante. | C | Agenda impõe métodos simultâneos e carga independente da necessidade de revisão. | Mentor escolhe método; Central complementa plano, sem obrigação questão+card. |
| `questao.proxima_revisao`, `revisao_item`, view `mentor_acervo_topico` | Planner agrupa por data da questão; GET usa fila e contagem da view. | C | Duas datas operacionais, UTC slice para calendário, limites 20/500 e contagens diferentes. | Ocorrência em fila canônica e projeções reconciliadas, sem segunda autoridade. |
| Feedback só para erro/dúvida no conhecimento didático histórico | Policy mantém descrição anterior. | C | API de prática atual devolve explicação após confirmação sem depender da confiança; conhecimento diverge do produto. | Gabarito/comentários após confirmação conforme V2; não restaurar limitação antiga. |
| Recuperação ativa, espaçamento, confiança e retestes: princípios da policy | Fundamentam análise de evidência e futura revisão. | A | Princípio não aprova thresholds nem algoritmo SRS legado. | Preservar conhecimento por domínio interno do único Mentor. |
| `mentor_decisao`, reason codes e explicações fixas | Auditoria e explicação determinística. | B | GET recalcula decisão em vez de ler a registrada; auditoria não grava execucao_id/policy version explícita e não há FK da demanda à decisão. | Resultado único registrado, versão/inputs e vínculo às demandas identificáveis. |
| `recordPlanAudit` | Salva plano antes/depois, sinais e decisão com hash de deduplicação. | B | Hash não inclui todos os sinais/inputs/policy; `plano_original` é estado anterior ao recálculo, não snapshot inaugural garantido. | Reaproveitar auditoria distinguindo plano inicial e alterações, com origem/versionamento. |
| `api/mentor.js` versus `plano-handler.js` | GET usa hoje/semana corrente; preparação usa semana alvo, materiais/matérias pendentes e política. | C | Backlog, scopes de objetivo, compromissos, referência temporal e sinais não são equivalentes; UI pode justificar outro resultado. | Um contrato de inputs e decisão; diagnóstico explica resultado, não decide em paralelo. |
| Cron com backup e execução técnica | Chama planner no domingo 00h Brasília; expansão está null. | B | Atualizações finais de log não verificam erro; snapshot execução não é transação do plano. | Reutilizar integração simples e auditável, separando resultado decisório de execução técnica. |
| Painel: versão de `mentor_conhecimento` e proteções 180/120/3 | Exibe versão legada e mínimos antigos hardcoded. | C | Pode indicar política diferente da efetivamente usada pelo Mentor. | Exibir versão/limites da fonte vigente, não desativar histórico. |
| Expansão quinzenal 2.000-2.500, alvo 2.250: migration 0045 | Declara função/tabelas de ciclos e seeds antigos. Cron atual não a chama. | D | Presença de função não comprova job ativo; eventual uso externo não foi verificado. | Preservar migrations/dados; não gerar acervo ou reativar expansão. Metas futuras exigem etapa própria. |
| Incremento de 60min nas 0038/0042 | Registra configuração antiga; default atual usa 50. | D | JSON real pode diferir da sequência pretendida; não afirmar incremento 60 vigente. | Histórico, não política V2. |
| Inventário 114 em `import-strategy-library.js` e `audit-strategy-production.js` | Scripts exigem número exato da coleção V1. | C | Importação/diagnóstico futuro rejeitaria inventário legítimo diferente; não há constante 114 no núcleo atual lido. | Inventário real mutável; manter scripts sem executar até adaptação autorizada. |
| `mentor_previsao` e `mentor_experimento` | Estruturas persistentes e salvaguardas históricas; sem consumidor de execução encontrado nos handlers atuais. | D | Não comprova tabela vazia/desuso externo; experimentos não estão autorizados V2. | Preservar schema/dados; não introduzir experimentos ou novas funcionalidades. |

## Tabelas, configurações e unicidade declaradas

| fonte | schema/intenção documentada no repositório | consumidor atual / limite |
| --- | --- | --- |
| `conhecimento_modulo` | 0022: unique(modulo,versao). 0046: índice único parcial **em modulo para todo registro ativo**, apesar do nome conter mentor. 0052 amplia enum de módulos. 0066 cria versão Mentor `2026.10.02.2`. | Loader principal escolhe ativo mais recente; especialistas exigem seis ativos. Não se presume múltiplos ativos onde o índice existe; aplicação real do índice não confirmada. |
| `mentor_contexto` | 0062: singleton id=1, fase/vigência/semana/dados. 0063 declara novo ciclo 02/10 e flags false. | GET, plano e gates de prática. Preparação atualiza fase/carga/estado. Schema/semente não provam contexto atual. |
| `mentor_conhecimento` | 0012: JSON versionado; antigas migrations espelham policy modular. 0062/0063 declaram todos inativos. | Painel ainda consulta ativo para mostrar versão; motor principal não o lê. Preservar histórico e corrigir consumidor somente em etapa autorizada. |
| `mentor_encontro_semanal` | 0040: unique semana; 0062 carga opcional; 0068 fatos JSON. | POST upsert, GET/UI e planner. Fatos não são política; compromissos atualmente duplicam representação. |
| `mentor_execucao` | 0013: input/resultado, versão e status; 0033 substitui índice de unicidade por tipo/semana/data. | Cron consulta/upsert e painel exibe. Não contém sozinho toda a proveniência decisória. |
| `mentor_decisao` | 0013: FK execucao_id opcional e dados; 0068 chave_operacao única. | Auditoria do plano usa chave hash; não preenche FK de execução nem fornece vínculo direto em sessao. |
| `mentor_acervo_topico` | View 0022 sobre questões/cards, incluindo próximas revisões. | GET e painel. Flags `ativa` na view e `ativo` em sinais de cards coexistem; contagens não são currículo/domínio. |
| `mentor_previsao` / `mentor_experimento` | 0013 e salvaguardas 0046. | Não houve leitura/escrita operacional encontrada no recorte atual; manter histórico. |
| `objetivo.config` / `objetivo.data_alvo` | Configuração por objetivo e data alvo. | GET usa data_alvo, planejar_ate ou janela_provavel_prova; sinal novo usa contexto/default BACEN, não a mesma origem. |
| `material_prioridade_evidencia` | 0067: enums e fonte/evidência/data obrigatórios. | Planner usa; GET não carrega esses metadados para produzir a mesma prioridade por material. |
| `acervo_meta` | Metas/bloqueio por tópico, originalmente para acervo. | Planner remove tópicos e matérias de concurso com expansão bloqueada antes de planejar teoria; gate de acervo interfere no currículo. Destino: separar acervo de elegibilidade teórica. |
| `sessao` e progresso | chaves, status, ordem, cancelamento, aula_origem_id, reason_codes; `material_progresso` canônico. | Preservar factualidade/exclusões e separar execução, carga decidida e cobertura. |

Todas essas estruturas possuem história relevante. **Nenhuma migration antiga é candidata a remoção por idade ou por conter policy superada.** Há dois arquivos com prefixo 0056 no checkout; isso merece atenção em futura conferência de ordem/aplicação, não renumeração nesta etapa.

## O que os seis domínios realmente fazem

| domínio legado | cálculo efetivo | uso pelo motor atual | limite |
| --- | --- | --- | --- |
| Planejamento | Janelas, aderência, carga, capacidade observada, perdas/backlog e possibilidades. | Motor consome janelas/backlog/carga percebida e recalcula decisão. | Análise de aumentar/reduzir duplicada; possibilidades não são decisão final. |
| Trilha | Cobertura por material/disciplina, atual, próximo, não iniciados e pré-requisitos fornecidos. | Motor consome restantes/base; ranking recebe pré-requisitos. | Handlers não fornecem pré-requisitos; próximo vizinho pode estar concluído. |
| Revisão | Vencidos e operacionalidade. | Adiciona PRACTICE_DISABLED. | Retestes/modalidade são null; nada cria prática no novo ciclo. |
| Desempenho | Contagem de respostas, domínio UNKNOWN. | Adiciona UNKNOWN_MASTERY. | Demais métricas null; análise estatística paralela ainda vive em mentor.js. |
| Acadêmico | Próxima prova/entrega, dias e aulas ainda não estudadas. | Motivos de prazo; seleção final por compromissos/aulas no planner. | Nem todos os sinais são usados na decisão final. |
| Previsão | Ritmo observado de materiais e cobertura projetada. | Adiciona COVERAGE_RISK e alimenta resumo. | Risco não escolhe área diretamente no motor; data/fórmula ainda específicas de BACEN. |

O motor retorna `mastery: UNKNOWN` mesmo que o sinal futuro mude. Não há suporte completo aos estados práticos: os seis estados são declarados, mas `mentorCycleState` só ativa os três teóricos. Isso não autoriza liberar prática nesta subfase.

## Fallbacks: conservação versus ressurreição do legado

- **Compatível:** histórico insuficiente mantém carga; ausência de encontro impede aumento; base completa não reinicia curso nem libera prática automaticamente; dados de incidência sem evidência permanecem UNKNOWN no ranking novo.
- **A adaptar:** configuração ausente/schema incompatível geram erro; não há fallback operacional integral coerente com V2. A classificação C não recomenda ignorar erro ou abrir prática.
- **Concorrente:** JSON incompleto restaura defaults estratégicos; fase não reconhecida cai em calendário antigo; previsão restaura data BACEN; catálogo inexistente pode cair em seleção por tópicos históricos quando não há materiais.
- **Não comprovado:** quais desses caminhos estão ativados pelos dados reais. Código alcançável e risco condicional estão identificados, mas não se afirma ocorrência em produção.

## Testes existentes inspecionados, sem execução

`mentor-decision.test.js`, `mentor-specialists.test.js`, `mentor.test.js`, `planner.test.js`, `phase6-meeting.test.js`, `policy-consistency.test.js`, `study-access.test.js`, `simulation-eligibility.test.js` e `expansion-policy.test.js` oferecem base de regressão.

Reaproveitar provas de determinismo, motivos, dados insuficientes, separação material/demanda, idempotência, exclusões, não compensação e gates fechados. Separar testes históricos de expectativa operacional V2: ainda existem asserts de datas de agosto/setembro, agenda fixa, cards diários, versão default e thresholds antigos. Teste passando para uma regra V1 não significa aprovação dessa regra para V2. Nenhum resultado de teste foi produzido nesta subfase.

## Riscos e pendências para consolidação futura

1. **Alto:** defaults reintroduzem policy histórica removida do banco.
2. **Alto:** caminhos antigos ainda podem apagar/remanejar sessões ou inserir compromissos; não executar preparação só para diagnosticar.
3. **Alto:** diagnóstico da UI não é leitura da decisão persistida e diverge da preparação em evidência/scope/tempo/backlog.
4. **Alto:** bloqueio de expansão do acervo filtra currículo teórico; material estudado ainda não possui correspondência completa com elegibilidade por tópico. Critérios de conclusão com/sem data divergem entre preparação e diagnóstico.
5. **Médio:** conteúdo de módulos de sinais não governa cálculos; versões expostas não comprovam influência efetiva da policy.
6. **Médio:** contexto, objetivo, defaults e encontro mantêm calendários/prazos concorrentes; UTC e Brasília coexistem na classificação de datas.
7. **Médio:** gravações separadas e hash parcial limitam replay/auditoria; não se declara atomicidade ou segurança concorrente da preparação.
8. **Pendente:** conferir schema/linhas/versões reais em leitura autorizada e identificada, sem inferir produção a partir do checkout.
9. **Produto pendente:** thresholds, janelas, carga/duração planejada, precedências finais e configuração Anki ainda não escolhidos pela V2. Este diagnóstico não os decide nem recupera feedback de carga excluído.

## Resultado da Fase 3.1

**PASS COM LIMITAÇÕES.** Inventário e diagnóstico do legado no repositório concluídos; estado do banco real/produção não verificado. Há base reaproveitável suficiente para consolidação incremental, mas não há hoje uma única policy operacional coerente com todos os contratos V2.

Somente este relatório foi criado. Nenhum código, dado, schema, migration, dependência, branch ou deploy foi alterado. Não foi iniciada a Fase 3.2.
