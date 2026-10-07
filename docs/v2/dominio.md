# Modelo de domínio da Plataforma V2

Data: 06/10/2026. Fase 1.2. Branch analisada: `v2`. HEAD: `bc36d01333ad94580704cbebf81872046605f8b8`.

## Escopo

Modelo conceitual alinhado ao [contrato funcional](produto.md). A comparação usa o schema declarado nas 69 migrations do checkout, com leitura dos handlers diretamente relacionados para identificar responsabilidades. Não houve consulta ao banco real: aplicação das migrations e estado dos dados não foram confirmados nesta subfase.

Uma entidade conceitual não exige uma tabela nova. Reutilizar, adaptar e candidato futuro a remoção são orientações para etapas posteriores, não autorização de execução. Não há migration, alteração de schema, dado ou código funcional nesta fase.

## Invariantes

1. Demanda planejada não é tempo estudado: estimativa e entrega pertencem ao plano; tempo real pertence aos registros de execução.
2. Demanda concluída não conclui automaticamente o material.
3. Material estudado representa cobertura, não domínio.
4. Questão respondida é uma observação, não comprovação isolada de domínio.
5. Central de Revisão é uma visão/fila complementar, não outro Plano.
6. Timer é controle de execução, não demanda. Pode registrar estudo livre ou tempo vinculado a uma demanda.
7. O Mentor consome dados e decide o planejamento, mas não reescreve história factual para acomodar suas decisões.
8. Estatísticas são derivadas dos registros canônicos. Contadores, caches e projeções não substituem os fatos que os sustentam.

Correções explícitas do usuário são diferentes de replanejamento automático. Corrigir um registro não autoriza o Mentor a apagar ou inventar execução. A representação técnica dessas correções será definida em fase própria.

## Entidades e responsabilidades

### 1. Usuário

- **Representa:** a identidade da única pessoa que utiliza a instalação e suas credenciais de acesso.
- **Não representa:** organização, tenant, papéis empresariais, outro Mentor ou estado de domínio acadêmico.
- **Relações:** proprietário conceitual dos objetivos e registros pessoais. Isso não exige adicionar usuario_id a todas as tabelas numa instalação pessoal.
- **Fonte da verdade:** conta persistida em `app_usuario` e validação de credenciais/sessão do backend. Cookie assinado é prova de acesso temporário, não cadastro nem fonte do progresso.

### 2. Objetivo

- **Representa:** finalidade duradoura de estudo, como um concurso atual/futuro ou a Faculdade, com identificação e referências de prazo quando existirem.
- **Não representa:** semana, matéria, carga fixa, garantia de aprovação ou um único concurso hardcoded no produto.
- **Relações:** reúne matérias, materiais, compromissos, demandas e prática pertinentes. Objetivos de Faculdade e concurso coexistem.
- **Fonte da verdade:** `objetivo`. Configuração específica pertence ao objetivo; política geral não deve ser duplicada em cada objetivo. Prazo real e referência provisória não podem ser apresentados como equivalentes.

### 3. Matéria

- **Representa:** disciplina organizada dentro de um objetivo.
- **Não representa:** PDF, uma sessão de estudo, prioridade imutável ou domínio do usuário.
- **Relações:** pertence a objetivo; organiza tópicos, materiais, compromissos e execução. Matérias de objetivos diferentes podem ter nomes semelhantes sem compartilhar automaticamente histórico.
- **Fonte da verdade:** `materia`, com vínculo ao objetivo. A disciplina original de uma coleção deve ser conciliada com esse cadastro sem destruir vínculos históricos.

### 4. Tópico/conteúdo

- **Representa:** unidade curricular identificável que pode ser estudada, praticada e revisada.
- **Não representa:** questão, trecho arbitrário inventado, material inteiro em todos os casos ou nota de domínio.
- **Relações:** pertence a matéria; pode ser coberto por materiais/unidades e referenciado por questões, cards, compromissos e demandas.
- **Fonte da verdade:** catálogo curricular validado a partir das fontes reais. O schema possui `topico` e `material_unidade_curricular`, mas estes não são sinônimos automáticos. Sem correspondência comprovada, o vínculo permanece desconhecido, sem inferência a partir do nome.

### 5. Material

- **Representa:** fonte concreta de estudo, como PDF, aula ou texto, com identidade, proveniência e ordem curricular verificáveis.
- **Não representa:** demanda, conclusão do usuário, unidade de tempo ou todo o catálogo externo como se estivesse coberto pela fonte.
- **Relações:** associado a objetivo/matéria; possui unidades curriculares e progresso; várias demandas podem utilizar o mesmo material. Relação com conteúdos deve ser explícita quando conhecida.
- **Fonte da verdade:** `material` para metadados e referência da fonte; arquivo/texto original protegido para o conteúdo. Hash identifica conteúdo do arquivo, não prova domínio. Status de aceitação/OCR não é status de conclusão.

### 6. Progresso de material

- **Representa:** estado efetivo de avanço do usuário naquele material, incluindo início e conclusão explícita.
- **Não representa:** tempo acumulado, conclusão de uma demanda, aprovação na matéria ou um novo sistema visual de estado do conteúdo.
- **Relações:** pertence a material; demandas e tempos podem fornecer contexto de execução, sem concluir o material automaticamente.
- **Fonte da verdade:** `material_progresso`. No contrato atual do schema, ausência de linha significa não iniciado; `em_andamento` e `concluido` são estados persistidos. Conclusão explícita válida, inclusive histórica, governa avanço curricular. Registro de sessão feita não deve sobrepor essa regra.

### 7. Compromisso

- **Representa:** obrigação ou evento com prazo real, como prova ou entrega acadêmica.
- **Não representa:** blocos preparatórios, dívida de horas ou todas as demandas necessárias para cumprir o prazo.
- **Relações:** pertence a objetivo; pode referenciar matéria e conteúdos. O Mentor usa o prazo como input para priorizar demandas.
- **Fonte da verdade:** `compromisso` e vínculos em `compromisso_topico`; fatos de calendário confirmados, não datas inventadas pelo planner. Texto previsto é contexto, não substituto automático de vínculo curricular.

### 8. Demanda/sessão planejada

- **Representa:** entrega organizada no plano, com finalidade/modalidade, data, ordem, contexto, estimativa e estado de execução informado.
- **Não representa:** timer, minutos reais, conclusão automática de material ou obrigação de recuperar horas perdidas.
- **Relações:** vinculada a objetivo e, conforme o caso, matéria, conteúdo, material, compromisso ou necessidade de revisão. Pode ter zero ou vários registros de tempo. Replanejamento altera posicionamento/estado permitido, preservando histórico factual e exclusões.
- **Fonte da verdade:** `sessao` para a demanda atual e os registros de planejamento/decisão para sua origem e alterações. O nome físico sessao não transforma essa linha em um timer. Estimativa não preenche tempo real.

### 9. Tempo de estudo

- **Representa:** registro real de duração de uma atividade, capturado por timer ou informado manualmente.
- **Não representa:** entrega concluída, estimativa, descanso, progresso curricular ou prova de aprendizagem.
- **Relações:** pode vincular-se a demanda por `sessao_id`, com contexto de objetivo/matéria/conteúdo; estudo livre não exige demanda. Vários registros podem corresponder a uma demanda.
- **Fonte da verdade:** `tempo_estudo` e seus segundos reais persistidos. Estados rodando/pausado/concluído controlam execução; timer na interface é a projeção/controle desse estado, não fonte independente. Para uma demanda, duração realizada é derivada da soma dos registros concluídos vinculados, convertida/arredondada no total, sem incremento cego nem duplicação.

Essa regra conceitual de duração preserva a direção 7.3. O checkout V2 não contém integralmente a implementação recente nem a migration 0069 do snapshot; não se declara reconciliação atômica ativa neste banco.

### 10. Questão

- **Representa:** item de prática com enunciado, formato, resposta correta, comentários e proveniência verificável.
- **Não representa:** tentativa do usuário, necessidade de revisão, prática automaticamente liberada ou indicador pessoal de domínio.
- **Relações:** pertence a tópico/conteúdo; pode participar de tentativas, revisões, simulados e origem corretiva de card.
- **Fonte da verdade:** `questao` para o item e seu gabarito/comentários, apoiados em fonte/evidência e curadoria. Campos de tentativas, estado e próxima revisão agregados na questão não são a história factual de respostas.

### 11. Tentativa de questão

- **Representa:** evento de resposta confirmada, com questão, instante, resultado, confiança e contexto disponível. Confiança é coletada junto à resposta.
- **Não representa:** atualização do enunciado, domínio, retenção confirmada por repetição imediata ou tempo adicional a somar automaticamente ao timer.
- **Relações:** pertence a questão; pode ocorrer em prática ou revisão. Futuramente, tentativa de simulado deve ter origem identificável para não duplicar eventos na estatística.
- **Fonte da verdade:** `registro` no schema atual. Guarda resultado, classificação, tempo e instante, com `operacao_id` quando informado. Hoje não persiste a alternativa/resposta escolhida nesse registro; portanto não permite reconstrução completa da resposta. Distinguir tentativa inédita, repetição imediata e reteste exige contexto/evidência, não dado fabricado.

### 12. Revisão de questão

- **Representa:** necessidade/ocorrência de revisitar uma questão, com motivo e agendamento. A resposta efetivamente dada nessa revisão é uma tentativa de questão.
- **Não representa:** novo enunciado, segunda tentativa contada só pelo agendamento ou demanda semanal por definição.
- **Relações:** referencia questão e pode alimentar uma revisão planejável. Sua execução se apoia em tentativa real; concluir/ignorar uma necessidade e acertar uma resposta são fatos diferentes.
- **Fonte da verdade:** `revisao_item` para ocorrência/fila com motivo, prioridade, agendamento e estado; `registro` para resposta. `questao.proxima_revisao` e parâmetros de espaçamento são estado de agendamento a reconciliar com a fila, não uma segunda verdade independente sobre a mesma ocorrência.

### 13. Question Card

- **Representa:** item de recuperação ativa com frente, resposta e fonte, de alta qualidade; pode vir de conteúdo estudado ou de correção de prática.
- **Não representa:** questão obrigatória de origem, registro de revisão ou memória pessoal adquirida.
- **Relações:** vinculado a objetivo/matéria/conteúdo, opcionalmente a questão; possui registros de revisão e pode originar necessidade planejável.
- **Fonte da verdade:** `question_card` para o conteúdo/proveniência. Seu estado SRS é estado derivado/reconciliável a partir de registros e configuração escolhida, não avaliação de domínio. Algoritmo/configuração Anki permanecem por definir no contrato.

### 14. Registro de revisão do card

- **Representa:** evento real de recuperação e avaliação de um card: 1 Novamente, 2 Difícil, 3 Bom, 4 Fácil.
- **Não representa:** conteúdo do card, simples visualização da frente, demanda concluída automaticamente ou calendário por si só.
- **Relações:** pertence a card; alimenta seu espaçamento e estatísticas. Pode atender uma necessidade de revisão, sem produzir dois eventos pelo mesmo ato.
- **Fonte da verdade:** `question_card_registro`, com instante e avaliação e `operacao_id` quando informado. Valores antigos lembrei/revisar devem permanecer interpretáveis historicamente. O schema atual não registra por evento toda a configuração/estado anterior e posterior do SRS; não se presume replay fiel de um Anki ainda não escolhido.

### 15. Revisão planejável

- **Representa:** necessidade de recuperação/revisita de conteúdo que o Mentor pode incorporar ao plano com modalidade e motivo explícitos.
- **Não representa:** outra autoridade de planejamento, timer, execução já realizada ou obrigação de combinar questão e card em todo bloco.
- **Relações:** conecta uma origem, como questão ou card, ao conteúdo e às demandas que a atendem. Origens futuras não são ativadas por existirem conceitualmente. A Central exibe essa fila/visão; Meu Plano materializa entregas escolhidas pelo único Mentor.
- **Fonte da verdade:** necessidade identificada na fonte canônica e seu atendimento factual, com decisão/agendamento do Mentor. Hoje a fila é composta por `revisao_item` e cards vencidos, e demandas de revisão vivem em `sessao`. Não há tabela genérica única comprovada neste checkout; a adaptação conceitual não exige criar outra fila duplicada.

### 16. Simulado futuro

- **Representa:** evento futuro de prática estruturada com conjunto/ordem de questões e duração própria.
- **Não representa:** bloco comum, funcionalidade já liberada, vários registros duplicados de tentativa ou decisão independente do Mentor.
- **Relações:** pertence a objetivo, eventualmente matéria; possui itens/questões, respostas e tempo, podendo posteriormente originar revisão planejável.
- **Fonte da verdade:** estruturas existentes `simulado` e `simulado_item`, com futura definição de integração de tentativas. Não contar resposta em simulado_item e registro como duas tentativas do mesmo evento. Preservar estruturas/dados; sem implementação agora.

### 17. Decisão do Mentor

- **Representa:** resultado determinístico do único Mentor, com inputs/sinais, versão das regras, ação, motivos e vínculo ao planejamento produzido.
- **Não representa:** especialista/agente autônomo, resposta LLM, fato de estudo ocorrido, domínio inventado ou permissão para apagar história.
- **Relações:** consome contexto, currículo, compromissos, execução e prática válida; pode produzir/ajustar demandas e suas justificativas. Conhecimento organizado por domínio não cria decisores independentes.
- **Fonte da verdade:** `mentor_decisao` para decisão registrada e seus motivos; `mentor_execucao` para execução técnica/inputs/resultados. `sessao.reason_codes` é projeção dos motivos associados à decisão de origem, não outra fonte decisória. Regras versionadas ficam em `conhecimento_modulo`; contexto mutável em `mentor_contexto`. Deve ser possível ligar decisão a demandas, sem presumir uma FK decisao_id que o schema atual não declara.

## Relações essenciais

| relação conceitual | significado |
| --- | --- |
| Objetivo -> matérias -> conteúdos | Organização curricular, não distribuição obrigatoriamente igual de carga. |
| Material -> unidades/conteúdos -> progresso | Fonte/cobertura identificável, sem equiparar PDF e tópico externo automaticamente. |
| Demanda -> zero ou vários tempos | Plano e execução separados; soma de tempo não conclui entrega/material. |
| Questão -> tentativas; card -> registros de revisão | Item e eventos pessoais separados; um evento não se duplica por aparecer em mais de uma tela. |
| Necessidade de revisão -> decisão -> demanda | Central complementa Meu Plano; não gera ordens concorrentes. |
| Registros canônicos -> estatísticas/sinais -> Mentor | Métricas são derivadas; decisão nova não altera os fatos de origem. |

## Comparação com o schema declarado

| entidade | estrutura atual | orientação |
| --- | --- | --- |
| Usuário | app_usuario (0051) | Reutilizar conta pessoal; descanso_ate é estado de execução atualmente acoplado à conta, não identidade. Não criar multiusuário. |
| Objetivo | objetivo (0002) | Reutilizar; adaptar configs/cortes específicos de BACEN e referências provisórias para longo prazo. |
| Matéria | materia (0001/0002) | Reutilizar IDs/vínculos; adaptar conciliação disciplina_curso/catalogo quando necessária. |
| Tópico/conteúdo | topico (0001), material_unidade_curricular (0064), conhecimento | Adaptar correspondência e proveniência; unidade possui material_id, mas não FK explícita a topico. conhecimento é trecho derivado de fonte, não policy do Mentor. |
| Material | material (0001/0002/0051/0064), metadados de arquivo/Storage | Reutilizar; adaptar ordem_estudo versus ordem_curso e fonte real sem substituir histórico. |
| Progresso | material_progresso (0060/0064) | Reutilizar estado canônico explícito; não inferir conclusão pela duração ou sessão feita. |
| Compromisso | compromisso (0011/0033), compromisso_topico (0046) | Reutilizar; separar evento externo da demanda preparatória; preservar interface acadêmica. |
| Demanda | sessao (0002/0004/0051/0059/0065/0066/0068) | Reutilizar; adaptar limites entre planejamento/entrega e tipos evento/aula; preservar exclusão, cancelamento e fatos distintos. |
| Tempo | tempo_estudo (0034/0036/0051) | Reutilizar; duracao_realizada na sessão é projeção. Revisar uso futuro das correções 7.x preservadas, sem aplicá-las agora. |
| Questão | questao (0001/0002/0019/0020), auditoria/relatos | Reutilizar item/proveniência; adaptar estado pessoal agregado e campos derivados. |
| Tentativa | registro (0001/0034) | Reutilizar histórico; adaptar rastreabilidade da resposta/origem sem inventar campos inexistentes. |
| Revisão de questão | revisao_item (0002/0061), estado SRS em questao | Adaptar fronteira fila/estado/atendimento; não apagar ocorrências antigas. |
| Question Card | question_card (0005/0008/0013/0019/0020/0029) | Reutilizar conteúdo; adaptar SRS ao comportamento escolhido e revisar flags ativo/ativa duplicadas. |
| Revisão do card | question_card_registro (0005/0008/0034) | Reutilizar avaliações/eventos; adaptar versionamento SRS e leitura de valores históricos conforme necessidade definida. |
| Revisão planejável | Composição de revisao_item, question_card e sessao; handler da Central | Adaptar como necessidade com atendimento explícito; não criar outro planner/registro de prática concorrente. |
| Simulado futuro | simulado/simulado_item (0006 e evoluções) | Reutilizar estruturas, adaptar integração factual apenas em fase futura; manter bloqueado. |
| Decisão | mentor_decisao/mentor_execucao (0013/0068), sessao.reason_codes (0066), conhecimento_modulo/contexto | Reutilizar auditoria; adaptar vínculo/contrato uniforme de decisão e fonte das regras, com um único Mentor. |

Não é necessário criar uma tabela de estatísticas como fonte concorrente: execução deriva de sessao/tempo_estudo; cobertura de material_progresso e currículo validado; prática de registro/question_card_registro e futuros eventos de simulado não duplicados. Domínio é inferência com evidência suficiente, não entidade factual preenchida por tempo ou aula. Sem evidência válida, permanece desconhecido; limiares não são definidos nesta fase.

## Sobreposições detectadas e tratamento futuro

1. **sessao versus tempo_estudo:** duracao_estimada, duracao_realizada e status não devem misturar planejamento com cronômetro. Finalizar timer e marcar entrega são ações diferentes.
2. **Progresso versus status de material/sessão:** aceito/recusado e texto/pendente_ocr tratam fonte; em_andamento/concluido tratam estudo; feita trata entrega.
3. **topico versus material_unidade_curricular:** falta correspondência explícita para identificar quais conteúdos uma fonte cobriu. Preservar IDs antigos; não preencher por catálogo externo.
4. **Ordem curricular:** ordem_estudo, ordem_curso e disciplina_curso convivem com materia_id; reconciliar por proveniência, não por renomeação que perca histórico.
5. **Revisão de questões:** questao.proxima_revisao/estado e revisao_item podem divergir. Definir quem governa estado e ocorrência, preservando tentativas separadas.
6. **Card:** frente/verso coexistem com resposta_direta/explicacao_curta; flags ativo/ativa e estado SRS coexistem. Definir representação canônica sem descartar fontes ou avaliações.
7. **Prática versus tempo:** registro.tempo e tempo_estudo podem medir o mesmo intervalo com finalidades distintas. Não somar indiscriminadamente ambos como tempo total de estudo.
8. **Simulado versus tentativa:** simulado_item guarda respostas, mas registro também é evento de prática; integração futura precisa impedir contagem dupla.
9. **Conhecimento/contexto/decisão:** mentor_conhecimento legado, conhecimento_modulo, defaults de código, objetivo.config e mentor_contexto não podem manter versões concorrentes da mesma política. conhecimento textual do material não equivale ao conhecimento decisório do Mentor.
10. **Auditoria e identidade:** razão na demanda e dados em mentor_decisao/mentor_execucao precisam ser rastreáveis sem dupla decisão; descanso_ate em app_usuario não é atributo conceitual de autenticação.

## Futuros candidatos a remoção ou desativação

Nenhuma entidade essencial listada pelo usuário é candidata a remoção. Candidatura abaixo é condicionada a conferir uso, dados e substituição, não permissão de DROP, exclusão de registros ou remoção de migrations.

| estrutura/campo histórico | candidatura e salvaguarda |
| --- | --- |
| mentor_conhecimento como fonte operacional | Desativar/remover somente a dependência operacional paralela; preservar histórico. Migrations 0062/0063 declaram inatividade, não confirmada no banco nesta análise. |
| Política quinzenal em acervo_ciclo_expansao/acervo_ciclo_item | Candidato a deixar de operar como regra; preservar ciclos/dados históricos. Não remover tabelas por idade. |
| Campos/flags agregados duplicados em questao/question_card | Candidato a remoção de redundância somente após escolher autoridade e confirmar consumidores; contadores/SRS úteis podem permanecer como projeções. |
| Regras históricas duplicadas em objetivo.config/conhecimento modular/defaults | Candidato a retirar políticas superadas da leitura operacional, não a apagar configurações/contextos válidos. |

Outras estruturas auxiliares de auditoria, relatos, edital, backup e falhas permanecem preservadas; não são agentes independentes nem novas entidades funcionais solicitadas. Ausência nesta lista de 17 entidades não comprova desuso. O modelo não autoriza anamnese, feedback Leve/Normal/Pesado ou novo sistema visual de estados.

## Pendências conceituais delimitadas

- Correspondência verificável material/unidade/conteúdo, respeitando o currículo real.
- Configuração Anki escolhida e dados necessários para rastrear o SRS.
- Vínculo explícito entre necessidade de revisão, tentativa/avaliação de atendimento, decisão e demanda.
- Integração futura de simulado com tentativa e tempo sem duplicação.

Essas pendências não exigem migração nesta subfase. O documento encerra somente a Fase 1.2; a próxima etapa não foi iniciada.
