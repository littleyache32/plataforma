# Memória operacional da Plataforma V2

Última atualização: 07/10/2026.

## Escopo atual

A Fase 1.7 fecha documentalmente a Fase 1 na v2, com commit autorizado e sem código funcional, banco, migrations, push ou deploy. Os contratos são coerentes; configuração Anki, apresentação responsiva da semana e parâmetros da policy permanecem por definição/aprovação nas etapas correspondentes. A leitura obrigatória continua mínima conforme AGENTS.md; esta memória não é leitura integral obrigatória. A Fase 2 exige nova solicitação explícita.

## Aprendizado do fechamento da Fase 1

- 07/10/2026, Fase 1.7: motivos copiados na demanda não são segunda fonte de decisão. Redação do domínio alinhada às fontes de verdade; AGENTS explicita a dispensa de testes funcionais no fechamento exclusivamente documental solicitado. Regra resultante: decisões de produto ainda abertas ficam registradas, sem solução inventada; commit apenas documental, sem autorização implícita de publicação ou fase seguinte.

## Preservação e consulta do histórico

A memória operacional anterior foi preservada integralmente em [memoria-operacional-v1.md](archive-v1/memoria-operacional-v1.md). O diretório archive-v1 é histórico e só deve ser consultado quando houver necessidade explícita de entender legado, no trecho pertinente. Não há obrigação de leitura integral. Datas, metas e estados antigos são evidência histórica, não autorização para reativar políticas superadas; a instrução mais recente e explícita do usuário prevalece.

Os demais documentos históricos estão em:

- [Auditoria do acervo de 10/08/2026](archive-v1/auditoria-acervo-2026-08-10.md).
- [Validação das conclusões da Fase 2](archive-v1/fase-2-validacao-conclusoes.md).
- [Consolidação da Fase 1 do Mentor V1](archive-v1/mentor-fase-1-consolidacao.md).
- [Roteiro consolidado do Mentor V1](archive-v1/roteiro-consolidado-mentor.md).

As [notas técnicas da Fase 2](fase-2-notas.md) permanecem disponíveis no caminho original por terem utilidade de manutenção. O roteiro V1 arquivado não constitui o roadmap operacional da V2.

## Regras de segurança desta transição

- Não remover migrations históricas ou renumerar arquivos já aplicados.
- Não remover código conectado, testes úteis, fontes privadas, backups ou trabalho local por aparência de legado.
- Não incorporar automaticamente branches V1 na V2. As implementações recentes da Fase 7 estão preservadas em snapshots identificados no inventário.
- Não incluir segredos, ambientes locais, PDFs pagos, dependências, builds ou artefatos pessoais no commit.
- Não confundir inspeção documental com validação do banco ou da produção.
- Antes de publicar uma alteração da aplicação, manter as verificações exigidas em AGENTS.md. Esta etapa não publica a aplicação.

## Histórico de aprendizado

- 06/10/2026, aprovação e execução da limpeza documental da Fase 0.4: o usuário determinou usar exclusivamente o inventário da Fase 0.3 e preservar a memória antiga. Acerto: arquivar documentos históricos sem alterar seu conteúdo e manter este ponto de entrada para não quebrar AGENTS.md. Regra resultante: classificação como candidato não autoriza excluir arquivo necessário; o inventário não confirmou nenhum arquivo inteiro de código morto, portanto nenhuma remoção de código foi realizada.
- 06/10/2026, validação da Fase 0.5: dependências diretas coincidem com o lockfile; 164 testes em 22 arquivos, lint de 118 arquivos e build passaram. O preview local abriu a tela de acesso e serviu todos os assets, sem erros/avisos capturados. Limitação: autenticação real e APIs/banco não foram exercitados; autenticação estrutural e compilação dos módulos foram verificadas. Acerto: registrar PASS COM LIMITAÇÕES sem corrigir débitos V1 nem declarar integração não testada. Regra resultante: baseline de desenvolvimento permite a próxima fase somente mediante autorização específica, não deploy nem encerramento automático de débitos históricos.
- 06/10/2026, definição explícita do contrato V2 na Fase 1.1: o usuário consolidou um único Mentor determinístico, sem agentes independentes nem LLM/IA operacional; plano semanal com movimentação entre dias; confiança junto à resposta; timer livre 30/50/personalizado em minutos; revisão integrada ao plano e SRS inspirado na configuração escolhida do Anki. Excluiu por enquanto anamnese, feedback Leve/Normal/Pesado e novo estado visual do conteúdo. Acerto: registrar precedência sobre regras V1 incompatíveis sem alterar a aplicação ou escolher configuração Anki/layout por inferência. Regra resultante: organização interna por domínio não cria novas autoridades; parâmetros ainda não escolhidos permanecem pendentes para as etapas correspondentes.
- 06/10/2026, modelo de domínio da Fase 1.2: foram documentadas 17 entidades com limites, relações e fontes canônicas. Acerto: separar demanda, timer/tempo, progresso, cobertura, tentativa e inferência de domínio; tratar Central como visão complementar e decisão do único Mentor como resultado auditável, não fato de execução. A comparação usa migrations do checkout, não confirmação do banco real. Regra resultante: estatísticas/projeções não substituem registros canônicos, Mentor não reescreve história factual, e candidatura de redundância não autoriza apagar registros ou migrations.
- 06/10/2026, arquitetura conceitual da Fase 1.3: conhecimento organizado nos dez domínios solicitados, sem especialistas ou agentes independentes, com fluxo único de fatos/sinais/regras/decisão/planejamento e motivos estruturados. Acerto: definir entradas, saídas e fallback conservador sem inventar domínio, ativar prática para coletar dados ou escolher todos os thresholds. Regra resultante: domínio interno não cria autoridade autônoma; insuficiência de evidência e falha técnica são explícitas, e policy/configuração Anki pendentes não são substituídas automaticamente por números históricos.
- 07/10/2026, fontes únicas da Fase 1.4: definidos os 13 conceitos com autoridade por responsabilidade, distinguindo policy/algoritmo/contexto, carga decidida/plano efetivo/execução e necessidade/agendamento/atendimento de revisão. Acerto: permitir derivados somente como projeções rastreáveis/reconciliáveis, sem declarar fontes já implementadas nem estado do banco confirmado. Regra resultante: cache/documento/migration histórica não pode virar fonte operacional concorrente; campos agregados não substituem fatos canônicos.
- 07/10/2026, correção das instruções na Fase 1.5: a leitura integral da memória V1 antes de toda alteração foi rejeitada por custo desnecessário de contexto. Acerto: AGENTS.md passa a exigir somente contrato de produto, documento da área e fontes de verdade quando domínio/dados forem alterados. Regra resultante: histórico V1 é consulta explícita de legado; testes direcionados nas microetapas, suíte completa/lint/build somente no fechamento; migrations e deploy exigem autorização explícita. A antiga obrigação de leitura integral desta memória ou do arquivo V1 está superada.
