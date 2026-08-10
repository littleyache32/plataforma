# Memória operacional da plataforma

Última atualização: 9 de agosto de 2026.

## Finalidade

Este arquivo é a memória de execução do projeto. Deve ser lido antes de toda alteração. Ele registra decisões confirmadas, erros que não podem se repetir e práticas que produziram bons resultados.

## Protocolo obrigatório antes de alterar

1. Classificar a mensagem como conversa, diagnóstico ou autorização para implementar.
2. Extrair apenas os requisitos expressos em uma lista de aceite.
3. Verificar o código, o Supabase e a produção antes de afirmar o estado atual.
4. Preservar dados e alterações válidas existentes.
5. Implementar sem extrapolar exemplos dados pelo usuário.
6. Validar testes, lint, build, banco, navegador e console conforme o risco.
7. Enviar todo código aprovado ao GitHub e confirmar a produção na Vercel.
8. Informar bloqueios externos com evidência, sem declarar como concluído o que não foi entregue.

## Decisões permanentes confirmadas

### Escopo e interface

- A plataforma é pessoal, com Modo Aluno e Administrador.
- A divisão Aluno e Administrador precisa ser respeitada na interface. Ações de cadastro, geração, importação, auditoria e reset ficam no Administrador.
- Faculdade e BACEN são filtros dentro dos módulos. Não criar duas interfaces independentes.
- A Semana é unificada e usa Faculdade e BACEN como identificação visual.
- As legendas permitidas na Semana são Estudo, Revisão, Exercício e Especial. Não criar a legenda Todas.
- Não usar emojis como ícones. Usar SVGs consistentes.
- A navegação móvel e de tablet usa barra lateral expansível e recolhível, sem navegação fixa no rodapé.
- Simulados e questões discursivas permanecem bloqueados até nova autorização.

### Semana e mentor

- O usuário é o mentorado. A plataforma prepara e recalibra a semana.
- Demandas são orientadas por entrega, não por horário rígido.
- Atividades normais duram 30, 60 ou no máximo 90 minutos. Provas e simulados podem exceder.
- Arrastar demanda significa reorganizar a ordem dentro do mesmo dia. Não mover entre dias por arraste.
- Demanda não concluída deve ser redistribuída pelo mentor para um dia posterior possível.
- De 10 a 23 de agosto de 2026: três horas diárias, sendo uma hora de Faculdade de segunda a quinta e duas horas de BACEN; sexta a domingo são três horas de BACEN; sem questões, Question Cards ou simulados.
- Faculdade segue aula dada, aula estudada: Pessoas e Negócios na segunda, Teoria do Crime na terça, Teorias da Justiça na quarta e Teoria da Constituição na quinta.
- Após a fase inicial, BACEN tem prioridade de carga. Question Cards BACEN são diários quando liberados; Faculdade, duas vezes por semana.
- Simulados só podem ser considerados a partir da semana de 7 de setembro de 2026.
- A matéria Análise e Produção de Texto não recebe questões nem Question Cards.

### Questões e Question Cards

- Questões existentes válidas não devem ser apagadas para ajustar quantidade ou porcentagem.
- Remover ou arquivar somente defeitos objetivos: duplicidade, formato inválido, fonte ausente, evidência insuficiente ou conteúdo estruturalmente imprestável.
- Meta atual: pelo menos 30 questões e 50 Question Cards por tópico aplicável.
- Distribuição desejada das questões: 60% fáceis, 30% médias e 10% difíceis. Novas questões compensam o acervo existente sem apagar válidas.
- Toda questão exige fonte, trecho de evidência, gabarito e explicação.
- BACEN usa CE e ME, com predominância compatível com Cebraspe. Faculdade pode mesclar CE e ME.
- Na prática, a disciplina começa vazia. Tópico vazio significa todos os tópicos.
- A classificação Certeza, Dúvida, Eliminação ou Sem conhecimento vem antes do gabarito.
- Explicação aparece em erro, acerto com Dúvida e acerto com Sem conhecimento. Acerto com Certeza ou Eliminação não mostra explicação.
- Questões e Question Cards usam revisão espaçada. Revisões vencidas viram demandas do mentor.
- Cards devem ser atômicos, específicos, baseados em recuperação ativa e sem duplicidade. Priorizar recordação, distinção, aplicação, exceção e correção.

## Erros anteriores e prevenção

1. Foram adicionadas ações não solicitadas, como reagendar ou ajustar meta. Regra: implementar somente ações expressamente pedidas.
2. Elementos administrativos apareceram no Aluno, incluindo coleta de dados e administração do banco. Regra: conferir visibilidade por modo antes da publicação.
3. Faculdade e BACEN foram separados excessivamente. Regra: separar por filtro dentro de cada módulo, mantendo Semana e Desempenho unificados.
4. O mentor criou carga de quatro a sete horas para um iniciante. Regra: respeitar a fase de adaptação e os limites de carga confirmados.
5. O arraste foi interpretado entre dias. Regra: permitir apenas reordenação no mesmo dia.
6. Exemplos do usuário foram generalizados como regras. Regra: exemplo só vira regra quando o usuário confirmar.
7. Foi sugerido faturamento apesar da preferência pelo plano gratuito. Regra: otimizar primeiro todas as cotas gratuitas e nunca pressupor faturamento.
8. Houve risco de declarar acervo completo antes de verificar banco, fonte e profundidade. Regra: usar contagens e auditoria real antes de declarar conclusão.
9. Conteúdo gerado a partir de material raso compromete questões e cards. Regra: a evidência precisa sustentar diretamente cada item.
10. Repetições de autorização interromperam o fluxo. Regra: usar permissões já concedidas e agrupar operações seguras, reconhecendo que confirmações obrigatórias do sistema não podem ser ignoradas.

## Acertos que viram padrão

1. Preservar questões válidas e arquivar apenas falhas objetivas.
2. Exigir fonte e trecho de evidência no banco.
3. Validar CE e ME também por restrições no banco.
4. Usar seletor de disciplina inicialmente vazio e Todos os tópicos como mistura da matéria.
5. Manter classificação de confiança, eliminação de alternativas e timer de prática.
6. Fazer migração antes do deploy e validar produção diretamente quando a integração automática não atualizar.
7. Tratar a cota do Gemini como bloqueio externo, sem inserção parcial ou substituição por conteúdo artificial.

## Histórico de aprendizado

- 2026-08-09, acerto: auditoria conservadora preservou 2.426 de 2.433 questões e arquivou somente sete falhas impeditivas.
- 2026-08-09, acerto: 2.260 de 2.261 Question Cards foram preservados; avisos estilísticos não foram tratados como motivo automático de exclusão.
- 2026-08-09, decisão: novas questões devem aproximar cada tópico de 60% fáceis, 30% médias e 10% difíceis.
- 2026-08-09, bloqueio: Gemini 3.1 Flash Lite e Gemini 3 Flash retornaram cota esgotada; Gemini 2.5 Flash Lite foi descontinuado para novas contas. Não gerar conteúdo inferior para mascarar o bloqueio.
