# Contrato funcional da Plataforma V2

Data: 06/10/2026. Fase 1.1. Branch: `v2`.

## Natureza do contrato

Este documento consolida as decisões funcionais explicitamente definidas pelo usuário para a V2. Não descreve funcionalidades já implementadas nem autoriza implementação nesta subfase. Em conflito com documentos históricos da V1, estas decisões prevalecem; assuntos não definidos aqui não recebem novas regras por inferência.

O [inventário V1](inventario-v1.md) orienta preservação e reaproveitamento. O [baseline técnico](baseline.md) registra o estado de partida e seus limites. Nenhum desses documentos substitui este contrato funcional.

## Produto

- Plataforma pessoal de estudos, voltada ao uso de longo prazo.
- Deve atender concursos atuais e futuros, sem limitar o produto a um concurso específico.
- Faculdade e concurso coexistem na mesma plataforma.
- Não há LLM nem IA operacional dentro da plataforma.
- As decisões inteligentes são determinísticas, baseadas em regras, dados e estatística.

## Mentor

- Existe um único Mentor.
- Não existem especialistas ou agentes independentes.
- Conhecimentos podem ser organizados internamente por domínio, sem criar autoridades decisórias separadas.
- A decisão final pertence sempre ao Mentor.

Organização interna por domínio não equivale a vários Mentores. Este contrato não define quantidade de domínios, novas tabelas ou nova arquitetura.

## Meu Plano

- A tela principal operacional é semanal.
- A semana inteira deve estar visível na experiência de planejamento.
- O usuário pode mover demandas entre dias e reordená-las.
- Pendência não cria automaticamente dívida de horas.
- Conteúdo pendente pode voltar em semanas futuras se continuar relevante.

Não há autorização para compensação automática de horas perdidas. A apresentação responsiva da semana inteira será definida na etapa correspondente, sem impor um layout novo nesta subfase.

## Demandas

O planejamento pode representar:

- Teoria/conteúdo.
- Questões.
- Question Cards.
- Revisão.
- Futuramente, simulados.

Listar uma modalidade no contrato não a libera automaticamente nem autoriza geração de acervo. Simulados permanecem uma capacidade futura, sem implementação agora.

## Timer

### Uso livre

- O usuário seleciona a matéria.
- Pode escolher 30 minutos, 50 minutos ou duração personalizada.
- A duração personalizada recebe somente minutos, sem exigir preenchimento em horas ou outro formato.

### Uso pelo plano

- A demanda já informa o contexto necessário ao timer.
- Iniciar deve exigir o mínimo possível de interação, aproveitando as informações da demanda.

Os presets do timer livre não estabelecem, por si só, a duração de todas as demandas do planejamento. Este contrato não acrescenta conversões, formulários, passos ou regras de carga não solicitados.

## Revisão

- Revisão faz parte do planejamento.
- A Central de Revisão é uma fila/visão complementar.
- A Central não compete com Meu Plano como outro planejador.
- Revisões podem usar questões ou Question Cards; não se exige usar ambos em toda revisão.
- Um item pode reaparecer inclusive muito tempo depois, quando isso fizer sentido.

Não são fixados intervalos universais, prazo máximo de reaparecimento ou algoritmo novo nesta subfase.

## Questões

- A confiança é classificada junto à resposta na interface.
- Opções: Sem conhecimento, Eliminação, Dúvida e Certeza.
- Depois da confirmação, mostrar o gabarito comentado e os comentários das alternativas, quando a questão possuir alternativas.

Classificar confiança junto à resposta substitui a obrigação histórica de uma etapa separada anterior à resposta. Este contrato não acrescenta uma tela intermediária ou um novo fluxo de confirmação.

## Question Cards

- Fundamentados em recuperação ativa e alta qualidade.
- Avaliação na ordem: 1 Novamente, 2 Difícil, 3 Bom, 4 Fácil.
- SRS inspirado no comportamento e na configuração escolhida do Anki.

Não se presume algoritmo, versão ou configuração padrão do Anki. A inspiração não autoriza copiar automaticamente todas as funcionalidades desse produto.

## Faculdade

- A interface existente deve ser preservada inicialmente.
- Faculdade continua relevante e coexistindo com o concurso.
- Concurso continua sendo a prioridade estrutural.

Prioridade estrutural não significa excluir a Faculdade. Nenhuma nova proporção, carga ou rotina acadêmica é definida aqui.

## Fora do escopo por enquanto

- Anamnese inicial.
- Feedback Leve/Normal/Pesado.
- Novo sistema visual de estado do conteúdo.
- Funcionalidades extras não solicitadas.

O feedback acima não deve ser reintroduzido na V2 apenas porque existe no histórico ou em componentes V1. Esta subfase registra a exclusão de escopo, mas não remove nem altera componentes existentes.

## Precedência sobre decisões históricas

| assunto | decisão vigente da V2 |
| --- | --- |
| Especialistas/agentes V1 | Um único Mentor; organização interna por domínio sem agentes independentes ou decisões paralelas. |
| Reordenação limitada ao mesmo dia | Permitir mover demandas entre dias e reordená-las. |
| Confiança como etapa separada anterior | Classificação junto à resposta na interface. |
| SRS descrito genericamente ou com outra referência | Comportamento/configuração escolhida do Anki; parâmetros ainda por definir. |
| Percepção de carga como formulário novo | Feedback Leve/Normal/Pesado fora do escopo por enquanto. |
| Datas, rotinas e catálogo de um concurso passado | Uso pessoal de longo prazo, com concursos atuais/futuros e Faculdade coexistindo. |

Preservar o histórico V1 não torna suas regras incompatíveis automaticamente vigentes. Não há alteração de código, banco, migrations ou produção para aplicar esta precedência na Fase 1.1.

## Ambiguidades restantes

1. **Anki:** qual comportamento/configuração deve inspirar o SRS, incluindo algoritmo e parâmetros. Não escolher automaticamente.
2. **Semana inteira visível:** resolvida pela instrução explícita da Fase 2 em 07/10/2026: sete colunas no desktop, sete grupos de dias em uma coluna no mobile e sidebar recolhível. Contrato visual em ux-ui.md.

Esses pontos não impedem o fechamento documental da Fase 1.1. Devem ser definidos antes das implementações correspondentes, sem ampliar o escopo ou iniciar a próxima fase automaticamente.

## Fechamento conjunto da Fase 1

Revisão documental em 07/10/2026, Fase 1.7. Status: **PASS COM PENDÊNCIAS**.

Os cinco contratos V2 e AGENTS.md foram confrontados em conjunto. Não há contradição de produto não resolvida entre eles. Dois pontos de redação foram alinhados: motivos em sessao.reason_codes são projeção da decisão, conforme fontes-de-verdade.md; fechamento exclusivamente documental não exige suíte funcional/lint/build quando o escopo explícito os dispensa.

Permanecem decisões para definição/aprovação do usuário antes da implementação correspondente:

- Comportamento/configuração Anki que orientará o SRS.
- Apresentação da semana inteira em desktop e mobile: pendência original da Fase 1, posteriormente resolvida pela Fase 2; não é mais bloqueio visual.
- Parâmetros de carga, duração por modalidade, fallback inicial, janelas/thresholds e precedência da policy V2, deliberadamente não escolhidos na Fase 1.3. Não presumir aprovação de novos valores nem reativar regras históricas incompatíveis.

Correspondência curricular, vínculo de atendimento de revisão e rastreabilidade de decisões são pendências técnicas delimitadas, não novos requisitos de produto. Schema/dados reais ainda precisam de conferência autorizada; a revisão documental não comprova produção.

O fechamento permite iniciar a Fase 2 quando houver solicitação explícita e escopo definido. Não autoriza implementar itens dependentes das decisões acima, migrations ou deploy, nem inicia a fase seguinte automaticamente. Apenas documentação/instruções foram alteradas; verificações estruturais substituem testes funcionais nesta subfase.
