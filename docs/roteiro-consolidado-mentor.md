# Roteiro consolidado da plataforma

Data: 30/09/2026. Estado: aprovado conceitualmente; Fase A ainda não validada em produção. Este documento não autoriza executar as Fases B-H, gerar acervo ou liberar prática.

## Regras transversais

- O mentorado fornece fatos; o Mentor principal decide matéria, método, prioridade, carga, revisão e transições de fase. Os seis especialistas fornecem sinais, sem motores independentes.
- Fase atual: hábito e base teórica, com dois blocos de concurso e um de Faculdade por dia. A carga cresce conforme constância e pode incorporar demandas de 30 ou 50 minutos, inclusive demandas adicionais, sem tratar a duração planejada como teto de tempo real.
- O conjunto vigente de aulas e PDFs do Estratégia é fonte de verdade para currículo e teoria. Os 114 PDFs observados em 11/08/2026 são inventário histórico, não constante do produto. Prática, estatísticas e, futuramente, simulados pertencem à plataforma.
- Questões e Question Cards permanecem zerados até autorização explícita de reconstrução. Prática não entra automaticamente por data. Simulados ficam por último.
- Meta futura do acervo BACEN: 10.000 questões aprovadas, até 500 novas aprovadas por semana. Qualidade vem antes do volume. Composição-alvo do acervo: dificuldade 60% fácil, 30% média, 10% difícil; incidência comprovada 60% alta, 30% média, 10% baixa. Isso não determina a sequência de resolução.
- Concluída a base programática do conjunto vigente, não reiniciar o curso inteiro. O Mentor passa progressivamente a privilegiar questões, revisões e cards, retornando à teoria pontualmente por diagnóstico. Simulados entram apenas na etapa final.

## Fase A: consolidação do Mentor e validação real

1. Objetivo: uma fonte ativa para conhecimento, outra para contexto e uma decisão final centralizada no Mentor.
2. Já existe: consolidação local em `shared/mentor.js`, `shared/planner.js`, APIs, testes e migration 0062; seis especialistas existentes foram preservados.
3. Falta: confirmar schema, contexto e código publicados em conjunto.
4. Corrigir: políticas antigas de data/carga não podem disputar autoridade com `mentor_contexto`. O banco consultado ainda não tem a tabela nem a migration 0062 aplicada. A semana publicada de 28/09 falha porque uma duração planejada viola `sessao_duracao_estimada_check`: estudo/revisão/exercício não podem ultrapassar 90 minutos e há um caminho de preparo acadêmico de 100 minutos no planner.
5. Dependências: revisar migrations pendentes 0061 e 0062, separar alterações locais não relacionadas, validar migração antes da publicação e conferir produção.
6. Não fazer: criar especialistas, ativar prática, executar o migrador geral sem conferir pendências ou publicar alterações misturadas.
7. Conclusão: migration e código compatíveis publicados; somente `conhecimento_modulo/mentor` ativo; contexto correto; 2 concurso + 1 Faculdade na semana; testes, lint, build e navegador sem erro no plano. Em 30/09/2026, esta fase está aberta.

## Fase B: integridade dos dados

1. Objetivo: respostas, revisões e tempo persistentes, consistentes e seguros.
2. Já existe: autenticação, identificadores de operação, backups e registros de falha.
3. Falta: atomicidade de respostas e sincronização offline confiável.
4. Corrigir: exclusão global do placar, mutações parciais, estados da revisão, fuso horário e limites do histórico.
5. Dependência: Fase A validada.
6. Não fazer: gerar acervo ou usar indicadores inconsistentes para decisões estratégicas.
7. Conclusão: testes de falha, repetição e recuperação não duplicam nem perdem dados; contagens fecham com registros reais.

## Fase C: currículo, acervo e Questões V2

1. Objetivo: questões curadas e prática limitada ao conteúdo estudado.
2. Já existe: catálogo, questão, fonte, confiança, feedback e seleção básica.
3. Falta: reconciliar catálogo com o conjunto vigente do Estratégia, seleção por peso/incidência/erros/confiança/reteste e pipeline de aprovação semanal.
4. Corrigir: cron e migration de 2.000-2.500 questões quinzenais; verificar gabarito completo após toda resposta e comentários de cada alternativa.
5. Dependências: Fase B e autorização explícita para criar/importar questões.
6. Não fazer: preencher metas com itens fracos, distribuir igualmente por tópico, usar incidência sem evidência ou ordenar resolução pela composição 60/30/10.
7. Conclusão: cobertura curricular auditada; cada item aprovado tem fonte, evidência, gabarito e explicação; até 500 aprovações semanais; seleção e feedback passam testes de ponta a ponta. Controles de confiança: 1 Sem conhecimento, 2 Eliminação, 3 Dúvida, 4 Certeza, antes da resposta.

## Fase D: Question Cards V2

1. Objetivo: experiência de recuperação ativa inspirada em Anki e Brainscape, adaptada à plataforma.
2. Já existe: frente/verso, avaliações, agendamento, histórico, denúncia e cards corretivos.
3. Falta: fluxo compacto, atalhos, progresso, diagnóstico de cards problemáticos e criação curada a partir de conteúdo importante já estudado, além de erros, falsa certeza e confusões.
4. Corrigir: fila/agendamento divergentes e cards sem atomicidade ou evidência.
5. Dependências: Fase B, conteúdo estudado verificável e Fase C para cards derivados de questões.
6. Não fazer: gerar cards por volume, copiar marca de terceiros, trocar o agendador sem dados ou introduzir cards na rotina por data.
7. Conclusão: frente, revelação, avaliação e próximo card funcionam por toque e teclado, sem duplicação; controles 1 Novamente, 2 Difícil, 3 Bom, 4 Fácil. Com sidebar fechada no desktop, os quatro controles aparecem em uma linha, na ordem 1-4.

## Fase E: revisões integradas

1. Objetivo: o Mentor escolher revisão por questões ou cards, sem exigir ambas no mesmo bloco.
2. Já existe: Central de Revisão e vencimentos.
3. Falta: converter sinais válidos em demandas de 30 ou 50 minutos e concluir a fila de ponta a ponta.
4. Corrigir: separação de itens futuros, vencidos, concluídos e ignorados.
5. Dependências: Fases C-D e transição de prática decidida pelo Mentor com aderência sustentada.
6. Não fazer: ativação por calendário, acrescentar todas as modalidades simultaneamente ou prescrever releitura sem diagnóstico.
7. Conclusão: a fila mostra apenas estados corretos e o plano inclui a modalidade adequada dentro de carga executável.

## Fase F: estatísticas com maturidade

1. Objetivo: registrar todas as tentativas, mas permitir decisão estratégica apenas com evidência suficiente.
2. Já existe: registros de respostas, confiança, tempo, revisões e diagnóstico parcial.
3. Falta: volume, tendência, dias distintos, recência, questões inéditas e retestes espaçados em indicadores conjuntos.
4. Corrigir: totais truncados ou deslocados por fuso e qualquer inferência de domínio a partir apenas de tempo/aula concluída.
5. Dependências: Fases B-E.
6. Não fazer: mudar prioridades por amostra pequena, dia ruim, chute, repetição imediata ou simulado isolado.
7. Conclusão: métricas reproduzíveis, incerteza visível e testes que separam registro, sinal inicial e evidência suficiente.

## Fase G: Mentor adaptativo

1. Objetivo: decidir o que, como, quanto e quando estudar usando dados confiáveis.
2. Já existe: planner, encontro, conhecimento e contexto consolidados na Fase A.
3. Falta: consumir sinais maduros de prática e ajustar progressivamente carga, método e prioridades.
4. Corrigir: parâmetros que só permitem incrementos de 50 minutos, confundem elegibilidade com obrigação ou reiniciam a teoria após a base.
5. Dependências: Fases A-F e dados individuais suficientes.
6. Não fazer: pedir decisões estratégicas ao mentorado, criar motores paralelos ou mudar estrutura por evento isolado.
7. Conclusão: cenários de aderência, prova próxima, amostra pequena, falsa certeza e conclusão da base geram decisões conservadoras e distintas; o Mentor preserva o concurso e controla a carga total.

## Fase H: simulados

1. Objetivo: medir transferência para a prova e alimentar ajustes prudentes.
2. Já existe: parte do banco e do backend; interface bloqueada.
3. Falta: realização, correção, análise por disciplina e integração ao Mentor.
4. Corrigir: qualquer dependência de acervo ou estatística ainda inconsistente antes da liberação.
5. Dependências: Fases C-G estáveis e autorização específica.
6. Não fazer: liberar cedo para compensar lacunas ou mudar o plano por um simulado isolado.
7. Conclusão: fluxo completo sem perda de respostas, análise reproduzível e Mentor usando o resultado junto de outras evidências.

## Controles de sessão e precedência

- Questões e Question Cards não iniciam timer ao abrir a tela. O timer começa apenas quando o mentorado inicia efetivamente a sessão de prática e termina com ela. Resolver conteúdo sem iniciar timer continua possível.
- No desktop com a sidebar fechada, cada conjunto de quatro controles de prática fica em uma só linha, na ordem 1, 2, 3, 4.
- Prevalecem a meta semanal de até 500 questões aprovadas, o conjunto vigente do Estratégia, o feedback após toda resposta e a fase atual sem prática automática. Regras quinzenais, números fixos de aulas, ocultação do feedback e liberação automática por data são históricas.
