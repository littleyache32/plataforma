# UX/UI e identidade visual V2

## Escopo e precedência

Data: 07/10/2026. Branch: v2. Base: 3b5c7c8.

Pré-condições verificadas nos entregáveis e Git: Fase 0 encerrada com limitações de integração; contratos da Fase 1 encerrados com pendências de policy/SRS que não bloqueiam esta interface. A instrução explícita da Fase 2 resolve a apresentação da semana e prevalece sobre referências visuais V1. Não redefine política de estudo.

Princípio da interface: abrir → ver → fazer → registrar → sair.

O usuário é mentorado. A interface não deve transferir ao usuário decisões estratégicas que pertencem ao Mentor.

## Identidade e design system

Minimalismo japonês contemporâneo como simplicidade, organização e contenção, sem símbolos culturais decorativos. Nome Mentor e marca ME preservados. Branco/off-white, texto preto suave, cinza neutro e teal profundo como acento principal. O adendo funcional abaixo autoriza cores dessaturadas auxiliares apenas em identificadores discretos. Vermelho reservado a erro/ação destrutiva. Nenhum gradiente decorativo novo; gráfico circular de tempo usa gradiente cônico somente como representação quantitativa.

Tokens em src/product-theme.css: ink #222b29, muted #61706a, line #e1e6e3, paper #ffffff, paper-soft #f8f9f8, teal #22685e, teal-deep #184e46, teal-soft #edf5f2, red #a34242. Espaçamento em múltiplos de 4 px, bordas de 1 px, raio 10–12 px e sombra somente em camadas sobrepostas.

Fonte principal da identidade visual: **KOUSHIKI SANS**, conforme correção explícita do usuário em 07/10/2026. Aplicar prioritariamente nos títulos de página/seção, sidebar, navegação, botões, labels, números de destaque, cabeçalhos de cards e demais elementos principais. Nenhuma outra fonte deve assumir a identidade principal. A direção anterior de Inter/sans-serif de sistema está superada como decisão de identidade, embora permaneça temporariamente no código até a disponibilidade do arquivo real da nova fonte.

Fonte auxiliar neutra só pode ser adotada para parágrafos longos, explicações extensas e comentários longos de questões se a inspeção da KOUSHIKI SANS comprovar necessidade de legibilidade. Essa exceção não se estende aos controles da interface. Nenhuma fonte auxiliar foi escolhida neste ajuste.

Preservar a hierarquia compacta: títulos aproximadamente 28–32 px no desktop, seções 18–22 px, texto 14–16 px e labels 12–13 px. Revisar pesos disponíveis, line-height, tracking, métricas dos números e espaçamento com a fonte carregada, sem inventar pesos ou validar medidas por uma fonte substituta. Conferir quebras em botões, alinhamento dos labels e legibilidade no mobile. Ícones reutilizam Icon.jsx, sem nova biblioteca.

### Estado do ajuste tipográfico

**Pendente de asset, não aplicado integralmente.** Em 07/10/2026 não foi localizado arquivo KOUSHIKI SANS no repositório, nos anexos disponíveis ou nas fontes instaladas verificadas. Não foi criado @font-face apontando para arquivo inexistente nem declarado sucesso de carregamento por mera presença do nome no CSS.

Próximo requisito: receber o arquivo original da fonte (preferencialmente WOFF2, ou OTF/TTF) com permissão de uso web. Depois: integrar o asset, verificar carregamento efetivo e acentos em português, aplicar a hierarquia e revisar capturas desktop/mobile. As capturas e resultados da auditoria abaixo correspondem à tipografia anterior e não comprovam a nova fonte. Nenhum código funcional foi alterado nesta correção documental.

Aprendizado registrado em 07/10/2026: a escolha explícita de KOUSHIKI SANS substitui a identidade tipográfica anterior. Regra resultante: fallback técnico não é aplicação da fonte solicitada; pesos, fonte auxiliar e aprovação visual dependem da inspeção do asset real.

Primário preenchido teal; secundário branco/borda; ação discreta ghost; destrutivo vermelho; ícones com nome acessível/tooltip. Hover discreto, seleção com borda/acento, disabled distinguível, foco de teclado visível. Não usar apenas cor: texto de prioridade, Hoje, conclusão e labels acompanham os estados.

styles.css foi inspecionado e mantido como base legada. product-theme.css substitui o tema anterior e centraliza as decisões V2, incluindo overrides específicos das regras V1 que venciam os seletores genéricos. Não foi feita refatoração global de classes. Remoção completa do CSS morto continua débito técnico, não requisito desta fase.

## Shell, navegação e mobile

Desktop: sidebar fixa à área visível por sticky, recolhível entre 208 e 72 px; ícones com labels abertos, ícones e tooltip recolhidos. Menu operacional: Meu Plano, Timer, Revisões; grupos Prática e Análise. Início/Sair ficam no rodapé, sem excluir a tela Início. Meu Plano é o módulo inicial. Questões/Caderno/Discursivas são controles internos, reutilizando Questions.jsx para o Caderno.

Mobile: Plano, Revisar, Praticar, Mais. Praticar abre os módulos de prática; Mais contém Timer, Estatísticas e Início. Uma coluna com sete grupos de dias, sem comprimir sete colunas no celular. Áreas de toque de pelo menos 44 px nas ações principais mobile, safe-area e foco visível. Tablet horizontal mantém sete colunas, aproveitando sidebar recolhida. Somente as cores visuais do manifest e theme-color foram alinhadas; service worker, instalação e comportamento offline não mudaram. Links de fonte serif externa foram retirados do index.html.

## Comportamento dos módulos

### Meu Plano e demanda

Cabeçalho compacto, semana e resumo. Horas de demandas concluídas são explicitamente estimativas das demandas entregues, não tempo real. Cards exibem matéria, conteúdo, modalidade, duração e somente prioridade alta quando relevante. Ordem curricular/policy/carga continuam existentes, sem decisões novas.

Drag/drop continua usando o endpoint de reordenação. Modal oferece Mover para, Mover acima e Mover abaixo, inclusive por teclado/toque. Escape fecha; foco fica contido na modal e retorna ao elemento anterior. Conclusão/desmarcação mantém a semântica existente.

Removidos da interface normal: Apagar demanda, Concluir aula/PDF e descrição redundante. Não foram removidos endpoint DELETE, cancelamentos, tabela, progresso ou mecanismos internos. Resolver questões e Estudar com Question Cards permanecem; as permissões/gates existentes do backend continuam sendo a autoridade, sem liberação de prática por esta fase.

Abrir timer transporta a demanda no padrão target do App. StudyTime fornece sessaoId, objetivoId, materiaId, topicoId, contexto demanda, título e duração sugerida. Abrir não inicia contagem. Finalizar timer não conclui demanda; marcar demanda não exige timer.

### Timer

Estudo livre: um seletor de matéria, 30 min, 50 min, personalizado somente em minutos e Iniciar foco. Contexto/objetivo são inferidos da matéria. Configuração precede estatísticas de tempo. Modo foco existente dá destaque ao relógio; pausa/retomada/conclusão/excedente preservados.

Registro manual e histórico continuam existentes. Não houve incorporação automática das correções V1 arquivadas de timezone, atomicidade, descanso, alertas ou offline. Esses débitos não são declarados corrigidos por mudança visual.

### Revisões

Fila complementar em Hoje, Atenção (datas anteriores) e Depois (datas futuras), com matéria/tópico, título, tipo, motivo, data e ação Revisar. Grupos sem itens não criam caixas vazias. Datas de apresentação usam Brasília.

Atualização da Fase 4.9, 07/10/2026: /api/revisoes inclui agendamentos futuros reais e última interação canônica quando existente. HOJE, ATENÇÃO e DEPOIS usam o corte do servidor em Brasília. A UI não mostra score, enunciado extenso nem indicadores de dashboard. Carregamento, erro e grupos vazios são distintos. Revisar transporta a questão/card selecionado; abrir não inicia timer nem registra revisão. Não há inferência de FSRS a partir do calendário legado.

### Questões e Caderno

Seletores compactos de disciplina e assunto e início explícito. Resposta e confiança permanecem vinculadas; ordem 1 Sem conhecimento, 2 Eliminação, 3 Dúvida, 4 Certeza. Desktop usa uma linha, mobile duas colunas. Valores canônicos enviados ao backend não mudaram.

Após confirmação aparecem gabarito, explicação e comentários existentes de todas as alternativas. Único ajuste de API: pratica-handler passa a retornar o conteúdo explicativo já armazenado após POST confirmado, sem suprimi-lo por confiança. Não muda cálculo de tentativa, transição de revisão, SRS ou Mentor; GET não revela gabarito. O campo legado mostrar_explicacao permanece por compatibilidade, mas a UI V2 usa o conteúdo retornado.

Caderno reutiliza Questions.jsx e suas consultas existentes. Nenhum novo filtro pedagógico foi criado. Timer opcional fica em disclosure, sem iniciar ao abrir a tela ou disclosure.

### Question Cards

Filtros compactos, frente/verso, explicação quando existente e 1 Novamente, 2 Difícil, 3 Bom, 4 Fácil em linha no desktop. Atalhos 1–4 só atuam com resposta revelada, fora de edição/formulário, sem repetição de tecla/modificadores e sem envio durante loading. Intervalos ficam com espaço reservado vazio; não foram inventados 2d/7d/21d/45d nem implementado FSRS. Backend de revisão preservado. Timer opcional recolhido.

### Simulados, estatísticas, vazios e Mentor

Simulados mantém o bloqueio e placeholder compacto. Não cria prova, histórico ou recomendações artificiais; estrutura futura de modo prova fica descrita, não implementada: questão, timer, progresso, mapa e anterior/próxima sem navegação distrativa.

Estatísticas mantém métricas reais existentes, com resumo e seções menos encaixotadas. Não cria retenção/cardstats/cobertura inexistentes. O rótulo Domínio real foi substituído por Acertos com certeza para descrever a medida efetiva sem inventar inferência de domínio. A proposta de novas abas analíticas não foi convertida em módulos sem dados.

Estados vazios/bloqueados são compactos. Mascote/imagens do Mentor removidos da interface; acesso discreto na barra superior. O encontro anteriormente mantido na Fase 2 foi retirado da interface pelos ajustes finos descritos abaixo, sem apagar seus registros ou alterar o backend. Não foi criada anamnese ou formulário novo de feedback.

Transições curtas, sem parallax, blur pesado ou animações novas; prefers-reduced-motion respeitado.

## Validação local e evidências

Aplicação Vite em 127.0.0.1:4182. Fixture tests/fixtures/ui-v2.html monta App e componentes reais com respostas inteiramente sintéticas em memória. Requisições fora da API sintética/origem são bloqueadas. Não usa autenticação, registros ou Supabase reais. Fixture não é importada pela entrada de produção nem incluída no build.

Viewport desktop 1440×900: sete colunas, sidebar aberta/recolhida, sem scroll horizontal. Tablet 1024×768: sete colunas e sem scroll horizontal. Mobile 390×844: uma coluna, labels e menus inferiores utilizáveis. Capturas revisadas em output/v2-ui, não versionadas: plano-desktop.jpg, plano-recolhido.jpg, plano-tablet.jpg, plano-mobile.jpg, timer.jpg, timer-mobile.jpg, revisoes.jpg, questoes.jpg, cards.jpg, estatisticas.jpg.

Fluxos observados: modal sem controles removidos, Mover abaixo alterando ordem sintética, demanda abrindo timer idle, seleção de Faculdade persistindo no timer livre, confirmação com certeza exibindo comentários, card revelado com quatro controles em linha, tecla 3 removendo apenas o card sintético, Simulados bloqueado, botão do Mentor abrindo painel e navegação mobile.

Correções visuais detectadas no browser: filtros/cards herdando cores V1; timer com gradiente decorativo; cards de avaliação multicoloridos; sidebar oculta por breakpoint V1 no tablet; labels mobile afetados pela sidebar recolhida; Mentor atrás do header. Todas corrigidas dentro do escopo visual.

Testes finais: 172 testes aprovados em 23 arquivos (8 específicos de UX V2); lint estrutural aprovado em 120 arquivos; build Vite aprovado, 48 módulos transformados. git diff --check sem erros. Busca no dist não encontrou a fixture nem seus dados sintéticos. O lint não substitui auditoria completa de acessibilidade/hooks.

## Auditoria final da Fase 2

Status: PASS COM LIMITAÇÕES. Interface implementada e validada localmente; não equivale a homologação autenticada contra banco/produção nem a PWA instalado em dispositivo físico.

| Subfase | Entrega/evidência | Resultado |
| --- | --- | --- |
| 2.1–2.3 | Paleta/tipografia/tokens e controles centralizados no tema; screenshots | PASS |
| 2.4–2.5 | Sidebar recolhível, navegação agrupada, Meu Plano inicial, tabs de questões | PASS |
| 2.6–2.7 | Semana desktop/mobile, reordenação preservada, modal sem exclusão/material/descrição redundante | PASS |
| 2.8 | Timer livre simplificado e target da demanda parado; SSR e interação local | PASS |
| 2.9 | Agrupamento de fila existente; ausência de dados futuros documentada | PASS COM LIMITAÇÕES |
| 2.10–2.11 | Filtros compactos, confiança ordenada, resposta comentada, Caderno compartilhado | PASS local |
| 2.12 | Card focado, quatro ratings, atalho real no browser, espaço sem intervalos fictícios | PASS local |
| 2.13 | Bloqueio preservado e discreto; modo prova futuro não implementado | PASS |
| 2.14–2.16 | Estatísticas existentes/vazios compactos, mascote retirado, Mentor acessível | PASS local |
| 2.17–2.19 | Responsividade, teclado/foco/touch e transições contidas | PASS COM LIMITAÇÕES: PWA físico não testado |
| 2.20 | Este contrato e registro operacional atualizado | PASS |

Critérios 1–16 comprovados por inspeção de alterações, testes e/ou browser local. Critério 17 comprovado para layout/navegação responsivos, não instalação/offline em aparelho. Critério 18: lint/build aprovados. Critério 19: suíte passou; nenhuma regressão crítica observada no escopo controlado, integração com APIs/banco reais não exercitada.

Não alterados: conhecimento/contexto/policy do Mentor, planner, schema/migrations, dados reais, autenticação, service worker e fila offline. Não foram feitos push, merge em main ou deploy. Documentos anteriores registram arquitetura-alvo, não prova de implementação dessas áreas. A fase seguinte não foi iniciada.

## Motivo discreto da demanda, Fase 3.9, 07/10/2026

A modal existente da Semana apresenta uma única frase curta derivada da decisão original, por exemplo: “Continuidade curricular da disciplina.” Não há painel técnico, códigos, inputs, novos controles ou reformulação visual. Consulta somente ao abrir a demanda; falhas aparecem como aviso curto e não impedem ações. Demandas sem origem recuperável não recebem justificativa inventada. Tipografia e layout existentes são preservados. Validação desta microetapa: renderização estática, consulta controlada e verificações estruturais; sem homologação visual em navegador real ou produção.

## Ajustes finos de UI/UX, 07/10/2026

Direção vigente: branco predominante, texto escuro, teal como acento, tipografia neutra, títulos contidos e separação visível dos cards. Minimalismo não significa ausência de bordas, contraste ou espaçamento. A Home ganhou regras próprias para métricas, gráfico, próximas demandas e disciplinas; cálculos e consultas permanecem iguais. Rótulos do gráfico usam formato curto, com descrição completa acessível.

Koushiki Sans permanece a primeira família da interface, mas não há arquivo da fonte no projeto. Sem esse asset não é possível garantir sua aplicação integral. O fallback é Segoe UI, seguido de sans-serif do sistema; nenhum download de fonte ou família decorativa foi adicionado. Não foi necessária uma fonte auxiliar exclusiva para textos longos.

Navegação: Início pertence ao menu principal. O próprio ME recolhe/expande a sidebar; a coluna de ícones continua disponível em desktop e mobile. No celular, a expansão sobrepõe o conteúdo sem alterar sua largura; selecionar uma área recolhe a barra. Rodapé com Início/Sair, botão textual Recolher e menu inferior duplicado foram retirados. Autenticação e backend não mudaram. Header mantém sincronização discreta e acesso ao Mentor por ícone com nome acessível.

Mentor: painel somente leitura com observações de carga/execução da avaliação V2, sinais existentes e direção já registrada. Nenhum formulário de encontro, conversa longa, hipótese fabricada ou nova decisão. Dados ausentes são identificados como ausentes. API, encontros históricos, policy e planner permanecem intactos nesta subfase. Falhas de consulta aparecem explicitamente e Escape fecha o painel.

Validação local com fixture sintética: desktop 1440x1000, tablet 1024x768, mobile 390x844 e 320x740. Home, barra expandida/recolhida e Mentor revisados; rótulos colados no gráfico e reposicionamento indevido do conteúdo ao expandir a sidebar mobile foram corrigidos. Não houve homologação autenticada em produção nem teste em aparelho físico. Os registros sintéticos da fixture nunca são enviados ao banco e ela não integra o build de produção.

Testes direcionados: 32 aprovados em quatro arquivos (shell/UI, Home e encontro canônico com backend preservado). Lint estrutural aprovado em 167 arquivos e build aprovado. Evidências locais em output/ui-fine-tuning/home-desktop.jpg e home-mobile.jpg, sem versionamento. Alterações anteriores de outras fases no diretório de trabalho foram preservadas; nenhum commit, push, migration ou deploy faz parte destes ajustes.

## Adendo: diferenciação visual funcional, 07/10/2026

Regra vigente: neutralidade não pode apagar a distinção operacional. Filtros do Plano são pills compactas, delimitadas, com hover, foco, aria-pressed e check visível na seleção. Todos limpa os filtros existentes, sem introduzir nova regra de planejamento.

Demandas no Plano e na Home apresentam matéria, contexto, atividade, conteúdo e duração nessa hierarquia. BACEN usa ponto teal; Faculdade usa marcador quadrado castanho dessaturado, sempre acompanhados de texto. Atividades usam ícone e rótulo: documento para Estudo, retorno para Revisão, interrogação para Exercício/Questões, cards para Question Cards e calendário para eventos. Especial permanece Especial; não se presume que todo registro especial seja um card.

Identidade de matéria: pequena barra e paleta limitada de seis tons dessaturados, calculados deterministicamente pelo ID da matéria, com nome normalizado como fallback quando não há ID. Ordem, semana e material não alteram a cor. A Home reaproveita os IDs dos registros de tempo para manter a correspondência com o Plano. A paleta limitada pode compartilhar tons; nome, posição, texto de contexto e ícone continuam sendo as informações principais. Cards permanecem brancos, sem fundos multicoloridos.

Nenhuma alteração de Mentor, carga, planner, revisão, banco, datas ou arquitetura. Validação deste adendo limitada à inspeção local e testes direcionados de apresentação; suíte completa, lint e build ficam para o próximo fechamento integrado, conforme protocolo econômico.

Resultado local do adendo: 16 testes direcionados aprovados em três arquivos; Plano desktop e Plano/Home mobile revisados com dados sintéticos. Selecionar Faculdade exibiu somente suas sete demandas sintéticas; Todos restaurou as 21. Nenhum overflow horizontal observado nas vistas conferidas. Evidência em output/ui-fine-tuning/plano-identidade-desktop.jpg. Não houve validação pesada ou publicação.
