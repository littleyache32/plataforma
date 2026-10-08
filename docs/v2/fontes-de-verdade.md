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

## Disponibilidade canônica, Fase 3.12, 07/10/2026

`mentor_contexto.dados.disponibilidade`, versão `disponibilidade-v2/1`, governa minutos factuais por data. `compromissos_bloqueantes` referencia IDs canônicos; suas datas vêm de `compromisso`, sem segundo calendário. `capacidade_semanal` na policy continua carga pretendida, não prova de disponibilidade. Slots alocados, reservas, reasons e `parametros.data_alocada` são derivados auditáveis. Data omitida/estrutura desconhecida não autoriza criação; demanda existente ou movimento manual não é reescrito para satisfazer o derivado. O formato foi definido em código/documentação, não instalado no banco. Não houve mudança no encontro. Contrato e limites em [mentor.md](mentor.md#disponibilidade-factual-fase-312).

## Reconciliação do encontro, Fase 3.13, 07/10/2026

O encontro não é uma segunda agenda. Provas/entregas são materializadas ou identificadas em `compromisso`; referências inequívocas são guardadas no encontro e resolvidas na leitura. Mudança de prazo usa o mesmo ID. Disponibilidade excepcional atualiza apenas datas explícitas em `mentor_contexto.dados.disponibilidade`, com referência no encontro. Relato original permanece histórico; contexto narrativo da semana é projetado em `mentor_contexto.dados.eventos_encontro` com origem e vigência semanal, sem interpretação estratégica. O Mentor não lê cópias de calendário, feedback de carga ou policy do encontro.

Dados antigos não foram migrados/reinterpretados automaticamente. Leve/Adequada/Pesada saiu da UI V2; campos históricos permanecem preservados e ignorados. Encontro vazio não altera fontes operacionais, e encontro ausente não veta plano válido. Implementação controlada não garante atomicidade entre as chamadas de compromisso/contexto/encontro nem comprova configuração em produção. Contrato, testes e limitações em [mentor.md](mentor.md#fatos-do-encontro-integrados-fase-313).

## Capacidade inicial, Fase 3.14, 07/10/2026

`mentor_contexto.dados.capacidade_inicial`, contrato `capacidade-inicial-v2/1`, é a única fonte da base configurável do perfil, por objetivo/atividade. Disponibilidade permanece fato calendárico separado; policy em `conhecimento_modulo` permanece regra; `mentor_decisao` permanece resultado; `sessao` permanece plano efetivo. Contexto guarda parâmetros iniciais, não algoritmo de progressão.

Referências anteriores a `capacidade_semanal` na policy documentam implementação histórica. Esse campo não é mais aceito na policy operacional nem usado como fallback. Ausência do parâmetro não é preenchida com rotina histórica ou tempo livre. Revisão da base acompanha a decisão; `carga_semanal.capacidade_inicial` é projeção, não outra autoridade. Sem conversão/alteração de dados reais. Contrato e limites em [mentor.md](mentor.md#capacidade-inicial-do-perfil-fase-314).

## Pendências, Fase 3.15, 07/10/2026

Sessão anterior continua canônica para a entrega/histórico factual. `mentor_decisao` guarda seu tratamento estratégico identificado, com snapshot e vínculos de nova seleção. Material/progresso/compromissos e contexto sustentam relevância atual; não há tabela de dívida de horas ou status local paralelo. Nova continuidade em `sessao` tem identidade e origem próprias, sem mudar a data/status da antiga. Abandono encerra obrigação na decisão, não remove registros nem currículo. Detalhes e limites em [mentor.md](mentor.md#tratamento-estratégico-de-pendências-fase-315).

## Separação estrutural da revisão, Fase 4.1, 07/10/2026

Demanda em `sessao`, decisão em `mentor_decisao`, fila derivada da Central, SRS de cards e reteste de questões não são intercambiáveis. FSRS pertence somente a Question Cards; questões mantêm lógica própria de reteste. Referências puras em `shared/review-v2-model.js` distinguem ocorrência `revisao_item`/alvo `questao` de fonte/alvo `question_card`, sem nova tabela, calendário ou algoritmo. Contrato, legado ainda não convertido e pendências em [revisao.md](revisao.md). Os adaptadores operacionais não foram conectados nesta subfase; nenhum vínculo novo ou agendamento foi gravado no banco.

## Evidências de revisão, Fase 4.2, 07/10/2026

`shared/review-v2-evidence.js` projeta observações com referências e corte explícito, sem armazenar outra fonte ou decidir prioridade. Questões leem resultado/confiança de `registro`; cards preservam avaliações em `question_card_registro`; conteúdo separa progresso e eventos de estudo/prática com vínculo verificável. Repetição/reteste/erro-alvo não são deduzidos sem contexto; FSRS permanece não implementado. Ausência de dados permanece desconhecida, não desempenho ruim. Mapa completo e pendências em [revisao.md](revisao.md#evidências-observacionais-fase-42). Sem integração operacional ou alteração de banco nesta subfase.

## Ordenação complementar, Fase 4.4, 07/10/2026

`shared/review-v2-queue.js` ordena projeções elegíveis sem persistir outro calendário/prioridade estratégica. Cobertura adequada por demanda exige vínculo exato com sessão/decisão/fonte e qualificação versionada; itens cobertos são preservados na projeção auditável, não concluídos nem apagados. A UI usa a classificação comum Hoje/Atenção/Depois. A API legada ainda não fornece evidência/vínculos V2 e não foi conectada ao motor; a supressão de duplicidade operacional permanece pendente de integração. Contrato e limites em [revisao.md](revisao.md#ordenação-complementar-da-central-fase-44).

## Método de revisão, Fase 4.5, 07/10/2026

`shared/mentor-v2-review-method.js` é função de domínio interna do único Mentor, não fonte concorrente de estratégia. A escolha recebe referência da policy, elegibilidade, fatos e slots autorizados; não modifica história ou calendário. Retorno teórico exige unidade, cobertura prévia e lacuna qualificada. Combinação conserva componentes/slots separados. Seleção ainda não está ligada à decisão operacional/planner; `mentor_decisao` e `sessao` continuam canônicos para decisão e demanda, sem nova tabela ou atividade COMBINACAO. Contrato e limites em [revisao.md](revisao.md#escolha-do-método-pelo-mentor-fase-45).

## Reteste de questões, Fase 4.6, 07/10/2026

`shared/mentor-v2-question-retest.js` seleciona recursos existentes a partir de elegibilidade e qualificações da policy única, sem calendário próprio ou FSRS. `registro` continua fonte factual de tentativas; número de exposições e desempenho posterior são derivados, não novos fatos concorrentes. Equivalência/ângulo/conceito exigem metadados comprovados pelo adaptador: o schema vigente ainda não possui essa correspondência completa. Histórico parcial não equivale a ausência de exposição. Integração operacional permanece pendente; nenhuma tabela, intervalo legado ou geração runtime foi ativado. Contrato em [revisao.md](revisao.md#reteste-próprio-de-questões-fase-46).

## Sinais corretivos locais, Fase 4.7, 07/10/2026

`shared/mentor-v2-question-signals.js` interpreta resultado/confiança de `registro` por regra determinística aprovada, sem outra fonte de estratégia ou score de domínio. Qualificações locais alimentam a elegibilidade existente; prioridade relativa continua na Central, decisão/demanda continuam em `mentor_decisao`/`sessao`. Falsa certeza justifica correção local, não fraqueza da matéria. Acerto sem conhecimento é evidência fraca, não lacuna confirmada. Vínculo conceitual precisa de prova; ausência restringe à questão. Decisão ampla e retorno teórico não são autorizados pelo evento isolado. Domínio e integração controlada testados; conexão operacional permanece pendente. Contrato em [revisao.md](revisao.md#tratamento-de-sinais-fortes-locais-fase-47).

## Revisão integrada ao Plano, Fase 4.8, 07/10/2026

`mentor_decisao` conserva método/fontes/evidências em `parametros.revisao` e `sessao` conserva demanda efetiva e vínculo imutável. `facts.reviewPlanning` é uma projeção interna, não outra tabela ou configuração de estratégia. Reserva de slots REVISAO pertence à capacidade inicial canônica; alocação não toma slots ESTUDO nem aumenta minutos. A Central lê cobertura da decisão original e data/status atuais da demanda, sem gravar uma segunda prioridade/agenda ou concluir itens. O handler foi conectado à supressão de cobertura validada; o adaptador operacional ainda não fornece projeções completas para criar novas revisões V2. Ausência produz pendência explícita, não fallback legado. Detalhes em [revisao.md](revisao.md#integração-revisão-para-meu-plano-fase-48).

## Projeção operacional da Central, Fase 4.9, 07/10/2026

`revisao_item` fornece ocorrência/calendário, `registro` fornece última tentativa e resultado/confiança, `question_card` fornece calendário/interação persistidos. `shared/review-v2-center.js` deriva apresentação e utiliza elegibilidade/ordenação V2 apenas com evidência qualificada e referência válida de policy. Datas legadas não são FSRS nem inferência de domínio. A UI consome categorias do corte do servidor, sem score bruto ou nova fonte factual. `cardId` é apenas alvo de navegação/consulta, não nova agenda. Cobertura do Plano continua derivada de `mentor_decisao` e `sessao`. Detalhes e limitações em [revisao.md](revisao.md#motor-conectado-à-central-fase-49-07102026).

## Integração factual de revisão, Fase 4.10, 07/10/2026

`shared/review-v2-pipeline.js` compartilha a qualificação local usada pela Central e pelo adaptador factual do Mentor. `facts.reviewPlanning` passa a ser construído a partir de `registro`, `revisao_item`, recurso disponível, tópico/matéria e capacidade canônica, sem outra fonte de estratégia. Somente combinações corretivas locais aprovadas podem fornecer itens operacionais; calendário existente continua restrição explícita, sem novo intervalo V2. Slots reservados continuam sendo o limite da materialização; a decisão e a demanda conservam suas fontes originais.

Essa integração não migra o escritor legado de prática, não qualifica automaticamente lacuna conceitual ou equivalência entre questões e não calcula FSRS. Teoria pontual exige proveniência íntegra fornecida ao contrato; cards aguardam sua integração SRS própria. Resultados, testes e limites em [revisao.md](revisao.md#integração-final-controlada-fase-410-07102026).
# Atualização da Fase 3.17

07/10/2026: `mentor_contexto.dados.ciclo_operacional` é a fonte factual do ciclo; `dados.capacidade_inicial` define a base planejável. `config/mentor-ciclo-atual.json` é somente entrada de manutenção convertida por `prepareCycleContext`, nunca consultada pelo motor em paralelo ao banco. Tetos 450/240/180 e restrições de materialização ficam no contrato central `shared/mentor-v2-cycle.js`, aplicado pelo allocator único. O arsenal futuro e a precedência atual estão em `mentor-estrategias.md`. Nenhum contexto ou cancelamento foi aplicado ao banco real nesta subfase.
# MVP de 08/10/2026

Decisão mais recente: início factual em 08/10, bootstrap até 11/10, sem reset em 12/10. `docs/v2/mvp-estudo.md` registra escopo e limites. A configuração local não substitui disponibilidade factual nem comprova ativação no banco. Tempo e demanda permanecem entidades separadas; o MVP deriva duração dos registros concluídos e preserva-a ao marcar/desmarcar a demanda, sem prometer atomicidade entre tabelas.
