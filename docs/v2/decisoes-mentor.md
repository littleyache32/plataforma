# Contrato de decisões do Mentor V2

Data: 07/10/2026. Fase 3.3. Branch: `v2`. Referência do checkout: `1d0fc4daf57acce2b8816dd665765ff861fc854c`.

## Escopo

Contrato documental do único Mentor determinístico, alinhado ao [produto](produto.md), à [arquitetura](mentor.md), às [fontes canônicas](fontes-de-verdade.md) e ao [modelo de sinais](sinais-mentor.md).

Define formato, tipos, referências, motivos e limites de aplicação. Não implementa decisões, algoritmos, persistência, API, migrations ou geração de demandas. Os critérios estratégicos, thresholds, janelas e precedências finais permanecem na etapa própria de policy. Enumerar um tipo não autoriza ativar sua modalidade.

**Não existem decisões livres em texto como fonte operacional.** O executor recebe dados tipados, não interpreta uma justificativa para descobrir o que fazer. Texto explicativo é projeção da decisão estruturada; editá-lo não muda o resultado. Texto livre do encontro não se transforma em regra executável.

## Envelope tipado de uma decisão

União discriminada por `tipo_decisao`: há um envelope comum e parâmetros específicos de cada tipo. Campos não aplicáveis são `null` ou coleções vazias conforme este contrato; campos necessários não podem ser omitidos nem substituídos por texto. Nomes abaixo são conceituais, não novas colunas exigidas.

| campo | tipo conceitual | obrigação e significado |
| --- | --- | --- |
| `decisao_id` | Identificador estável | Identifica este resultado no histórico. Retentativa de aplicação não é uma nova decisão. |
| `versao_contrato` | Identificador de versão | Distingue o formato deste contrato de representações históricas; a versão concreta será atribuída na implementação. |
| `tipo_decisao` | Enum fechado do catálogo abaixo | Discriminador obrigatório. Não aceitar verbo/texto arbitrário. |
| `objetivo_id` | ID ou null | Obrigatório para alvo pertencente a um objetivo. Em decisão de carga envolvendo vários objetivos, os IDs aparecem nos itens estruturados do escopo, sem inventar objetivo único. |
| `materia_id` | ID ou null | Obrigatório para priorizar matéria e quando o alvo tiver matéria conhecida. Deve pertencer ao objetivo indicado. |
| `topico_id` | ID ou null | Obrigatório para priorizar tópico; nos demais casos somente se houver correspondência curricular comprovada. Não inventar tópico pelo nome do material. |
| `tipo_atividade` | ESTUDO, QUESTOES, QUESTION_CARDS, REVISAO ou null | Identifica modalidade escolhida quando aplicável. Não adicionar SIMULADO ao catálogo operacional inicial. |
| `duracao_minutos` | Número positivo finito ou null | Estimativa de uma demanda concreta, nunca tempo estudado. Null para decisão sem duração individual. Carga agregada usa parâmetros próprios. |
| `prioridade` | Objeto de ordem relativa ou null | `{ordem_relativa: inteiro positivo, conjunto_ref: ID}`. Ordem menor vem antes **dentro do mesmo conjunto**. Não é score de domínio nem aprovação de escala P0-P4 ou pesos V1. |
| `alvo_temporal` | Objeto obrigatório | `{data: YYYY-MM-DD ou null, semana_inicio: YYYY-MM-DD, semana_fim: YYYY-MM-DD}`. Semana alvo é operacional, segunda a domingo em America/Sao_Paulo; data, quando presente, pertence a ela. |
| `demanda_id` | ID ou null | Obrigatório para manter ou alterar uma demanda existente. Null ao solicitar necessidade ainda não materializada ou criar demanda nova. |
| `alvos_relacionados` | Coleção de referências tipadas | IDs de material, unidade curricular, compromisso, necessidade de revisão ou pendência, conforme o tipo. Somente entidades reais identificáveis; não presumir que todas já têm ID/schema disponível. |
| `parametros` | Objeto discriminado por tipo | Conteúdo operacional específico definido na matriz abaixo; não objeto livre de instruções. |
| `reason_codes` | Coleção não vazia de códigos conhecidos | Motivos estruturados; cada código tem suporte nas evidências e regra da policy. |
| `fundamentacao` | Coleção estruturada | Para cada motivo: `{codigo, regra_id, evidencia_ids}`. `regra_id` identifica a regra na versão da policy; IDs apontam para `evidencias_utilizadas`. |
| `evidencias_utilizadas` | Coleção estruturada não vazia | Fatos/sinais/contexto efetivamente utilizados, com valores e lacunas do instante de avaliação; contrato abaixo. Não apenas justificativas textuais. |
| `instante_referencia` | Timestamp com offset ou UTC | Corte das entradas e referência de cálculo; dias/semanas são derivados em Brasília. |
| `registrada_em` | Timestamp | Instante técnico de registro, separado da referência usada para decidir. |
| `policy_ref` | Referência versionada | `{fonte: conhecimento_modulo, id: ID, versao: identificador}`. Identifica a policy efetiva, não uma versão de default histórico. |
| `contexto_ref` | Referência/snapshot identificável | Contexto efetivo usado no corte, inclusive vigência. Não basta apontar para singleton mutável sem identificar seu conteúdo na avaliação. |
| `avaliacao_ref` | Identificador | Liga decisões da mesma avaliação e seus inputs/sinais; não cria outro Mentor. |
| `decisao_substituida_id` | ID ou null | Referência a decisão anterior cujo efeito prospectivo é substituído, sem apagá-la. Null quando não há substituição. |

A ordem relativa exige conjunto identificável e ordenação reprodutível. Empates, níveis, pesos e precedência entre critérios ainda pertencem à policy futura. Não comparar posições de conjuntos diferentes como prioridade global.

Datas específicas de outubro, quantidade de blocos e presets do timer não são defaults deste contrato. A política de duração planejada não é estabelecida pela existência do campo `duracao_minutos`.

### Evidências utilizadas

Cada item contém `evidencia_id`, `natureza` (FATO, SINAL ou CONTEXTO), fonte/referência canônica, versão da definição quando derivado, escopo, janela/corte, valor e unidade quando pertinentes, e lacunas/qualidade identificadas.

Para razões de desempenho/aderência, incluir numerador, denominador, volume, itens distintos, dias/sessões, recência, persistência e retestes quando pertinentes. Não é necessário repetir todo o histórico em cada decisão, mas devem existir referências e valores/snapshot suficientes para reconstruir o fundamento. Fonte mutável sem registro do valor observado não garante replay.

Ausência de dados também pode fundamentar uma decisão conservadora: registrar qual fonte foi consultada, sua integridade e a lacuna. Consulta que falhou não é evidência de ausência de estudo. Prazo confirmado não precisa de reteste, mas precisa de origem e data verificáveis.

**Toda observação pode ser registrada. Nem toda observação autoriza uma decisão.** A fundamentação deve identificar a regra que qualificou o uso dos sinais; listar um percentual ou um reason code não substitui essa avaliação. Nesta subfase não se define suficiência estatística.

## Catálogo inicial de tipos

| `tipo_decisao` | significado operacional | campos/parâmetros necessários quando aplicável | o que não autoriza |
| --- | --- | --- | --- |
| CRIAR_DEMANDA | Materializar uma entrega nova a partir de necessidade/decisão explícita. | Objetivo, matéria quando conhecida, atividade, duração, data alvo; conteúdo/material/necessidade identificável quando pertinente. Parâmetros: referência da necessidade e ordem planejada quando definida. | Duplicar demanda equivalente, recriar exclusão manual, concluir material ou iniciar timer. |
| MANTER_DEMANDA | Preservar demanda existente após avaliação. | `demanda_id`, referência da versão/estado observado e semana/data alvo atuais. Atividade/duração/prioridade, se projetadas, devem coincidir com o estado mantido. | Reescrever fatos, restaurar exclusão ou modificar conteúdo sob o nome de manutenção. |
| REDUZIR_CARGA | Definir carga planejada menor para o período e escopo explícitos. | Parâmetros de carga anterior/proposta, objetivos e unidades comparáveis, distribuição aplicável, referências de decisão/plano anterior. | Apagar estudo realizado ou concluir que tempo registrado diminuiu; impor piso V1. |
| AUMENTAR_CARGA | Definir carga planejada maior para o período e escopo explícitos. | Mesma estrutura de carga e evidência qualificada pela policy vigente. | Compensar dívida de horas, presumir capacidade ou reativar escalada por data histórica. |
| REDISTRIBUIR_CARGA | Alterar distribuição no escopo declarado, conservando seu total planejado na mesma unidade. | Antes/depois por objetivo/matéria/dia/atividade conforme mudança; total preservado e alvos existentes identificados. | Aumentar total escondidamente, alterar execução ou atropelar movimentação/exclusão protegida. |
| PRIORIZAR_MATERIA | Alterar posição relativa de matéria entre alternativas elegíveis. | Objetivo, matéria, prioridade com conjunto comparável, período e referências das alternativas. | Excluir outras matérias do currículo ou acrescentar demanda sem decisão de carga/planejamento correspondente. |
| PRIORIZAR_TOPICO | Alterar posição relativa de conteúdo comprovadamente identificado. | Objetivo, matéria, tópico, prioridade e conjunto comparável, período. | Inventar vínculo material-tópico ou transformar resultado isolado em domínio. |
| SOLICITAR_REVISAO | Selecionar necessidade de revisão para o planejamento. | Referência da necessidade/origem e conteúdo quando conhecidos; atividade REVISAO; parâmetro `modalidade_execucao` QUESTOES ou QUESTION_CARDS quando já escolhida. Data ou semana alvo. | Executar questão+card obrigatoriamente, duplicar fila ou marcar atendimento sem evento real. |
| SOLICITAR_QUESTOES | Selecionar prática de questões em conteúdo/escopo elegível. | Objetivo, matéria e conteúdo/itens identificáveis; atividade QUESTOES; referência da necessidade, incluindo revisão quando for o caso. Duração/data obrigatórias somente ao materializar demanda. | Gerar acervo, abrir prática bloqueada ou presumir que solicitação foi executada. |
| SOLICITAR_QUESTION_CARDS | Selecionar prática de cards existentes e elegíveis. | Objetivo, matéria e referências de cards/conteúdo/necessidade; atividade QUESTION_CARDS. Duração/data obrigatórias somente ao materializar demanda. | Gerar cards automaticamente, escolher configuração Anki ou ativar modalidade bloqueada. |
| RETORNO_PONTUAL_TEORIA | Selecionar retorno explícito a conteúdo já estudado quando justificado. | Objetivo, matéria, atividade ESTUDO e material/unidade/tópico identificável; necessidade/lacuna delimitada e referência de cobertura prévia. Duração/data se houver demanda. | Reiniciar curso, resetar progresso ou reapresentar material como nunca estudado. |
| ADIAR_CONTEUDO | Retirar necessidade da seleção imediata sem encerrá-la. | Conteúdo/necessidade e período de seleção afetado; parâmetro `destino_temporal` com semana futura, se conhecida, ou null se ainda não definida. | Apagar história, excluir currículo ou inventar data futura. |
| ABANDONAR_PENDENCIA | Encerrar o tratamento de uma pendência específica como necessidade operacional. | Referência identificável da pendência e evidências/regra que qualificam seu encerramento; período afetado. Não precisa de atividade/duração/prioridade. | Apagar demanda factual, tempo, progresso, tentativa ou conteúdo curricular; concluir material; usar baixa prioridade como exclusão definitiva. |
| REAGENDAR_SEMANA_FUTURA | Destinar necessidade/demanda identificada a outra semana definida. | Semana alvo futura, origem temporal, referência da necessidade ou demanda; data opcional dentro da semana e ordem quando definida. | Transportar objeto antigo como dívida, duplicar sessão ou sobrepor exclusão/movimentação protegida. |

São **14 tipos iniciais**. Não há tipo genérico EXECUTAR_TEXTO, INSTRUCAO_LIVRE ou ação definida pelo texto explicativo. Simulados permanecem futuros.

### Estrutura de carga

Nos três tipos de carga, `parametros` contém `carga_antes`, `carga_proposta`, escopo/período e referências de origem. Cada carga explicita quantidade de demandas e minutos estimados quando conhecidos, com distribuição por alvos/dias/modalidades conforme o que está sendo alterado. Valores ausentes ficam ausentes, nunca são preenchidos por tempo executado.

Redução/aumento devem identificar qual dimensão planejada mudou, mostrando também a outra quando disponível. Contagem menor com minutos maiores não é redução inequívoca: a divergência exige regra explícita, não um rótulo enganoso. Redistribuição conserva total nas dimensões de carga declaradas como preservadas; não converte minutos perdidos em capacidade extra.

Decisão agregada não gera demanda implícita pela interpretação do texto. As demandas concretas e sua relação com a decisão de carga devem ficar identificáveis no resultado do planejamento; não aplicar carga e criação como dois acréscimos independentes.

### Solicitação, demanda e revisão

Solicitar modalidade/necessidade e criar demanda são responsabilidades distintas, não duas unidades de estudo. Se a avaliação contiver SOLICITAR_REVISAO e uma seleção de questões ou cards para a mesma necessidade, ambas devem referenciar a mesma origem e aplicação, sem gerar duas demandas automaticamente.

Solicitação com apenas semana alvo pode permanecer uma seleção estruturada ainda não materializada. Não executar sessão com método/duração/data exigidos ainda indefinidos. Nenhum executor escolhe outra estratégia para preencher campos ausentes. Modalidade não escolhida é lacuna explícita, não autorização para combinar todas.

Retorno à teoria conserva conclusão curricular. Adiar não encerra pendência; reagendar define destino temporal; abandonar encerra uma necessidade delimitada, não abandona o conteúdo do currículo. Os critérios que autorizam cada ação ainda precisam ser aprovados na policy. Se a pendência não puder ser identificada no modelo atual, a decisão não pode ser aplicada por aproximação textual.

## Reason codes iniciais

Vocabulário inicial de motivos, não regras de disparo. O significado não contém thresholds. Quando uma condição exigir avaliação de suficiência, recência, relevância ou disponibilidade, `fundamentacao.regra_id` deve apontar para a regra aprovada que a definiu.

| código | significado verificável / suporte necessário |
| --- | --- |
| INSUFFICIENT_EVIDENCE | Dados não atendem aos requisitos da regra aplicada; indicar lacunas e sinal avaliado. |
| UNKNOWN_MASTERY | Domínio permanece desconhecido; não há inferência válida a partir das fontes utilizadas. |
| DATA_INCONSISTENCY | Fontes/derivados divergem; identificar quais. Não é desempenho ruim do aluno. |
| DATA_UNAVAILABLE | Fonte não pôde ser avaliada; diferenciar erro técnico de ausência factual. |
| CONSERVATIVE_CONTINUITY | Continuidade de estratégia válida nos limites da regra de fallback e do contexto. Não inventa carga inicial. |
| EXECUTION_PATTERN | Padrão de entregas/regularidade observado, com série, volumes e período identificados. Não equivale a aderência alta/baixa sem policy. |
| AVAILABILITY_CONSTRAINT | Restrição factual de disponibilidade afeta o plano. Referenciar período e origem. |
| CURRICULUM_GAP | Há conteúdo elegível ainda não coberto, com inventário/progresso identificados. |
| MATERIAL_IN_PROGRESS | Material permanece em andamento segundo fonte canônica; não implica domínio ou conclusão. |
| PREREQUISITE | Relação curricular verificável exige consideração; não inferida de nome ou PDF extenso. |
| PENDING_CONTENT | Necessidade de conteúdo não atendida ainda existe; não representa dívida de minutos. |
| CONFIRMED_DEADLINE | Prova/entrega confirmada fornece prazo; não inventa classificação de proximidade. |
| EVIDENCED_INCIDENCE | Incidência com fonte/evidência identificadas participa da regra; UNKNOWN não equivale a LOW. |
| QUESTION_PERFORMANCE | Resultado de questões com amostra/contexto qualificados pela regra; não sinônimo de domínio. |
| FALSE_CERTAINTY_PATTERN | Erros com certeza compõem padrão qualificado, com volume/persistência e denominadores explícitos. |
| KNOWLEDGE_GAP_EVIDENCE | Evidências qualificadas de lacuna específica; declaração isolada Sem conhecimento não basta por si só. |
| UNCERTAINTY_PATTERN | Distribuição/persistência de dúvida/confiança foi qualificada no conteúdo delimitado. |
| RETEST_EVIDENCE | Intervalos e resultados de novas recuperações conhecidos e pertinentes à regra; não mera repetição técnica/imediata. |
| REVIEW_NEED | Necessidade de revisão identificada e selecionada; indicar origem, agenda/estado e regra. |
| CARD_RETRIEVAL_EVIDENCE | Avaliações factuais de cards, contexto e persistência qualificados; não nota objetiva de domínio. |
| TARGETED_THEORY_NEED | Lacuna delimitada justifica retorno pontual à fonte teórica; cobertura anterior não é apagada. |
| PRIORITY_TRADEOFF | Alternativas elegíveis concorrem; regra explicita a escolha relativa e o que foi adiado. Não elimina conteúdo. |
| NO_LONGER_RELEVANT_PENDING | Pendência específica perdeu pertinência segundo fatos/regra identificados. Não abandona o currículo. |
| FUTURE_RESCHEDULING | Destino futuro foi escolhido pela regra, com origem/destino e restrições identificados. Não é justificativa autossuficiente. |

Código é motivo, não comando: REVIEW_NEED não cria sozinho revisão; PENDING_CONTENT não acrescenta carga; UNKNOWN_MASTERY não libera questões. Um código descritivo de destino deve acompanhar o motivo causal, não substituí-lo.

Não usar textos arbitrários como novos códigos. Adições futuras exigem significado e versão do catálogo/contrato. Códigos V1 podem permanecer nos registros históricos; tradução exige correspondência explícita, não reinterpretar automaticamente sua decisão como V2.

## Validade, aplicação e substituição

1. Rejeitar formato com tipo/código desconhecido, campos condicionais ausentes, IDs incoerentes, duração inválida ou alvo temporal contraditório. Não executar parcialmente uma instrução incompleta.
2. Toda decisão possui pelo menos um motivo sustentado em regra e evidências. A existência de valores não comprova sua suficiência; a policy deve qualificá-los quando necessário.
3. Campos e referências dizem o que deve ocorrer; texto de interface somente explica. Mesmo inputs, corte, policy e desempates devem produzir o mesmo resultado sem interpretação livre.
4. Decisão não é execução: registrar um resultado não comprova que demanda foi criada, estudo ocorreu ou revisão foi atendida. A futura aplicação deve ter resultado rastreável, sem duplicação em retry.
5. Antes de aplicar efeito prospectivo, conferir validade dos alvos, modalidade autorizada e alterações/exclusões protegidas. Decisão antiga não restaura demanda apagada ou substitui ação posterior do usuário silenciosamente.
6. `decisao_substituida_id` não pode apontar para si mesma, formar ciclo ou apagar registro anterior. Substituição altera efeitos futuros no escopo explícito; execução passada permanece factual.
7. Alteração de parte de plano/agregado exige escopo das alterações e decisões/demandas afetadas. Não fingir substituição total quando somente uma demanda muda.
8. Fatos históricos, tempo, tentativas, avaliações de card e conclusão de material não são alvos de reescrita estratégica do Mentor.

Não se define aqui algoritmo de conciliação, transação, operação_id, status técnico ou nova infraestrutura. Essas garantias precisam ser comprovadas na implementação autorizada; não estão declaradas prontas por este documento.

### Avaliação sem nova ação

Uma avaliação pode resultar em coleção vazia de decisões, sem inventar novo tipo operacional. O resultado da avaliação deve distinguir `DECISOES_EMITIDAS`, `SEM_ALTERACAO` e `NAO_AVALIAVEL`, com referência temporal, policy/contexto, evidências e motivos estruturados.

`SEM_ALTERACAO` significa que nenhuma nova ação estratégica foi emitida, não que todas as demandas foram concluídas. `NAO_AVALIAVEL` identifica limitação de dados/fonte; não permite declarar sucesso nem aplicar fallback histórico escondido. MANTER_DEMANDA só deve ser emitida quando houver avaliação dessa demanda identificável.

Esses estados classificam o resultado técnico/conceitual da avaliação, não acrescentam tipos de decisão, novas telas ou funcionalidade nesta fase.

## Fontes canônicas e adaptação futura

- Decisão estruturada e fundamentação pertencem conceitualmente a `mentor_decisao`; execução técnica/inputs/resultados a `mentor_execucao`; plano efetivo a `sessao`.
- Policy versionada vem de `conhecimento_modulo`; contexto mutável de `mentor_contexto`; sinais são derivados das fontes definidas na Fase 3.2.
- `sessao.reason_codes` e texto explicativo são projeções vinculadas à decisão de origem. A API não recalcula outra estratégia para justificar um plano já registrado.
- O campo textual legado `mentor_decisao.decisao` não atende sozinho a este contrato. JSON em `dados` pode ser reaproveitado na adaptação, mas não se declara que o schema atual já valida a união tipada.
- Referências diretas, versionamento do contexto, aplicação de decisão e vínculos necessidade-demanda ainda possuem lacunas descritas nas Fases 3.1/3.2. Não criar IDs fictícios ou migrations nesta subfase.

## Ambiguidades e definições pendentes

1. **Policy:** critérios para emitir cada tipo, suficiência de evidência, janelas, carga/duração, prioridade e desempates permanecem por definir. O catálogo não importa regras V1.
2. **Abandonar pendência:** limite de preservação factual está definido; os casos de produto que justificam encerramento, alcance temporal e eventual nova elegibilidade precisam de aprovação na policy antes de aplicação. Não presumir abandono definitivo do conteúdo.
3. **Adiamento sem destino:** é representável como seleção adiada; critérios e momento de reavaliação permanecem pendentes, sem cron/prazo inventado.
4. **Revisão/cards:** modalidade de revisão e configuração Anki dependem das decisões correspondentes; sua seleção não é deduzida pelo executor.
5. **Aplicação/persistência:** vínculo real entre decisão, avaliação, necessidade e demanda; política de substituição parcial e proteção contra aplicação stale deverão ser concretizados/testados. Não há alteração de banco agora.

Não há contradição documental identificada que exija inventar solução nesta subfase. As pendências acima delimitam a implementação futura; não autorizam execução automática nem avanço de fase.

## Fechamento

**Status documental: PASS.** Envelope, 14 tipos iniciais, 24 reason codes, evidências, alvo temporal e substituição foram definidos. Validação realizada apenas na estrutura documental e referências locais.

Aprendizado registrado em 07/10/2026: motivo, decisão e aplicação são responsabilidades diferentes. Regra resultante: executor opera somente sobre tipo/parâmetros válidos e referências auditáveis; explicação textual nunca se torna fonte operacional.

Somente `docs/v2/decisoes-mentor.md` foi criado. Nenhuma alteração de código funcional, dado, migration, teste funcional, lint, build, branch, commit, push ou deploy. Não foi iniciada a próxima subfase.

## Implementação delimitada, Fase 3.4

Em 07/10/2026, o contrato recebeu versão concreta `mentor-v2/1` e validação em `shared/mentor-v2-policy.js`. Os 14 tipos e 24 motivos estão catalogados; somente `MANTER_DEMANDA` tem regra executável. Demais tipos são recusados, não convertidos em texto operacional nem executados por motores V1. Cada decisão mantida referencia o estado observado, versão da policy, corte, contexto e evidências dos motivos. A prioridade permanece null, sem tradução presumida da escala V1.

O adapter registra o envelope da avaliação em `mentor_decisao.dados`. Avaliação inválida/indisponível não é registrada como sucesso e não escreve demandas. Não existe ainda executor de novas estratégias ou substituições prospectivas. O detalhamento e a configuração reconhecida estão em [mentor.md](mentor.md#fonte-operacional-implementada-na-fase-34). Esta atualização não ativa todas as ações conceituais nem altera banco/migrations.

## Atualização do catálogo, Fase 3.5

Em 07/10/2026, o catálogo recebeu a revisão `mentor-v2-reasons/2`, com 25 códigos: os 24 anteriores mais `UNRESOLVED_SIGNAL_CONFLICT`. O novo código significa conflito entre observações estruturadas sem regra aprovada de resolução, identificável pelos sinais e seus valores/escopos. Não é comando para redistribuir carga nem prova de fraqueza. Decisões de continuidade associam esse motivo à regra `CONTINUIDADE_PLANO_EXISTENTE` e ao snapshot das observações/conflitos. Sem conflito, evidência não qualificada continua registrada por `INSUFFICIENT_EVIDENCE`.

O contrato comum `mentor-v2/1` não mudou; registros antigos não recebem motivos retroativamente. Estado de fallback e versão do motor pertencem ao envelope da avaliação. O detalhamento e os limites estão em [mentor.md](mentor.md#fallback-implementado-na-fase-35). Nenhum novo tipo de decisão foi criado ou liberado.

## Catálogo de carga semanal, Fase 3.6

Em 07/10/2026, revisão `mentor-v2-reasons/3`, com 29 códigos. Adicionados:

- `LOAD_MAINTAINED`: carga existente conservada pela avaliação, sem novas demandas.
- `LOAD_CHANGE_POLICY_UNDEFINED`: ausência de regra aprovada de alteração da carga; não significa teto permanente.
- `ISOLATED_WEEK_NOT_PROGRESSION`: somente uma semana fechada foi observada; ela não autoriza expansão automática, qualquer que seja seu percentual.
- `NO_HOUR_DEBT`: pendências identificadas não viram dívida de minutos ou blocos extras.

O motivo existente `CONFIRMED_DEADLINE` registra compromissos da janela sem impor aumento. Fundamentos usam a mesma regra de continuidade e evidência `carga_semanal`, sem motor independente. MANTER é ação da projeção da avaliação; não foi criado um tipo MANTER_CARGA. Decisões operacionais permanecem MANTER_DEMANDA. AUMENTAR_CARGA/REDUZIR_CARGA exigem critérios ainda pendentes, e não foram ativados. Contrato `mentor-v2/1` e registros anteriores preservados.

## Priorização, Fase 3.7

Em 07/10/2026, catálogo `mentor-v2-reasons/4`, com 34 códigos. Adicionados `CURRICULUM_CONTINUITY` (primeiro material pendente válido), `STRUCTURAL_CONTEST_PRIORITY` (prioridade estrutural dentro da capacidade disponível), `FACULTY_CONTINUITY` (capacidade acadêmica preservada), `RECENCY_TIEBREAK` (execução antiga/ausente desempata alternativas equivalentes, sem inferir retenção) e `NO_ELIGIBLE_CURRICULUM` (slot sem conteúdo elegível identificado, sem reinício do curso).

`PRIORIZAR_MATERIA` torna-se executável pela regra `PRIORIZACAO_CURRICULAR_SEMANAL`, com `prioridade = {ordem_relativa: 1, conjunto_ref}`, alternativas comparáveis, material em `alvos_relacionados` e origem da capacidade em `demanda_id`/`estado_observado`. `parametros.aplicacao = SELECAO_SEM_ALTERAR_PLANO` distingue seleção de aplicação. Não se usa MANTER_DEMANDA para trocar conteúdo; esse tipo continua conservando o estado observado. Não há materialização de novas demandas ou liberação dos demais tipos nesta subfase.

Os motivos existentes CURRICULUM_GAP, MATERIAL_IN_PROGRESS, CONFIRMED_DEADLINE, PRIORITY_TRADEOFF e INSUFFICIENT_EVIDENCE complementam a seleção quando sustentados pelos fatos. No caso de prioridade, fundamentos apontam para a nova regra central, não a regra de manutenção. Tentativas/revisões observadas não recebem QUESTION_PERFORMANCE, RETEST_EVIDENCE ou TARGETED_THEORY_NEED como evidência qualificada sem critérios aprovados. Registros anteriores preservam contrato e motivos da sua versão.

## Criação do plano, Fase 3.8

Em 07/10/2026, catálogo `mentor-v2-reasons/5`, com 36 códigos. Adicionados `APPROVED_WEEKLY_CAPACITY` (slots explicitamente configurados na versão vigente da policy) e `WEEKLY_PLAN_SELECTION` (seleção de demanda para a semana, não confirmação de execução).

`CRIAR_DEMANDA` torna-se executável pela regra `GERACAO_PLANO_SEMANAL`. Demanda nova tem `demanda_id = null`; parametros contém `titulo`, `ordem`, `chave_mentor` lógica e `capacidade_slot`. Data, objetivo, modalidade e duração devem coincidir com esse slot; conteúdo/referências precisam ser reais, e motivos apontam à regra e às evidências. Não emite MANTER_DEMANDA para um slot fictício: os portadores internos de capacidade usados no ranking não são decisões persistidas de manutenção.

Aplicação gera UUID estável por slot e chave física com referência à decisão criadora. Registro original e chave não mudam ao mover/reordenar ou reaplicar o plano. O retorno de aplicação identifica somente inserções confirmadas; avaliação persistida e inserção são operações separadas. Histórico de decisão permanece auditável em caso de falha/retry.

Criar não autoriza atualizar, cancelar ou substituir demanda existente. ABANDONAR_PENDENCIA, REAGENDAR_SEMANA_FUTURA e REDISTRIBUIR_CARGA continuam exigindo regras próprias, sem execução textual ou empréstimo de policy histórica. Simulado não é modalidade operacional desta subfase.
