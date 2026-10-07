# Instruções de desenvolvimento da Plataforma V2

## Leitura mínima antes de trabalhar

Ler somente:

1. `docs/v2/produto.md`.
2. O documento específico da área que será alterada. Por exemplo, `docs/v2/mentor.md` para o Mentor ou `docs/v2/dominio.md` para o modelo de domínio. Esses exemplos não exigem ler ambos em toda tarefa.
3. `docs/v2/fontes-de-verdade.md` quando houver alteração de domínio ou dados.

Não carregar todos os documentos da V2 por padrão. Se a área ainda não possuir documento específico, informar essa lacuna sem compensar com leitura integral do histórico ou criar documentação não solicitada.

## Histórico V1

`docs/archive-v1/` é documentação histórica. Consultar somente quando houver necessidade explícita de entender legado, limitando a leitura ao documento ou trecho pertinente.

Não é obrigatória a leitura integral de `docs/memoria-operacional.md` nem da memória V1 arquivada em toda execução. A memória de trabalho não substitui os contratos da V2 nem amplia a leitura mínima acima.

## Escopo e precedência

- A instrução explícita mais recente do usuário prevalece em caso de conflito.
- Não inventar funcionalidades, filtros, ações ou textos não solicitados.
- Não transformar exemplos isolados em regras gerais.
- Não alterar áreas fora do escopo nem iniciar a próxima fase automaticamente.
- Preservar trabalho local válido, histórico factual, fontes privadas e migrations históricas necessárias.
- Após correção, aprovação ou rejeição, atualizar somente a documentação pertinente e registrar brevemente data, aprendizado e regra resultante. Não exigir releitura de todo o histórico para isso.

## Validação e publicação

- Durante microetapas, executar testes direcionados ao escopo alterado.
- Executar suíte completa, lint e build apenas no fechamento da fase, respeitando o escopo explícito solicitado.
- Em fases exclusivamente documentais, usar verificações documentais/estruturais; não executar suíte de código, lint ou build quando não houver alteração funcional e o escopo solicitado dispensar essas execuções.
- Não executar nem aplicar migrations sem autorização explícita.
- Não fazer deploy sem autorização explícita. Commit ou push não constituem autorização de deploy.
- Quando houver publicação autorizada, validar a versão publicada no navegador dentro do escopo da fase.
