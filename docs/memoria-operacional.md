# Memória operacional da Plataforma V2

Última atualização: 06/10/2026.

## Escopo atual

A Fase 0.4 autoriza somente limpeza documental na branch `v2`, baseada no [inventário da Fase 0.3](v2/inventario-v1.md), com commit local. Não autoriza mudanças de funcionamento, refatoração, alteração de banco, aplicação de migrations, push ou deploy.

## Preservação e consulta do histórico

A memória operacional anterior foi preservada integralmente em [memoria-operacional-v1.md](archive-v1/memoria-operacional-v1.md). Antes de alterar a aplicação, ler também esse histórico integralmente para preservar decisões e correções válidas. Datas, metas e estados antigos são evidência histórica, não autorização para reativar políticas superadas; a instrução mais recente e explícita do usuário prevalece.

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
