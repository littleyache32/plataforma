# Memória operacional da plataforma

Última atualização: 11 de agosto de 2026.

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
- A linguagem visual é clara e inspirada em desenho manual: fundo de papel muito discreto, contornos levemente irregulares, bastante espaço em branco e cores reservadas para contexto, estado e ação. Textos longos permanecem em fonte neutra para preservar legibilidade.
- A área de Questões apresenta disciplinas e tópicos em um catálogo hierárquico expansível. A disciplina continua inicialmente vazia. Selecionar uma disciplina abre a primeira questão de todos os seus tópicos; selecionar um tópico troca imediatamente para a primeira questão dele.
- Os números exibidos ao lado de disciplinas e tópicos representam contagens reais de itens ativos daquela área. Não usar numeração meramente ordinal nesses locais.
- O timer de Questões e Question Cards é opcional, progressivo e começa em zero somente ao acionar o botão próximo ao indicador de tempo. O conteúdo pode ser respondido sem iniciar o timer.
- Question Cards usam a mesma estrutura visual hierárquica das Questões, mantendo frente, resposta e avaliação de revisão espaçada próprias.
- O Mentor pode usar composição visual de conversa e balões, mas não deve simular campo de chat, anexos, reações ou funções que ainda não existam.
- Simulados e questões discursivas permanecem bloqueados até nova autorização.
- O catálogo BACEN confirmado em 10 de agosto de 2026 contém exatamente 12 disciplinas e 71 tópicos, conforme a referência visual do curso BACEN Técnico Bancário enviada pelo usuário. As disciplinas são Português, Direito Constitucional, Direito Administrativo, Administração Pública, Administração Geral, Ética na Administração Pública, Noções de Informática, Raciocínio Lógico, Contabilidade Geral, Administração de Recursos Materiais, Gestão de Pessoas e Arquivologia. A lista exata de tópicos está registrada na migração `0023_catalogo_bacen_qconcursos.sql`; não manter disciplinas ou tópicos BACEN fora dela.

### Semana e mentor

- O usuário é o mentorado. A plataforma prepara e recalibra a semana.
- Demandas são orientadas por entrega, não por horário rígido.
- A demanda deve ser concluída inteira na mesma execução. Ultrapassar a estimativa não cria continuação, não divide a atividade e não reduz a aderência quando a entrega foi concluída.
- Atividades normais duram 30, 60 ou no máximo 90 minutos. Provas e simulados podem exceder.
- Arrastar demanda significa reorganizar a ordem dentro do mesmo dia. Não mover entre dias por arraste.
- Demanda não concluída deve ser redistribuída pelo mentor para um dia posterior possível.
- De 17 a 30 de agosto de 2026: três horas diárias, sendo uma hora de Faculdade de segunda a quinta e duas horas de BACEN; sexta a domingo são três horas de BACEN; sem questões, Question Cards ou simulados.
- A semana é preparada automaticamente no domingo às 23h30, horário de Brasília. Abrir o aplicativo na segunda-feira funciona como contingência caso a execução agendada não ocorra.
- Faculdade segue aula dada, aula estudada: Pessoas e Negócios na segunda, Teoria do Crime na terça, Teorias da Justiça na quarta e Teoria da Constituição na quinta.
- Após a fase inicial, BACEN tem prioridade de carga. Question Cards BACEN são diários quando liberados; Faculdade, duas vezes por semana.
- Após a fase inicial, a carga de estudo BACEN se adapta pela conclusão das demandas: abaixo de 70% na semana mais recente, o bloco cai de 60 para 30 minutos; entre 70% e 85%, permanece em 60 minutos; a partir de 85% por duas semanas consecutivas, sobe para 90 minutos. Faculdade, revisões vencidas, Questões e Question Cards não são removidos por esse ajuste.
- Simulados só podem ser considerados a partir da semana de 7 de setembro de 2026.
- A matéria Análise e Produção de Texto não recebe questões nem Question Cards.
- O fechamento semanal compara demandas planejadas e concluídas, pendências, revisões e aderência. Esse resultado alimenta o ajuste da semana seguinte.
- A trajetória até a prova mostra conteúdo restante, ritmo, capacidade projetada e risco somente quando existir data-alvo. Sem data da prova, a plataforma não inventa prazo nem percentual de risco.
- Não criar manifesto sequencial dos PDFs, marcador de continuidade, continuação automática de aula ou calibração por tempo real. Esses itens não foram selecionados e conflitam com a demanda concluída inteira.

### Questões e Question Cards

- Cada um dos 113 tópicos aplicáveis de BACEN e Faculdade deve ter exatamente 100 questões ativas e 20 Question Cards ativos. O acervo-alvo atual é de 11.300 questões e 2.260 cards. Tópicos sem fonte específica usam o conhecimento consolidado da disciplina ou a base curricular local, conforme autorização explícita de 12 de agosto de 2026.
- Cada tópico deve ter exatamente 60 questões fáceis, 30 médias e 10 difíceis. Para cumprir a regra exata, itens excedentes podem ser arquivados de forma recuperável, priorizando a preservação de itens já respondidos e de melhor qualidade.
- Toda questão exige fonte, trecho de evidência, gabarito e explicação.
- BACEN usa CE e ME, com predominância compatível com Cebraspe. Faculdade pode mesclar CE e ME.
- Na prática, a disciplina começa vazia. Tópico vazio significa todos os tópicos.
- A classificação Certeza, Dúvida, Eliminação ou Sem conhecimento vem antes do gabarito.
- Explicação aparece em erro, acerto com Dúvida e acerto com Sem conhecimento. Acerto com Certeza ou Eliminação não mostra explicação.
- Questões e Question Cards usam revisão espaçada. Revisões vencidas viram demandas do mentor.
- Erro, Dúvida e Sem conhecimento enviam automaticamente a questão ao Caderno de Questões. O caderno é uma opção própria dentro de Questões e alimenta futuras revisões.
- Cards devem ser atômicos, específicos, baseados em recuperação ativa e sem duplicidade. Priorizar recordação, distinção, aplicação, exceção e correção.
- A frente do card usa contexto mínimo, comando direto e dica do formato esperado. O verso apresenta primeiro a resposta direta, depois explicação de até duas frases. Imagem ou mnemônico é opcional e só entra quando for fiel e realmente útil. Os formatos permitidos são pergunta e resposta, lacuna e causa e efeito.
- Responder questões não pode elevar o tópico acima de 20 Question Cards. O fluxo atualiza card correspondente quando existente; o Caderno absorve a necessidade de revisão sem criar excedente.
- Em 11 de agosto de 2026, o usuário autorizou reconstruir o acervo BACEN exclusivamente a partir dos PDFs do Estratégia fornecidos por ele, sem Gemini. Só tópicos com fonte específica suficiente podem receber questões e cards; tópicos sem fonte ficam bloqueados.
- Os PDFs pagos do Estratégia não podem ser enviados ao GitHub. O texto integral fica apenas no Supabase protegido, e o repositório guarda importadores, mapeamentos e auditorias.
- Revisões vencidas de Question Cards vêm antes de cards novos. O limite inicial é de dez cards novos por objetivo ao dia.
- O aluno pode denunciar Question Card ambíguo, incompleto ou incorreto. O item denunciado sai da fila até auditoria administrativa.

### Administração e confiabilidade

- O Administrador possui um controle operacional com saúde do mentor, execuções, próxima execução, falhas, política, semana gerada, auditoria de questões e cards, cobertura e backup.
- O calendário acadêmico registra prova ou entrega, disciplina, data, peso, duração e conteúdo previsto.
- O backup exporta progresso, respostas, planejamento, compromissos e configurações do mentor em JSON, sem segredos nem PDFs pagos.
- Demandas e execuções do mentor usam chaves únicas. O plano é bloqueado se houver duplicidade ou carga superior a 480 minutos no dia.
- O fechamento transfere no máximo três pendências e somente quando elas couberem na capacidade do dia. Tópicos sem fonte específica não entram no planejamento.
- Falhas de funções e do cron são registradas para resolução no painel administrativo.
- A implantação gratuita usa sete funções serverless: Autenticação, Estudos, Planejamento, Desempenho, Mentor, Administração e Cron. Os handlers permanecem separados em `api/_lib`; consolidar a porta de entrada não autoriza misturar responsabilidades no código nem remover funcionalidades.
- O timer de estudo é progressivo e persistente, pode ser iniciado em demanda, disciplina, Questões e Question Cards, permite pausa e retomada e oferece modo foco. O tempo real não divide automaticamente uma demanda concluída.
- O Yoda é a porta da central de alertas: revisões vencidas, pendências, risco de acúmulo, prazos e mudança de carga. Semana e próxima demanda continuam acessíveis pelos módulos próprios.
- A Central de Revisão unifica questões erradas, Dúvida, Sem conhecimento, cards vencidos e revisões do mentor, ordenadas por urgência.
- A plataforma é instalável como PWA. Semana e cards previamente carregados ficam disponíveis em conexão instável; mutações offline usam identificadores únicos e sincronizam quando a internet retorna.
- O Administrador possui comparador de edital BACEN e backups automáticos semanais com retenção de 90 dias. Restaurar exige confirmação explícita e substitui os dados de progresso cobertos pelo snapshot.

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
11. O Gemini foi chamado mesmo após o usuário definir que ele não seria usado por enquanto e que avisaria quando autorizasse. Regra: nenhuma função, script ou fluxo pode chamar Gemini sem uma autorização nova, explícita e específica do usuário.

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
- 2026-08-10, decisão: foi solicitado um lote adicional exato de 300 questões e 600 Question Cards. O executor incremental foi criado para completar lacunas sem remover válidas e sem aceitar inserção parcial.
- 2026-08-10, bloqueio confirmado: a primeira execução do lote parou no índice zero com `429 RESOURCE_EXHAUSTED`, adicionando zero questões e zero cards. Retomar somente com cota gratuita disponível ou chave de projeto com cota.
- 2026-08-10, correção: o bloqueio correto não é apenas a cota. O Gemini não estava autorizado nesta fase. Até nova manifestação explícita do usuário, toda produção, auditoria e importação deve ocorrer sem Gemini.
- 2026-08-10, arquitetura: os conhecimentos foram separados em Questões, Question Cards e Mentor. Questões objetivas e discursivas compartilham o mesmo conhecimento; Simulados permanece sem conhecimento ativo.
- 2026-08-10, arquitetura: o mentor principal coordena especialistas internos de planejamento semanal, revisão espaçada, diagnóstico de desempenho e auditoria do acervo. O especialista de simulados fica inativo até liberação.
- 2026-08-10, desempenho: o mentor não consulta mais o banco enquanto o painel está fechado, sua resposta compacta caiu de aproximadamente 50 KB para 2,2 KB e o pacote inicial do front caiu de cerca de 463 KB para 217 KB.
- 2026-08-10, auditoria: 2.426 questões e 2.260 Question Cards ativos passaram nas verificações estruturais, mas nenhum dos 113 tópicos aplicáveis atingiu simultaneamente as metas de 30 questões e 50 cards. Faltam 1.082 questões e 3.390 cards.
- 2026-08-10, auditoria: a distribuição atual é 25,8% fácil, 39,4% média e 34,8% difícil, distante da meta 60/30/10. Corrigir por adição incremental de itens fáceis e médios, sem apagar difíceis válidos e sem Gemini até autorização.
- 2026-08-10, infraestrutura: a conexão GitHub da Vercel foi recriada com o mesmo repositório `littleyache32/plataforma` e a branch de produção `main` para restaurar o deploy automático.
- 2026-08-10, acerto: a expansão local, sem Gemini, criou e importou atomicamente 1.082 questões e 3.390 Question Cards a partir dos trechos aceitos das apostilas. Todos os 113 tópicos aplicáveis passaram a ter pelo menos 30 questões e exatamente 50 cards.
- 2026-08-10, auditoria: o banco passou a ter 3.508 questões e 5.650 Question Cards ativos. A auditoria estrutural aprovou todos os itens, sem arquivamentos. A distribuição ficou em 48,7% fáceis, 27,3% médias e 24,1% difíceis; a diferença para 60/30/10 permanece porque questões difíceis válidas foram preservadas.
- 2026-08-10, regra resultante: expansão offline deve planejar o lote completo, validar cada item e gravar tudo em uma única transação. Se qualquer tópico não puder atingir a meta com fonte, evidência e unicidade, não realizar inserção parcial.
- 2026-08-10, entrega: foi criado um exportador da plataforma pessoal vazia para instalações independentes. O pacote exclui segredos, Git, Vercel, dependências, builds e dados do proprietário original; substitui rótulos e políticas pessoais por equivalentes genéricos e termina as migrações com banco sem objetivos, matérias, questões, cards, sessões ou estatísticas.
- 2026-08-10, regra resultante: toda cópia destinada a outra pessoa deve usar Supabase, Vercel, GitHub, senha e chaves próprios. Antes da entrega, gerar novamente a partir da lista controlada, executar a sanitização, testar como projeto separado e reabrir o ZIP para verificar os arquivos distribuídos.
- 2026-08-10, decisão visual: a plataforma adotou uma interface sketch minimalista baseada nas referências enviadas, com navegação clara, textura sutil de papel, cartões desenhados e animações curtas. O catálogo de Questões passou a exibir disciplinas e tópicos de forma expansível, e o Mentor recebeu apresentação em balões sem ganhar funcionalidades não solicitadas.
- 2026-08-10, correção de catálogo: o BACEN foi reconciliado com a lista visual confirmada pelo usuário. O banco passou de 9 disciplinas e 71 tópicos para exatamente 12 disciplinas e 71 tópicos autorizados. Conteúdo com correspondência clara foi realocado; tópicos e conteúdos sem correspondência foram removidos. Permaneceram 1.858 questões ativas e 2.900 Question Cards em 45 tópicos; 26 tópicos autorizados ficaram inicialmente sem acervo e não devem ser declarados completos.
- 2026-08-10, correção de classificação: itens de tópicos legados amplos foram redistribuídos por correspondência textual para remédios constitucionais, Poderes, verbos, pronomes, redes, navegadores, DFC, DVA, remuneração, conceitos de Arquivologia e modelos de Administração Pública. O total do acervo foi preservado, e 12 dos 71 tópicos BACEN permanecem sem conteúdo.
- 2026-08-10, decisão visual: a paleta foi refinada para azul predominante e acabamento mais minimalista, preservando a linguagem sketch, a hierarquia e todas as funcionalidades.
- 2026-08-10, correção visual e de prática: o refinamento azul predominante foi rejeitado e a paleta sketch anterior deve ser restaurada. Contagens de disciplinas e tópicos precisam refletir o acervo ativo; Questões e Question Cards abrem o primeiro item ao selecionar o foco e usam timer progressivo opcional, independente da resolução.
- 2026-08-11, nova regra de acervo: a meta mínima de 30 questões foi substituída por uma composição exata por tópico aplicável, com 100 questões distribuídas em 60 fáceis, 30 médias e 10 difíceis, além de exatamente 50 Question Cards. Excedentes podem ser arquivados de forma recuperável para cumprir a composição.
- 2026-08-11, nova regra de revisão: erro, Dúvida e Sem conhecimento devem incluir automaticamente a questão no Caderno de Questões para revisões futuras.
- 2026-08-11, acervo normalizado: os 113 tópicos aplicáveis ficaram com exatamente 11.300 questões e 5.650 Question Cards. Cada tópico possui 100 questões, sendo 60 fáceis, 30 médias e 10 difíceis, e 50 cards. A transação adicionou 8.367 questões e 1.290 cards e arquivou recuperavelmente 185 questões e 640 cards excedentes. Gatilhos no banco impedem novos excedentes.
- 2026-08-11, exclusão solicitada: o usuário determinou apagar todas as questões e todos os Question Cards de Faculdade e BACEN. A limpeza inclui os registros diretamente dependentes, mas preserva objetivos, disciplinas, tópicos, materiais, conhecimento, mentor e planejamento. Regra resultante: não repovoar o acervo sem nova autorização explícita.
- 2026-08-11, novo início: a data real da mentoria passou a ser 17 de agosto de 2026. Sessões anteriores foram removidas, e as duas semanas de construção de base passaram a abranger 17 a 30 de agosto.
- 2026-08-11, nova fonte autorizada: 11 pacotes do Estratégia foram auditados, totalizando 114 PDFs únicos, 24.410 páginas, nenhuma página sem texto e nenhuma falha de extração. O material didático local criado anteriormente foi removido.
- 2026-08-11, cobertura conservadora: os PDFs sustentam diretamente 63 dos 71 tópicos BACEN. Oito tópicos sem aula específica permanecem bloqueados para impedir conteúdo inventado: Gestão de Políticas Públicas; Licitações e Lei 8.666; Serviços Públicos; Correio Eletrônico; Word/Writer; Navegadores; Probabilidade; Problemas com Dados, Figuras e Palitos.
- 2026-08-11, reconstrução autorizada: foram importados 114 materiais, 6.300 questões e 3.150 Question Cards para os 63 tópicos cobertos. Cada tópico coberto tem exatamente 100 questões, com 60 fáceis, 30 médias, 10 difíceis, 75 CE e 25 ME, além de 50 cards. A reconstrução ocorreu sem Gemini e passou na auditoria transacional.
- 2026-08-11, correção de qualidade: a inspeção visual identificou sumário, abertura de aula, pergunta retórica, relato pessoal, metadado de questão anterior e fragmento de alternativa entre os primeiros itens gerados. Regra resultante: a extração para prática ignora as cinco páginas iniciais, páginas de provas comentadas, títulos e saudações, e aceita somente frases declarativas completas, sem marcas de banca, questão, gabarito ou alternativa.
- 2026-08-11, auditoria final do Estratégia: os 6.300 enunciados e 3.150 cards passaram na busca em lote por ruído editorial, com zero ocorrências. Amostras em produção de Contabilidade, Constitucional, Português, Lógica e Informática foram inspecionadas; as contagens por disciplina, tópico e Question Cards foram confirmadas no navegador, sem erro no console.
- 2026-08-11, correção de Question Cards: o modelo de cortar uma frase ao meio foi rejeitado por não garantir atomicidade nem recuperação clara. Regra resultante: manter 3.150 cards, 50 por tópico coberto, e estruturar cada item com contexto mínimo, pergunta ou lacuna inequívoca, dica de escopo, resposta direta e explicação curta vinculada à fonte.
- 2026-08-11, segunda correção de Question Cards: amostragem aleatória mostrou que forçar 50 cards por tópico mantinha conectivos sem contexto, linguagem de aula e respostas incompletas. Regra resultante: o acervo ideal passa a 1.890 cards, 30 por tópico coberto, aceitando apenas trechos autossuficientes e removendo o corte automático de expressões.
- 2026-08-11, terceira correção de Question Cards: filtros rigorosos mostraram que dois tópicos sustentam apenas 14 e 16 cards autossuficientes. Regra resultante: não completar metas com fragmentos artificiais; manter 1.250 cards úteis, de 14 a 20 por tópico e teto de 20.
- 2026-08-11, limite reconhecido: filtros determinísticos garantem estrutura, fonte e remoção de ruído evidente, mas não substituem revisão semântica humana de todo o acervo. Não declarar perfeição semântica dos 1.250 cards; a curadoria integral permanece uma etapa distinta e não autoriza Gemini.
- 2026-08-11, correção do mentor: a aderência mede demandas concluídas, sem penalizar o tempo real acima da estimativa. Uma atividade concluída permanece uma entrega única, sem continuação automática. Timer geral, mapa pedagógico dos PDFs e ampliação do painel do Yoda não foram autorizados nesta etapa.
- 2026-08-11, adaptação de carga: depois das duas semanas iniciais fixas, o mentor reduz somente os blocos de estudo BACEN para 30 minutos quando a aderência recente fica abaixo de 70%, mantém 60 minutos na faixa sustentável e amplia para 90 minutos apenas depois de duas semanas consecutivas com pelo menos 85%.
- 2026-08-12, seleção de escopo: foram aprovados P1 itens 5 e 6; P2 itens 5 e 6; P3 itens 1, 3, 4, 5 e 6; P4 itens 2, 3 e 5. P1 item 4 já estava concluído. Os demais itens da lista original não devem ser inferidos como aprovados.
- 2026-08-12, entrega operacional: o mentor passou a produzir fechamento semanal e trajetória condicionada à existência de data-alvo; cards ganharam denúncia e limite diário; o Administrador recebeu saúde, falhas, auditoria, cobertura e backup; e o planejador passou a bloquear duplicidade, excesso diário e transferência descontrolada.
- 2026-08-12, arquitetura aprovada: as doze portas serverless foram consolidadas em sete áreas para preservar margem no plano gratuito da Vercel. As URLs públicas e os handlers especializados devem continuar separados e compatíveis. Timer de foco, alertas do mentor, modo offline, busca global e comparador de edital foram apenas sugestões e não estão autorizados para implementação.
- 2026-08-12, correção da consolidação: o primeiro deploy das sete funções carregava todas as dependências administrativas ao abrir o painel e falhou em produção. Regra resultante: Painel, Materiais e Seed compartilham a função Administração, mas seus handlers são carregados sob demanda para manter dependências e falhas isoladas.
- 2026-08-12, nova autorização explícita: timer integrado no estilo YPT, central de alertas do Yoda, PWA offline, comparador de edital BACEN, backup automático com recuperação, modo foco, botão Próxima demanda e Central unificada de revisão foram aprovados em conjunto. A busca global continuou rejeitada e não deve ser acrescentada.
- 2026-08-12, regra de confiabilidade offline: respostas de Questões, revisões de Question Cards e registros de timer recebem identificador de operação único. A repetição durante a sincronização deve devolver o resultado já registrado, sem duplicar estatística nem tempo.
- 2026-08-12, correção do Controle de foco: Faculdade e BACEN não aparecem como separação global nesse módulo. O contexto e a disciplina são escolhidos localmente, ao lado de Estudo livre.
- 2026-08-12, correção do Mentor: Próxima demanda foi removida do cabeçalho da Semana e passou a ser uma ação exclusiva do painel do Yoda.
- 2026-08-12, início das revisões: nenhum Question Card pode aparecer na Central de revisão antes de 17 de agosto de 2026. A partir dessa data, continuam valendo vencimento, prioridade e limite diário.
- 2026-08-12, nova decisão visual: a linguagem sketch foi substituída pela referência editorial minimalista, com papel claro, tinta escura, laranja restrito a ações, painéis retos, tipografia editorial e transições curtas. Não reintroduzir gradientes, cartões arredondados intermediários ou cores saturadas sem pedido explícito.
- 2026-08-12, nova autorização de cobertura: o usuário autorizou completar os tópicos sem fonte específica usando o mesmo processo local, o conhecimento consolidado das disciplinas e a base curricular registrada. O Gemini permaneceu desautorizado. O acervo passou a 11.300 questões, exatamente 100 por cada um dos 113 tópicos aplicáveis, com distribuição 60 fáceis, 30 médias e 10 difíceis, e 2.260 Question Cards, exatamente 20 por tópico. A auditoria aprovou todos os itens estruturalmente, mas essa validação determinística não substitui curadoria semântica humana.
- 2026-08-12, correção encontrada em produção: ocultar cards somente na Central de revisão não bastava, pois o Yoda ainda mostrava prioridade e ação de cards vencidos. Até 17 de agosto de 2026, a restrição também se aplica aos alertas, prioridades, contador e botões do Mentor relacionados a Question Cards.
