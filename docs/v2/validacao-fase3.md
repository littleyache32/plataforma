# Integração final da Fase 3

Data: 07/10/2026. Subfase 3.16. Branch: `v2`.

Status: **PASS COM LIMITAÇÕES**. Integração local aprovada; não representa configuração, aplicação de migrations ou validação de produção.

## Método e evidências

`tests/mentor-v2-final-integration.test.js` executa reconciliação de fatos, `prepareMentorWeek`, adaptador factual, sinais, policy, priorização, materialização, persistência da avaliação/demandas e consulta da origem. Não substitui policy/planner por mocks. O adaptador relacional de persistência usa somente dados sintéticos em memória, sem conexão externa. Testes anteriores complementam validação da API do encontro e da interface.

Cada demanda produzida no teste integrado deve recuperar sua decisão original, reason codes e evidências. A avaliação permanece com domínio desconhecido, não cria dívida e não altera progresso do material. Nenhuma regra ou funcionalidade operacional nova foi necessária na 3.16. Foi acrescentado suporte ao filtro `in` no adaptador de teste, necessário para o fechamento factual de semana.

| cenário obrigatório | evidência na matriz integrada | resultado |
| --- | --- | --- |
| Semana normal | Teste 1: 14 demandas sintéticas; reaplicação preserva os mesmos registros. | PASS |
| Dia indisponível | Teste 2: zero demandas na data bloqueada; restrição registrada. | PASS |
| Prova próxima no encontro | Teste 3: prova canônica governa seleção acadêmica e aparece nas evidências. | PASS |
| Compromisso novo | Teste 4: entrega bloqueante impede uso da data; repetição não duplica compromisso. | PASS |
| Capacidade superior à disponibilidade | Teste 5: só um bloco cabe em 70 minutos disponíveis; não alonga o bloco. | PASS |
| Demanda perdida anterior | Teste 6: nova continuidade possui origem própria; histórico anterior intacto. | PASS |
| Várias pendências | Teste 7: 20 pendências não ampliam as 14 demandas configuradas nem duplicam registros. | PASS |
| Histórico insuficiente | Teste 8: base configurada materializada sem decisão de aumento/redução ou domínio inventado. | PASS |
| Continuidade da Faculdade | Teste 9: capacidade acadêmica explicitamente configurada preservada. | PASS |
| Capacidade adicional favorece concurso | Teste 10: slot adicional configurado com destino estrutural vai ao concurso sem retirar Faculdade. | PASS |
| Semana sem encontro | Teste 11: fontes válidas permitem geração sem encontro. | PASS |
| Encontro sem fatos pertinentes | Teste 12: decisões idênticas às da ausência de encontro. | PASS |
| Feedback legado ausente da decisão | Teste 13: Leve/Adequada/Pesada ignorados, decisões idênticas. | PASS |
| Movimento manual preserva origem | Teste 14: data/ordem/status podem mudar sem reescrever decisão original; material permanece sem conclusão. | PASS |
| Ausência de fallback V1 | Teste adicional: configuração histórica retorna 503/NAO_AVALIAVEL, sem criação. | PASS |

Os números de slots e datas acima são fixtures, não configuração pessoal nem política permanente. Capacidade adicional explicitamente configurada não equivale a progressão automática por aderência. Sem critério aprovado, não há aumento autônomo.

## Validação executada

- Direcionados: 295 testes aprovados em 14 arquivos, incluindo os 15 testes da matriz final.
- Suíte completa: `npm test`, 461 testes aprovados em 35 arquivos.
- Lint: `npm run lint`, 144 arquivos verificados sem problemas pelo verificador estrutural do projeto. Não é uma análise ESLint de todas as regras de React.
- Build: `npm run build`, aprovado, 49 módulos transformados.
- `git diff --check`: aprovado.

A primeira execução da matriz encontrou uma expectativa incorreta no teste, não um bug operacional: sem histórico e com base válida, `carga_semanal.acao` é `MATERIALIZAR_CAPACIDADE_CONFIGURADA`, não `MANTER`. A expectativa foi corrigida após conferir a policy, mantendo a exigência de não aumentar/reduzir carga autonomamente e de não inferir domínio.

## Limitações e pendências explícitas

- Banco real, schema/configuração vigente e ativação da policy V2 não foram inspecionados ou alterados nesta subfase. Perfil real ainda precisa fornecer capacidade e disponibilidade canônicas; não são inventadas pelo motor.
- Persistência sintética não prova atomicidade/concorrência PostgreSQL, RLS nem fluxo autenticado no navegador. Não foi realizado E2E em produção.
- Reconciliação de fatos entre compromisso, contexto e encontro permanece composta por chamadas separadas, com os limites de falha/retry documentados na 3.13; não foi adicionada transação nesta fase.
- O teste de movimento/conclusão altera a linha sintética e valida a reação do planner/rastreio; não simula clique de usuário nem transação de conclusão de sessão/tempo.
- Critérios numéricos de progressão e qualificação estatística continuam pendentes de definição. Revisão avançada, FSRS, geração de cards e simulados não foram implementados.
- Alteração local preexistente em `docs/v2/ux-ui.md`, diretório `output/`, ZIP de auditoria, ambientes, dependências e outputs foram preservados fora do checkpoint da Fase 3.

Sem deploy, merge, push, migration ou alteração de dados reais. O checkpoint inclui trabalho legítimo ainda local das subfases 3.12 a 3.15 e testes/documentação da 3.16; a base 3.1 a 3.10 já estava versionada no commit anterior. O SHA final é consultável no histórico Git do próprio documento, sem referência circular no conteúdo.

Aprendizado: uma base configurável, disponibilidade factual e carga resultante são contratos diferentes. Regra confirmada: materializar somente o que cabe, conservar histórico e registrar por que cada demanda existe. Encerramento desta subfase não autoriza iniciar a Fase 4.
