# Modelo de revisão V2

Data: 07/10/2026. Fase 4.1. Branch: `v2`.

Contrato alinhado a [produto.md](produto.md), [dominio.md](dominio.md) e [fontes-de-verdade.md](fontes-de-verdade.md). Este documento distingue responsabilidades; não define intervalos, thresholds ou um novo algoritmo de agendamento.

## Quatro conceitos separados

| conceito | responsabilidade | fonte canônica | o que não faz |
| --- | --- | --- | --- |
| A. Revisão como demanda | Entrega prioritária selecionada pelo único Mentor, com data, conteúdo, modalidade, duração e motivo. | `sessao` para plano efetivo; `mentor_decisao` para origem e evidências. | Não substitui calendário SRS, necessidade de reteste ou evento de execução. |
| B. Central de Revisão | Fila complementar de necessidades/agendamentos, observada pelo Mentor e disponível para consulta/prática. | Projeção de `revisao_item` e do agendamento canônico dos cards. | Não decide carga, cria demandas ou mantém uma segunda agenda editável. |
| C. SRS de Question Cards | Espaçamento da recuperação ativa de cada card; FSRS pertence exclusivamente a esse domínio. | Conteúdo em `question_card`; eventos em `question_card_registro`; configuração/versionamento SRS e estado derivado do card. | Não agenda retestes de questões nem decide sozinho o plano semanal. |
| D. Reteste de questões | Necessidade de nova tentativa para observar aprendizagem/retenção com evidência contextual. | Ocorrência em `revisao_item`; resposta/resultado/confiança em `registro`; conteúdo em `questao`. | Não usa FSRS de cards nem trata um erro isolado como domínio ou fraqueza comprovada. |

Meu Plano é a superfície operacional. A Central mostra necessidades, inclusive as que ainda não receberam uma demanda; aparecer nas duas telas não duplica execução. A mesma demanda pode atender uma ou mais fontes identificadas quando a decisão do Mentor justificar. Não se exige questão e card juntos.

## Agendamento, prioridade e execução

1. A fonte identifica necessidade/agendamento. O Mentor avalia evidências, relevância, disponibilidade e capacidade para selecionar demandas prioritárias.
2. Uma questão errada é uma observação; não determina necessariamente retorno após quantidade fixa de dias. Critérios de reteste serão definidos em etapa própria, sem importar automaticamente intervalos V1.
3. A data elegível da fonte não é necessariamente a data escolhida para a demanda. O estado de vencimento é derivado do agendamento e do instante de referência, não da posição na Semana.
4. Um item pode voltar semanas, meses ou muito tempo depois. Não há horizonte máximo nem obrigação de revisar tudo diariamente neste contrato.
5. Uma tentativa real pertence a `registro`; uma avaliação real de card pertence a `question_card_registro`. Demanda feita, item exibido ou timer encerrado não inventam esses eventos.
6. Concluir uma demanda não deve, por si só, concluir todas as necessidades vinculadas ou modificar o SRS. Atendimento exige evento correspondente e vínculo verificável. Mover demanda não reescreve decisão original nem agenda canônica da fonte.
7. Ausência de data/evidência é explícita: não significa vencimento imediato, retenção baixa ou autorização para gerar prática. Pendência não cria dívida automática.

## Base estrutural implementada nesta subfase

`shared/review-v2-model.js`, contrato `revisao-v2/1`, fornece funções puras para referências derivadas:

- `createReviewSourceReference`: distingue `RETESTE_QUESTAO`, com ocorrência `revisao_item` e alvo `questao`, de `SRS_QUESTION_CARD`, com fonte/alvo `question_card`.
- `createReviewQueueReference`: projeta chave qualificada por tipo e ID, fonte e agendamento canônico opcional. Sem data fornecida, mantém `null`; não calcula intervalo ou prioridade.
- `createPlannedReviewReference`: liga IDs de demanda/decisão a fontes, sem confundir a entrega planejada com a ocorrência de revisão. Impede fonte repetida e aceita somente questões ou somente cards, sem exigir ambos.

Esses objetos são contratos de integração, não novas tabelas ou fontes concorrentes. IDs são referências; as funções não consultam o banco para comprovar existência ou atendimento. Datas exigem timestamp parseável com fuso explícito e não recebem limite de distância. Não há dependência de FSRS, LLM, banco, relógio implícito ou policy V1.

**Limite deliberado:** o módulo ainda não foi conectado aos handlers/UI/planner. Não altera geração, calendário, atendimento ou prática vigente. O vínculo genérico não está persistido nem foi apresentado como migration aplicada. Para necessidades de revisão de conteúdo sem questão/card, a modelagem conceitual continua válida, mas nenhum novo adaptador/tabela foi inventado aqui.

## Reaproveitamento e limites do checkout atual

| estrutura atual | reaproveitamento | limite a tratar em subfase autorizada |
| --- | --- | --- |
| `api/_lib/revisoes-handler.js` e `ReviewCenter.jsx` | Central já reúne ocorrências de questões e cards vencidos; UI declara fila complementar. | Handler entrega apenas pendentes já elegíveis, limitado a 100 por fonte; grupo futuro da UI não recebe toda a fila futura. Não chamar isso de Central inteligente concluída. |
| `shared/cards.js` e eventos de cards | Conteúdo, avaliações e persistência existentes. | Algoritmo atual por intervalo/fator de facilidade não é FSRS. Configuração FSRS e reprodução auditável ainda precisam de implementação autorizada. |
| `shared/practice.js` e `pratica-handler.js` | Questões/tentativas/ocorrências de reteste possuem estruturas próprias. | Erros ainda recebem intervalos fixos em caminhos legados; existe inferência histórica de estado de domínio. Não são regras aprovadas de reteste V2. Permanecem sem alteração nesta base conceitual. |
| Policy/planner V2 e trace | Único Mentor, demandas com origem e fila observada como sinal. Revisão configurada referencia `revisao_item`. | Vínculo genérico card/reteste/conteúdo, atendimento factual e escolha qualificada de modalidade ainda não integrados. |

Migrations históricas e registros reais permanecem intactos. Não foram duplicadas filas, alteradas gates de prática ou feitas conversões automáticas de histórico.

## Validação e pendências

Testes direcionados em `tests/review-v2-model.test.js`: distinção de fontes, incompatibilidade SRS/reteste, fila sem demanda, demanda com uma única modalidade, vínculo sem duplicação, origem obrigatória, ausência de data sem fallback, datas distantes e preservação dos inputs. Resultado: 13 testes novos aprovados; 88 aprovados em 4 arquivos, incluindo regressões de cards, prática e plano. Não executados suíte completa, lint completo ou build nesta microetapa.

Pendências: configurar/implementar FSRS exclusivamente para cards; definir reteste de questões baseado em evidência; integrar projeções da Central e vínculos de atendimento/plano; qualificar prioridade/seleção no Mentor. Nenhuma dessas tarefas foi iniciada nesta 4.1.

Aprendizado: necessidade, fila, plano e resposta são fatos distintos. Regra resultante: cada um mantém sua fonte; a Central não decide estratégia e o espaçamento do card não governa questões. Sem banco, migration, deploy, merge ou avanço para a 4.2.

## Evidências observacionais, Fase 4.2

Registro em 07/10/2026. Estrutura `evidencia-revisao-v2/1` em `shared/review-v2-evidence.js`. Funções puras `questionReviewEvidence`, `cardReviewEvidence` e `contentReviewEvidence`; não conectadas aos handlers ou à policy nesta microetapa.

Princípio: **toda observação pode ser registrada; nem toda observação autoriza decisão.** Não há cálculo de prioridade, domínio, intervalo de retorno, demanda ou carga. Não há thresholds novos nem FSRS implementado.

### Mapa de sinais e proveniência

| domínio/sinal | fonte/estrutura observacional | limites de interpretação |
| --- | --- | --- |
| Questão: erro/acerto | `registro.resultado`, ligado a `questao_id`; enum `erro`/`acerto`. | Não prova domínio, fraqueza persistente ou necessidade imediata de revisão. |
| Sem conhecimento, eliminação, dúvida, certeza | `registro.classificacao`; valores `sem_conhecimento`, `eliminacao`, `duvida`, `certeza`. | Autoclassificação da resposta; falta de campo permanece `null`, não sem conhecimento. |
| Falsa certeza | Derivação local: resultado erro e classificação certeza na mesma tentativa. | Não é score de prioridade. Se resultado/confiança forem desconhecidos, valor `null`. |
| Recência de questão | `registro.criado_em` e corte explícito; segundos transcorridos. | Sem janela arbitrária; data recente não garante evidência suficiente. |
| Repetição/reteste/inédita | Contexto explícito `tipo`, com referência canônica a `registro`, `revisao_item` ou `sessao`. | Schema atual não registra essa distinção integralmente em `registro`. Sem contexto: `UNKNOWN`; não inferir reteste somente por nova resposta ou distância temporal. |
| Tópico | `questao.topico_id`, associado à questão da tentativa. | Ausência de vínculo permanece `null`; não usar título/matéria para inventar tópico. |
| Erro-alvo | Registro anterior fornecido com resultado `erro`, ID e questão identificados. | Não presumir que toda resposta posterior corrige o último erro. A relação precisa ser comprovada pelo adaptador; não é deduzida pela função. |
| Estado FSRS futuro | Campo reservado `estado_fsrs: { disponibilidade: NAO_IMPLEMENTADO, valor: null }`. | Não converter intervalo/fator de facilidade legado em estabilidade, dificuldade ou retenção FSRS. |
| Vencimento de card | `question_card.proxima_revisao` comparado ao corte explícito. | Sem data: `null`; vencido não significa prioridade automática. Pode refletir calendário legado, não FSRS. |
| Histórico de avaliações | `question_card_registro`: ID, card, resultado e instante de cada avaliação. | Preserva `novamente`, `dificil`, `bom`, `facil` e históricos `lembrei`/`revisar`, sem conversão retroativa. IDs repetidos são recusados. |
| Recência de card | `question_card.ultima_revisao`, com recência individual dos registros fornecidos. | Data do card é projeção; eventos permanecem fonte factual. Divergências exigem reconciliação futura, não alteração silenciosa. |
| Data de estudo do conteúdo | Eventos confirmados de `sessao`/`tempo_estudo` vinculados explicitamente ao material; último instante entre os fornecidos. | Data planejada não é data estudada. Timer ativo ou bloco apenas planejado não entra como exposição confirmada. O adaptador ainda precisa selecionar eventos válidos. |
| Progresso do conteúdo | `material_progresso`: estado e instantes de início/conclusão/atualização. | Não concluir material por bloco; não inferir domínio nem percentual inexistente. Sem snapshot carregado: `null`, não inferência de progresso. |
| Exposição posterior | Eventos factuais de estudo vinculados ao mesmo material, comparados ao último estudo fornecido. | A relação temporal é uma derivação, não retenção. Sem data-base/instante: posterioridade desconhecida. Não basta compartilhar a matéria. |
| Prática posterior | `registro` ou `question_card_registro`, com associação curricular verificável ao material. | Relação material/conteúdo/tópico precisa de prova; o schema atual não dá material_id direto a toda tentativa. Não inventar correspondência. |

### Envelope e desconhecidos

Cada envelope contém `versao`, `tipo`, `alvo`, `corte`, `fontes` e `observacoes`, além de `qualificacao: NAO_AVALIADA` e `autoriza_decisao: false`. Referências são entidade + ID; não são provas de existência no banco sem consulta do adaptador. Estes objetos são derivados, não novas fontes persistidas.

Datas exigem timestamp parseável com fuso explícito. Observações não podem estar no futuro em relação ao corte; agendamento futuro de card é válido. Não há relógio implícito nem limite de meses/anos. Recência não depende do fuso do dispositivo. Material/questão/card incompatíveis e duplicações dentro da mesma lista são recusados.

Histórico não fornecido é `null`; lista fornecida vazia é `[]`. Nenhuma lista é presumida completa: `completude_historico: NAO_COMPROVADA` nos envelopes de card/conteúdo. Um conjunto parcial não significa inexistência de outros eventos. Não são produzidos contadores de volume, acerto ou retenção que poderiam parecer métricas completas.

Para conteúdo, `posterior_ao_ultimo_estudo` é `true`/`false` somente quando ambos os instantes são conhecidos; caso contrário, `null`. Listas preservam também eventos não posteriores, explicitamente classificados, sem apagá-los. O mesmo ato pode ter referências em tempo/sessão; isso não autoriza contá-lo duas vezes como evidência independente ou tempo adicional.

### Validação e pendências da 4.2

24 testes estruturais novos aprovados em `tests/review-v2-evidence.test.js`; 37 aprovados junto aos 13 testes do modelo 4.1. Cobrem os quatro níveis de confiança, erro/acerto, falsa certeza, desconhecidos, recência, contexto explícito, erro-alvo, vencimento, avaliações antigas/atuais, vínculo curricular, duplicidade, corte temporal, determinismo e preservação dos inputs.

Pendentes: integração factual dos adaptadores, registro inequívoco de tipo de tentativa/erro-alvo e atendimento, correspondência material–tópico–prática, qualificação por volume/dias/persistência/reteste e implementação/configuração FSRS em etapa autorizada. Não foram implementados ranking, intervalos, retestes automáticos, mudanças no Mentor ou persistência nova.

Aprendizado: observação negativa ou vencimento não é decisão estratégica. Regra resultante: transportar fatos com proveniência e desconhecidos explícitos; o único Mentor qualificará a evidência posteriormente. Sem migration, banco real, commit, deploy, suíte completa, lint completo ou build. Não avançar para a 4.3.

## Motor de elegibilidade, Fase 4.3

Registro em 07/10/2026. `shared/review-v2-eligibility.js` implementa `evaluateReviewEligibility`, contrato `elegibilidade-revisao-v2/1`, consumindo o envelope observacional da 4.2. É um calculador de sinal de elegibilidade, não outro Mentor decisor.

Saídas: alvo, corte, resultado `ELEGIVEL`/`NAO_ELEGIVEL`/`EVIDENCIA_INSUFICIENTE`, booleano `elegivel`, `reason_codes`, critérios avaliados, evidências/regra utilizadas e pendências. `cria_demanda` e `define_prioridade` permanecem `false`. O motor não produz data de demanda, score, carga, retenção ou domínio.

### Questões

Critérios podem chegar como `CONFIRMADO`, `DESCARTADO` ou `UNKNOWN`. Uma confirmação/descartamento exige `regra_ref` com ID/versão e referências de fontes presentes no envelope. A qualificação deve vir da camada interna do único Mentor, sustentada pela policy vigente e dados canônicos; não é comando do usuário, entrada livre da UI ou outra policy persistida. A função valida a estrutura e a compatibilidade das observações, mas não comprova existência de registros/configuração no banco.

| critério | validação mínima do motor | reason code de elegibilidade |
| --- | --- | --- |
| ERRO_RELEVANTE | Erro observado e relevância qualificada, não simples erro isolado. | REVIEW_RELEVANT_ERROR |
| FALSA_CERTEZA | Erro com certeza observado e critério qualificado. | REVIEW_FALSE_CERTAINTY |
| FALTA_CONHECIMENTO | Classificação sem conhecimento observada e critério qualificado. | REVIEW_KNOWLEDGE_GAP |
| DUVIDA_PERSISTENTE | Dúvida observada, persistência qualificada por regra/evidência. | REVIEW_PERSISTENT_DOUBT |
| RETESTE_DEVIDO | Ocorrência canônica referenciada em `revisao_item` e data explícita já atingida. | REVIEW_RETEST_DUE |
| SEM_EXPOSICAO | Recência conhecida e lacuna longa qualificada; não threshold fixo inventado. | REVIEW_LONG_EXPOSURE_GAP |
| IMPORTANCIA_CONTEUDO | Importância qualificada com referência factual. Pode valer mesmo com acerto. | REVIEW_CONTENT_IMPORTANCE |
| COBERTURA | Necessidade de cobertura qualificada com referência factual. Não exige erro. | REVIEW_COVERAGE_NEED |

Pelo menos um critério confirmado e temporalmente permitido torna o item elegível. Isso apenas permite que o Mentor considere o retorno; não obriga revisão agora nem seleção no próximo bloco. Sem qualificação: evidência insuficiente. Critério desconhecido não vira negativo. Confirmação contrária ao fato (por exemplo, erro relevante em um acerto) é recusada.

Uma restrição `nao_antes_de`, quando existente, vem de agendamento/contexto canônico referenciado, nunca de `data_do_erro + X dias` calculado aqui. Um critério confirmado pode permanecer temporalmente impedido por semanas, meses ou anos e passa a elegível quando essa restrição é atingida. `REVIEW_NOT_YET_ELIGIBLE` explica o impedimento. A restrição é local ao critério; não é veto global a outras necessidades confirmadas. Ausência da restrição não cria intervalo fixo. Não há prazo máximo para um erro voltar.

### Question Cards

O motor prepara consumo de um resultado FSRS externo futuro: algoritmo identificado como `FSRS`, card correspondente, referência canônica ao próprio `question_card`, versão do algoritmo/configuração, instante de cálculo e próxima revisão. Resultado com cálculo posterior ao corte, referência incompatível ou versões ausentes é recusado.

Com essa entrada válida, próxima revisão atingida gera `REVIEW_FSRS_DUE`; data futura mantém não elegível. Sem resultado FSRS, retorna insuficiência com pendência `FSRS_NAO_DISPONIVEL`. `question_card.proxima_revisao` legado e fator de facilidade não são convertidos ou aceitos implicitamente como resultado FSRS. Testes usam snapshots exclusivamente sintéticos; nenhum FSRS foi implementado ou executado. Critérios de questões não são aceitos no caminho de cards e FSRS não é aceito no caminho de questões.

### Limitações deliberadas

O motor ainda não está conectado ao handler da Central, banco ou planner. Não libera prática, modifica gates ou substitui o agendamento legado. A integração futura deverá fornecer qualificação factual da policy única, validar o vínculo entre fontes e critério (por exemplo, quais eventos demonstram persistência), carregar estado ativo/ignorado/atendido e respeitar restrições operacionais antes da criação de demandas. Estado de atendimento não foi deduzido de acertos isolados nesta subfase.

Ainda não foram definidos thresholds de dúvida persistente, lacuna longa ou suficiência estatística. O motor não fabrica esses parâmetros: recebe critérios qualificados ou mantém insuficiência. Para importância/cobertura, o adaptador precisa incorporar ao envelope as referências pertinentes e validá-las; compartilhar tópico ou matéria não comprova sozinho o critério. Não há autoridade independente de configuração em `qualificacoes`.

### Testes e fechamento da 4.3

21 testes novos em `tests/review-v2-eligibility.test.js`; 58 direcionados aprovados junto ao modelo 4.1 e evidências 4.2. Cobertura dos oito critérios, insuficiência, adiamento por meses, reteste futuro, ausência de dívida, dúvida sem persistência, descarte, acerto elegível por cobertura/importância, contradições, fontes/versão, FSRS ausente/futuro/devido, separação de domínios e determinismo sem mutação.

Status local: PASS COM LIMITAÇÕES. Elegibilidade determinística implementada e testada; qualificação completa dos sinais e conexão operacional continuam pendentes. Sem banco, migration, commit, deploy, suíte completa, lint completo ou build. Aprendizado: elegibilidade é permissão para considerar revisão, não prioridade ou prazo obrigatório. Não iniciar a 4.4.

## Ordenação complementar da Central, Fase 4.4

Registro em 07/10/2026. `shared/review-v2-queue.js` implementa `orderReviewQueue`, contrato `fila-revisao-v2/1`. Só aceita itens com elegibilidade V2 correspondente ao alvo e ao mesmo corte. Não elegíveis ficam fora da fila acionável, identificados no resultado; não são apagados da fonte.

### Prioridade relativa

Ordenação lexicográfica determinística, sem soma de pesos ou thresholds novos. Precedência técnica implementada: urgência qualificada, vencimento, importância qualificada, falsa certeza qualificada, falta de conhecimento qualificada, persistência do erro, retestes anteriores, volume de evidência, cobertura e tempo sem exposição. Empate completo usa chave estável da ocorrência. Essa ordem só afeta a fila complementar, não altera a decisão/carga do Mentor ou o Plano.

Urgência admite `IMEDIATA`/`PROXIMA`/`NORMAL`; importância `HIGH`/`MEDIUM`/`LOW`. Persistência, retestes, volume e recência são magnitudes observacionais não negativas qualificadas pelo domínio interno do Mentor; cobertura é booleana. Sinais conhecidos exigem regra versionada e fontes presentes no envelope. Valores ausentes ou `UNKNOWN` não recebem rótulo baixo, ruim ou dominado: contribuição neutra e motivo `REVIEW_PARTIAL_ORDERING_EVIDENCE`. Volume funciona como desempate após os critérios anteriores, não comprova sozinho domínio nem suficiência. Recência usa maior tempo sem exposição primeiro, somente se o sinal tiver sido qualificado. Não inventa evidência a partir da extensão do PDF.

Falsa certeza/falta de conhecimento utilizam os reason codes de elegibilidade qualificada, não campos crus isolados. O resultado inclui `prioridade_relativa`, `sinais_utilizados` e reasons de ordenação. Não grava prioridade na fonte, recalcula FSRS ou cria demanda. A matriz e sinais são auditáveis, sem um novo motor estratégico independente.

### Plano e cobertura adequada

Antes de ordenar, verificar vínculo `revisao_ref` da 4.1 com identidade de sessão, decisão e fonte exata. A adequação deve vir do único Mentor, com `cobertura_adequada`, `prioritaria` e `regra_ref` versionada; não é inferida apenas da duração, posição ou matéria da demanda. Confirmar correspondência de tipo/ID da necessidade e ID do alvo: mesmo tópico, outra questão ou outra ocorrência da mesma questão não bastam.

Somente demanda `planejada`/`parcial`, no dia atual ou futuro e dentro do prazo útil, pode cobrir a necessidade. Para item já devido ou sem data, cobertura posterior a hoje não suprime a ação da Central; para data futura, deve ocorrer até o dia canônico do item. Comparação é calendárica em Brasília, pois a demanda possui data sem horário. Cancelada, feita, antiga, não prioritária ou inadequada não esconde necessidade ainda elegível. Movimentação manual para além do prazo reabilita a ação complementar sem mudar o vínculo histórico original.

Necessidade coberta sai de `itens` acionáveis e aparece em `cobertos_no_plano`, com fonte, sessão, decisão, regra e `REVIEW_COVERED_BY_PRIORITY_PLAN`. Não é concluída, ignorada, excluída ou agendada novamente. Nenhum registro de prática é duplicado. Essa projeção evita duas chamadas para executar a mesma necessidade; o Plano permanece operacionalmente principal.

### Categorias visuais

`REVIEW_CATEGORIES` e `reviewCategory` são usados pelo motor e por `ReviewCenter.jsx`: `Hoje`, `Atenção`, `Depois`. Hoje corresponde à data calendárica atual em Brasília; Atenção a datas anteriores; Depois a datas futuras ou ausência explícita de data. Item futuro não aparece como atrasado. Ordenação relativa é preservada dentro dos grupos; apresentação mantém a sequência solicitada. Data de vencimento e urgência não são fundidas num status factual novo.

### Integração e limites explícitos

O motor recebe projeções e vínculos já comprovados pelo adaptador, sem consultar/alterar o banco. A API `revisoes-handler.js` ainda entrega a fila legada limitada, sem qualificações V2 nem vínculo genérico persistido. Não foi conectada ao novo motor: fazê-lo agora presumindo esses dados fabricaria evidência ou ocultaria itens indevidamente. A UI foi conectada somente à classificação comum das categorias; a ordenação V2 e supressão de cobertura estão implementadas/testadas no motor, **não estão ativas na fila real da API**. A competição operacional Plano/Central permanece pendência de integração, não deve ser declarada resolvida em produção.

O vínculo `revisao_ref`, `cobertura_adequada` e os sinais são contratos de projeção, não colunas novas existentes em `sessao`. Verificação de origem real da decisão, completude/paginação da fila, atendimento e elegibilidade factual serão necessárias antes da ativação. Não foram usados prioridade V1 ou data legada para simular qualificação V2. Não foi criado painel ou nova ação visual.

Testes direcionados: 25 novos de ordenação/cobertura/categorias, com regressões 4.1–4.3. Cobrem sinais, urgência antes de volume, vencimento, motivos qualificados, vínculo exato, cancelamento, prazo, movimento manual, card sem obrigação de questão, desconhecidos, rejeição de entradas e determinismo. A verificação da UI é estrutural, não E2E de navegador. Resultado: 96 testes aprovados em 6 arquivos, incluindo 83 do domínio de revisão e 13 regressões estruturais de UI. Sem suíte completa, lint completo, build, banco, migration, deploy ou commit.

Status: PASS COM LIMITAÇÕES para motor local; ativação ponta a ponta da Central continua pendente. Aprendizado: supressão exige cobertura comprovada e temporalmente útil, não semelhança de conteúdo. Regra resultante: preservar a necessidade e sua origem, evitando segunda execução só quando o Plano realmente a atende. Não iniciar a 4.5.

## Escolha do método pelo Mentor, Fase 4.5

Registro em 07/10/2026. Função interna `selectMentorReviewMethod` em `shared/mentor-v2-review-method.js`, contrato `metodo-revisao-v2/1`. Não é especialista independente nem nova fonte de policy. Recebe elegibilidade da 4.3, escopo curricular, recursos factuais autorizados/elegíveis, slots disponíveis, modalidades permitidas, fontes e referência da policy única. Não lê defaults V1 nem consulta LLM.

### Métodos e continuidade

| método | condição | resultado |
| --- | --- | --- |
| QUESTAO_INDIVIDUAL | Necessidade de questão elegível; recurso-alvo ativo e comprovado, apenas uma questão elegível no escopo informado e slot permitido. | Recuperação/reteste direcionado ao item, sem adicionar card automaticamente. |
| BATERIA_QUESTOES | Mesmo caminho, com várias questões ativas/elegíveis referenciadas no tópico delimitado. | Prática agrupada do conteúdo, sem ampliar para matéria ou curso inteiro. |
| QUESTION_CARDS | Necessidade de card elegível; card-alvo e outros recursos elegíveis do mesmo escopo, com slot permitido. | Recuperação ativa, sem exigir questão no mesmo bloco ou modificar SRS. |
| COMBINACAO | Qualificação explícita e versionada com fontes de questão e card; objetivos complementares de recuperação ativa e aplicação do conceito; ambos os recursos e slots disponíveis. | Componentes estruturados e separados, cada um com finalidade, modalidade, referências e duração. |
| RETORNO_PONTUAL_TEORIA | Exceção: lacuna conceitual confirmada e qualificada, tópico identificado, estudo prévio comprovado, unidade curricular/material referenciados e evento factual de prática. | Somente a unidade delimitada, sem reset, reinício do curso ou conclusão automática. |

Falta de questão/card/slot não produz retorno automático à teoria. Erro, falsa certeza, dúvida ou tempo estudado não são, por si só, prova de lacuna conceitual. Se a qualificação de lacuna estiver confirmada mas não for comprovável/consistente, o resultado permanece pendente em vez de fingir revisão normal suficiente. Lacuna desconhecida/não confirmada não troca o método normal.

Com questões e cards disponíveis sem justificativa de combinação, preservar a modalidade da necessidade elegível: questão continua prática de questões; card continua recuperação por cards. A mera existência dos dois recursos não é motivo para usá-los juntos. Sem tópico explícito, restringir ao alvo exato; não deduzir tópico por nomes ou ampliar o conjunto silenciosamente. Não cria questões/cards para preencher o bloco.

### Capacidade e demandas possíveis

O domínio seleciona componentes dentro dos slots fornecidos, nunca cria capacidade. Slots de 30 ou 50 minutos são aceitos; cada slot possui ID, modalidade e duração. Gates bloqueados são respeitados. Não escolhe percentuais de divisão nem progressão de carga.

Exemplos de configurações admitidas, não rotina hardcoded:

- Slot QUESTION_CARDS de 30 minutos: componente de recuperação ativa de cards.
- Slot QUESTOES de 50 minutos: componente de questão individual ou bateria, conforme recursos elegíveis disponíveis.
- Combinação justificada: um componente de 30 minutos de cards e outro de 50 minutos de questões, **somente se os dois slots já estiverem disponíveis**. Não fundir em demanda comum de 80/100 minutos nem acrescentar carga por obrigação de combinar.

Estes exemplos não obrigam duração universal por método nem significam que uma questão leva necessariamente todo o bloco. São estimativas planejáveis separadas do tempo real. O planner futuro deverá alocar os componentes sem reutilizar slots já consumidos; a função atual não os persiste ou reserva.

### Resultado e motivos

Resultado `METODO_SELECIONADO` ou `METODO_PENDENTE`, com método, componentes, finalidade, referências, policy/corte, qualificação utilizada e `reason_codes`. Flags `cria_demanda`, `altera_progresso` e `reinicia_curso` ficam `false`. O único Mentor ainda deve incorporar a escolha à decisão tipada histórica; este objeto não é outra ordem operacional nem substitui `mentor_decisao`.

Motivos implementados: `REVIEW_TARGETED_SINGLE_QUESTION`, `REVIEW_QUESTION_BATCH_SCOPED`, `REVIEW_CARD_RETRIEVAL`, `REVIEW_COMPLEMENTARY_METHODS_JUSTIFIED`, `REVIEW_SEPARATE_CAPACITY_SLOTS`, `REVIEW_CONCEPTUAL_GAP_CONFIRMED`, `REVIEW_THEORY_RETURN_BOUNDED`. Pendências explícitas: `REVIEW_METHOD_REQUIRES_ELIGIBILITY`, `REVIEW_CONCEPTUAL_GAP_NOT_PROVEN`, `REVIEW_THEORY_SLOT_UNAVAILABLE`, `REVIEW_COMBINATION_NOT_JUSTIFIED`, `REVIEW_COMBINATION_RESOURCES_UNAVAILABLE`, `REVIEW_METHOD_RESOURCES_OR_CAPACITY_UNAVAILABLE`, `REVIEW_NO_AUTOMATIC_THEORY_FALLBACK`.

Combinação usa finalidades estruturadas `RECUPERACAO_ATIVA` para cards e `APLICACAO_DO_CONCEITO` para questões. A regra/evidência qualificada que sustenta essa complementaridade pertence à policy única, não a um campo de texto livre ou comando do usuário. A função comprova a estrutura/referências recebidas, não a autenticidade de linhas no banco; o adaptador futuro deve carregar e validar os fatos.

### Testes, integração e pendências

15 testes novos em `tests/mentor-v2-review-method.test.js`, 98 direcionados aprovados em 5 arquivos com regressões 4.1–4.4. Cobrem individual/bateria/cards, escopo, 30/50, combinação justificada ou recusada, slots separados, lacuna real versus erro isolado, estudo prévio, recursos/gates, falta de capacidade, elegibilidade, duplicações, determinismo e ausência de mutação.

Status: PASS COM LIMITAÇÕES para domínio local. Escolha ainda não é chamada pela policy operacional/handler/planner; não houve criação de demandas reais nem ativação de retorno teórico. Integração futura deverá consumir as qualificações/fatos canônicos, transportar os métodos para decisões tipadas e materializar componentes com rastreabilidade/capacidade. Nenhum novo tipo de atividade genérico COMBINACAO foi adicionado ao banco ou ao contrato operacional: combinação é uma composição de métodos/componentes existentes.

FSRS, reteste avançado, qualificação numérica e correspondência curricular completa continuam pendentes. Sem mudanças em UI, banco, migrations, algoritmo SRS, timer, carga, suíte completa, lint completo, build, commit ou deploy. Aprendizado: escolher revisão não obriga combinar métodos nem retornar à teoria; lacuna exige evidência e escopo. Não iniciar a 4.6.

## Reteste próprio de questões, Fase 4.6

Registro: 07/10/2026. `shared/mentor-v2-question-retest.js` implementa `selectQuestionRetest`, função interna do único Mentor. Não usa FSRS, não gera questões, não grava tentativas/demandas nem reabre conteúdo. A elegibilidade da 4.3 continua sendo pré-condição; esta função seleciona o recurso para retestar a necessidade, não cria uma segunda policy estratégica.

### Entradas e evidência

- Evidência anterior da 4.2 e elegibilidade da 4.3 para a mesma questão e corte: resultado, confiança, falsa certeza, erro-alvo e recência permanecem auditáveis.
- Conceito explícito e catálogo de questões existentes ativas/elegíveis com referências canônicas. Alternativas exigem equivalência qualificada/versionada que vincule questão original, alternativa e conceito. Mesmo tópico, nome parecido ou extensão de material não comprovam equivalência.
- Histórico de tentativas com IDs e timestamps explícitos; retries idênticos contam uma exposição, duplicatas divergentes são recusadas. Corte exclui dados futuros. Histórico parcial informa quantidade observada, nunca total zero por ausência de registro.
- Importância qualificada LOW/MEDIUM/HIGH fica registrada com fonte/regra e motivo. A seleção não transforma baixa importância em exclusão; a urgência relativa continua responsabilidade da 4.4/policy principal.
- Desempenho posterior no mesmo conceito fica visível como fato. Só qualificação versionada sustentada por tentativas posteriores pode indicar `NECESSIDADE_SUPERADA` ou `NECESSIDADE_PERSISTE`. Acerto posterior isolado não cancela automaticamente a necessidade nem demonstra domínio.

### Seleção determinística

1. Preferir questão alternativa com equivalência comprovada ao conceito-alvo.
2. Entre alternativas, preferir ângulo diferente quando os dois ângulos estiverem documentados na qualificação; depois menor número de exposições somente com histórico completo; depois exposição conhecida mais antiga; desempate estável por ID.
3. Sem alternativas, manter reteste pendente, sem criar questão ou retornar automaticamente à teoria.
4. A questão original pode voltar com autorização versionada e fundamentada em tentativa/reteste, `nao_antes_de` posterior à exposição anterior e já alcançado no corte. Não existe fórmula erro + X dias nem horizonte máximo. Mesmo autorizada, a original não tem preferência sobre alternativa comprovada.
5. Necessidade superada por evidência posterior qualificada permanece auditável, sem apagar o erro ou modificar história.

O resultado `reteste-questao-v2/1` informa `RETESTE_SELECIONADO` ou `RETESTE_PENDENTE`, questão original/selecionada, conceito, fontes, policy, corte, observações, qualificações e `reason_codes`. Não agenda intervalos, não infere domínio e não cria demanda. Motivos incluem `QUESTION_EQUIVALENT_ALTERNATIVE`, `QUESTION_DIFFERENT_ANGLE`, `QUESTION_AVOID_MECHANICAL_RECOGNITION`, `QUESTION_ORIGINAL_RETEST_AUTHORIZED`, `QUESTION_LATER_CONCEPT_EVIDENCE`, `QUESTION_RETEST_NEED_PERSISTS`, `QUESTION_RETEST_SUPERSEDED_BY_LATER_EVIDENCE` e motivos explícitos de pendência/prova insuficiente.

### Validação e limites

24 testes novos em `tests/mentor-v2-question-retest.test.js`; 122 testes direcionados aprovados em 6 arquivos com regressões 4.1 a 4.5. Cobrem equivalência, ângulo, gates, exposições/recência, histórico parcial, desempenho posterior, importância, retorno posterior da mesma questão, retries, determinismo e ausência de mutação/geração.

Status: PASS COM LIMITAÇÕES para o domínio local. O schema atual não oferece vínculo canônico completo de conceito/equivalência/ângulo nem contexto de todas as exposições. Os adaptadores futuros devem comprovar esses metadados e a completude do histórico, sem aceitar rótulos do cliente como fatos. A função não autentica linhas no banco: valida estrutura e referências recebidas. Não está ligada ao handler de prática, método 4.5 ou planner operacional; estes ainda não podem ser declarados protegidos contra reconhecimento mecânico por este domínio. A integração deverá transportar a alternativa selecionada para a decisão tipada, mantendo a necessidade original referenciada.

Sem mudança em banco, migrations, UI, FSRS, timer, suíte completa, lint, build, commit ou deploy. Aprendizado: retestar conceito não exige repetir imediatamente o enunciado; falta de equivalência comprovada produz pendência explícita. Encerrar na 4.6.

## Tratamento de sinais fortes locais, Fase 4.7

Registro: 07/10/2026. `assessQuestionCorrectionSignal`, em `shared/mentor-v2-question-signals.js`, interpreta uma tentativa factual com a referência da policy única. Contrato `sinais-locais-questao-v2/1`. Não é especialista independente, agenda de revisão ou estimador de domínio.

| resultado/confiança | sinal local | consequência permitida |
| --- | --- | --- |
| Erro + certeza | FALSA_CERTEZA; força CORRETIVA_FORTE | Qualifica FALSA_CERTEZA na elegibilidade 4.3. A Central 4.4 reconhece REVIEW_FALSE_CERTAINTY na prioridade relativa, respeitando urgência, prazo, importância e cobertura pelo Plano. Revisão/reteste local, sem reordenar a matéria inteira. |
| Erro + sem conhecimento | PROVAVEL_LACUNA_BASE; força CORRETIVA | Qualifica FALTA_CONHECIMENTO para revisão/reteste. Não confirma lacuna conceitual e não autoriza retorno teórico. |
| Acerto + dúvida/eliminação | CONHECIMENTO_INSTAVEL; evidência positiva instável | Registrar instabilidade observada, sem fabricar persistência ou revisão automática a partir de um evento. |
| Acerto + certeza | EVIDENCIA_POSITIVA_FORTE; evidência positiva relativamente mais forte | Registrar resultado positivo mais forte que um acerto inseguro. Não concluir domínio, cancelar automaticamente revisão ou mudar carga/matéria. |
| Acerto + sem conhecimento | ACERTO_FRACO_POSSIVEL_ACASO; evidência positiva fraca | Possível lucky guess, não prova de acaso nem lacuna confirmada. Não qualifica falta de conhecimento corretiva só pela autoclassificação. |
| Erro + dúvida/eliminação | ERRO_COM_INCERTEZA | Observação local, sem promover a falsa certeza ou fraqueza persistente. |
| Resultado/confiança ausente | UNKNOWN | Não tratar desconhecido como erro, falta de conhecimento ou domínio. |

As combinações corretivas aprovadas geram qualificações locais versionadas para a elegibilidade já existente. São fundamentadas na tentativa atual, não no erro-alvo histórico ou num percentual isolado. Não há nova escala numérica, threshold de amostra, intervalo fixo ou prioridade global. Datas/modalidades/capacidade/gates e cobertura pelo Plano continuam condições posteriores da materialização.

O escopo é um conceito somente quando seu vínculo com a questão é explícito, qualificado e referenciado; sem esse vínculo, restringe-se à questão observada. Não inferir conceito por nome, tópico ou matéria. A informação de tópico na evidência permanece factual, sem virar autorização de revisar todo o tópico.

### Limites de decisão e teoria

Todas as saídas mantêm `autoriza_decisao_ampla: false`, `requer_amostra_para_decisao_ampla: true`, `infere_dominio: false`, `confirma_lacuna_base: false`, `autoriza_retorno_teoria: false`, `altera_prioridade_materia: false`, `altera_carga: false` e `cria_demanda: false`. A regra diferencia a força do evento local da suficiência de uma amostra. Repetições não ganham autorização ampla por contagem automática deste módulo.

O domínio de método 4.5 continua exigindo lacuna qualificada, evidência, estudo prévio e unidade delimitada antes de retorno pontual à teoria. Este sinal não produz tal qualificação. A suficiência da evidência precisa ser comprovada pela policy com volume, distribuição temporal, persistência e retestes pertinentes; parâmetros ainda não aprovados não são inventados. Mesmo acerto com certeza não demonstra retenção por si só.

### Testes e integração

23 testes novos em `tests/mentor-v2-question-signals.test.js`; 145 direcionados aprovados em 7 arquivos com regressões 4.1 a 4.6. Incluem as oito combinações completas, desconhecidos, escopo, vínculo de conceito, prova de origem, limites de decisão, determinismo, elegibilidade/ordenação, cobertura prioritária pelo Plano, seleção de alternativa no reteste e ausência de retorno automático à teoria.

Status: PASS COM LIMITAÇÕES para domínio local. Integração controlada comprovada com os módulos 4.3 a 4.6, mas o novo tratamento ainda não foi conectado ao handler de prática ou planner operacional. Não modifica o comportamento legado em produção. Adaptadores futuros devem carregar fatos e comprovar correspondência conceitual/amostra; validação estrutural não autentica dados de banco. Nenhuma migração ou ativação foi presumida.

Sem banco, migration, UI, FSRS, timer, suíte completa, lint completo, build, commit, push ou deploy. Aprendizado: um evento pode justificar correção local forte sem autorizar mudança estratégica ampla; provável lacuna não é lacuna comprovada. Encerrar na 4.7.

## Integração Revisão para Meu Plano, Fase 4.8

Registro: 07/10/2026. `shared/mentor-v2-review-plan.js` integra a fila qualificada da 4.4 e o método da 4.5 à geração existente em `shared/mentor-v2-policy.js`. Versão do motor: `mentor-v2-engine/4.8`. Não cria outro decisor ou outra tabela de planejamento.

### Controle da carga e continuidade

Revisões ocupam somente slots `REVISAO` explicitamente reservados em `mentor_contexto.dados.capacidade_inicial`. Quantidade e minutos desses slots são o limite: não há percentual arbitrário, aumento automático, substituição de slot `ESTUDO`, uso de toda disponibilidade livre ou dívida por item que não coube. Continuidade do concurso e Faculdade em seus slots de estudo permanece intacta. Muitos itens elegíveis não aumentam a quantidade de demandas.

O slot de revisão pode informar matéria/tópico e ocorrência específicos, ou deixar o conteúdo para seleção do Mentor dentro do objetivo. Matéria/tópico, quando informados, devem vir juntos. O Mentor escolhe na ordem relativa da Central e só aloca método cuja duração cabe exatamente no slot e cuja modalidade está permitida. Disponibilidade factual é aplicada antes; não fragmentar nem alongar o bloco para acomodar revisão. Ausência de slot não cria nova demanda. Não foram configuradas quotas reais no banco.

### Decisão, materialização e origem

A avaliação aceita `facts.reviewPlanning.itens`, projeções internas contendo fonte, evidência, elegibilidade e método qualificados, com matéria/tópico/objetivo. Não é payload estratégico da UI nem nova fonte persistida. O código valida correspondência de policy/corte, fontes, elegibilidade e método; confere ocorrência pendente/questão/tópico na fonte canônica para retestes, e card/tópico para cards. Projeção sem fonte correspondente não gera demanda. O adaptador ainda deve autenticar os demais fatos/qualificações.

Cada `CRIAR_DEMANDA` de revisão conserva:

- Matéria, tópico, duração, dia, prioridade, `reason_codes` e policy/origem tipados.
- Título compacto que mostra o método, por exemplo `Revisão (questão): Conceito alvo`.
- `parametros.revisao`, contrato `revisao-plano-v2/1`, com fonte exata, método, referências e snapshot de evidências/qualificações.
- Fundamentação `revisao_planejada` na decisão original. Motivos específicos do método/elegibilidade permanecem no snapshot; `REVIEW_NEED`, `APPROVED_WEEKLY_CAPACITY` e `NO_HOUR_DEBT` integram a decisão operacional.

O materializador existente grava demanda `revisao` e chave imutável de decisão. O método não exige coluna nova: fica auditável na decisão canônica e visível no título da demanda. Mover ou reordenar a demanda não muda sua origem. Recalcular preserva identidade, conclusões e tombstones de exclusão; uma necessidade não ocupa dois slots na mesma alocação.

Não há promoção silenciosa do caminho legado `revisao_id + agendada_para` a decisão V2. Sem projeção qualificada ou método/slot compatível, registrar `REVISAO_V2_SEM_ITEM_METODO_OU_CAPACIDADE_COMPATIVEL`; os slots de estudo continuam sendo gerados. O teste antigo de materialização por ocorrência crua foi substituído por cobertura explícita de revisão qualificada e recusa de legado; testes de Questões/Question Cards existentes permaneceram.

### Precedência operacional do Plano

`api/_lib/mentor-v2-review-coverage.js` lê demanda e decisão original pelo rastreio existente. Só origem válida, método/evidência íntegros e demanda ativa planejada/parcial produzem cobertura. `revisoes-handler.js` separa `cobertos_no_plano` da fila acionável; não conclui, ignora ou apaga o item canônico. Totais de questões/cards refletem itens acionáveis.

Correspondência é exata por fonte, ocorrência e alvo. Compartilhar tópico, matéria ou questão em outra ocorrência não basta. Demanda cancelada/feita não oculta uma necessidade ainda elegível. A data atual da demanda define a utilidade da cobertura: necessidade já devida só sai da ação complementar se coberta hoje; mover para depois do prazo devolve a ação da Central sem alterar história. A função de fila 4.4 conserva a mesma regra. Demanda futura não impede ação hoje para item vencido.

### Validação e limitações objetivas

21 testes novos em `tests/mentor-v2-review-plan.test.js`; 315 testes direcionados aprovados em 13 arquivos. Cobrem geração tipada/materialização/rastreio, ordenação, limite de revisões, continuidade concurso/Faculdade, slots, gates, disponibilidade, método pendente/duração incompatível, não duplicação, exclusão, cobertura exata, decisão persistida, movimentação manual, cancelamento e preservação factual. Regressão de integração teve somente expectativa da versão do motor atualizada para 4.8. Banco em testes é controlado, não PostgreSQL real.

Status: PASS COM LIMITAÇÕES. Integração no avaliador e leitura de cobertura pela Central implementadas. **O adaptador operacional `evaluateMentorWeekV2` ainda não constrói `facts.reviewPlanning` a partir de qualificações canônicas completas.** Portanto, com os dados atualmente carregados por ele, não afirmar geração real de revisões V2 concluída: slots de revisão sem essa projeção permanecem pendentes. As limitações de correspondência conceitual, suficiência, alternativas e FSRS das 4.2 a 4.7 não foram inventadas/resolvidas nesta integração. A fila legada continua com sua limitação/paginação e ordenação anteriores; somente a precedência de cobertura validada foi ligada ao handler.

Métodos de um componente são materializáveis: questão individual, bateria, cards e teoria pontual previamente qualificada. Combinação multicomponente permanece pendente de alocação/cobertura conjunta; não é fundida em um bloco nem declarada atendida por apenas uma parte. Slots reservados são configuração explícita, não regra que obriga o usuário a escolher estratégia no encontro. Revisão não aumenta carga sem decisão de capacidade autorizada.

Sem banco, migration, deploy, commit, push, suíte completa, lint completo ou build. Trabalho anterior e arquivos privados mantidos intactos. Aprendizado: revisão compete por capacidade explicitamente reservada, não por toda capacidade curricular; cobertura é derivada da decisão original e da posição atual da demanda. Encerrar na 4.8.

## Motor conectado à Central, Fase 4.9, 07/10/2026

`shared/review-v2-center.js` projeta ocorrências pendentes de `revisao_item`, calendário persistido de cards e última tentativa canônica de `registro`. Quando há policy V2 válida e evidência qualificada, passa pelos sinais locais, elegibilidade e ordenação da 4.4. Sem qualificação, mantém observação de calendário com ordenação estável, sem converter datas legadas em decisão estratégica ou ressuscitar ranking V1. Não gera revisões nem altera histórico.

`revisoes-handler.js` lê também agendamentos futuros, pagina registros e conserva a precedência da demanda prioritária validada na 4.8. Categorias HOJE, ATENÇÃO e DEPOIS são calculadas no servidor pelo corte explícito em Brasília. Gates de prática permanecem. A resposta acionável não inclui score bruto, vetor ou prioridade numérica interna.

`ReviewCenter.jsx` reutiliza a interface da Fase 2: matéria/tópico, tipo, motivo curto, última interação quando conhecida e Revisar. Não mostra enunciado completo nem frente de card. Grupos vazios são textos discretos; erro de consulta não significa fila vazia. Abrir questão usa seu alvo existente. Abrir card transporta `cardId` por App/QuestionCards e consulta somente aquele item, inclusive futuro selecionado explicitamente, sem avaliar automaticamente ou mudar sua data. O GET mantém autenticação, contexto, card ativo, gate e regras existentes de introdução de cards novos; fluxo normal de cards permanece.

Validação: 203 testes direcionados aprovados em 12 arquivos. Incluem 17 testes novos da projeção/API/apresentação e 6 do alvo exato de card, regressões de evidência, elegibilidade, fila, método, reteste, sinais, integração ao Plano, cards e UI V2. Testes da API usam dados controlados; apresentação usa renderização React e callbacks. Não houve validação visual em navegador, banco real ou produção nesta subfase.

Limitações: FSRS ainda não implementado; datas de cards são observações persistidas, não qualificação FSRS. A integração operacional que constrói `facts.reviewPlanning` para novas demandas, registrada na 4.8, continua pendente. Esta subfase liga leitura e apresentação, não fecha essa geração. Nenhuma threshold ou evidência inexistente foi inventada. Sem suíte completa, lint, build, migration, deploy, commit ou push. Aprendizado: calendário observado e prioridade qualificada devem coexistir sem virar fontes concorrentes. Encerrar na 4.9.

## Integração final controlada, Fase 4.10, 07/10/2026

Status: PASS COM LIMITAÇÕES. Motor `mentor-v2-engine/4.10`.

### Ligação operacional realizada

`shared/review-v2-pipeline.js` centraliza a qualificação local antes duplicada entre consumidores. Tanto a Central como o adaptador do único Mentor usam registro factual, referência de questão/ocorrência, corte e policy. Falsa certeza e erro sem conhecimento recebem somente a qualificação local aprovada na 4.7. Acerto com dúvida, acerto com certeza ou erro com dúvida permanecem observações sem nova autorização estratégica. O registro mais recente prevalece; histórico de erro não sobrepõe resposta posterior.

`evaluateMentorWeekV2` agora constrói `facts.reviewPlanning` para necessidades locais comprovadas e consulta cobertura rastreável já planejada. Essa ligação resolve a pendência da 4.8 **para esses sinais locais de questões**. Recursos inativos, marcados como errados/defeituosos ou arquivados não são planejados; a Central também deixa de apresentar os explicitamente indisponíveis. Gates de prática, ocorrência pendente, currículo, disponibilidade e capacidade continuam necessários.

A seleção do método utiliza apenas questão existente e slot REVISAO configurado de 30/50 minutos. Métodos compatíveis são projetados por duração; o alocador escolhe dentro do slot disponível, sem incremento de minutos, substituição automática da teoria curricular, bateria inferida por tópico ou combinação obrigatória. A capacidade inválida segue a recusa tipada/fallback central existente, sem exceção prematura do adaptador. Nenhum progresso factual é alterado pela avaliação.

Calendário existente de `revisao_item` é preservado como restrição explícita: o motor não recalcula `erro + X dias`. Um registro antigo ainda pode justificar retorno local quando sua necessidade continua pendente e temporalmente permitida. Sem referência qualificada, ausência de dados não produz domínio, fraqueza ampla ou lacuna de base confirmada.

### Matriz de validação

| cenário | comprovação controlada | resultado |
| --- | --- | --- |
| Errado com certeza | POST de prática, registro, qualificação falsa certeza, Central, avaliador e demanda | PASS |
| Errado sem conhecimento | POST de prática, qualificação local; demanda quando calendário permite; data futura respeitada | PASS |
| Acerto com dúvida | Sinal instável sem autorização automática de demanda ampla | PASS |
| Acerto com certeza | Evidência positiva sem inferir domínio ou gerar revisão estratégica isolada | PASS |
| Questão antiga elegível | Retorno local sem horizonte máximo e sem reinício curricular | PASS |
| Erro isolado sem suficiência | Erro com dúvida não gera demanda de revisão ou retorno teórico automaticamente | PASS |
| Mesmo item no Plano | Cobertura exata da decisão/demanda suprime chamada equivalente da Central, preservando ocorrência | PASS |
| Múltiplos erros do tópico | Competição dentro da capacidade; sem dívida, aumento de carga ou fraqueza de matéria inferida | PASS |
| Revisão sem teoria | Método questão individual, sem alteração de progresso ou reinício | PASS |
| Teoria realmente autorizada | Qualificação sintética versionada com unidade, estudo prévio e prática atravessa método, decisão e materialização | PASS com limite de qualificação operacional |

Há também cobertura de estudo como exposição factual sem domínio, ausência de FSRS, gates, recursos indisponíveis, registro mais recente, duração de slot e falha de leitura sem persistência parcial.

21 testes novos em `tests/review-v2-integration.test.js`. Comando final direcionado: cinco arquivos de integração/revisão/capacidade/Central, 108 testes aprovados. Suíte completa: 670 testes aprovados em 46 arquivos. Lint: 166 arquivos aprovados. Build: aprovado. A primeira suíte encontrou cinco regressões na recusa de capacidade inválida; corrigidas na projeção, sem relaxar o contrato, e suíte completa repetida com sucesso.

### Limitações que permanecem explícitas

- Banco/produção e navegação E2E real não foram validados. APIs e materialização foram exercitadas com banco controlado, inclusive POST do handler existente de prática.
- O escritor legado `pratica-handler.js`/`practiceTransition` ainda calcula intervalos fixos, atualiza campos históricos da questão e possui fluxo corretivo de cards. Esta subfase não migrou esse escritor, não recalculou agendas existentes nem eliminou seus débitos de atomicidade. O POST sintético torna esse limite visível: erro sem conhecimento recebe data futura legada, respeitada pela leitura V2. Não afirmar substituição integral do agendamento legado ou fechamento de todo o ciclo de atendimento.
- Retorno pontual à teoria está integrado estruturalmente e materializável quando recebe qualificação íntegra; o adaptador ainda não produz qualificação canônica de lacuna conceitual. Teste com dados sintéticos não comprova sua obtenção em produção. Nenhuma regra de suficiência/amostra foi inventada.
- Dúvida persistente, lacuna longa, importância, equivalência entre questões/ângulos e persistência ampla dependem de qualificações/metadados ainda não fornecidos operacionalmente. Múltiplos erros no mesmo tópico não bastam para fabricá-los.
- FSRS não implementado. Contrato de entrada permanece preparado; datas de cards legados não se tornam elegibilidade FSRS ou nova demanda automática de cards. Combinação multicomponente permanece limitada conforme 4.8.

Sem banco real, migrations, deploy, commit ou push. Trabalho local anterior e fontes privadas preservados. Aprendizado: compartilhar qualificação local fecha leitura/planejamento sem transformar observação em autorização ampla; validar integração não equivale a migrar silenciosamente escritor legado ou inventar parâmetros de aprendizagem. Encerrar na 4.10.
