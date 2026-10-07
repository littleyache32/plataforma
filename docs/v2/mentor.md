# Arquitetura conceitual do Mentor V2

Data: 06/10/2026. Fase 1.3. Branch: `v2`.

## Escopo e autoridade

Este documento define a arquitetura conceitual alinhada ao [contrato funcional](produto.md) e ao [modelo de domínio](dominio.md). Não descreve implementação concluída, não altera código e não ativa modalidades futuras.

Existe **um único Mentor determinístico**, responsável pelas decisões de estudo. Não há especialistas, agentes independentes, múltiplos planejadores ou LLM/IA operacional dentro da plataforma. Domínios organizam conhecimento e cálculos internos; não possuem autonomia, estado decisório paralelo ou autorização para emitir demandas diretamente.

O usuário informa fatos e disponibilidade; o Mentor decide a estratégia. Meu Plano é a representação operacional semanal dessa decisão. A Central de Revisão continua uma visão complementar, não um segundo motor.

## Fluxo único de decisão

`registros canônicos + contexto + conhecimento versionado -> sinais estruturados -> regras do Mentor -> decisão + reason codes -> planejamento semanal`

| etapa | responsabilidade e limite |
| --- | --- |
| Leitura | Reunir fatos disponíveis e identificar ausência, desatualização ou inconsistência. Não substituir dados ausentes por valores favoráveis. |
| Sinais | Derivar execução, cobertura, prática, retenção quando comprovável, prazos e disponibilidade. Tempo, cobertura e domínio permanecem distintos. |
| Regras | Aplicar a política vigente de forma central, considerando restrições e evidência. Conhecimento histórico incompatível não é fallback ativo. |
| Decisão | Resolver conflitos e escolher carga, prioridades, método e conteúdo. Toda decisão final pertence ao mesmo Mentor. |
| Planejamento | Materializar entregas no plano, preservando execução passada, exclusões e reorganizações do usuário conforme o contrato. Não decidir outra estratégia escondida. |
| Explicação | Associar motivos estruturados aos resultados. Texto explicativo deriva dos motivos e fatos, sem geração livre por LLM. |

Mesmos dados, contexto, instante de referência e versão das regras devem produzir a mesma decisão. Datas, ordenação e desempates precisam ser explícitos para não depender do relógio do dispositivo, ordem incidental de consulta ou aleatoriedade. Os detalhes dos desempates serão definidos nas regras correspondentes, não por motores adicionais.

## Conhecimento organizado por domínio

| domínio interno | conhecimento/sinais sob sua responsabilidade | limite |
| --- | --- | --- |
| Planejamento | Organização semanal, ordem, continuidade curricular e retorno de conteúdo pendente relevante. | Não transportar sessões antigas como dívida nem substituir fatos por plano recalculado. |
| Carga/aderência | Entregas planejadas/concluídas, evolução da execução e compatibilidade da carga com disponibilidade observada. | Não confundir minutos excedentes com outra demanda ou aumentar carga só para compensar faltas. |
| Aprendizagem e memória | Distinção entre cobertura, recuperação ativa, aplicação, repetição imediata e evidência de retenção. | Não presumir domínio por tempo, aula concluída ou resposta isolada. |
| Revisão | Necessidades de revisita, recência, atendimento e escolha de modalidade apropriada. | Não criar fila decisória concorrente nem exigir questão e card simultaneamente em toda revisão. |
| Questões | Qualidade/proveniência, tentativas, resultado e confiança coletada junto à resposta. | Não tratar classificação subjetiva ou um acerto como prova suficiente de domínio. |
| Question Cards | Recuperação ativa, avaliações 1-4, histórico e estado de espaçamento. | Não escolher silenciosamente configuração Anki; um card revisado não determina domínio sozinho. |
| Faculdade | Conteúdo e pendências acadêmicas válidos, coexistência com o concurso e continuidade do estudo. | Preservar inicialmente a interface existente; não inferir aula dada ou conteúdo concluído sem registro. |
| Compromissos | Provas/entregas confirmadas, prazos e conteúdo associado. | Não inventar data oficial nem converter prazo automaticamente em dívida ou blocos extras. |
| Desempenho | Estatísticas derivadas, volume/contexto da amostra, tendência, confiança e retenção quando houver dados válidos. | Não fabricar métricas ou mudar estratégia por evidência insuficiente. |
| Simulados futuros | Integração futura de evento, respostas, tempo e sinais com a decisão central. | Não liberar, programar ou implementar simulados nesta fase; não duplicar tentativas nas estatísticas. |

Um mesmo fato pode informar vários domínios, mas não é duplicado como registro de estudo ou contagem de prática. Esses domínios não implicam dez tabelas, dez serviços ou dez agentes.

## Entradas

Todas as entradas respeitam as fontes canônicas definidas em dominio.md. O Mentor pode ler estatísticas derivadas, desde que sua origem e contexto sejam identificáveis.

| entrada | informação consumida | cautela |
| --- | --- | --- |
| Histórico de demandas | Plano, entregas, pendências, cancelamentos, exclusões e reorganizações. | Distinguir não conclusão, cancelamento pelo Mentor e exclusão manual. Não recriar item excluído por simples recálculo. |
| Tempo | Registros reais vinculados ou livres e sua duração. | Não usar estimativa como tempo estudado nem somar duas vezes o mesmo intervalo. |
| Progresso curricular | Materiais em andamento/concluídos e correspondência com conteúdo real. | Conclusão de bloco não conclui material; cobertura não é domínio. |
| Questões | Itens válidos, tentativas e resultados contextualizados. | Questões existentes no acervo não significam questões resolvidas; repetição imediata não comprova retenção. |
| Confiança | Sem conhecimento, Eliminação, Dúvida e Certeza, associadas à tentativa. | Confrontar confiança e resultado; ausência de classificação histórica não deve virar Certeza. |
| Revisões | Necessidades, datas, motivos e evidência de atendimento. | Futuro, vencido, concluído e ignorado não são equivalentes; revisar agendamento sem inventar execução. |
| Cards | Conteúdo válido, avaliações Novamente/Difícil/Bom/Fácil, histórico e estado SRS disponível. | Não extrapolar configuração Anki ainda não escolhida nem contar abertura do card como revisão. |
| Compromissos | Provas/entregas, datas e conteúdo confirmado. | Distinguir prazo confirmado de referência provisória; não presumir vínculo curricular ausente. |
| Encontro semanal | Fatos e exceções informados que a plataforma não conhece sozinha. | Entrada de contexto, não escolha estratégica do usuário nem fonte de política permanente. Não incluir feedback Leve/Normal/Pesado ou anamnese nesta arquitetura. |
| Disponibilidade | Capacidade e restrições reais informadas/registradas para o período. | Ausência de dado não equivale a disponibilidade ilimitada; tempo realizado não garante capacidade futura igual. |

Texto livre do encontro pode permanecer como fato contextual, mas não vira regra executável por interpretação de LLM. Apenas fatos com significado operacional definido podem alimentar sinais determinísticos; lacunas ficam explícitas. Isso não exige novo formulário nesta subfase.

## Saídas

| saída | contrato conceitual |
| --- | --- |
| Carga semanal | Quantidade e distribuição de entregas previstas compatíveis com contexto, disponibilidade e evidência, sem compensação automática de atraso. |
| Demandas | Entregas concretas de teoria, questões, cards ou revisão conforme modalidade autorizada, com contexto e vínculos. Simulados continuam futuros. |
| Prioridades | Ordem relativa justificada entre necessidades elegíveis, sem excluir conteúdo apenas por prioridade menor. |
| Método | Forma de estudo ou revisão selecionada entre as modalidades permitidas, sem aumentar complexidade por falta de dados. |
| Matéria | Disciplina escolhida dentro do objetivo, mantendo coexistência da Faculdade e prioridade estrutural do concurso. |
| Conteúdo | Material/unidade/tópico identificável e elegível, respeitando sequência e progresso reais. Não apresentar material concluído como aula nova por reinício do plano. |
| Duração | Estimativa da demanda, separada do tempo efetivamente estudado. Presets 30/50/personalizado do timer livre não definem automaticamente política de carga do plano. |
| Revisões | Necessidades selecionadas e seu agendamento/atendimento no plano, podendo ocorrer muito tempo depois quando justificadas. Sem exigir questão e card juntos. |
| Reason codes | Motivos estruturados da decisão, com fatos/sinais que os sustentam e a versão das regras. |

As saídas compõem uma decisão coerente, não decisões independentes por campo ou domínio. A arquitetura não define nesta etapa números de blocos, intervalos, pesos ou pontuações universais.

## Fallback por evidência insuficiente

O fallback pertence ao mesmo Mentor e às mesmas regras, não a um motor alternativo.

1. **Não inventar domínio:** manter domínio desconhecido quando não houver prática/evidência suficiente. Ausência de observação não é erro, acerto nem baixo domínio.
2. **Não aumentar complexidade:** não introduzir modalidade nova, método elaborado ou decisão agressiva apenas para preencher lacuna de informação.
3. **Manter estratégia conservadora:** preservar estratégia válida compatível com disponibilidade e restrições atuais, sem aumento automático por ausência de encontro/dados. Se não existir estratégia válida, usar somente o fallback explicitamente definido na policy futura; não inventar carga inicial nesta fase.
4. **Continuar coleta de evidência:** aproveitar eventos normais de demandas, tempo, progresso e prática autorizada. Não criar anamnese, feedback excluído ou rotinas de prática não liberadas para obter dados.
5. **Explicitar o limite:** registrar o motivo da manutenção/limitação e os dados ausentes. Não apresentar confiança estatística, previsão ou retenção que os registros não suportam.

Conservador não significa ignorar prazo confirmado ou impossibilidade real de cumprir um plano. Restrições válidas continuam sendo respeitadas; dados inconsistentes devem ser sinalizados, não tratados como evidência de aprendizagem. Falha técnica de leitura também não equivale a uma semana sem estudo.

## Responsabilidade final e conflitos

- Invariantes do domínio, preservação factual e modalidades autorizadas limitam qualquer decisão.
- Prazos, sustentabilidade, cobertura, desempenho e organização semanal são considerados conjuntamente pelo único Mentor.
- Conflitos devem resultar em uma decisão final com motivo explícito, não em demandas contraditórias de domínios diferentes.
- Pendência pode voltar à fila quando relevante, sem aumentar automaticamente carga para pagar horas.
- Replanejamento respeita movimentações/exclusões e preserva o histórico factual; o plano futuro não altera tentativas, tempos ou conclusões passadas.

A precedência detalhada e os critérios de desempate entre prioridades ainda serão definidos. Não importar automaticamente hierarquias, pesos ou limiares V1 como regras definitivas da V2.

## Explicabilidade e fontes de verdade

Cada decisão conceitualmente deve permitir identificar: período e instante de referência; fatos principais utilizados; sinais calculados; lacunas de evidência; versão da policy; resultado; reason codes; e demandas relacionadas. A implementação pode aproveitar os registros existentes, sem exigir infraestrutura nova nesta fase.

Reason codes devem expressar motivos verificáveis, não justificativas genéricas ou textos livres usados como memória operacional. Exemplos conceituais de motivos são dados insuficientes, material em andamento, prazo confirmado próximo ou manutenção conservadora. O catálogo definitivo de códigos e suas condições permanece pendente; citar exemplo não o transforma automaticamente em regra ativada.

Conhecimento relativamente permanente, contexto mutável, fatos canônicos e decisões são responsabilidades separadas. Organizar conhecimento por domínio não duplica policy; tabelas históricas, defaults e textos de memória não devem competir como autoridades operacionais. A interface explica a decisão registrada, sem decidir de novo.

## Pendências para etapas posteriores

- Janelas de observação, suficiência de amostra e thresholds de aderência, desempenho e retenção.
- Critérios de manter/aumentar/reduzir carga e fallback inicial quando não houver estratégia válida.
- Precedência detalhada, pesos e desempates de prioridades.
- Regras de modalidade/duração por demanda, sem confundir timer livre com carga planejada.
- Configuração/comportamento Anki escolhido, parâmetros SRS e reconciliação de revisões.
- Catálogo definitivo de reason codes e vínculo auditável entre decisão, necessidade e demanda.
- Contrato dos fatos do encontro/disponibilidade, sem reintroduzir feedback excluído.

Nenhum desses parâmetros foi escolhido silenciosamente. Esta documentação encerra somente a Fase 1.3. Sem código, banco, migration, testes de implementação, commit, push ou deploy; nenhuma próxima etapa iniciada.

## Fonte operacional implementada na Fase 3.4

Registro em 07/10/2026. O escopo acima descreve a arquitetura pretendida; esta seção distingue a implementação atual dos critérios estratégicos ainda pendentes.

- `shared/mentor-v2-policy.js` é o único avaliador decisório V2. Não importa motores V1, não chama LLM e não usa fase/data histórica para estratégia.
- `api/_lib/mentor-v2.js` reúne fatos e carrega exclusivamente a policy ativa do módulo `mentor` em `conhecimento_modulo`. Não faz merge com defaults ou conhecimento legado. Zero ou múltiplas versões válidas, configuração desconhecida e falha factual produzem `NAO_AVALIAVEL`, sem alterar demandas.
- `api/_lib/plano-handler.js`, API do Mentor e cron passam pela mesma fronteira. O painel identifica a versão vigente dessa fonte, não a versão de uma execução antiga. O bootstrap em App não possui mais o corte histórico de 05/10.
- Avaliações válidas são registradas em `mentor_decisao.dados`, tipo `avaliacao_mentor_v2`, com snapshot, referência temporal, versão, decisões tipadas e fundamentos. GET apresenta a avaliação registrada; sem registro, avalia sem aplicação/persistência. Leitura não inventa outra estratégia. O cron não reapresenta execução V1 concluída como sucesso V2 nem a sobrescreve.
- Domínio permanece `UNKNOWN` nesta implementação. Preservar estimativa factual não significa aprovar uma política universal de duração ou inferir aprendizagem.

### Configuração reconhecida, não instalada no banco

O registro requer `id`, `modulo = mentor`, `ativo = true` e `versao` textual. Em `conteudo.politica`:

```json
{
  "modelo": "MENTOR_V2",
  "versao_contrato": "mentor-v2/1",
  "modalidades_permitidas": ["ESTUDO"],
  "regras": [{"id": "CONTINUIDADE_PLANO_EXISTENTE", "habilitada": true}]
}
```

Este é um exemplo do formato validado, não um seed aplicado ou autorização para ativar modalidades. Não aceita parâmetros estratégicos adicionais, scripts ou instruções livres. O código implementa o algoritmo uma única vez; o registro versiona e habilita a regra. Demanda de prática também exige a flag factual correspondente em `mentor_contexto.dados.rotina_pratica`; a policy não libera a prática por si só.

A única regra executável nesta subfase é a continuidade explícita de demandas já planejadas com vínculos/estimativas válidos. Emite `MANTER_DEMANDA`, conserva data/ordem/conteúdo e não escreve em `sessao`. Concluídas, faltas e cancelamentos não são recriados. Não há prioridade estratégica inferida: prioridade tipada permanece null, sem importar escala V1.

### Limitações e desativação do legado

Os 14 tipos do contrato são conhecidos, mas somente `MANTER_DEMANDA` está executável agora; outros tipos são recusados até existir sua regra autorizada na mesma fonte. Ainda não há geração de nova semana, adaptação de carga, seleção curricular ou seleção de revisões pela V2. Sem demandas existentes, a avaliação retorna `SEM_ALTERACAO`, não declara uma semana nova criada. A API de preparação informa contadores zero e estado `preservado`; ausência de policy informa pendência e HTTP 503.

O banco não foi consultado/alterado nem recebeu configuração V2 nesta subfase. Portanto, a ativação real não está comprovada; um registro V1 existente será recusado. A configuração/versionamento real e as regras estratégicas pendentes precisam de etapa autorizada antes de publicação. Persistência usa a chave única já descrita pela migration 0068, sem nova migration ou comprovação de schema real.

`shared/mentor.js`, `shared/mentor-policy.js`, `shared/mentor-decision.js`, `shared/mentor-specialists.js`, `shared/planner.js` e o loader modular continuam preservados para histórico, testes ou consumidores não decisórios, mas não são chamados pelos entrypoints decisórios V2. Scripts históricos ainda podem exercitar V1 quando executados explicitamente; não foram convertidos nem executados aqui. Gates de acesso de prática em `shared/study-access.js`, SRS e cálculos do placar continuam legado de suas áreas, não regras do avaliador V2; consolidá-los não foi incluído nesta subfase.

A coleta existente do encontro foi preservada sem novo formulário. Campos legados como carga percebida não entram na avaliação V2. Não há interpretação de texto livre nem uso do antigo `fase`/`carga_atual` como policy. A fonte factual consumida agora é limitada à continuidade; os sinais documentados na Fase 3.2 ainda não são todos calculados.

Aprendizado: separar uma fronteira única de decisão não autoriza preencher políticas estratégicas pendentes com números históricos. Regra resultante: faltar configuração V2 gera limitação explícita e preservação factual, nunca fallback V1 silencioso.

Validação local: 59 testes aprovados nos arquivos `mentor-v2-policy`, `mentor-v2-integration`, `phase6-meeting`, `phase6-meeting-api`, `policy-consistency` e `serverless-architecture`. Cobertura inclui determinismo, contrato, recusa do legado, fontes ausentes/inconsistentes, ausência de efeitos parciais, preservação de demandas/exclusões, leitura de decisão registrada e cron sem sucesso falso. Testes de integração usam dados sintéticos e adapter controlado; não comprovam PostgreSQL ou produção. Sem suíte completa, lint, build, migration, commit, push ou deploy. Status da implementação: PASS COM LIMITAÇÕES pelos itens operacionais pendentes descritos acima. A Fase 3.5 não foi iniciada.

## Fallback implementado na Fase 3.5

Registro em 07/10/2026. O fallback agora integra a mesma regra `CONTINUIDADE_PLANO_EXISTENTE`, sem segundo motor, mudança de schema ou instalação de configuração no banco. Versão do motor: `mentor-v2-engine/3.5`; catálogo de motivos: `mentor-v2-reasons/2`.

Na ausência de regra aprovada para qualificar evidência, toda avaliação factual válida registra `INSUFFICIENT_EVIDENCE`, `CONSERVATIVE_CONTINUITY` e `UNKNOWN_MASTERY`. Mantém demandas existentes e autorizadas, sem novas demandas, aumento de carga, novas modalidades, inferência de domínio ou de fraqueza forte. Um percentual, volume alto ou flag de suficiente no input não substitui regra de suficiência. Não foram criados thresholds.

O envelope de avaliação explicita `fallback`: estratégia conservadora, domínio e fraqueza forte UNKNOWN, aumento de carga e adição de modalidades false, prioridade estrutural CONCURSO, Faculdade PRESERVAR_SEM_EXPANDIR e coleta EVENTOS_NORMAIS. Isso preserva a distribuição já existente sem promover Faculdade, excluir seus blocos ou acrescentar compensação de atraso. Não redistribui plano já desequilibrado nem inventa carga inicial; essas decisões ainda dependem de regras aprovadas. Sem plano existente, preserva coleção vazia e explicita insuficiência, sem criar uma semana fictícia.

### Sinais e conflitos

O avaliador puro aceita opcionalmente `facts.signals`, coleção de observações estruturadas: `sinal_id`, `nome`, `fonte`, `escopo`, `janela` e `valor`. Metadados de volume/dias/sessões/retestes e origem/versionamento podem acompanhar o valor. Não são comandos ou decisões de domínios independentes; texto não é executado. Ausência da coleção representa ausência de sinais qualificados, não desempenho zero.

Detecta valores divergentes para uma mesma medida, escopo, janela, unidade, versão de definição e corte. Não compara silenciosamente unidades, períodos ou definições diferentes. Também aceita conflitos identificados previamente por cálculo interno em `facts.signalConflicts`, com `id` e `sinal_ids` rastreáveis, para relações entre medidas distintas que não podem ser inferidas por simples comparação de valores. Referência inválida causa DATA_INCONSISTENCY, não desempate arbitrário.

Conflito sem regra de resolução adiciona `UNRESOLVED_SIGNAL_CONFLICT` à avaliação e às decisões mantidas. Sinais e conflitos entram no snapshot de evidências e na fundamentação da mesma regra. Não seleciona o primeiro valor, não escolhe o mais conveniente e não usa aleatoriedade. Observações são ordenadas por ID para resultado reproduzível.

O adapter operacional atual não calcula todos os sinais futuros da Fase 3.2; seu caminho atual registra insuficiência por ausência de qualificação. O tratamento de conflitos foi validado com inputs estruturados controlados no avaliador único, sem fingir coleta completa em produção. Coleta continua nos fluxos factuais existentes de execução, tempo, material e prática autorizada, sem criar questionários ou liberar prática para obter amostra.

### Persistência, compatibilidade e limites

Avaliações novas continuam em `mentor_decisao.dados`, incluindo fallback, motivos e evidências. A versão do motor participa da chave de avaliação, evitando colisão com resultado da 3.4 para o mesmo corte/inputs. Registros anteriores continuam históricos, legíveis e não reescritos; GET mantém a regra de apresentar avaliação registrada, não recalcular uma estratégia apenas para explicá-la. O formato comum de decisão `mentor-v2/1` permanece compatível.

Policy ausente, inválida ou V1 e fontes factuais indisponíveis continuam `NAO_AVALIAVEL`, sem execução de fallback estratégico ou resgate de defaults históricos. Ativação real, geração de semanas e critérios de suficiência/carga continuam pendentes conforme a 3.4. Esta subfase não alterou banco, migrations, frontend ou produção.

Aprendizado: insuficiência e conflito são limites de interpretação, não prova de baixo desempenho. Regra resultante: manter continuidade rastreável e coleta normal até haver regra/evidência que autorize mudança.

Validação local da 3.5: 67 testes aprovados em `mentor-v2-fallback.test.js` (22), `mentor-v2-policy.test.js` (25) e `mentor-v2-integration.test.js` (20). Cobrem ausência/insuficiência de sinais, resposta isolada, volume sem qualificação, tempo/cobertura, concurso/Faculdade, faltas, conflitos explícitos e detectados, rastreabilidade, determinismo, recusa de policy V1 e persistência sintética do fallback. Sem suíte completa, lint, build, consulta/alteração de banco, migration aplicada, commit, push ou deploy. Nenhuma próxima subfase iniciada.

## Carga semanal implementada na Fase 3.6

Registro em 07/10/2026. Motor `mentor-v2-engine/3.6`; catálogo `mentor-v2-reasons/3`, com 29 motivos. `shared/mentor-v2-load.js` é somente calculador factual interno: não decide, não cria demandas e não possui policy paralela. A decisão continua exclusivamente em `shared/mentor-v2-policy.js`.

### Dados consumidos e derivados

O adapter existente passa a ler, além do plano alvo, o histórico anterior de demandas, tempos concluídos até o corte, tipos de objetivo e compromissos canônicos não concluídos. Leituras paginadas impedem truncar essas coleções silenciosamente. Página de 500 registros é limite técnico de transporte, não janela estratégica, mínimo de evidência ou meta de estudo. Não há leitura de feedback subjetivo nem utilização de fase/carga histórica como política.

A avaliação identifica:

- Quantidade de demandas e minutos estimados do plano efetivo, por objetivo, com contagens de blocos de 30 e 50 minutos. Não funde nem converte blocos. Durações históricas positivas permanecem observáveis, sem serem transformadas em padrão V2.
- Entregas concluídas separadas do tempo real. Excedente de timer não vira outra entrega. Tempo livre e vinculado permanecem distintos; entrega sem timer não inventa duração real.
- Série por semana calendárica do histórico disponível, denominadores, conclusões até o prazo/corte, dias distintos e pendências. Não escolhe janela recente numérica para progressão sem aprovação.
- Cancelamentos do Mentor e exclusões manuais, separados de faltas. Aderência aqui descreve o **plano efetivo observado no corte**, não um plano original imutável. Sua comparabilidade histórica permanece não qualificada; mover/excluir demanda pode alterar o conjunto observado e não autoriza progressão.
- Compromissos ainda pendentes até o fim da semana alvo e dias até sua data em Brasília. Não inventa um threshold para chamar uma prova de próxima nem transforma prazo em carga extra.

Semana aberta, denominador zero ou conclusão sem instante verificável não produzem aderência final. Fonte não fornecida gera lacuna/null, não falso zero. Falha de leitura de fonte necessária gera DATA_UNAVAILABLE e nenhuma decisão operacional. Snapshot dos registros/derivados e corte ficam ligados à avaliação.

Para tempo real, esta análise usa explicitamente o dia da finalização em Brasília. Não afirma distribuir intervalos cruzando dias/semanas nem altera a estatística/timer existente. Aderência é por entrega, nunca pela quantidade de minutos excedentes.

### Resultado e limites de decisão

Sem regra aprovada de progressão/redução, a ação de carga é **MANTER**, com `LOAD_MAINTAINED` e `LOAD_CHANGE_POLICY_UNDEFINED`. Uma única semana fechada observada adiciona `ISOLATED_WEEK_NOT_PROGRESSION`, sem classificar automaticamente a semana como boa. Pendências adicionam `NO_HOUR_DEBT`; compromissos da janela adicionam o motivo já existente `CONFIRMED_DEADLINE`. Todos sustentados nas evidências da mesma regra de continuidade.

O envelope `carga_semanal` é projeção estruturada da mesma avaliação e do plano preservado, vinculada à policy e à avaliação. Não constitui outra fonte estratégica ou novo tipo fora do contrato da Fase 3.3. Ações operacionais permanecem `MANTER_DEMANDA`; nenhuma instrução livre de carga é executada. `carga_observada` distingue a base factual, e `carga_proposta` conserva essa base, sem materializar novo plano. Sem plano vigente, situação SEM_BASE_VIGENTE e proposta null; histórico/contexto antigo não inventa a carga inicial.

A base não é teto permanente. Capacidade adicional tem prioridade estrutural CONCURSO e Faculdade mantém continuidade, mas incremento quantitativo/distribuição nova não é escolhido nesta subfase. Novas atividades poderão acrescentar demandas gradualmente quando suas regras estiverem aprovadas; não existe obrigação de sempre substituir blocos nem liberação automática de prática. Nenhuma falta acrescenta horas. Compromissos não autorizam expansão sem regra.

**Pendências objetivas:** aprovação da base inicial quando não houver plano; janela e suficiência para aumento/redução; tamanho absoluto dos passos, limites e restrições de sustentabilidade; distribuição de capacidade adicional e entrada gradual de atividades. Não há policy de alteração aprovada no checkout; não importar 70/85, escadas antigas ou incrementos percentuais. AUMENTAR_CARGA e REDUZIR_CARGA continuam tipos previstos, mas não executáveis. Ativação no banco e validação em produção continuam pendentes da 3.4. Esta subfase recebe PASS COM LIMITAÇÕES, não comprova progressão operacional completa.

Validação local: 95 testes direcionados aprovados em `mentor-v2-load` (23), `mentor-v2-policy` (25), `mentor-v2-fallback` (22) e `mentor-v2-integration` (25). Incluem duas boas semanas sem policy, baixa aderência, 30/50, provas, cancelamentos, faltas, tempo excedente/livre, dados ausentes, janela aberta, determinismo, persistência e paginação sintética de 501 registros históricos. Sem suíte completa, lint, build, banco real, migration, commit, push ou deploy. Não avançar para a próxima subfase automaticamente.

Aprendizado: observar capacidade não autoriza definir passo de progressão. Regra resultante: manter carga rastreável até a policy aprovar sua mudança; a base continua expansível, sem dívida de horas e sem feedback subjetivo.

## Priorização implementada na Fase 3.7

Registro em 07/10/2026. Motor `mentor-v2-engine/3.7`, catálogo `mentor-v2-reasons/4`. A regra adicional reconhecida é `PRIORIZACAO_CURRICULAR_SEMANAL`, habilitada explicitamente no mesmo registro canônico de policy, ao lado de `CONTINUIDADE_PLANO_EXISTENTE`. Não há ativação implícita em configuração antiga nem seed aplicado ao banco.

### Entradas e seleção

O adapter lê currículo/material, `material_progresso`, histórico factual de execução, compromissos e seus vínculos explícitos, fila de revisão, questões e tentativas. Leituras são paginadas, inclusive progresso identificado por `material_id` e vínculos de compromisso pela chave composta. Falha de uma fonte impede avaliação/persistência parcial. `mentor_contexto.dados.objetivo_principal_id`, quando informado, identifica o concurso principal; não é inferido do nome, de config estratégico antigo ou de uma data histórica.

O cálculo factual em `shared/mentor-v2-priority.js` identifica candidatos e necessidades, mas não decide. A ordenação e a seleção pertencem exclusivamente a `shared/mentor-v2-policy.js`:

1. Preservar capacidade existente por objetivo, data e duração, sem criar carga inicial ou transferência de blocos acadêmicos ao concurso. O concurso principal vem primeiro na avaliação, seguido dos demais concursos e da Faculdade; isso não muda as datas do plano.
2. Usar somente slots de Estudo planejados no dia corrente/futuro, na referência de Brasília. Concluídas, faltas, cancelamentos e slots movidos/reordenados manualmente não recebem nova seleção.
3. Por matéria, selecionar o primeiro material aceito não concluído na ordem real `ordem_curso`. Não pular material em andamento, material com OCR pendente ou lacuna de ordem para chegar a uma aula posterior. Não inventar sequência por título ou UUID.
4. Entre matérias do mesmo objetivo: compromisso confirmado ainda pendente dentro da semana, com vínculo explícito, por prazo; continuidade de material em andamento; menos seleções nesta avaliação; execução concluída mais antiga ou ausente; IDs estáveis como último desempate técnico. Não existem score de domínio, pesos V1 ou proporção nova de carga.
5. Um material em andamento pode receber vários slots separados. A seleção não o conclui nem avança por número de blocos. Uma conclusão canônica faz o próximo cálculo avançar; base concluída não reinicia o curso.

O compromisso identifica prioridade da matéria, não uma correspondência material-tópico fictícia. `compromisso_topico` é usado somente quando seu vínculo identifica a matéria de forma verificável. A seleção de material mantém `topico_id = null` quando não existe correspondência explícita. O restante do currículo continua elegível, mesmo sem ser escolhido nesta semana.

### Decisão não é aplicação

`PRIORIZAR_MATERIA` agora é um tipo executável, com material selecionado em `alvos_relacionados`, alternativas identificadas, ordem relativa no conjunto, evidências e fundamentos da regra central. A referência da demanda identifica a capacidade disponível; **não é uma ordem de substituir seu conteúdo**. `parametros.aplicacao = SELECAO_SEM_ALTERAR_PLANO` torna esse limite explícito.

Decisões `MANTER_DEMANDA` continuam preservando o plano efetivo. Seleções são registradas no mesmo envelope de `mentor_decisao`, lidas pela mesma API, sem escrever em `sessao`, materiais, conclusões, tempo ou tentativas. Materialização/conciliação dessas seleções em novas demandas não foi implementada nesta subfase. Sem base de carga, há candidatos observáveis, mas nenhum slot inventado. Sem candidato válido para um slot, registrar `NO_ELIGIBLE_CURRICULUM`; não reiniciar curso nem preencher com conteúdo fictício.

### Desempenho, revisão e reteste

Tentativas são observações rastreáveis, não evidência autoqualificada. A fila real identifica revisão pendente/vencida no corte e `checagem` como necessidade de reteste. Datas futuras não são vencidas. Ausência de critérios aprovados de volume, dias, persistência, recência e retestes permanece uma limitação explícita: `SUFICIENCIA_DESEMPENHO_REVISAO_RETESTE_NAO_DEFINIDA`.

Nesta implementação esses dados não mudam a ordem curricular nem liberam prática. Nenhum erro, percentual, classificação de confiança ou sinal declarado suficiente por si mesmo reordena matéria inteira. Não há `RETORNO_PONTUAL_TEORIA` executável sem regra/evidência qualificada; sobretudo, não existe reinício automático do curso. Essa limitação não deve ser apresentada como seleção de modalidade de revisão já concluída.

### Validação e riscos

Status local: **PASS COM LIMITAÇÕES**. 133 testes direcionados aprovados: prioridade 29, integração 34, policy 25, fallback 22 e carga 23. Os 38 casos adicionados incluem materiais concluídos/em andamento, conclusão explícita versus bloco, base concluída, prazos, vínculo acadêmico, 30/50, recência, determinismo, exclusões/movimentações, erro isolado, revisão futura/vencida, reteste, OCR/ordem ausentes, contrato, falha de fonte e paginação de 501 materiais. A integração usa adapter controlado, não banco real.

Pendências: ativação/versionamento autorizado no banco; critérios de suficiência para desempenho, revisão/reteste e retorno pontual; correspondência material-tópico; conciliação/materialização do plano; base inicial quando inexistente. Matérias sem materiais ordenados não recebem um currículo inventado, inclusive Faculdade. Não houve consulta/alteração de banco, migrations, suíte completa, lint, build, commit, push ou deploy nesta subfase.

Aprendizado: priorizar conteúdo não significa concluir material, aumentar carga ou alterar história. Regra resultante: uma seleção estruturada precisa preservar a capacidade factual e só pode usar aprendizagem/retenção quando houver qualificação aprovada. Não iniciar a próxima subfase automaticamente.

## Geração do plano semanal, Fase 3.8

Registro em 07/10/2026. Motor `mentor-v2-engine/3.8`, catálogo `mentor-v2-reasons/5`. A regra `GERACAO_PLANO_SEMANAL` é habilitável somente na mesma policy canônica, com continuidade e priorização curricular. Nenhum registro foi instalado no banco.

### Capacidade explícita e semana inteira

`conteudo.politica.capacidade_semanal` descreve slots aprovados: `dia` (0 = segunda, 6 = domingo), `objetivo_id`, `atividade` e `duracao_minutos`. Não contém um default implícito de quantidade ou proporção. Estudo utiliza blocos independentes de 30/50; outras atividades respeitam duração positiva até 90, compatível com o schema atual. Simulado/prova não são aceitos pela regra desta etapa.

Para prática explicitamente configurada, são necessários `materia_id` e `topico_id`; revisão também exige `revisao_id` real. A modalidade precisa estar na policy e liberada no contexto. Questões/cards precisam de conteúdo existente naquele tópico; revisão precisa estar pendente, vinculada ao conteúdo e não agendada depois do dia selecionado. Não há geração de acervo, configuração SRS presumida ou ativação por data histórica. Configurar um slot não significa que uma amostra estatística foi qualificada.

O Mentor seleciona conteúdos para todos os dias configurados da semana. Usa a ordenação curricular da 3.7, sem finalizar material por seleção de blocos. Materiais em andamento podem receber vários blocos separados. Faculdade e concurso conservam a capacidade explicitamente prevista. A carga proposta é uma projeção das demandas atuais + criações selecionadas, vinculada à mesma avaliação; a base observada continua separada.

Ainda falta aprovar/configurar a base real quando não houver plano: **a implementação não escolheu números iniciais para produção**. Não duplica uma base sobre um plano manual/legado já existente. Sem configuração, conteúdo elegível ou autorização necessária, registra pendência e HTTP 503, não sucesso falso. Uma aplicação pode ser parcial quando somente alguns slots possuem conteúdo válido; o retorno informa suas criações confirmadas e a pendência restante. Não há preenchimento retroativo de dias anteriores ao corte.

### Decisões e aplicação

O único Mentor emite `CRIAR_DEMANDA` com data, objetivo, matéria, material/tópico quando identificado, atividade, duração, ordem relativa, título, slot de capacidade, versão e fundamentos. `APPROVED_WEEKLY_CAPACITY` e `WEEKLY_PLAN_SELECTION` identificam a autorização da base e a seleção, não execução factual.

`api/_lib/mentor-v2-plan.js` apenas valida/materializa esses resultados; não escolhe outra estratégia. A preparação registra a avaliação antes de inserir demandas em `sessao`. Mapeamento compatível com a UI existente: ESTUDO -> estudo; QUESTOES -> exercicio; QUESTION_CARDS -> especial; REVISAO -> revisao. Não houve alteração de UI.

A identidade lógica é `v2:<semana>:<índice do slot>`. Dela deriva um UUID estável, independentemente do corte ou material. A chave persistida acrescenta `:decision:<decisao_id>` para apontar exatamente à decisão original. O UUID/PK protege contra duplicação entre avaliações diferentes; inserção usa `onConflict: id`, `ignoreDuplicates: true`, sem UPDATE de sessões existentes. A chave física nunca é reescrita para apontar a uma avaliação posterior.

Data original, reason codes e origem mentor são gravados com a criação. Decisão/material/slot ficam verificáveis em `mentor_decisao.dados`; a chave permite localizar a decisão específica, sem migration ou campo inventado. Mover/reordenar a demanda altera o plano efetivo, não a decisão histórica ou sua chave. Na leitura das identidades, buscar também demandas V2 movidas para fora da semana, concluídas e canceladas. Assim, recálculo não preenche o buraco deixado pelo usuário nem recria exclusões persistentes.

O lote de inserção é uma operação de banco; erro não é ignorado. Registro da avaliação e inserção do plano são operações separadas: falha pode deixar decisão ainda não aplicada, nunca deve ser apresentada como criação confirmada. Retry reaplica sem sobrescrever/duplicar sessões. Não se declara atomicidade transacional entre `mentor_decisao` e `sessao` nesta etapa.

### Fechamento e pendências

Após aplicação sem pendência, fechar factualmente a semana anterior já encerrada: somente demandas do Mentor ainda planejadas e não movidas para além daquela semana passam a `nao_concluida`. Não alterar feitas, canceladas, tempo, progresso ou decisões originais. Não remover história nem transportar objetos de sessão para o dia seguinte.

Conteúdo não coberto continua elegível no currículo e pode ser diluído em slots da semana seguinte; material efetivamente concluído deixa a fila curricular. Faltas não acrescentam slots à base. Critérios estratégicos para abandono explícito, adiamento/substituição de demandas existentes e reagendamento tipado continuam pendentes: esses tipos não foram ativados por aproximação ou policy V1. A aplicação desta etapa é inserção de novas demandas, não substituição silenciosa de um plano editado.

### Validação e limites

Status: **PASS COM LIMITAÇÕES**. 183 testes direcionados aprovados em 10 arquivos; 35 casos novos em `mentor-v2-plan.test.js`. Cobertura: sete dias, distribuição por objetivo, 30/50, vínculos/reasons, progresso, faltas sem dívida, conteúdo novamente elegível, exclusão, movimento para outra semana, datas originais, duplicidade/retry, propostas de cortes diferentes, quatro modalidades com gates, revisão futura, ausência de configuração, contrato adulterado, falha de gravação e fechamento da semana anterior.

Testes de persistência usam adapter relacional controlado. A migration histórica da PK/identidade foi inspecionada, mas PostgreSQL real, concorrência real, ativação da policy e produção não foram validados. Nenhuma migration criada/aplicada, alteração de banco real, suíte completa, lint, build, commit, push ou deploy. A base inicial real, estratégias de encerramento/reagendamento e suficiência estatística permanecem pendentes. A semana já existente é preservada, não reconstruída como se fosse vazia.

Aprendizado: decisão, aplicação e execução têm estados distintos. Regra resultante: criar somente dentro da capacidade explícita, guardar origem imutável e nunca usar replanejamento para repor exclusões ou pagar dívida. Parar ao concluir esta subfase.

## Rastreabilidade da demanda, Fase 3.9

Registro em 07/10/2026. A consulta autenticada `GET /api/mentor?recurso=demanda&id=<uuid>` resolve a decisão original de criação pela `sessao.chave_mentor`, não pela avaliação mais recente nem pela policy atualmente ativa. Não recalcula estratégia nem escreve dados.

Com `auditoria=1`, disponibiliza decisão estruturada, snapshots das evidências utilizadas, reason codes, referência/versionamento da policy e contexto, demanda original materializada, demanda atual e datas da decisão/referência/registro. A validação exige correspondência entre o vínculo, contrato e fatos originais da demanda. Movimentação, ordem e status atuais não reescrevem a origem. Divergência do cache de reason codes é identificada, não usada como nova justificativa.

Sem a flag de auditoria, retorna somente estado de rastreabilidade e frase curta. A modal da Semana consulta esse resumo ao abrir; não exibe inputs, códigos ou painel técnico. Erro de leitura gera aviso curto, sem bloquear as ações existentes. Respostas tardias de uma modal fechada ou trocada são ignoradas. Demanda manual é identificada como manual; legado sem vínculo e decisão ausente/inconsistente são informados sem inventar explicação.

Não há nova persistência concorrente: decisões continuam em `mentor_decisao.dados`, demandas em `sessao`, e texto é projeção determinística. Não houve migration, alteração de banco real ou publicação. A rastreabilidade aplica-se às criações V2 vinculadas; não recupera retroativamente decisões V1 inexistentes. Testes controlados cobrem resolução original, contrato, movimentos, versões, cache divergente, erros, autenticação e apresentação discreta. Validação PostgreSQL/produção e interação em navegador real não foram realizadas nesta microetapa.

Aprendizado: a explicação precisa apontar para a decisão que criou a demanda, mesmo após mudanças no plano ou na policy. Regra resultante: nunca substituir uma origem ausente por motivo inferido da configuração atual.

Resultado local da 3.9: **PASS COM LIMITAÇÕES**. 220 testes direcionados aprovados em 13 arquivos, incluindo 29 novos casos de rastreabilidade/API/UI e regressões do Mentor/plano/encontro/UI. `git diff --check` sem erros. Testes de banco usam adapter controlado; UI usa renderização estática e inspeção estrutural, não E2E em navegador. Não foram executados suíte completa, lint ou build. Sem commit, push ou deploy; trabalho local anterior preservado. Parar nesta subfase.

## Integração do Mentor V2, Fase 3.10

Registro em 07/10/2026. Status local: **PASS COM LIMITAÇÕES**.

Fluxo integrado: `registros canônicos -> adapter factual mentor-v2.js -> sinais de carga/currículo -> policy única mentor-v2-policy.js -> decisões tipadas -> mentor_decisao -> materializador mentor-v2-plan.js -> sessao -> Semana -> consulta da decisão original`. API, preparação e cron utilizam a mesma fronteira. O teste atravessa leitura controlada, derivação, decisão, persistência do plano e rastreio de todas as 21 demandas sintéticas, inclusive avanço baseado em material concluído e domínio UNKNOWN.

Isolamento verificado também nas dependências transitivas locais dos pontos de entrada, não apenas nos imports diretos. Regras V1 continuam preservadas como histórico e em testes próprios, mas não são alcançadas pelos entrypoints decisórios V2. Conhecimento legado, configuração de objetivo, fase antiga e carga histórica no contexto não alteram as demandas. Ausência ou concorrência de policy ativa mantém o plano intacto e retorna pendência; não escolhe uma versão silenciosamente nem resgata defaults históricos.

Correções mínimas de integração: retirada do início hardcoded de setembro da Semana; resposta do Mentor mantém `revisao_imediata: []`, exigida pela tela de Estatísticas. Essa lista vazia não ativa revisão avançada e não simula evidência de retenção. Nenhum novo threshold, regra de progressão, FSRS, geração de cards ou simulado foi implementado.

Validação: 115 testes direcionados em seis arquivos; suíte completa com 374 testes aprovados em 31 arquivos; lint estrutural aprovado em 136 arquivos; build Vite aprovado com 49 módulos. Cinco novos casos incluem fluxo completo, interferência histórica, configuração ausente/concorrente, grafo transitivo e retirada do corte histórico. A regressão da API verifica explicitamente o contrato utilizado por Estatísticas. Lint estrutural não equivale a análise completa de hooks/acessibilidade.

Limites: persistência é comprovada por adapter relacional controlado, não PostgreSQL ou produção. Ativação/versionamento da policy real e configuração de capacidade semanal não foram realizados; continuam necessários para gerar um plano real quando ainda inexistente. Critérios de suficiência e alteração estratégica de carga permanecem pendentes, sem números arbitrários. Não houve banco, migration, commit, push ou deploy. Trabalho local anterior preservado; nenhuma próxima fase iniciada.

Aprendizado: a integração inclui consumidores e dependências indiretas. Regra resultante: compatibilidade de resposta não autoriza reativar um decisor histórico, e aprovação local não comprova configuração real do banco.
