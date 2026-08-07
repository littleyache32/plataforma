# Plataforma de estudos: escopo validado para inicio de uso

Data: 7 de agosto de 2026

## Decisao central

A plataforma sera um mentor de estudos. Ela cria e prioriza demandas, e voce executa, move uma demanda de dia quando necessario e registra o que aconteceu. O aluno nao planeja sessoes manualmente nem escolhe uma agenda por horario.

O uso principal na proxima segunda deve ser: abrir a Semana, ver as demandas recomendadas, iniciar questoes ou revisoes, responder e receber a proxima prioridade.

## Situacao atual, sem maquiagem

| Area | Estado atual | Decisao |
| --- | --- | --- |
| Banco de questoes | Estrutura, seguranca, fontes e motor de seed existem. O banco continua vazio. | Prioridade maxima. Gerar e revisar o primeiro lote antes do inicio de uso. |
| Semana | Ha grade de dias, mas ainda permite criar manualmente titulo, data e duracao. Tambem mostra objetivos abaixo. | Substituir pelo quadro de demandas do mentor. |
| Questoes | Fluxo CE e ME, classificacao antes do gabarito, explicacao, fonte e marcar como errada funcionam. | Manter e acrescentar eliminacao visual nas alternativas ME. |
| Simulados | A area e somente um aviso, ainda sem fluxo. | Construir apos a Semana e o primeiro banco de questoes. |
| Desempenho | Ha placar de questoes, falsa certeza, prioridades e fila de revisao. | Separar em desempenho de questoes e desempenho de simulados. |
| Question Cards | Ainda nao ha modulo separado. | Criar como modulo proprio, alimentado automaticamente por questoes e simulados. |

## Correcao do que foi retirado

Estes itens nao entram nas demandas semanais porque voce nao os pediu:

- Reagendar como botao de acao.
- Ajustar meta como botao de acao.
- Formulario de "Nova sessao" com titulo, data e duracao no Modo Aluno.
- Planejamento manual de sessoes pelo aluno.
- Horarios fixos para as demandas de estudo.
- Compromissos pessoais, como terapia, no quadro de estudos.

Ao abrir uma demanda, as acoes serao somente:

1. Marcar como concluida.
2. Resolver questoes.
3. Estudar com Question Cards.

A revisao sera uma demanda criada pelo mentor, nao uma acao generica adicional.

## Semana: desenho que sera construido

### Uma unica visao

A Semana nao sera dividida em uma tela Faculdade e outra BACEN. Ela mostrara as duas frentes juntas para permitir enxergar a carga real da semana.

Cada card tera duas identificacoes independentes:

- Contexto: Faculdade ou BACEN.
- Tipo de demanda: Estudo, Revisao, Exercicio ou Especial.

As quatro legendas serao:

| Legenda | Uso |
| --- | --- |
| Estudo | Aprender ou aprofundar um topico. |
| Revisao | Corrigir questoes, revisar simulados, tratar erros e falsas certezas ou rever Question Cards vencidos. |
| Exercicio | Resolver questoes por materia ou topico. |
| Especial | Anki e outras rotinas especiais definidas pelo mentor. |

O Anki entrara inicialmente como demanda Especial. Nao sera criada integracao com a conta do Anki sem uma decisao sua especifica sobre essa integracao.

### Grade semanal

- Os sete dias ocuparam a parte central da pagina, sem formulario manual abaixo.
- O dia atual tera destaque visual e exibira a carga estimada do dia, pela soma das demandas planejadas.
- Cada card exibira: contexto, materia, topico, tipo, carga estimada e prioridade.
- O aluno podera arrastar um card para outro dia. Isso apenas muda o dia da demanda e fica salvo.
- Arrastar nao criara horarios e nao altera automaticamente o conteudo ou a prioridade da demanda.
- O mentor podera recalcular a distribuicao na proxima rodada, considerando o que foi feito, movido ou deixado pendente.

### Sua disponibilidade conhecida

Ja fica registrado para o calculo inicial:

- Faculdade de segunda a quinta, das 8h as 10h50.
- Esse intervalo e indisponivel para estudo na plataforma.
- A semana trabalha por carga e demandas, sem preencher cada hora do seu dia.

Ponto critico: saber que sobram 14 horas no relogio nao significa que existem 14 horas sustentaveis de estudo. Almoco, deslocamento, academia, descanso e imprevistos precisam caber. Para a primeira semana, o mentor deve propor uma carga conservadora e ajustavel, baseada na sua disponibilidade efetiva fora da faculdade. A definicao da carga diaria maxima entrara na anamnese rapida antes da primeira distribuicao automatica.

## Questoes

O fluxo atual permanece e ganha um ajuste importante:

- Nas questoes de multipla escolha, cada alternativa tera um botao X para eliminacao visual.
- A alternativa eliminada ficara riscada, sem revelar o gabarito.
- Essa marcacao e temporaria naquela tentativa. Ela nao substitui a classificacao final "eliminacao".
- A classificacao continua obrigatoria antes de confirmar: Certeza, Duvida, Eliminacao ou Sem conhecimento.

As questoes continuarao separadas por Faculdade e BACEN dentro do modulo Questoes. A semana apenas consolida as duas frentes.

## Question Cards: modulo proprio

Question Cards deixara de ser apenas um atalho dentro de uma demanda. Havera um modulo proprio na navegacao, com cards para revisar quando necessario.

Eles serao gerados automaticamente a partir de questoes e simulados:

| Situacao | Regra inicial |
| --- | --- |
| Erro | Cria ou reforca um card de revisao. |
| Erro com Certeza | Prioridade maxima, com revisao imediata. |
| Acerto com Duvida, Eliminacao ou Sem conhecimento | Pode criar card quando houver conceito relevante a consolidar. |
| Acerto com Certeza | Gera card apenas quando o conceito for importante ou ainda nao tiver cobertura. Isso evita acumular cards repetidos. |
| Mesmo conceito repetido | Reforca o card existente, em vez de criar varios iguais. |

Os cards usarao a explicacao e a fonte da questao como base. Assim, eles revisam conhecimento real trabalhado no aplicativo, em vez de virarem uma colecao solta e inflada.

## Simulados

O simulador sera separado da pratica comum e tera dois momentos.

### Antes de iniciar

- Escolha de contexto: Faculdade ou BACEN.
- Escolha de materia ou disciplina, quando aplicavel.
- Quantidade de questoes e duracao definida pelo tipo de simulado.
- Questoes sorteadas por assunto e dificuldade, sem ordem crescente de dificuldade.
- Durante o simulado, nao havera filtro de questoes. A composicao fica fechada ao iniciar.

### Durante o simulado

- Uma questao por tela.
- Setas para avancar e voltar.
- Painel lateral ou direito com todas as questoes numeradas.
- O painel indicara respondida, atual e pulada. Uma questao pulada podera ser retomada antes de finalizar.
- Em ME, havera eliminacao visual com X nas alternativas.
- A classificacao de confianca tambem sera registrada em cada resposta.
- O relogio fica visivel e o estado e salvo, para que uma interrupcao nao apague o simulado.

## Desempenho: o que faz sentido para Faculdade e BACEN

Os dados de pratica e de simulados nao serao misturados.

### Desempenho de questoes

Manter:

- Acerto bruto.
- Dominio real: acertos com Certeza.
- Falsa certeza: erros marcados com Certeza.
- Tempo medio por questao.
- Evolucao por materia e topico.
- Fila de revisao e prioridades do mentor.

### Desempenho de simulados

Adicionar:

- Questoes acertadas / total e percentual por simulado.
- Simulados concluidos.
- Taxa de acerto com Certeza.
- Taxa de acerto com Duvida.
- Taxa de erro com Certeza, que e a falsa certeza.
- Tempo medio por questao e comparacao entre simulados.
- Questoes puladas no momento da finalizacao.
- Evolucao ao longo do tempo.
- Analise por materia e topico para Faculdade ou BACEN.

O item "taxa QV" visto no video nao deve ser copiado enquanto seu significado nao estiver claro. No nosso produto, cada indicador tera um nome explicito. O icone de relogio faz sentido como tempo medio por questao, e nao como uma taxa de confianca.

Nao fazem sentido no momento: desempenho por vestibular, ENEM, UERJ, areas Linguagens/Humanas/Natureza/Matematica ou categorias de vestibular. Elas seriam ruido para Direito e BACEN.

## Ordem de entrega recomendada

### Necessario para comecar na segunda

1. Destravar a geracao com pesquisa e fonte, gerar um lote piloto e conferir a qualidade antes de ampliar.
2. Criar o modulo Question Cards automatico a partir de tentativas reais.
3. Corrigir a Semana: quadro unico Faculdade + BACEN, quatro legendas, carga estimada, dia atual e arrastar entre dias.
4. Incluir a eliminacao visual X nas questoes ME.

### Evolucao durante a primeira semana de uso

5. Simulados completos, com temporizador, navegacao, pulos e salvamento.
6. Painel separado de desempenho de simulados.
7. Refinar o mentor conforme os seus dados reais de uso.

## Dependencia atual do banco de questoes

O motor foi preparado para usar pesquisa e fonte. No projeto Gemini atual, o modelo que aceita a chave esta sem cota de pesquisa no plano gratuito, por isso o primeiro seed nao conseguiu criar questoes. Gerar sem essa pesquisa quebraria a regra mais importante do produto: toda questao precisa ter uma fonte verificavel.

Para o lote piloto, e necessario habilitar faturamento ou uma cota de pesquisa compativel no projeto Gemini "app estudo". Assim que isso estiver ativo, o passo seguinte sera gerar uma materia piloto, auditar CE e ME, fonte, explicacao e aderencia Cebraspe, e somente depois expandir o banco.

## Criterios objetivos de pronto para segunda

- Voce abre a Semana e ve uma unica lista semanal de demandas de Faculdade e BACEN.
- Nao aparece formulario de nova sessao, reagendamento ou ajuste de meta.
- Os cards mostram contexto, tipo, prioridade e carga, e podem ser arrastados entre dias.
- O modulo Questoes tem questoes reais, com fonte, de ambos os formatos CE e ME.
- O X de eliminacao funciona nas alternativas ME sem entregar resposta.
- Erros e falsas certezas passam a alimentar a revisao e os Question Cards.
- Tudo continua salvo apos recarregar.

## Decisao de execucao apos sua aprovacao

Cada entrega sera feita isoladamente, validada, enviada ao GitHub e publicada na Vercel. A proxima implementacao sugerida e o passo 1: garantir o primeiro banco de questoes com fontes. Em seguida, Question Cards e Semana.
