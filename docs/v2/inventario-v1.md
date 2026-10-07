# Inventário da Plataforma V1 para a V2

## Escopo e evidência

Data: 06/10/2026. Branch analisada: `v2`. HEAD: `801abb958eb9aecc77a89a2196f696c588763938`.

Inventário estático dos 210 arquivos versionados: 22 em src, 29 em api, 14 em shared, 3 em public, 36 em scripts, 22 em tests, 6 em docs, 69 migrations e 9 arquivos da raiz. Este documento é adicional a esses totais.

Foram examinados arquivos, importações, roteadores, comandos do package.json, configurações e migrations. Não houve execução de scripts operacionais, testes, build, acesso ao banco ou validação de produção. Afirmações anteriores de aplicação de migrations e publicação são registros históricos, não verificações novas.

Classificações indicam ações futuras, não autorização para excluir, mover, executar ou reativar arquivos:

- **A: MANTER NA V2**, estrutura útil a preservar.
- **B: MANTER, MAS REMODELAR**, preservar a capacidade e seus dados, adequando contratos ou regras posteriormente.
- **C: ARQUIVAR COMO HISTÓRICO V1**, preservar evidência e implementação histórica; não usar como regra vigente. Arquivamento de código conectado exige antes substituir ou desativar consumidores explicitamente.
- **D: REMOVER POR SER LEGADO SEM UTILIDADE**, somente candidatos cuja falta de utilidade possa ser comprovada. Nenhum arquivo inteiro de código recebeu aprovação de remoção nesta análise.

## Frontend: src/

| arquivo/área | classificação | motivo | ação futura |
| --- | --- | --- | --- |
| src/main.jsx | A | Entrada referenciada pelo index.html; inicializa React, estilos, SW e sincronização. Não é morto por não ter importadores JS. | Preservar inicialização e revisar integração offline quando autorizada. |
| src/App.jsx | B | Coordena módulos e targets existentes. Preparação inicial contém corte fixo em 05/10/2026; target da Semana é apenas consumido/limpo no fluxo atual. | Centralizar referência de ciclo; revisar estado sem produtor antes de remover apenas esse estado. Reutilizar navegação, sem novo estado global desnecessário. |
| src/api.js | B | Contratos HTTP, autenticação e IndexedDB úteis. A versão V2 atual não incorpora integralmente as correções recentes da fila/timer. | Preservar compatibilidade de itens existentes; avaliar reutilização isolada do snapshot 7.x. |
| src/components/AccessGate.jsx | A | Conta pessoal e entrada conectadas à aplicação. | Manter autenticação pessoal e proteções, sem arquitetura SaaS. |
| src/components/Layout.jsx; src/components/Icon.jsx | B | Navegação desktop/mobile e sistema de ícones efetivamente usados. | Preservar acessibilidade e navegação; adequar apresentação na fase visual. |
| src/components/Home.jsx; src/home-summary.js | B | Resumo ligado a dados reais de estudo e planejamento. | Preservar histórico; separar execução, cobertura e domínio desconhecido. |
| src/components/Week.jsx | B | Semana, demandas, exclusões e conclusão são centrais. | Preservar IDs/histórico e integrar apenas correções aprovadas de data, alvo do timer e planejamento. |
| src/components/StudyTime.jsx; src/components/FocusTimer.jsx | B | Timer, tempo manual, descanso e histórico são usados; melhorias locais recentes estão no arquivo da Fase 7. | Comparar contratos e recuperar trabalho útil controladamente; não confundir timer concluído com demanda/material concluídos. |
| src/components/MentorWidget.jsx; src/assets/mentor-avatar.svg | B | Interface do Mentor, encontro e identidade usados. | Manter fatos do encontro e explicações determinísticas; eliminar dependência de descrições históricas de fase. |
| src/components/Questions.jsx; src/components/QuestionCards.jsx | B | Módulos conectados e lógica de prática existente, mesmo com prática bloqueada. | Preservar contratos, tentativas, confiança e avaliações; não liberar nem gerar prática nesta etapa. |
| src/components/ReviewCenter.jsx; src/components/Performance.jsx | B | Revisões e estatísticas conectadas; úteis à futura V2. | Preservar registros; distinguir estados de revisão e cobertura de domínio. |
| src/components/Simulations.jsx; src/components/DiscursiveQuestions.jsx | B | Placeholders bloqueados, importados pelo App e presentes na navegação. Não são arquivos mortos. | Manter bloqueio e contratos futuros; não implementar funcionalidades agora. |
| src/components/OfflineStatus.jsx | B | Usado pelo Layout; informa sincronização. | Recuperar apresentação fiel de pendências/falhas da fila quando aprovada. |
| src/styles.css; src/product-theme.css | B | Ambos carregados pelo main, com sobreposição de estilos. | Consolidar linguagem visual sem remover estilos usados nem antecipar reforma visual. |

## Backend: api/

| arquivo/área | classificação | motivo | ação futura |
| --- | --- | --- | --- |
| api/auth.js; api/_lib/http.js; api/_lib/supabase.js | A | Autenticação pessoal, cookies, guardas e acesso ao Supabase são infraestrutura necessária. | Preservar proteção e isolamento de credenciais; revisar somente símbolos legados identificados abaixo. |
| api/estudos.js; api/planejamento.js; api/desempenho.js; api/admin.js | B | Entradas serverless e despachantes conectados aos rewrites. Ausência de importadores não comprova desuso de endpoint. | Preservar rotas/contratos; separar manutenção pessoal de geração histórica sem criar painel administrativo complexo. |
| api/mentor.js; api/cron/mentor.js; api/_lib/plano-handler.js | B | Leitura de sinais, encontro, cron e geração de plano são operacionais. Há montagem paralela de inputs/explicações. | Unificar contrato da decisão, mantendo encontro, fallback, idempotência e histórico; cron não deve gerar acervo. |
| api/_lib/module-knowledge.js | B | Carrega conhecimento modular ativo com cache e fallback. | Tornar origem/versão explícitas; impedir fallback histórico concorrente com contexto vigente. |
| api/_lib/catalogo-handler.js; api/_lib/objetivos-handler.js | A | Currículo, objetivos, matérias e compromissos necessários. | Preservar vínculos e calendário real. |
| api/_lib/materiais-handler.js; api/_lib/estudo-handler.js | B | Materiais, fontes, progresso e estudo ligados ao currículo; importação antiga possui dependências semânticas. | Separar ingestão/progresso de geração; preservar hash, OCR pendente e conclusão explícita. |
| api/_lib/sessoes-handler.js; api/_lib/tempo-handler.js | B | Sessão e tempo reais precisam sobreviver à V2. | Reutilizar melhorias 7.x após revisão isolada e alinhamento com schema; não apagar duração/histórico. |
| api/_lib/pratica-handler.js; api/_lib/questoes-handler.js; api/_lib/questions.js | B | Prática, registros e formatos de questões usados pelas rotas. | Preservar dados e validações; substituir portas históricas de acesso por autorização vigente. |
| api/_lib/revisoes-handler.js; api/_lib/placar-handler.js; api/_lib/simulados-handler.js | B | Revisão, estatísticas e contratos de simulado úteis mesmo quando bloqueados. | Preservar histórico; não executar resets nem liberar modalidades por data antiga. |
| api/_lib/painel-handler.js; api/_lib/edital-handler.js | B | Manutenção, diagnóstico/backup e edital têm utilidade técnica. Não equivalem a interface administrativa solicitada. | Manter acesso pessoal protegido, operações explícitas e rotas necessárias. |
| api/_lib/seed-handler.js; api/_lib/acervo-handler.js; api/_lib/rebuild-handler.js | C | Cadeia antiga de geração/reconstrução efetivamente conectada ao admin/seed. Não é código morto. | Preservar histórico; antes de arquivar fisicamente, tratar rotas, comandos e dependências. Nunca executar para inventariar. |
| api/_lib/gemini.js | B | Adaptador usado pela geração/importação histórica, não pelo núcleo determinístico do Mentor. | Manter separação semântica opcional; não introduzir LLM no caminho crítico. |

## Regras compartilhadas: shared/

| arquivo/área | classificação | motivo | ação futura |
| --- | --- | --- | --- |
| shared/material-progress.js | A | Regra comum de progresso/conclusão consumida por estudo e planner. | Preservar fonte canônica: sessão concluída não implica material concluído. |
| shared/mentor-decision.js; shared/mentor-specialists.js | B | Motor determinístico e seis calculadores de sinais existentes. | Preservar arquitetura/reason_codes; ajustar inputs/policy sem criar especialistas paralelos. |
| shared/mentor-policy.js; shared/mentor.js; shared/planner.js | B | Decisão, descrição de fase e planejamento contêm regras novas e caminhos históricos. | Consolidar conforme mapa de duplicidades abaixo; preservar idempotência, bloqueios e seleção curricular. |
| shared/study-access.js | B | Elegibilidade conectada à prática, mas contém data histórica de acesso. | Manter autorização explícita do contexto como autoridade; retirar concorrência temporal em fase própria. |
| shared/practice.js; shared/cards.js | A | Tentativas, confiança e revisão de cards têm contratos/testes úteis. | Preservar sem ativar prática antecipadamente. |
| shared/question-quality.js; shared/question-distribution.js; shared/card-quality.js; shared/card-content.js | A | Validação, distribuição e estrutura de conteúdo usadas por handlers, scripts e testes. | Preservar algoritmos úteis; distinguir composição do acervo da ordem de resolução. |
| shared/offline-content.js | B | Utilitário de conteúdo sintético da geração histórica; não é a fila offline/PWA. | Separar validadores reaproveitáveis dos geradores históricos; não reutilizar fabricação de conteúdo sem fonte. |

## PWA: public/

| arquivo/área | classificação | motivo | ação futura |
| --- | --- | --- | --- |
| public/sw.js | B | Service worker registrado; cache de app e algumas respostas API. | Revisar escopo de caches, autenticação e invalidação; cache V1 e remoção ampla de caches merecem cuidado. Não substituir por projeto de notificações fechadas. |
| public/manifest.webmanifest; public/mentor-icon.svg | A | Manifesto e identidade referenciados pelo HTML/SW. | Preservar instalação e adaptar identidade somente quando solicitado. |

## Scripts: scripts/

| arquivo/área | classificação | motivo | ação futura |
| --- | --- | --- | --- |
| scripts/import-study-materials.js | A | Pipeline pessoal PDF/ZIP com hash, duplicidade e metadados, sem geração de prática; aplicação explícita. | Preservar caminho simples, auditável e protegido para materiais novos. |
| scripts/audit-git-secrets.js | A | Verificação útil de segurança do Git. | Preservar e executar apenas quando necessário; não expor valores. |
| scripts/migrate.js | B | Runner real registra nome completo da migration e transação por arquivo. | Preservar histórico; rever segurança da conexão/ambiente antes de uso. Não executar nesta fase. |
| scripts/lint.js | B | Verificação local útil, mas proibição geral de localStorage pode conflitar com persistência legítima dos alertas 7.x. | Adequar regra por responsabilidade quando o trabalho for incorporado; não rodar agora. |
| scripts/strategy-source-map.js | B | Mapeamento de fontes usado por várias ferramentas; coexistem catálogo histórico e organização real. | Preservar proveniência e separar correspondência histórica de fonte curricular vigente. |
| scripts/sync-strategy-curriculum.js; scripts/audit-strategy-extracted.js; scripts/analyze-strategy-coverage.js | B | Reconciliação e inspeção de materiais úteis; defaults apontam para extração datada em tmp. | Parametrizar inventário vigente e não inventar conteúdo para completar catálogo externo. |
| scripts/import-current-faculty-sources.js | B | Importação de fontes acadêmicas útil, ligada a caminhos/conjunto específicos. | Preservar hashes/OCR; parametrizar conjunto e separar dados pessoais do Git. |
| scripts/audit-coverage.js; scripts/profile-production.js | B | Consultas de cobertura/performance reutilizáveis, com pressupostos de V1. | Adequar métricas à fonte curricular real; escolher ambiente explicitamente. |
| scripts/audit-and-adapt-library.js; scripts/audit-and-adapt-cards.js | B | Validadores úteis, porém alteram dados sem --dry-run; nome audit não significa somente leitura. | Separar relatório de mutação e exigir aplicação explícita em eventual remodelagem. |
| scripts/backup-bacen-catalog.js | B | Backup/exportação útil de dados essenciais. | Generalizar escopo pessoal e proteger outputs; restauração exige validação própria. |
| scripts/export-study-materials.js; scripts/export-textbooks.py | B | Exportadores úteis, mas saídas podem conter materiais protegidos/dados pessoais. | Preservar ferramenta e manter conteúdos fora do Git; revisar caminhos e finalidade. |
| scripts/extract-strategy-zips.py; scripts/extract-study-zip.ps1; scripts/render-study-pdfs.py; scripts/verify-study-pdfs.py | B | Extração e verificação manual de materiais, sem necessidade de interface administrativa. | Reutilizar com entradas explícitas e arquivos protegidos; ausência de importador não prova desuso de CLI. |
| scripts/simulate-mentor-trajectory.js | B | Simulação útil com início histórico padrão em agosto. | Parametrizar ciclo e separar cenários históricos de regras vigentes. |
| scripts/acervo-specs.js | C | Catálogo antigo usado por acervo/rebuild/geradores; não é desconectado. | Preservar para interpretar V1; não impor catálogo à coleção real de PDFs. |
| scripts/build-complete-library.js; scripts/generate-production-library.js; scripts/rebuild-production-library.js | C | Geração/reconstrução histórica e metas por tópico; conectados a comandos npm. | Arquivar implementação e comandos conjuntamente após tratamento das dependências; não executar. |
| scripts/expand-requested-batch.js | C | Lote histórico 300 questões/600 cards não define produto vigente. | Preservar solicitação histórica, sem reativar expansão automática. |
| scripts/expand-offline-library.js | C | Geração de acervo sintético; offline aqui não significa sincronização de estudo. | Não confundir com PWA; arquivar geração mantendo validadores úteis. |
| scripts/normalize-exact-library.js | C | Força 100 questões/20 cards por tópico e preenche por catálogo antigo. | Não usar normalização de volume como substituto de qualidade/proveniência. |
| scripts/import-strategy-library.js; scripts/fill-bacen-question-gaps.js | C | Importação antiga acoplada à geração de questões/cards e preenchimento de lacunas externas. | Preservar histórico e extrair somente partes comprovadamente úteis, sem geração automática. |
| scripts/import-curated-bacen.js | C | Importador de coleção anterior com pastas e correções curriculares específicas. | Preservar proveniência/curadoria; não impor essa coleção ao currículo atual. |
| scripts/audit-strategy-production.js | C | Exige números históricos: 114 materiais, 6.300 questões, 1.250 cards e catálogo específico. | Manter como evidência datada; validação V2 deve ler inventário vigente, não essas constantes. |
| scripts/audit-question-expansion.js | C | Auditoria de tabela/ciclos de expansão históricos. | Preservar relatório histórico, sem transformar expansão quinzenal em política atual. |
| scripts/audit-production.js | C | Teste antigo cria compromisso, gera plano de agosto e apaga registros no cleanup; login também usa contrato antigo. | Não executar como inspeção segura. Preservar evidência e substituir futuramente por testes isolados. |
| scripts/relabel-curricular-demands.js | C | Correção pontual de títulos vinculada ao ciclo de 02/10. | Preservar histórico; não reexecutar indiscriminadamente. |
| scripts/build-empty-platform-package.js | C | Exporta outra instalação e transforma políticas/datas por substituição textual. Não é necessário à plataforma pessoal. | Arquivar ferramenta e comando template; não aplicar transformações à V2. |

As metas antigas de 30/50 por tópico, lote 300/600, quantidades exatas por tópico e expansão quinzenal não substituem a decisão posterior de meta final de 10.000 aprovadas, crescimento de até 500 aprovadas/semana com prioridade de qualidade e composição 60/30/10. Essa decisão é referência histórica mais recente sobre acervo, não autorização de geração na Fase 0.3 nem definição completa da V2.

## Testes: tests/

| arquivo/área | classificação | motivo | ação futura |
| --- | --- | --- | --- |
| tests/auth.test.js; tests/questions.test.js; tests/cards.test.js; tests/practice.test.js | A | Protegem autenticação, contratos e prática já existente. | Preservar regressões; adaptar somente contratos deliberadamente alterados. |
| tests/quality.test.js; tests/question-distribution.test.js; tests/strategy-curriculum.test.js | A | Qualidade, distribuição e currículo/material possuem verificações úteis. | Preservar proveniência e conclusão canônica; números de fixture não devem virar constantes do produto. |
| tests/mentor-decision.test.js; tests/mentor-specialists.test.js; tests/planner.test.js; tests/mentor.test.js | B | Protegem motor/sinais/plano, mas combinam cenários históricos e vigentes. | Preservar cenários válidos; isolar expectativas obsoletas, sem perder regressões. |
| tests/phase6-meeting.test.js; tests/phase6-meeting-api.test.js | A | Evidência controlada do encontro, replanejamento e integridade. | Preservar fechamento da Fase 6 e seus casos, sem retestar produção mutante. |
| tests/focus-timer.test.js; tests/home-summary.test.js | B | Cobertura atual de timer/resumo é útil, anterior a partes recentes da Fase 7. | Manter e complementar com testes do snapshot conforme incorporação aprovada. |
| tests/frontend-scope.test.js; tests/serverless-architecture.test.js | B | Protegem escopo pessoal e arquitetura/rotas, incluindo checagens textuais. | Revisar expectativas junto à V2, não apagar para aceitar mudança indevida. |
| tests/policy-consistency.test.js; tests/expansion-policy.test.js | B | Verificam coerência de política, incluindo saneamento de regras antigas. | Manter garantias úteis; não reativar expansão histórica para satisfazer teste. |
| tests/study-access.test.js; tests/simulation-eligibility.test.js | B | Ainda exercitam datas históricas de desbloqueio. | Arquivar expectativas superadas e manter bloqueios/autorização explícita como regressão vigente. |
| tests/offline-content.test.js | B | Testa geração/qualidade de conteúdo, não fila IndexedDB. | Preservar validadores úteis; separar cenários do gerador V1 histórico. |

Nenhum teste foi executado nesta subfase. Os resultados de fases anteriores não são apresentados como execução atual.

## Documentação: docs/

| arquivo/área | classificação | motivo | ação futura |
| --- | --- | --- | --- |
| docs/memoria-operacional.md | B | Decisões e histórico indispensáveis, mas texto vigente ainda mistura ciclos e contém fechamento antigo da Fase 6. | Separar contexto V2 de histórico V1, preservando decisões e correções posteriores; não tratar pendências antigas como diagnóstico atual. |
| docs/fase-2-notas.md | B | Procedimentos úteis de currículo/material e importação. | Reaproveitar instruções técnicas e atualizar pressupostos quando necessário. |
| docs/fase-2-validacao-conclusoes.md | C | Relatório datado útil como evidência de preservação de conclusões. | Arquivar como validação V1 sem apagar histórico. |
| docs/mentor-fase-1-consolidacao.md | C | Justifica conhecimento/contexto e consolidação passada. | Preservar decisões úteis como referência, não como segunda política executável. |
| docs/roteiro-consolidado-mentor.md | C | Sequência V1 e roteiro conceitual antigo; não são o roadmap operacional V2. | Arquivar como roteiro V1, preservando critérios reaproveitáveis; não inventar roadmap V2 nesta fase. |
| docs/auditoria-acervo-2026-08-10.md | C | Fotografia histórica do acervo e suas metas. | Preservar evidência datada, não usar como inventário atual. |
| docs/v2/inventario-v1.md | A | Documento desta subfase, com classificação e limites. | Usar como base de decisões posteriores, sem autorizar limpeza automaticamente. |

## Banco e migrations

| arquivo/área | classificação | motivo | ação futura |
| --- | --- | --- | --- |
| supabase/migrations/0001 até 0068, todos os 69 arquivos atuais | A | História de schema e dados, incluindo versões antigas, saneamentos e correções. Idade não torna migration removível. | Preservar nomes/conteúdo; verificar aplicação real antes de qualquer mudança futura. Não reaplicar resets. |
| supabase/migrations/0056_ocultar_semanas_anteriores_ao_reinicio.sql; supabase/migrations/0056_retomada_21_setembro.sql | A | Dois arquivos têm prefixo 0056; runner identifica nome completo. | Não renumerar arquivo aplicado; registrar cuidado de ordenação e identidade. |
| Migrations 0023, 0039, 0045, 0054 e ciclos de agosto/setembro | A | Catálogo antigo, resets e expansão fazem parte da história, mesmo com políticas superadas. | Preservar arquivo; impedir que dados históricos governem operação nova. |
| Migrations 0060 a 0068 | A | Progresso, contexto, currículo, aula acadêmica, decisão, especialistas e encontro são estruturas a preservar. | Confirmar estado real do schema/dados em fase autorizada, sem presumir divergência ou conformidade. |
| conhecimento_modulo | B | Fonte prevista de conhecimento permanente/policy dos módulos. | Preservar versões e identificar exatamente versão ativa por módulo; evitar estratégia duplicada no fallback. |
| mentor_contexto | A | Fonte prevista de contexto mutável, encontro, carga e disponibilidade. | Preservar contexto/histórico; atualizar apenas por fluxo autorizado. |
| mentor_conhecimento | C | Legado desativado pelas migrations 0062/0063, útil como histórico. | Preservar registros; não reativar como fonte concorrente. Inatividade real não foi consultada agora. |
| material/material_progresso/material_unidade_curricular, currículo, sessao, tempo_estudo e relações | A | Materiais, execução e histórico são dados essenciais. | Preservar IDs, vínculos, exclusões e progresso; não resetar curso ou histórico. |
| Questões, cards, revisões, tentativas, estatísticas, decisões e encontros | A | Estruturas úteis mesmo com prática bloqueada ou tabelas vazias. | Preservar contratos/dados e gates de autorização; não gerar acervo. |

## Raiz e arquivos locais

| arquivo/área | classificação | motivo | ação futura |
| --- | --- | --- | --- |
| AGENTS.md; .gitignore; .env.example | A | Instruções, proteção de arquivos e contrato de ambiente. | Preservar; exemplo deve conter somente placeholders, nunca segredos. |
| README.md | B | Documentação de uso e manutenção, com comandos V1 históricos. | Separar comandos seguros de ações mutantes/obsoletas. |
| package.json; package-lock.json | B | Dependências e reprodução do ambiente necessárias; scripts incluem geradores históricos. | Preservar lock; revisar comandos junto ao arquivamento, sem limpeza de dependências por suposição. |
| index.html; vite.config.js | A | Entrada, compilação e configuração de testes existentes. | Preservar contratos de execução. |
| vercel.json | B | Rewrites, funções e agendamento usados. | Preservar rotas e revisar publicação/agendamento da V2 em fase própria; sem deploy nesta etapa. |
| output/; plataforma-estudos-auditoria.zip | C | Artefatos locais não versionados já existentes antes desta análise; potencial evidência/backup. | Preservar por enquanto. Avaliar conteúdo/proteção antes de arquivar ou excluir; não são código-fonte. |
| .env*, credenciais locais, PDFs pagos, uploads e extrações de materiais | A, preservação privada fora do Git | Podem ser úteis e sensíveis, mas não devem ser commitados/publicados. | Não ler/expor valores; manter separadamente em armazenamento seguro. Não confundir tmp com lixo sem verificar conteúdo. |
| node_modules/, dist/build, caches e temporários comprovadamente regeneráveis | D, candidatos futuros | Outputs reproduzíveis não constituem fonte V2. Não inclui automaticamente todos os arquivos de tmp/output. | Só remover quando autorizado e após verificar alvo e ausência de material/histórico útil. Nada removido agora. |

## Regras do Mentor: duplicidades e conflitos potenciais

| arquivo/área | classificação | motivo | ação futura |
| --- | --- | --- | --- |
| shared/mentor-policy.js: defaults + resolveMentorPolicy; conhecimento_modulo; migration 0063 | B | A migration remove chaves históricas do JSON, mas merge com defaults pode recolocar fase_inicial, reinicio, retomada e adaptacao_estudo. Remover chave no banco não elimina fallback de código. | Distinguir fallback seguro de política histórica; comprovar caminho usado antes de afirmar impacto em produção. |
| shared/mentor-policy.js: progressao_carga e motor_decisao; shared/planner.js: ajuste legado; shared/mentor-decision.js | B | Limiares 70/85 e progressão existem em mais de uma representação/caminho. | Policy vigente única; caminhos históricos explicitamente isolados, sem decisão concorrente. |
| shared/planner.js: datas de ciclo; mentor_contexto; shared/mentor.js: mentorPhase/mentorCycleState | B | Datas/etapas e descrição do estado coexistem no código e no contexto. | Contexto define ciclo real; funções devem interpretar o mesmo estado, sem escada histórica automática. |
| shared/study-access.js; flags de mentor_contexto; handlers de prática | B | Data antiga 31/08 ainda é um gate adicional, embora flags atuais também sejam consultadas. | Não afirmar liberação atual só pela data; substituir concorrência por gate explícito único em etapa autorizada. |
| shared/mentor.js: simulationEligibility; tests/simulation-eligibility.test.js | C, regra histórica dentro de arquivo B | Função permite elegibilidade por 07/09 com critérios antigos; referências encontradas em testes e exportador, não no fluxo operacional atual. | Preservar histórico; não usar para liberar simulados na V2. |
| api/mentor.js; api/_lib/plano-handler.js | B | Montam dados e calculam sinais para apresentação/plano em caminhos diferentes. | Alinhar contrato de inputs/sinais/decisão e explicação; evitar divergência entre plano e interface. |
| api/_lib/module-knowledge.js; migrations 0066/0067 | B | Policy central e seis especialistas já existem; cache e seleção de registros ativos afetam origem. | Preservar seis módulos; explicitar versão e resolver conflitos no Mentor principal. |
| Regras antigas de acervo em migrations/geradores e testes | C para política; A para história SQL | Expansão quinzenal e metas exatas antigas permanecem em artefatos históricos. | Não reativar por reaproveitamento de script/teste; qualidade e coleção vigente prevalecem nas fases futuras autorizadas. |

Fonte de verdade a preservar conceitualmente: conhecimento permanente em `conhecimento_modulo`; fatos/contexto em `mentor_contexto`; progresso e execução em registros canônicos; decisão no motor determinístico; planner materializa demandas. Documentação histórica e `mentor_conhecimento` não devem funcionar como fontes operacionais paralelas. A inspeção estática não confirma quais linhas estão ativas no banco real.

## Arquivos aparentemente mortos: evidência antes de remover

O grafo de importações não encontrou arquivo inteiro de componente atual, shared ou handler sem referência. Entradas HTML/serverless e scripts CLI foram consideradas separadamente. Isso comprova ligação estática, não uso efetivo pelo usuário nem alcançabilidade de todo ramo.

| arquivo/área | classificação | motivo | ação futura |
| --- | --- | --- | --- |
| api/_lib/http.js: export authenticate(password) | D, candidato de símbolo, não do arquivo | Busca em src/api/shared/scripts/tests encontrou definição sem chamada; autenticação atual usa outro contrato. | Confirmar consumidores externos/contrato antes de remover somente função. http.js permanece necessário. |
| src/App.jsx: weekTarget/setWeekTarget | B | Busca encontrou declaração e consumo/limpeza, mas nenhum produtor de target não nulo. | Confirmar fluxo e testar antes de remover estado interno; não remover Week. |
| Simulations, DiscursiveQuestions, Gemini, geradores e acervo-specs | B/C conforme tabelas | Bloqueio, manutenção ou geração antiga não significam desconexão. Importações/rotas/comandos existem. | Não apagar por aparência; tratar dependências primeiro. |
| src/components/Contents.jsx no snapshot V1 local | C | Não existe na v2 atual; preservado no arquivo anterior, não é candidato a exclusão do diretório atual. | Consultar histórico se houver capacidade útil; não importar automaticamente. |

## Trabalho útil fora da v2 atual

| arquivo/área | classificação | motivo | ação futura |
| --- | --- | --- | --- |
| archive/v1-fase7-wip, snapshot 0dc19012bfc49e0dbdf3e8eb024552e33b3b30af | C como snapshot; conteúdo útil A/B | Preserva 24 arquivos locais recentes sobre demanda/timer, descanso, alertas, datas, fila e persistência offline. Não estão integralmente na v2. | Manter snapshot intacto; revisar reutilização por capacidade, sem merge indiscriminado. |
| test/fase-7-postgres, base ceafdeef4c61ed65f7961036cf07bff81b1fea76 | C como branch de validação | Preserva base e CI PostgreSQL da Fase 7; worktree mantém trabalho local independente. | Preservar branch/worktree. Não confundir branch base com snapshot das alterações locais. |
| supabase/migrations/0069_tempo_sessao_duracao_atomica.sql no arquivo Fase 7 | A para histórico técnico preservado, fora do checkout V2 | Trigger/reconciliação de duração pertence ao trabalho recente; ausente dos 69 arquivos atuais. | Incorporar somente após escolha técnica e conferência de schema; não criar duplicata nem aplicar agora. |
| .github/workflows/fase-7-postgres.yml; tests/timer-duration-postgres.test.js no arquivo Fase 7 | A/B para reutilização futura | Validação isolada de atomicidade/concorrência real já preparada. | Preservar evidência e CI útil; resultados anteriores não foram reexecutados nesta subfase. |
| shared/platform-date.js; src/offline-timer.js; src/timer-alerts.js e testes direcionados no snapshot | A/B para reutilização futura | Helpers e regressões das implementações locais recentes. | Não recriar antes de comparar; não presumir que a V2 atual já contém essas correções. |
| archive/v1-local-pre-v2, snapshot 41f35484f61ce387153e2fc61ca2f5f0779f1f09 | C | Preserva 36 arquivos do estado local antigo, incluindo AUDIT_*.md, Contents e roteiro/script históricos. | Manter como evidência; docs AUDIT ausentes do checkout atual não foram perdidos nem precisam ser recriados. |

## Riscos e limites do inventário

1. Políticas removidas do JSON podem continuar disponíveis em defaults/caminhos legados. Isso requer correção futura dirigida, não reauditoria ou execução agora.
2. Rótulo audit não garante leitura: audit-production e audit-and-adapt podem mutar dados. Nenhum foi executado.
3. Números 114 e catálogo antigo não definem currículo permanente. Scripts que os exigem são evidência histórica, não fonte vigente.
4. Correções recentes 7.x estão preservadas fora da v2. Recriar sem consultar snapshots perderia trabalho; merge geral levaria mudanças não selecionadas.
5. Migrations misturam schema com decisões/resets históricos. Excluir ou reaplicar para deixar limpo pode destruir vínculos/dados; preservar todos os arquivos atuais.
6. Banco real, Storage, variáveis de produção, configurações externas e uso externo de endpoints não foram consultados. Não há declaração de sincronismo com produção.
7. Cache PWA, fila e autenticação exigem revisão dirigida quando forem remodelados; esta inspeção não prova comportamento offline nem vazamento real.
8. O único candidato D de código é um símbolo aparentemente sem consumidor, não um arquivo inteiro. Saídas regeneráveis dependem de confirmação individual antes de limpeza.

## Resultado da Fase 0.3

Inventário concluído e documentado. Nenhum arquivo foi excluído ou movido. Nenhum código, migration, dado, branch ou produção foi alterado. Apenas este documento foi criado. Não foi iniciada a próxima subfase.

## Aplicação documental na Fase 0.4

As tabelas acima registram os caminhos examinados na Fase 0.3. Após a autorização de limpeza, os caminhos históricos passaram a ser:

| caminho na Fase 0.3 | destino na Fase 0.4 |
| --- | --- |
| docs/memoria-operacional.md, conteúdo V1 | [docs/archive-v1/memoria-operacional-v1.md](../archive-v1/memoria-operacional-v1.md) |
| docs/auditoria-acervo-2026-08-10.md | [docs/archive-v1/auditoria-acervo-2026-08-10.md](../archive-v1/auditoria-acervo-2026-08-10.md) |
| docs/fase-2-validacao-conclusoes.md | [docs/archive-v1/fase-2-validacao-conclusoes.md](../archive-v1/fase-2-validacao-conclusoes.md) |
| docs/mentor-fase-1-consolidacao.md | [docs/archive-v1/mentor-fase-1-consolidacao.md](../archive-v1/mentor-fase-1-consolidacao.md) |
| docs/roteiro-consolidado-mentor.md | [docs/archive-v1/roteiro-consolidado-mentor.md](../archive-v1/roteiro-consolidado-mentor.md) |

O conteúdo dos cinco arquivos foi preservado byte a byte. O caminho [docs/memoria-operacional.md](../memoria-operacional.md) permanece como memória de entrada da V2 e remete ao histórico V1, preservando a referência de AGENTS.md.

Nenhum arquivo de código foi removido. A função authenticate é apenas candidato de símbolo em arquivo necessário, fora da limpeza de arquivos e sem autorização para refatoração. node_modules é dependência do ambiente de execução; dist está referenciado como saída de deploy em vercel.json/vite.config.js. Ambos foram preservados, assim como caches, temporários, segredos locais e artefatos de auditoria, sem inclusão no commit. Arquivos classificados C de geração continuam conectados e não foram movidos. Todas as 69 migrations e todos os testes foram preservados.
