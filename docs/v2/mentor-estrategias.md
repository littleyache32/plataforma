# Contrato estratégico do Mentor V2

Atualização: 07/10/2026, Fase 3.17. Contrato conceitual; não implementa um seletor avançado de estratégias.

## Responsabilidade

O usuário é exclusivamente o mentorado. Informa fatos, disponibilidade, restrições, compromissos e execução. O único Mentor decide carga, distribuição, método, prioridade, revisão, prática e estratégia. Não existem controles para escolher uma semana de questões, revisão ou aumento de carga.

Objetivo: maximizar a probabilidade de aprovação sob restrições reais de tempo, aderência, disponibilidade, conhecimento, retenção e sustentabilidade. Não produzir uma probabilidade numérica sem modelo e evidência suficientes. Incerteza alta mantém uma estratégia conservadora.

## Baseline operacional

O ciclo configurado começa segunda-feira, 12/10/2026, com semana inicial até 18/10. A data não é regra permanente do motor. `config/mentor-ciclo-atual.json` é entrada de manutenção, não é lida pelo runtime. `prepareCycleContext` converte essa entrada em `mentor_contexto.dados.ciclo_operacional` e `dados.capacidade_inicial`, as fontes operacionais canônicas.

Primeira semana: duas demandas de concurso e uma de Faculdade diariamente, todas de Estudo e 50 minutos, quando houver disponibilidade factual. São 150 minutos de base diária, não um teto permanente. Um dia sem capacidade não despeja os blocos em outro dia. Não adicionar questões, revisões, cards ou simulados rotineiramente. Uma necessidade acadêmica factual pode mudar o conteúdo dos blocos, sem aumentar automaticamente a carga.

As demandas antigas planejadas e sem execução podem ser canceladas pelo Mentor antes da nova materialização, inclusive futuras. Não excluir sessões executadas, tempo, progresso, currículo, prática, compromissos nem decisões. Registro de tempo vinculado, mesmo ativo, ou duração realizada protege a sessão do cancelamento. Cancelamento não gera dívida.

Esta subfase não ativou o contexto no banco real, não cancelou demandas reais e não publicou código. A ativação deve preservar disponibilidade e demais fatos canônicos, usando a configuração preparada, sem reconstruir histórico.

## Capacidade e progressão

Disponibilidade é fato; capacidade planejável é configuração; carga é decisão. Capacidade adicional não significa mais PDFs. Pode atender aquisição, questões, diagnóstico, reteste, cards, revisão e, quando autorizado futuramente, simulado.

Sem critérios e evidência suficientes para progressão, manter. Uma semana boa não obriga aumento. Não existe escada por semana nem meta de alcançar rapidamente o máximo. Aumento futuro será incremental e conservador; redução também é válida.

Tetos absolutos líquidos: segunda a sexta 450 minutos/dia; sábado 240; domingo 180. São restrições, não metas. Disponibilidade menor prevalece. Sexta-feira não recebe carga especial hardcoded.

Faculdade mantém continuidade: um bloco diário inicial; depois, normalmente até dois, até três excepcionalmente por prova/entrega factual próxima. Recuperação acadêmica qualificada poderá justificar exceção quando possuir contrato factual próprio, não por inferência livre. Nunca transformar três em rotina. Capacidade incremental favorece concurso além da necessidade acadêmica normal.

## Distribuição

Preservar ordem interna e o primeiro material pendente válido. Concluir demanda não conclui material nem prova domínio. Intercalar matérias elegíveis no dia e distribuir exposições na semana; prazos factuais podem justificar concentração. Se apenas uma matéria for elegível, a repetição não cria conteúdo fictício.

A distribuição atual usa prioridade por prazo, seleções no dia/semana, material em andamento e recência factual. Não há intervalo universal de revisão. Distribuição multissemanal avançada depende de evidência e será refinada futuramente; não é obrigatório cobrir todas as disciplinas a cada semana.

## Funções do estudo

| Função | Exemplos | Limite de interpretação |
| --- | --- | --- |
| Aquisição | Aula, PDF, teoria nova | Cobertura não é domínio |
| Prática/avaliação | Questões, baterias, diagnóstico, simulado futuro | Observação isolada não autoriza decisão ampla |
| Retenção/revisão | Cards, retestes, questões de revisão, recuperação ativa | Consome orçamento finito |

Uma atividade pode exercer função híbrida. Essa classificação interna não exige novos controles visuais.

## Arsenal futuro

| Família | Ênfase relativa, não exclusividade |
| --- | --- |
| Construção de base | Aquisição com continuidade curricular |
| Equilíbrio aquisição + retenção | Conteúdo necessário e manutenção ativa |
| Consolidação | Integração e estabilidade do conhecimento |
| Reforço de retenção | Maior participação justificada de revisão |
| Prática/diagnóstico intenso | Evidência sobre conceitos e aplicação |
| Recuperação de lacunas | Correção local; teoria pontual qualificada |
| Preparação pré-prova | Prazo factual sem dívida automática |
| Preparação pós-edital | Cobertura e relevância do edital vigente |
| Simulação | Somente em fase futura autorizada |
| Manutenção | Preservação de retenção no longo prazo |

Famílias não exaustivas. Estratégia é distribuição relativa de capacidade, não ocupar todos os blocos com a mesma atividade. Toda mudança futura exige evidência, reason_codes, horizonte de avaliação e possibilidade de reversão. Nenhum seletor avançado é implementado nesta etapa.

## Pendências e integração com revisão

Dias perdidos não são compensados automaticamente no dia seguinte nem concentrados no fim de semana. O Mentor pode manter, reagendar, substituir, abandonar ou diluir necessidades dentro da capacidade futura. A história permanece.

Revisão é estrutural, preferencialmente recuperação ativa, questões, cards ou retestes. Retorno à teoria é pontual e depende de necessidade qualificada, nunca releitura genérica após erro.

A Fase 4 recebe contexto, capacidade, limites e demandas existentes. Revisão/prática deve consumir slots disponíveis da carga aprovada, não somar uma fila ilimitada fora dela. Sem slot autorizado, o item permanece na fila complementar. O orçamento não autoriza geração automática de acervo nem liberação de simulados.

## Limitações de ativação

Testes locais usam dados sintéticos, não comprovam cancelamento em produção. O cancelamento possui rechecagem de tempo e update condicionado ao estado/duração, mas não uma transação com trava entre início concorrente de timer e cancelamento. Esse caso requer garantia PostgreSQL antes de ativação com sessões concorrentes. Não considerar a configuração local como contexto já aplicado ao banco real.
