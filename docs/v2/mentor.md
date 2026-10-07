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
