# Fontes únicas de verdade da Plataforma V2

Data: 07/10/2026. Fase 1.4. Branch: `v2`. HEAD de referência: `bc36d01333ad94580704cbebf81872046605f8b8`.

## Escopo e princípio

Definição conceitual alinhada ao [produto](produto.md), ao [domínio](dominio.md) e ao [único Mentor](mentor.md). A comparação considera o checkout e as migrations históricas; não houve consulta ao banco ou confirmação de quais versões estão ativas em produção.

**Um dado derivado pode existir como cache ou visualização, mas não pode virar segunda fonte concorrente.** A fonte canônica é definida por informação/responsabilidade, não pela obrigação de juntar tudo numa tabela ou JSON. Item, evento, contexto, política e decisão não são intercambiáveis.

As fontes abaixo são o contrato pretendido da V2. Lacunas de vínculo, versionamento ou reconciliação não são declaradas implementadas. Nenhuma escolha autoriza alterar código, banco ou migrations nesta subfase.

## Mapa de fontes canônicas

| conceito | fonte canônica | derivados permitidos | legado concorrente | ação futura |
| --- | --- | --- | --- | --- |
| Políticas do Mentor | Policy versionada em `conhecimento_modulo`, com versão vigente identificável do único Mentor e conhecimento organizado por domínio. Algoritmos/invariantes determinísticos têm implementação única no código; não há outra implementação em JSON. | Cache da versão carregada; parâmetros validados; explicações derivadas. Valores de estratégia pertencem à policy; código executa, não mantém outra estratégia. | `DEFAULT_MENTOR_POLICY` e merge em `shared/mentor-policy.js`; regras em `shared/mentor.js`, `shared/planner.js`, handlers, `objetivo.config` e JSON histórico de `mentor_conhecimento`. | Separar algoritmo de parâmetros; eliminar fallback estratégico histórico e leituras paralelas. Configuração incompleta não deve reativar ciclo antigo. Não escolher thresholds aqui. |
| Contexto vigente | `mentor_contexto`, com vigência explícita, fatos/condições atuais e referências às fontes de origem. Compromissos permanecem em sua entidade; encontro é registro factual de origem. | Snapshot do contexto usado numa decisão; resumo de fase e disponibilidade na UI. | Datas/fases hardcoded, JSON de policy contendo rotina atual, documentos V1 tratados como estado atual; fatos do encontro copiados sem vínculo. | Definir campos de contexto e origem; separar vigência atual de histórico, sem reescrever os fatos que a originaram. Não reintroduzir feedback excluído. |
| Carga | **Carga decidida:** decisão semanal registrada em `mentor_decisao`, com período/versão. **Plano efetivo:** demandas persistidas em `sessao`, incluindo alterações autorizadas. São informações distintas. | `mentor_contexto.dados.carga_atual` como projeção da decisão vigente, referenciada; totais de demandas/minutos estimados como agregações do plano; aderência como derivação de entregas. | Quantidades fixas no planner/defaults, etapas históricas em JSON/migrations, totais da UI usados como decisão e carga_atual sem origem concorrendo com decisão. | Tornar a origem da carga vigente rastreável; planejamento e movimentações não redecidem carga escondidamente. Separar recomendação, plano alterado e execução. Não transformar faltas em dívida. |
| Currículo | `objetivo`/`materia`/`topico` para identificação curricular validada; `material_unidade_curricular` para unidades verificáveis da fonte, com correspondência explícita quando conhecida. `material` governa identidade, proveniência e sequência do curso fornecido. Cada estrutura possui responsabilidade distinta. | Contagens, cobertura e catálogo hierárquico reconciliado; mapas de importação como apoio verificável. | Catálogo externo de 71 tópicos, `acervo-specs.js`, total 114 como constante, `ordem_estudo` versus `ordem_curso`, nomes de disciplina usados para inferir vínculo. | Reconciliar catálogo e unidades a partir das fontes reais; definir correspondência sem duplicar conteúdo por rótulo. Inventário é mutável; preservar IDs/vínculos históricos. |
| Progresso de material | `material_progresso`: estado de avanço e conclusão explícita válida por material. Ausência de linha é não iniciado no contrato atual. | Cobertura por matéria/objetivo, material atual e próximo elegível; tempo como contexto separado. | `sessao.status = feita`, duração, aceitação do material ou OCR tratados como conclusão; indicadores locais não reconciliados. | Fazer todos os consumidores lerem a mesma conclusão canônica; preservar conclusões anteriores. Bloco concluído não conclui PDF/aula. |
| Demandas | `sessao` para a entrega planejada atual, data, ordem, modalidade e estado; decisões/histórico para origem e alterações. Exclusões manuais permanecem protegidas. | Meu Plano, totais, cartões e resumo; snapshot do plano original para auditoria, sem substituir o plano atual. | Demandas calculadas só em memória, objetos antigos transportados como dívida, resultado de recálculo sobrescrevendo exclusão/entrega e timer tratado como demanda. | Conciliar mudanças de forma idempotente, preservar histórico e diferenciar falta, cancelamento do Mentor e exclusão manual. |
| Tempo | `tempo_estudo` para registros reais, com segundos persistidos, vínculo opcional a demanda e estado de execução. Tempo concluído é a base dos totais consolidados. | Contador ativo calculado a partir do estado confirmado; totais por período/disciplina; `sessao.duracao_realizada` derivada dos tempos concluídos vinculados, com arredondamento uma vez no total. | Estimativa usada como duração real, sobrescrita de duracao_realizada e soma cega; `registro.tempo` somado novamente ao timer pelo mesmo intervalo; estado local tratado como fato confirmado. | Reconciliar pelo conjunto canônico; distinguir pendência local de dado sincronizado. Reaproveitar correções 7.x somente em fase autorizada; migration 0069 não está aplicada por este documento. |
| Questões | `questao` para conteúdo, gabarito, comentários e proveniência. `registro` para tentativas reais, resultado, confiança e instante. Item e resposta possuem fontes separadas por responsabilidade. | Contagem de tentativas, acerto, confiança, recência, tendência e estado de aprendizagem quando sustentados pelos registros e policy. | `questao.quantidade_tentativas`, `usada`, `marcada_errada` ou `estado` como história independente; enum dominada tratado como domínio comprovado; dados de simulado contados duas vezes. | Preservar conteúdo e tentativas; reconciliar agregados e melhorar rastreabilidade sem inventar alternativa escolhida que registro não guarda hoje. |
| Revisões | `revisao_item` governa ocorrências/necessidades de revisão de questão; eventos em `registro` comprovam resposta. Para cards, histórico de `question_card_registro` + configuração SRS escolhida governa cálculo de agendamento, projetado em `question_card`. Demanda em `sessao` governa entrega planejada, não necessidade de origem. | Central como composição da fila; estados relativos ao instante de referência; próxima data de card como projeção SRS; demandas e contagens sem duplicar necessidade/atendimento. | `questao.proxima_revisao` e `revisao_item.agendada_para` concorrendo pela mesma ocorrência; fila da Central virando planner; card vencido e demanda contados como duas revisões executadas. | Para ocorrência de questão, a fila é autoridade de agendamento; campos na questão não podem marcar outra data operacional concorrente. Definir vínculo de atendimento/plano e reconciliação SRS sem criar segunda fila. Não ativar revisão automática nesta fase. |
| Question Cards | `question_card` para conteúdo/proveniência; `question_card_registro` para avaliações factuais; policy/configuração SRS versionada para cálculo. Ainda falta escolher a configuração Anki e completar sua rastreabilidade. | Repetições, lapsos, intervalo e próxima revisão como estado derivado; representação frente/verso baseada em conteúdo único. | Flags ativo/ativa, verso versus resposta_direta/explicacao_curta sem autoridade de edição clara, parâmetros SRS no código divergindo dos registros/configuração. | Escolher representação canônica de conteúdo e flag operacional; preservar campos/eventos antigos até reconciliar consumidores. Não adotar configuração Anki presumida. |
| Compromisso | `compromisso` para prova/entrega confirmada; `compromisso_topico` para vínculo explícito de conteúdo. | Avisos, dias até prazo e demandas preparatórias decididas pelo Mentor; cópia de referência em snapshot. | Agenda em defaults/JSON/documentos, compromisso duplicado por fato do encontro e sessões de prova usadas para inventar novo evento. | Fatos informados atualizam a entidade pertinente pelo fluxo autorizado; contexto aponta para ela, sem outro calendário independente. Preservar diferença entre prazo oficial e provisório. |
| Estatísticas | Registros canônicos de origem, não tabela/resposta de resumo: demandas para entregas, tempo_estudo para tempo, material_progresso + currículo para cobertura, registro/card_registro para prática. | Views, respostas API, gráficos, agregações e caches recalculáveis com janela, filtros, fórmula e referência temporal identificáveis; domínio como inferência com evidência, não fato inventado. | Contadores persistidos não reconciliados, resumo do frontend tratado como fato, cobertura/tempo exibidos como domínio, caches alterados manualmente sem alterar origem. | Uniformizar fórmulas e evitar dupla contagem. Dado ausente/desconhecido não vira zero de desempenho ou domínio. Estatística não modifica história factual. |
| Decisões | `mentor_decisao` para resultado final e motivos do único Mentor; `mentor_execucao` para execução/inputs/resultados técnicos. São registros vinculados, não duas autoridades estratégicas. | `sessao.reason_codes`, justificativas UI e snapshots das entradas/saídas, todos associados à decisão/versão de origem. | API do Mentor e plano recalculando estratégia separadamente, reasons regenerados sem vínculo, textos livres/documentos funcionando como memória decisória. | Unificar contrato e rastreabilidade entre execução, decisão e demandas; explicação deriva do resultado registrado, não outra decisão. Preservar histórico das decisões sem alterar fatos de estudo. |

## Fronteiras que evitam duas verdades

### Policy, algoritmo e contexto

- O banco guarda parâmetros e conhecimento versionado, não uma segunda implementação do motor.
- O código implementa o algoritmo e invariantes, sem espelhar parâmetros estratégicos em defaults concorrentes.
- Contexto guarda condições mutáveis, não outro conjunto de estratégias.
- Domínios internos de conhecimento não são especialistas/agentes independentes.
- Fallback conservador deve fazer parte da policy identificável. Remover uma chave no JSON não pode ressuscitar uma política histórica via merge.

`conhecimento_modulo` admite organização interna por domínio, mas a resolução produz uma policy coerente do único Mentor. A escolha por registros ativos e cache atual não comprova, por si só, unicidade real da versão ativa no banco.

### Carga decidida, plano e execução

Uma decisão de carga não é o total momentâneo da tela. O plano efetivo pode refletir mudanças de data/ordem feitas pelo usuário; isso não reescreve a decisão original. O total realizado deriva dos registros de execução, sem modificar retroativamente o planejado para melhorar aderência. Cada pergunta possui uma única fonte definida, sem fundir esses conceitos.

### Revisão necessária, agendada e realizada

A fila identifica necessidade e agendamento; a demanda representa entrega escolhida; tentativa/avaliação registra execução. Estar em duas telas não duplica o item. Estado relativo de vencimento é uma derivação da data/estado canônico e do instante de referência, não uma marcação independente na UI.

Para cards, os eventos e a configuração escolhida sustentam o SRS; uma projeção persistida pode manter seu estado técnico, mas não ser editada como calendário concorrente. A capacidade de reconstrução completa ainda depende de dados de versão/estado que o schema atual não registra integralmente.

## Duplicações atuais por camada

| camada | evidência/risco identificado | papel correto na V2 |
| --- | --- | --- |
| Código | DEFAULT_MENTOR_POLICY e resolveMentorPolicy repõem chaves históricas; datas/limiares também aparecem no planner/mentor/study-access. Handlers montam sinais/decisões em caminhos distintos. | Algoritmo único, contrato de inputs e parâmetros da versão canônica; não outra estratégia ou contexto oculto. |
| JSON do banco declarado | conhecimento_modulo, mentor_conhecimento, objetivo.config e mentor_contexto já receberam políticas, etapas e metas sobrepostas por migrations. carga_atual replica resultado que também aparece na decisão. | Cada registro guarda sua responsabilidade; histórico fica identificado e projeção referencia origem. Estado real de linhas não consultado nesta fase. |
| Migrations históricas | 0045 registra expansão quinzenal; 0055/0056/0058/0063 registram ciclos/datas; 0062/0063 desativam legado; 0066/0067 versionam policy/conhecimento. | História de schema e alterações aplicadas, não consulta operacional para escolher o ciclo vigente. Não editar, excluir ou reaplicar por causa de regra superada. |
| Documentos | Memória/roteiros V1 incluem metas e fases posteriormente substituídas; os documentos V2 registram contratos, não linhas atuais do banco. | Orientação normativa para desenvolvimento. Para fatos atuais, ler a entidade canônica. Documento não é memória operacional executável do Mentor. |
| Campos derivados | duracao_realizada, quantidade_tentativas, estados SRS, cobertura, totais, reasons copiados e snapshots podem divergir das origens. | Projeções com origem, versão/contexto temporal quando aplicável e reconciliação; nunca fatos independentes. |

## Contrato mínimo de derivados

1. Identificar a origem e a fórmula/regra responsável pelo valor.
2. Identificar período, instante de referência e versão quando afetarem o resultado.
3. Permitir reconstrução/reconciliação a partir das fontes; onde isso ainda não é possível, registrar a lacuna, sem prometer replay.
4. Uma mudança de cache não muda o fato; correção deve ocorrer pelo fluxo da fonte competente.
5. Cache ausente ou vencido não autoriza ler política histórica incompatível ou inventar dados.
6. Snapshots históricos continuam ligados à origem/versão da época; não são substituídos pelo estado atual nem usados como fonte vigente.

Essas obrigações são conceituais e podem ser atendidas com estruturas simples já existentes. Não exigem worker, fila nova, tabelas genéricas ou arquitetura distribuída nesta fase.

## Limites e pendências

- Confirmar futuramente versões ativas e schema real em ambiente autorizado.
- Consolidar correspondência currículo/material/conteúdo e rastreabilidade da decisão de carga.
- Definir configuração SRS, representação/flag canônica dos cards e vínculo de atendimento da revisão.
- Definir thresholds/fórmulas finais sem herdar automaticamente números V1.

Fontes canônicas conceituais foram definidas para os 13 conceitos solicitados. Implementação e migração dessas responsabilidades permanecem futuras. Somente este documento e a memória de trabalho foram atualizados; nenhum código, banco, migration, commit, push ou deploy realizado. Não iniciar a próxima etapa por efeito deste fechamento.

## Atualização delimitada da Fase 3.4, 07/10/2026

A fronteira operacional do Mentor foi implementada em `shared/mentor-v2-policy.js`, com adapter factual único `api/_lib/mentor-v2.js`. `conhecimento_modulo` no módulo mentor continua canônico; o algoritmo não contém outra estratégia/default V1. Somente configuração explicitamente marcada `MENTOR_V2`, contrato `mentor-v2/1`, com regra suportada é aceita. `mentor_contexto` permanece factual; fase/carga antiga e texto livre não são fundamentos operacionais.

Avaliações são persistidas em `mentor_decisao.dados`, com referência da policy, snapshot e contrato de decisão. Texto serve apenas como projeção explicativa. API de leitura não recalcula estratégia quando existe avaliação V2 válida registrada. Planner não consulta os antigos motores. Histórico, migrations e registros V1 não foram apagados.

Isso não conclui migração de todas as 13 fontes acima: a continuidade de demandas existentes é a única decisão executável nesta subfase. Configuração real, geração de novas demandas e thresholds permanecem pendentes. Nenhuma alteração/consulta de banco, migration aplicada ou publicação foi realizada. Detalhes e limitações em [mentor.md](mentor.md#fonte-operacional-implementada-na-fase-34).

## Atualização delimitada da Fase 3.7, 07/10/2026

A mesma policy agora reconhece `PRIORIZACAO_CURRICULAR_SEMANAL` como regra explicitamente habilitável. Seleção canônica lê `material.ordem_curso` + `material_progresso`, nunca conclusão de sessão como conclusão do material. Compromissos/vínculos fornecem prazos; histórico concluído fornece recência de execução, não retenção. Objetivo principal é referência factual opcional em `mentor_contexto.dados.objetivo_principal_id`, não outra policy em objetivo.config.

`PRIORIZAR_MATERIA` registra a seleção de material dentro da capacidade já existente, com alternativas e motivo, sem modificar o plano efetivo ou seu progresso. `priorizacao` é projeção da mesma avaliação, não outro decisor. Filas/tentativas são observadas, mas não autorizam revisão, reteste ou retorno teórico por amostra sem critério aprovado. Ativação da configuração e aplicação das seleções em demandas continuam pendentes; não foram realizadas no banco. Detalhes em [mentor.md](mentor.md#priorização-implementada-na-fase-37).

## Geração e aplicação, Fase 3.8, 07/10/2026

A policy única reconhece slots explicitamente aprovados em `capacidade_semanal` e a regra `GERACAO_PLANO_SEMANAL`; não há defaults de carga inicial ou escada histórica no executor. A avaliação registra carga proposta e decisões `CRIAR_DEMANDA`; `sessao` armazena o plano efetivamente aplicado, ainda separado de execução/progresso.

A PK estável por semana/slot evita duplicações. `chave_mentor` guarda o slot e a referência à decisão específica que criou a demanda; não é trocada quando o usuário move a sessão. Reason codes continuam uma projeção em array, sem se tornarem metadados concorrentes. Reaplicar insere somente demandas ausentes, nunca atualiza registros existentes ou restaura exclusões. Decisão registrada sem aplicação confirmada não significa semana pronta.

Fechamento factual marca não conclusão, preserva história e não vira estratégia de cobrança. Conteúdo pendente pode concorrer novamente dentro da capacidade, sem transportar sessões antigas. Base inicial real, encerramento/reagendamento estratégico explícito, critérios estatísticos e ativação no banco permanecem pendentes. Detalhes e limites em [mentor.md](mentor.md#geração-do-plano-semanal-fase-38).

## Consulta da origem, Fase 3.9, 07/10/2026

A explicação da demanda é derivada da decisão original específica em `mentor_decisao.dados`, localizada por `sessao.chave_mentor`. A consulta autenticada oferece resumo para a UI e auditoria detalhada opcional, sem gravação, nova avaliação ou consulta à policy atual. Evidências e versões são snapshots históricos da decisão; `sessao.reason_codes` permanece cache verificável, nunca segunda fonte estratégica. Ausência ou inconsistência de vínculo é explícita, inclusive em registros V1. Nenhuma fonte histórica foi reconstruída ou alterada. Detalhes em [mentor.md](mentor.md#rastreabilidade-da-demanda-fase-39).

## Integração verificada, Fase 3.10, 07/10/2026

O fluxo de dados/sinais/policy/decisão/planner/demandas/rastreio foi validado em integração controlada. Dependências transitivas dos entrypoints decisórios V2 não alcançam motores V1; políticas históricas no banco/configuração não fornecem defaults. Concorrência de versões ativas impede aplicação em vez de escolher uma silenciosamente. A Semana não usa mais o início histórico de setembro. Contrato da API com Estatísticas foi preservado sem ativar revisão avançada. Validação local completa aprovada; configuração/schema reais e ativação no banco não foram validados ou alterados. Limites em [mentor.md](mentor.md#integração-do-mentor-v2-fase-310).
