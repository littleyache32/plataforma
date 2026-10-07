# Modelo de sinais do Mentor V2

Data: 07/10/2026. Fase 3.2. Branch: `v2`. Referência do checkout: `1d0fc4daf57acce2b8816dd665765ff861fc854c`.

## Escopo e princípio

**Toda observação pode ser registrada. Nem toda observação autoriza uma decisão.**

Este documento define dados derivados para o único Mentor determinístico, conforme [produto](produto.md), [arquitetura do Mentor](mentor.md) e [fontes de verdade](fontes-de-verdade.md). Considera as lacunas já registradas no [diagnóstico legado](mentor-legado.md). Não implementa cálculos, decisões, alterações de schema ou coleta adicional.

Uma resposta, uma conclusão de demanda ou um minuto registrado são observações factuais. Percentuais, distribuições e séries descrevem essas observações. A autorização para decidir depende de uma policy futura, identificável, que avalie conjuntamente contexto e evidência. Nenhum sinal abaixo emite demandas, escolhe matéria, aumenta carga ou libera prática.

Não são definidos thresholds, mínimos de amostra, janelas numéricas de desempenho, pesos, scores, intervalos SRS, critérios de domínio ou quantidade de blocos. Não importar os números V1 como defaults. Não reintroduzir anamnese ou feedback Leve/Normal/Pesado.

## Contrato comum dos sinais

Cada sinal deve permitir identificar conceitualmente:

| informação | significado |
| --- | --- |
| Identidade e escopo | Sinal, usuário pessoal, objetivo, matéria, conteúdo/material e modalidade, conforme os vínculos realmente existentes. |
| Referência temporal | Instante de cálculo, início/fim da janela e se o período está aberto ou fechado. Semana calendárica e dias usam America/Sao_Paulo. Timestamps permanecem instantes, não datas cortadas em UTC. |
| Origem e versão | Registros/fontes consultados e versão da definição do cálculo. Policy usada para qualificar evidência, quando essa qualificação existir. Cache não vira fonte factual. |
| Valor e unidade | Contagem, segundos/minutos, intervalo, razão ou distribuição; numerador e denominador de toda razão. Precisão mantida no cálculo; arredondamento somente na apresentação pertinente. |
| Volume | Eventos válidos, itens distintos e eventos excluídos da métrica com motivo. Retentativas técnicas do mesmo evento não aumentam volume. |
| Distribuição da evidência | Dias distintos, sessões identificáveis e distribuição entre conteúdos/modalidades; ausência de vínculo é explícita. |
| Recência e persistência | Datas dos eventos, intervalos e série por períodos comparáveis. Não converter automaticamente tempo decorrido em esquecimento ou repetir o mesmo evento como evidência independente. |
| Qualidade e lacunas | Dados ausentes, inconsistentes, leitura parcial/falha técnica, correspondência curricular desconhecida e limites de reconstrução. |
| Limite de interpretação | O que o sinal descreve e o que não permite concluir. Não inclui uma ação estratégica automática. |

Não se exige uma tabela ou serviço novo para esse contrato. Identificação das fontes pode ser atendida por referências/snapshots simples na implementação futura.

### Valor observado e suficiência são distintos

- Um percentual pode ser calculável mesmo com pouquíssimas observações; deve acompanhar contagens e contexto, não receber selo de domínio.
- `null/UNKNOWN` representa ausência de informação para aquela medida. Zero só representa ausência comprovada de eventos numa leitura íntegra e com universo conhecido, ou resultado zero com denominador válido.
- Denominador zero produz razão indisponível, não 0% de desempenho/aderência.
- Erro de consulta, fila local não sincronizada ou lacuna histórica não equivalem a ausência de estudo.
- Suficiência para decisão permanece **não avaliada por esta subfase**. Será responsabilidade da policy futura, sem ignorar volume, recência, dias/sessões, persistência e retestes pertinentes.
- Um prazo confirmado pode ser conhecido sem amostra de prática. Exigir evidência pertinente não significa exigir retestes para todo tipo de sinal.

## Sinais definidos

### 1. Aderência semanal

**Fonte:** demandas em `sessao`, plano de referência e histórico factual de conclusões/alterações; não o contador do timer.

**Derivação:** entregas concluídas do conjunto avaliado dividido por entregas planejadas desse mesmo conjunto. Expor as duas contagens, período, data de corte e identidade do plano de referência. Uma demanda conta uma vez, independentemente de quantos timers a atendam ou de tempo excedente.

Separar demandas ainda não vencidas, faltas, cancelamentos pelo Mentor, exclusões manuais, conclusões tardias e movimentações. Plano original e plano efetivo são visões distintas e não podem compartilhar um denominador sem identificação. Uma conclusão tardia preserva seu instante real; não reescreve automaticamente o fechamento anterior.

Em semana aberta, descrever execução até o corte e demandas futuras separadamente, sem chamá-la de aderência final. A composição do conjunto elegível, incluindo tratamento de cancelamentos/exclusões, deverá ser explicitada na policy correspondente. Se não for reconstruível, apresentar contagens e limite, não um percentual supostamente comparável. Mover ou apagar uma demanda não pode melhorar silenciosamente o indicador.

**Evidência associada:** quantidade de demandas, dias previstos/realizados, distribuição por objetivo/modalidade e séries de semanas com a mesma definição. Um percentual semanal isolado não decide carga.

### 2. Carga planejada

**Fonte:** demandas persistidas e decisão de origem quando vinculável.

**Derivação:** quantidade de demandas e soma de `duracao_estimada` por dia/semana, objetivo, matéria e modalidade. Distinguir carga originalmente decidida do plano efetivo após alterações. Provas/compromissos e estudo livre não viram automaticamente blocos comuns.

**Limite:** estimativa não é tempo real, capacidade disponível ou carga executada. Identificar duração ausente e distribuição diária, não apenas total semanal.

### 3. Carga executada

**Fontes:** `sessao` para entregas; `tempo_estudo` concluído para tempo real.

**Derivação:** duas medidas separadas: demandas entregues e segundos reais registrados no período. Mostrar tempo vinculado ao plano versus livre/manual, conforme metadados existentes, sem inferir modalidade por título. Minutos são conversão do total de segundos, não soma de valores já arredondados.

**Limite:** concluir demanda sem timer comprova entrega, não minutos. Tempo sem demanda comprova registro de tempo, não entrega planejada. Não preencher tempo por estimativa nem somar `registro.tempo` novamente ao mesmo intervalo medido pelo timer.

### 4. Pendências

**Fontes:** demandas não entregues, conteúdos/materiais pertinentes e fila de revisão canônica.

**Derivação:** separar pendências de entrega, conteúdo curricular e revisão; identificar idade, origem, relevância contextual e vínculo conhecido. Contar necessidades de conteúdo distintas além dos registros de demanda, sem fundi-los: dois blocos no mesmo PDF são duas entregas, mas podem compartilhar uma necessidade curricular.

Cancelamento do Mentor e exclusão manual não são faltas do aluno. Necessidade curricular remanescente não autoriza recriar demanda excluída. Ausência de vínculo impede deduplicação semântica segura e deve ser informada.

**Limite:** pendência não é dívida de horas nem autorização para acrescentar blocos.

### 5. Regularidade

**Fontes:** eventos de entrega e tempo concluído, disponibilidade/plano identificável.

**Derivação:** dias distintos com entregas e dias distintos com tempo, apresentados separadamente; distribuição ao longo do período, intervalos sem eventos e sequência de dias observados. Comparação com dias previstos somente quando disponibilidade e plano forem conhecidos.

**Limite:** não penalizar dia sem estudo previsto como falta. Um longo timer não equivale a vários dias regulares. Dias sem observação não provam indisponibilidade ou desinteresse; não criar score arbitrário de constância.

### 6. Progresso curricular

**Fontes:** currículo/material vigente e conclusão explícita em `material_progresso`.

**Derivação:** materiais não iniciados, em andamento e concluídos; quantidade coberta/total identificado por disciplina/objetivo; material atual e próximo elegível na ordem real. Percentual de materiais concluídos descreve **cobertura por contagem**, não proporção do esforço nem domínio. Progresso de páginas/unidades só quando registrado e comparável.

**Evidência associada:** versão/composição do inventário, datas de conclusão e correspondência material-conteúdo comprovada. Acréscimo de material pode mudar o denominador sem apagar conclusão anterior.

**Limite:** bloco concluído não conclui material. Critérios conflitantes de conclusão no legado devem aparecer como inconsistência, não provocar reset ou reinício do curso. Não inferir tópicos cobertos pelo nome de PDF nem fixar 114 como total.

### 7. Tempo por matéria

**Fonte:** `tempo_estudo` concluído, agrupado por vínculo de matéria/objetivo.

**Derivação:** segundos/minutos registrados, quantidade de registros e dias distintos; distribuição por modalidade quando conhecida. Registros sem matéria ficam explicitamente sem atribuição, não distribuídos por estimativa.

Para totais por dia, identificar a convenção usada: dia factual informado para registro manual e, para intervalos reais conhecidos, fração pertencente a cada dia de Brasília. Essa distribuição é derivada, não cria tempos novos. Sem dados para separar um intervalo que cruza dias, informar a limitação; nunca usar somente `timestamp.slice(0,10)`.

**Limite:** tempo não prova domínio, dificuldade ou capacidade futura. Timer em andamento pode ter projeção própria, mas não entra como tempo concluído consolidado.

### 8. Desempenho em questões

**Fontes:** tentativas em `registro`, identidade/contexto/proveniência da `questao`.

**Derivação:** acertos, erros e acertos/tentativas válidas; questões distintas, cobertura dos conteúdos amostrados e separação entre primeira tentativa, repetições e retestes identificáveis. Não contar timeout/retry técnico como nova resposta.

**Evidência associada:** volume, dias/sessões, recência, composição do conjunto e resultado por tipo de tentativa. Dificuldade/incidência só quando houver fonte válida; UNKNOWN não é LOW.

**Limite:** acerto bruto não é domínio ou retenção. Repetir a mesma questão após ver a resposta não tem o mesmo valor informativo que recuperar em outro momento. Não extrapolar para toda a matéria uma amostra concentrada em um conteúdo.

### 9. Confiança da resposta

**Fonte:** classificação factual associada à tentativa confirmada.

**Derivação:** contagens e distribuição de Sem conhecimento, Eliminação, Dúvida e Certeza; cruzamento de cada categoria com resultado, conteúdo e tipo de tentativa. Informar classificações ausentes/legadas separadamente.

**Limite:** categorias não são uma escala numérica de domínio nem recebem pesos nesta fase. Certeza subjetiva não é confiança estatística; classificação ausente não vira Certeza.

### 10. Falsa certeza

**Fonte:** tentativa com `resultado=erro` e `classificacao=certeza`.

**Derivação:** quantidade desses eventos e itens distintos; duas razões com nomes distintos: erros com certeza/tentativas com certeza e erros com certeza/tentativas com classificação válida. Cada denominador deve acompanhar sua razão.

**Evidência associada:** repetição do padrão em dias/conteúdos, recência e resultado em retestes posteriores. Não contar retry como recorrência.

**Limite:** um episódio pode ser observado sem autorizar mudança estratégica. Não determinar gravidade por percentual sem volume ou confundir os dois denominadores.

### 11. Falta de conhecimento

**Fonte:** classificação Sem conhecimento nas tentativas.

**Derivação:** quantidade/proporção entre tentativas classificadas, questões/conteúdos distintos e resultados associados. Preservar inclusive acerto nessa categoria.

**Limite:** representa declaração naquela resposta, não diagnóstico definitivo de lacuna ou desconhecimento de toda a matéria. Erro isolado não equivale automaticamente a Sem conhecimento.

### 12. Dúvida

**Fonte:** classificação Dúvida nas tentativas.

**Derivação:** quantidade/proporção, acertos/erros associados, distribuição entre conteúdos e persistência em observações posteriores. Eliminação permanece categoria separada, não é convertida automaticamente em Dúvida.

**Limite:** acerto com dúvida difere de erro com certeza, mas não fixa método/prioridade sem avaliação conjunta.

### 13. Desempenho recente

**Fonte:** mesmas tentativas canônicas de desempenho, filtradas por janelas explicitamente informadas.

**Derivação:** série de acerto, confiança e falsa certeza por períodos comparáveis; diferenças descritivas com volumes, itens distintos, dias/sessões e composição ao lado de cada ponto. Identificar sobreposição entre janelas.

**Limite:** não fixar janela nesta fase nem declarar tendência estatisticamente confirmada pela simples diferença de percentuais. Mudança de dificuldade, conteúdo ou mistura de repetições pode explicar variação sem mudança de aprendizagem.

### 14. Recência

**Fontes:** timestamps dos eventos factuais pertinentes.

**Derivação:** último evento e tempo decorrido desde estudo registrado, conclusão de material, tentativa, reteste ou revisão, separadamente. Calcular a partir do mesmo instante de referência; data de agenda não substitui evento executado.

**Limite:** ausência de evento é desconhecido, não recência zero. Tempo decorrido sozinho não determina esquecimento, curva de retenção ou revisão obrigatória; nenhuma meia-vida V1 é herdada.

### 15. Quantidade de evidência

**Fontes:** conjunto validado de registros usado por cada sinal.

**Derivação:** eventos, itens e conteúdos distintos, dias, sessões vinculáveis, intervalo observado, recência, distribuição e repetições/retestes. Expor quantidade com e sem classificação/vínculo e limites de leitura.

**Persistência:** série de ocorrências do mesmo padrão em períodos/dias distintos, com universo e intervalos identificados. Persistência descreve repetição observada, não um limiar de aprovação. Janelas sobrepostas e eventos do mesmo item não são automaticamente evidências independentes.

**Limite:** cem eventos concentrados numa sessão não equivalem a cem questões distintas distribuídas ao longo do tempo. Volume não autoriza decisão sozinho; não criar nota única ou mínimo arbitrário de evidência.

### 16. Retestes

**Fontes:** tentativas do mesmo item com ordem e timestamps verificáveis, e contexto de prática quando disponível.

**Derivação:** tentativa inicial e posteriores, intervalo desde resposta anterior, dias/sessões distintos e mudança de resultado/confiança. Preservar correção e exposição prévia ao gabarito quando esses fatos forem conhecidos.

Sem parâmetro aprovado de espaçamento, informar o intervalo observado, não aplicar o mínimo V1 de dois dias. Quando não for possível distinguir repetição imediata de reteste planejado, classificar o contexto como desconhecido. Itens distintos do mesmo tópico só formam reteste de conteúdo se a correspondência curricular for comprovada.

**Limite:** uma nova tentativa não demonstra retenção por si só; acerto imediatamente após feedback não comprova recuperação tardia. Não definir quantidade mínima de retestes nesta fase.

### 17. Revisões

**Fontes:** ocorrências em `revisao_item`, agendamento canônico dos cards e eventos factuais de atendimento; demanda não substitui a necessidade de origem.

**Derivação:** fila por origem, conteúdo, data/motivo, futuras, previstas para o corte, vencidas, concluídas e ignoradas, conforme estado e precisão temporal disponíveis. Expor idade do vencimento e vínculo com plano/atendimento quando existente. Comparação usa instante se agenda possuir horário e dia de Brasília se for somente data.

Uma necessidade exibida na Central e no Plano continua a mesma necessidade. Questão respondida durante revisão é uma tentativa, não duas. Demanda marcada feita sem vínculo de atendimento não prova que toda a fila relacionada foi revisada.

**Limite:** revisão vencida não escolhe modalidade nem cria bloco extra. Revisão ignorada não é concluída. A descrição dos sinais não gera revisões ou ativa novas origens.

### 18. Question Cards

**Fontes:** conteúdo em `question_card`, avaliações em `question_card_registro` e configuração SRS escolhida quando existir.

**Derivação:** eventos/itens distintos/dias; distribuição 1 Novamente, 2 Difícil, 3 Bom, 4 Fácil; sequência por card, avaliações posteriores e tempo entre recuperações. Datas futuras/vencidas vêm do agendamento canônico identificado.

Novamente é relato de falha de recuperação; Difícil/Bom/Fácil descrevem avaliação do usuário, não gabarito objetivo ou percentual de acerto automaticamente. Eventos históricos lembrei/revisar conservam sua categoria original e eventual tradução deve ser explicitamente versionada, não presumida.

**Limite:** abertura de card não é revisão. Lapsos, intervalos/estabilidade e replay SRS exigem definição/configuração e dados compatíveis; não inventar estado Anki nem nota de domínio. Não gerar cards para obter evidência.

### 19. Compromissos/provas

**Fontes:** `compromisso`, `compromisso_topico` e dados factuais confirmados; encontros podem ser origem referenciada, não calendário concorrente.

**Derivação:** eventos futuros/passados, dias até a data em Brasília, matéria/objetivo e conteúdos vinculados, status e natureza do prazo. Distinguir prova, entrega e referência provisória; indicar ausência de correspondência curricular. Pendência de cobertura associada só quando mapeamento e progresso forem conhecidos.

**Limite:** dias até prova é dado calculável, não classificação automática de proximidade, risco ou prioridade. Não copiar datas BACEN antigas, inventar carga preparatória, inferir domínio ou adicionar blocos por prazo.

## Dados disponíveis conceitualmente e lacunas

Esta seção descreve capacidade do schema/checkout já diagnosticado, não existência de dados pessoais reais. Nenhum banco foi consultado na Fase 3.2.

| grupo | base canônica reaproveitável | dependência/lacuna para o sinal completo |
| --- | --- | --- |
| Execução e carga | sessao, tempo_estudo, status/datas/vínculos | Plano de referência reconstruível, alterações e distinção uniforme de cancelamentos/exclusões; compatibilidade das correções de tempo 7.x não integralmente incorporadas na V2. |
| Regularidade e disponibilidade | Dias de eventos e plano; contexto factual | Restrições/disponibilidade completas e vigentes quando necessárias; ausência de dado não vira disponibilidade ilimitada. |
| Currículo | material, material_progresso, unidades e catálogo | Critério único de conclusão, inventário conciliado e correspondência material-unidade-tópico verificável. |
| Questões e confiança | registro com resultado/classificação/data e questão | Alternativa escolhida não consta no registro atual; contexto completo de sessão/origem, exposição ao feedback e histórico integral de tentativas não estão garantidos. Desempenho básico pode ser calculável sem esses campos, mas com limites. |
| Tendência, persistência e retestes | Eventos datados disponíveis | Dados longitudinais reais e comparáveis; intervalos observáveis não são automaticamente retestes suficientes. Policy futura define suficiência sem fabricar observações. |
| Revisões | revisao_item, tentativas e cards | Vínculo canônico necessidade-atendimento-demanda e reconciliação de datas concorrentes; origens futuras sem schema/eventos permanecem indisponíveis. |
| Question Cards | question_card e question_card_registro | Configuração Anki ainda não escolhida, flag canônica e versão/estado anterior-posterior para replay; eventos V1 não fornecem retrospectivamente tudo isso. |
| Compromissos | compromisso e compromisso_topico | Conciliação dos fatos do encontro com fonte única e confirmação dos vínculos/proveniência do prazo. |

Tempo e cobertura continuam computáveis sem prática, quando seus registros forem íntegros. Domínio/retenção suficientes para decisão não são preenchidos por esses dados. Existência de tabelas não comprova observações suficientes nem libera prática.

## Salvaguardas para implementação posterior

1. Usar a mesma definição de sinal na API, no Mentor e no planner; UI não recalcula outra estratégia.
2. Qualquer razão acompanha volume e origem do denominador. Semana aberta, mudança de plano e escopos diferentes não são comparados como iguais.
3. Separar eventos técnicos repetidos de observações factuais novas; preservar identidade e história.
4. Não somar tempo, tentativas ou revisões duas vezes porque aparecem em várias entidades/telas.
5. Dados de matéria não representam automaticamente seus conteúdos; conteúdo não representa todo o objetivo.
6. Disponibilidade, cobertura, execução, recuperação e domínio permanecem dimensões distintas, não um score único.
7. Persistência/recência/reteste contextualizam evidência; não geram decisões sem policy explícita.
8. Falha de fonte e inconsistência são limites técnicos, não resultados negativos do aluno. Dados ausentes não ressuscitam default histórico.

## Fechamento

**Status documental: PASS.** Os 19 grupos solicitados foram definidos com fontes, derivação, evidência pertinente e limites. Não foram escolhidos thresholds ou decisões estratégicas. Pendências de dados/instrumentação e policy estão explicitadas, sem serem declaradas implementadas.

Aprendizado registrado em 07/10/2026: percentual calculável e evidência suficiente são conceitos diferentes. Regra resultante: o sinal deve preservar contagens, contexto temporal, proveniência e lacunas; só a policy futura do único Mentor poderá qualificar sua utilização decisória.

Somente `docs/v2/sinais-mentor.md` foi criado. Sem alterações de código, dados, migrations, testes funcionais, lint, build, commit, push ou deploy. Não iniciar a próxima subfase automaticamente.
