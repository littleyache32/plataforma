# Mapa de transformação da Plataforma V1 para a V2

Data: 07/10/2026. Fase 1.6. Branch de referência: `v2`. HEAD: `bc36d01333ad94580704cbebf81872046605f8b8`.

## Escopo e critérios

Mapa documental baseado no [produto](produto.md), [domínio](dominio.md), [Mentor](mentor.md), [fontes de verdade](fontes-de-verdade.md) e [inventário V1](inventario-v1.md), confrontado com arquivos e rotas do checkout. Banco atual significa estruturas declaradas nas migrations, não confirmação do schema ou dos dados em produção. Não houve execução da aplicação, testes ou consulta ao banco nesta subfase.

- **MANTER:** preservar inicialmente a capacidade/interface, sem reforma própria.
- **REMODELAR:** adaptar a base, contratos e integrações úteis, preservando dados e regressões.
- **REESCREVER:** substituir uma implementação sem base reaproveitável demonstrada. Nenhuma área inteira exige isso neste mapa.
- **REMOVER:** retirar capacidade sem destino aprovado. Nenhuma das 12 áreas recebe essa classificação.
- **ADIAR:** preservar estruturas e histórico, sem implementar ou liberar a capacidade agora.

A classificação principal é por área. Preservar tabelas não obriga preservar regras históricas incompatíveis. As dependências indicam condições técnicas, não uma nova sequência de fases ou autorização para execução.

## Resumo

| área | classificação principal | direção |
| --- | --- | --- |
| Início | REMODELAR | Resumo factual complementar ao plano semanal. |
| Meu Plano | REMODELAR | Centro operacional semanal, com movimentação e preservação factual. |
| Conteúdos | REMODELAR | Organizar capacidade existente de currículo/material, sem reinventar catálogo. |
| Timer | REMODELAR | Aproveitar execução atual e correções preservadas da Fase 7. |
| Revisões | REMODELAR | Fila complementar e necessidades integradas ao plano único. |
| Questões | REMODELAR | Preservar itens/tentativas e adequar resposta, confiança e comentários. |
| Question Cards | REMODELAR | Recuperação ativa e SRS conforme configuração Anki a definir. |
| Estatísticas | REMODELAR | Derivar execução, cobertura e evidência de aprendizagem separadamente. |
| Mentor | REMODELAR | Um único motor determinístico, sem autoridades paralelas. |
| Faculdade | MANTER | Preservar interface inicial e integração com concurso. |
| Simulados | ADIAR | Preservar schema/histórico e bloqueio, sem ativação. |
| Offline/PWA | REMODELAR | Manter instalação e tornar persistência/sincronização seguras. |

## 1. Início

- **Arquivos atuais:** `src/components/Home.jsx`, `src/home-summary.js`, `src/App.jsx`; dados via `api/_lib/tempo-handler.js` e `api/_lib/sessoes-handler.js`.
- **Banco atual:** `sessao`, `tempo_estudo`, `objetivo`, `materia`; `material_progresso` e currículo como fontes para cobertura quando integrada.
- **Problemas:** resumo depende das mesmas fórmulas/filtros temporais que tempo e semana; leitura parcial não comprova sincronismo. `App.jsx` prepara semana com corte fixo em 05/10/2026 e ignora falha desse preparo. Início não deve assumir outra autoridade de planejamento.
- **Destino V2:** manter resumo e acesso ao trabalho semanal; derivar indicadores de fontes canônicas, distinguindo execução, cobertura e domínio desconhecido. Sem painel novo não solicitado.
- **Dependências:** contrato de Meu Plano, datas calendáricas consistentes, tempo e estatísticas reconciliados.

## 2. Meu Plano

- **Arquivos atuais:** `src/components/Week.jsx`, `src/App.jsx`, `api/_lib/plano-handler.js`, `api/_lib/sessoes-handler.js`, `api/mentor.js`, `api/cron/mentor.js`, `shared/planner.js`, `shared/material-progress.js`; roteamento em `api/planejamento.js` e `vercel.json`.
- **Banco atual:** `sessao`, `objetivo`, `materia`, `topico`, `material`, `material_progresso`, `compromisso`, `mentor_contexto`, `mentor_decisao`, `mentor_execucao`, `mentor_encontro_semanal`; campos de exclusão/cancelamento/provisoriedade declarados pela 0068.
- **Problemas:** coexistem caminhos de política/ciclo históricos; datas da Week dependem do dispositivo. Drag-and-drop existe, mas é necessário alinhar movimento entre dias com backend, replanejamento e exclusões. O checkout não liga a demanda ao módulo de tempo como o snapshot 7.2A. Reordenar visualmente não comprova persistência e preservação em recálculo.
- **Destino V2:** semana inteira como operação principal; mover e reordenar demandas, preservando IDs, concluídas, exclusões e histórico. Conteúdo pendente pode voltar sem dívida automática. O planner materializa a decisão do único Mentor, não define estratégia concorrente.
- **Dependências:** decisão/contexto canônicos, progresso de material, compromissos, timer por `sessao_id`, definição responsiva da semana. Preservar testes de planner e da Fase 6.

## 3. Conteúdos

- **Arquivos atuais:** não há `src/components/Contents.jsx` neste checkout nem área autônoma em `App.jsx`. Capacidade distribuída em `api/_lib/catalogo-handler.js`, `objetivos-handler.js`, `materiais-handler.js`, `estudo-handler.js`, `shared/material-progress.js`, `Week.jsx`; ferramentas em `scripts/import-study-materials.js`, `scripts/strategy-source-map.js` e `scripts/sync-strategy-curriculum.js`.
- **Banco atual:** `objetivo`, `materia`, `topico`, `material`, `material_unidade_curricular`, `material_progresso`; `edital_versao`/`edital_item` como estruturas relacionadas, não substitutos automáticos do material real.
- **Problemas:** currículo externo versus unidades reais, ordens concorrentes e correspondência material/tópico incompleta. Inventário 114 é fotografia, não constante. A ingestão histórica possui caminhos acoplados a geração/semântica; não devem virar requisito operacional da V2.
- **Destino V2:** reaproveitar currículo, importação pessoal, hashes, sequência e conclusão explícita. Separar sessão, progresso e conclusão. Uma futura apresentação de Conteúdos pode adaptar essa base; não presumir que a ausência de componente exige reescrever backend ou criar agora uma nova UI de estados.
- **Dependências:** correspondência curricular verificável, fontes privadas preservadas, contratos de progresso e objetivos. `Contents.jsx` útil está preservado em `archive/v1-local-pre-v2`, apenas candidato a comparação futura, sem importação automática.

## 4. Timer

- **Arquivos atuais:** `src/components/StudyTime.jsx`, `FocusTimer.jsx`, `src/api.js`, `api/_lib/tempo-handler.js`, `sessoes-handler.js`, `api/planejamento.js`; `tests/focus-timer.test.js`.
- **Banco atual:** `tempo_estudo`, `sessao`, vínculos com objetivo/matéria/tópico; estado, segundos e `descanso_ate` persistidos.
- **Problemas:** integração demanda/timer incompleta neste checkout; tempo derivado da demanda precisa reconciliação única. Registro manual usa meio-dia fixo; datas e resumo exigem Brasília. Descanso, transições e falhas possuem correções preservadas fora da V2. Não declarar aqui atomicidade ou suporte offline completo como ativos.
- **Destino V2:** uso livre com matéria e 30/50/personalizado em minutos; uso pelo plano aproveita contexto com mínima interação. Abrir não inicia; concluir timer não conclui demanda/material. Tempo real é factual e independente da estimativa. Reaproveitar correções de transições, duração, datas, descanso e alertas selecionadamente.
- **Dependências:** vínculo `sessao_id`, contratos de tempo/estado, schema compatível e testes. Snapshot `archive/v1-fase7-wip` preserva as correções; migration `0069_tempo_sessao_duracao_atomica.sql` e testes PostgreSQL estão fora do checkout atual e exigem incorporação/validação autorizadas, sem merge geral.

## 5. Revisões

- **Arquivos atuais:** `src/components/ReviewCenter.jsx`, `api/_lib/revisoes-handler.js`, `shared/practice.js`, `shared/cards.js`, `shared/planner.js`, `src/App.jsx`; rotas em `api/estudos.js`.
- **Banco atual:** `revisao_item`, `questao`, `registro`, `question_card`, `question_card_registro`, `sessao`.
- **Problemas:** datas da questão e ocorrências da fila podem concorrer; card vencido e demanda precisam vínculo de atendimento sem dupla contagem. A Central atual é lista de urgência, sem contrato completo de estados/vínculos de todas as origens futuras. Abrir pela fila não prova que a necessidade foi atendida.
- **Destino V2:** revisão no planejamento; Central como visão complementar de necessidades, não outro plano. O Mentor escolhe questões ou cards conforme regra/evidência, sem exigir ambos. Preservar histórico e distinguir agendamento de execução, inclusive reaparecimento distante.
- **Dependências:** origem canônica da necessidade, tentativas/avaliações, configuração SRS, decisão do Mentor e vínculo ao plano. Não criar segunda fila concorrente nem ativar fontes inexistentes.

## 6. Questões

- **Arquivos atuais:** `src/components/Questions.jsx`, `api/_lib/pratica-handler.js`, `questoes-handler.js`, `questions.js`, `shared/practice.js`, `shared/question-quality.js`, `shared/question-distribution.js`, `shared/study-access.js`; `api/estudos.js`.
- **Banco atual:** `questao`, `registro`, `revisao_item`, `relato_questao`, `questao_auditoria`, `materia`, `topico`.
- **Problemas:** gate com data histórica; contadores/estado da questão não são história canônica. `registro` não guarda hoje alternativa escolhida para reconstrução completa. A UI pode ocultar explicação por classificação, contrariando o contrato de comentários após confirmação. Tempo por item não deve ser somado novamente ao mesmo intervalo de timer.
- **Destino V2:** adaptar fluxo existente; confiança junto à resposta com Sem conhecimento, Eliminação, Dúvida, Certeza. Após confirmação, gabarito comentado e comentários das alternativas quando aplicáveis. Preservar itens, proveniência, relatos e tentativas, sem inferir domínio de um acerto.
- **Dependências:** conteúdo/tópicos válidos, autorização explícita de prática, contrato factual de tentativa, revisões e estatísticas. Geradores antigos não definem ordem de resolução nem autorizam criação de acervo.

## 7. Question Cards

- **Arquivos atuais:** `src/components/QuestionCards.jsx`, `api/_lib/questoes-handler.js`, `shared/cards.js`, `shared/card-content.js`, `shared/card-quality.js`; `tests/cards.test.js` e validadores de qualidade.
- **Banco atual:** `question_card`, `question_card_registro`, `relato_card`, `question_card_auditoria`; relações com matéria/tópico/objetivo e questão quando existente.
- **Problemas:** `ativo`/`ativa` e campos de resposta sobrepostos; SRS atual não equivale automaticamente à configuração Anki desejada. Eventos não guardam toda a configuração/estado para replay fiel. Dados e avaliações antigos precisam continuar interpretáveis.
- **Destino V2:** preservar conteúdo e recuperação ativa; avaliações 1 Novamente, 2 Difícil, 3 Bom, 4 Fácil. Cards de conteúdo ou corretivos não exigem questão de origem. Adaptar SRS após escolha explícita de comportamento/configuração Anki, sem presumir algoritmo ou reescrever todo o módulo.
- **Dependências:** escolha Anki pendente, conteúdo/flag canônicos, eventos e versão de cálculo, autorização de prática e integração de revisão/estatísticas.

## 8. Estatísticas

- **Arquivos atuais:** `src/components/Performance.jsx`, `src/home-summary.js`, `api/_lib/placar-handler.js`, `api/_lib/tempo-handler.js`, `api/mentor.js`, `shared/mentor.js`; `api/desempenho.js`.
- **Banco atual:** agregações de `sessao`, `tempo_estudo`, `material_progresso`, currículo, `registro`, `question_card_registro`; decisões como origem de explicações, não fatos de desempenho.
- **Problemas:** totais/caches concorrentes, risco de dupla contagem e amostra insuficiente. Execução/cobertura não comprovam domínio; ausência de prática não pode virar nota zero. Janela temporal e filtros precisam ser uniformes.
- **Destino V2:** adaptar APIs/gráficos úteis com fórmulas rastreáveis; separar execução, cobertura e aprendizagem sustentada por evidência. Estatísticas derivam fatos e informam o Mentor, sem alterar história para ajustar indicadores.
- **Dependências:** duração reconciliada, calendário Brasília, currículo/progresso e tentativas/avaliações canônicas; thresholds e critérios de suficiência ainda a definir.

## 9. Mentor

- **Arquivos atuais:** `shared/mentor.js`, `mentor-policy.js`, `mentor-decision.js`, `mentor-specialists.js`, `planner.js`, `study-access.js`; `api/mentor.js`, `api/_lib/module-knowledge.js`, `plano-handler.js`, `api/cron/mentor.js`, `src/components/MentorWidget.jsx`.
- **Banco atual:** `conhecimento_modulo`, `mentor_contexto`, `mentor_decisao`, `mentor_execucao`, `mentor_encontro_semanal`; `mentor_previsao`/`mentor_experimento` como estruturas existentes a avaliar; `mentor_conhecimento` como legado histórico, não fonte operacional pretendida.
- **Problemas:** defaults repõem políticas históricas; datas/limiares e montagem de decisões se repetem. Terminologia de especialistas V1 não é arquitetura definitiva V2. Feedback Leve/Normal/Pesado não pertence ao escopo atual, embora exista no legado.
- **Destino V2:** um único motor determinístico. Reutilizar cálculos úteis de `mentor-specialists.js` como funções/domínios internos sem autoridade independente; consolidar policy/contexto/decisão, reason codes e fallback conservador. Nenhuma dependência operacional de LLM ou memória textual.
- **Dependências:** fontes canônicas, inputs estruturados, política versionada, parâmetros ainda por definir, plano e logs vinculados. Mudança de nome/organização não exige novos agentes, tabelas ou reescrita total.

## 10. Faculdade

- **Arquivos atuais:** contexto em `src/App.jsx`/`Layout.jsx`, `Week.jsx`, `MentorWidget.jsx`; `api/_lib/objetivos-handler.js`, `catalogo-handler.js`, `materiais-handler.js`, `estudo-handler.js`; funções acadêmicas em `shared/planner.js`/`mentor-specialists.js`; `scripts/import-current-faculty-sources.js`.
- **Banco atual:** objetivos/matérias/tópicos acadêmicos, `compromisso`, `compromisso_topico`, `material`, `material_progresso`, `sessao`, `tempo_estudo`, contexto.
- **Problemas:** horários, provas e aulas são fatos mutáveis, não calendário hardcoded; aula dada não prova estudo/conclusão. Scripts de fontes específicas não definem currículo permanente. A Faculdade compartilha componentes, não possui módulo autônomo completo a reescrever.
- **Destino V2:** manter interface inicialmente e preservar histórico/vínculos acadêmicos. Coexistir com concurso, que permanece prioridade estrutural. Ajustes nos componentes compartilhados devem preservar esse contrato, sem criar carga ou formulário acadêmico novos por inferência.
- **Dependências:** calendário confirmado, progresso canônico, plano e decisão única. MANTER não congela bugs de integração nem autoriza reformulação visual própria.

## 11. Simulados

- **Arquivos atuais:** `src/components/Simulations.jsx`, `api/_lib/simulados-handler.js`, `api/desempenho.js`; elegibilidade histórica em `shared/mentor.js` e testes correspondentes.
- **Banco atual:** `simulado`, `simulado_item`, vínculos com objetivos/matérias/questões.
- **Problemas:** frontend atual é placeholder bloqueado, não fluxo completo. Regra histórica por data não autoriza liberação; futura integração precisa evitar tentativas/tempo duplicados.
- **Destino V2:** ADIAR implementação e ativação. Preservar bloqueio, schema, rotas necessárias e dados históricos; definir futuramente evento, execução e estatísticas no mesmo modelo, sem apagar tabelas porque a tela é placeholder.
- **Dependências:** prática estabilizada e autorizada, acervo válido, registro de tentativas, timer/estatísticas e regras futuras explícitas. Nenhum desbloqueio automático neste mapa.

## 12. Offline/PWA

- **Arquivos atuais:** `src/api.js`, `src/components/OfflineStatus.jsx`, `src/main.jsx`, `public/sw.js`, `public/manifest.webmanifest`, `public/mentor-icon.svg`; configuração de entrada em `index.html`.
- **Banco atual:** fila/cache no IndexedDB; servidor persiste fontes factuais e `operacao_id` nos contratos que o suportam. IndexedDB pendente não equivale a confirmação do banco.
- **Problemas:** sincronização usa `replaceQueue()` com `clear()`, permitindo perder operação adicionada durante envio; descarte de 4xx e sincronizações paralelas exigem proteção. `OfflineStatus` chama online de Sincronizado sem verificar pendências. Cache/SW requer compatibilidade com autenticação e invalidação; persistência local do timer ainda não está integralmente incorporada.
- **Destino V2:** manter PWA e adaptar fila por identidade persistente, operação estável e confirmação individual. Pendência/falha visível e compatibilidade com itens antigos. Recuperar correções úteis do snapshot, sem arquitetura distribuída, background artificial ou promessa de alerta exato com navegador fechado.
- **Dependências:** contratos idempotentes do backend, compatibilidade IndexedDB, estado confirmado/local do timer e testes de falha/retry. `shared/offline-content.js` é geração sintética histórica, não implementação da fila offline.

## Limites de remoção e reescrita

Nenhuma área inteira será removida ou reescrita com base nesta análise. Regras históricas concorrentes, gates por data, feedback excluído e geração automática sem autorização devem deixar de governar a V2 nas etapas pertinentes. Isso não autoriza apagar histórico, migrations aplicadas, endpoints conectados ou fatos de estudo.

Código sem consumidor só pode ser removido após verificação específica de importações, rotas, scripts e finalidade. Este mapa não converte candidatos do inventário em exclusões aprovadas. Capacidades futuras e componentes conectados não são código morto por estarem bloqueados.

## Preservação e pendências

- Comparar capacidades úteis dos snapshots `archive/v1-fase7-wip` e `archive/v1-local-pre-v2` antes de reimplementar, sem merge indiscriminado.
- Preservar todas as migrations históricas e verificar schema/dados reais apenas em etapa autorizada. Não presumir que o checkout espelha produção.
- Definir apresentação da semana no mobile, configuração Anki e critérios numéricos da policy antes das respectivas implementações.
- Reaproveitar testes válidos; expectativas históricas não obrigam a reativar políticas superadas. Nenhum teste, lint ou build foi executado nesta subfase documental.
- Apenas este mapa foi criado. Sem código funcional, banco, migrations, dados, commit, push ou deploy. Encerrar a Fase 1.6 sem iniciar outra etapa.
