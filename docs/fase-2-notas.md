# Fase 2: currículo e materiais

Auditoria de 30/09/2026: os 11 pacotes locais do Estratégia contêm 114 PDFs
distintos, com 24.410 páginas. O SHA-256 de cada arquivo local correspondeu
ao inventário de extração e a um dos 114 materiais já armazenados no banco.
Esses totais são o estado auditado, não constantes usadas pelo produto.

O catálogo antigo repartiu três pacotes entre matérias diferentes. A coluna
`disciplina_curso` preserva o nome do conjunto original, enquanto `materia_id`
continua existindo para referências históricas. O planner agrupa e ordena por
`disciplina_curso` e `ordem_curso`, sem usar os tópicos antigos para inventar aulas.

`material_unidade_curricular` registra inicialmente uma unidade por PDF, com
o título real do arquivo. É uma identificação verificável de conteúdo no nível
de aula. Capítulos internos só devem ser acrescentados se identificados no
sumário ou por curadoria com referência ao próprio PDF. A tabela não libera
Questões ou Question Cards por si só.

O progresso do material tem três estados: ausência de linha significa não
iniciado; `em_andamento` surge quando um bloco vinculado é concluído;
`concluido` exige marcação explícita da aula/PDF. A quantidade de blocos
concluídos é calculada das sessões, não duplicada como contador mutável.
Desmarcar o último bloco retorna a não iniciado, exceto se o PDF já foi
explicitamente concluído. Blocos adicionais seguem no mesmo PDF enquanto ele
não estiver concluído.

## Manutenção pessoal

Depois da migration 0064, sincronizar o acervo vigente primeiro em modo de
auditoria e depois com `--apply`:

`node --env-file=.env.local scripts/sync-strategy-curriculum.js --root="CAMINHO_ESTUDO" --report="CAMINHO_AUDITORIA_JSON"`

`node --env-file=.env.local scripts/sync-strategy-curriculum.js --root="CAMINHO_ESTUDO" --report="CAMINHO_AUDITORIA_JSON" --apply`

Para novos PDFs, usar `scripts/import-study-materials.js --input="CAMINHO"`.
Aceita PDF individual, pasta e ZIP. Sem `--apply`, verifica entrada, hash,
duplicidade e ordem sem gravar. Para conjunto já conhecido, identifica o
pacote pela pasta. Para outro curso, informar `--disciplina-curso`, `--materia`
e `--ordem` (ou um `--manifest=arquivo.json` com essas chaves por caminho do
PDF). Uma matéria ainda não cadastrada exige cadastro técnico prévio; o
importador não altera currículo sem essa associação explícita. Com `--apply`,
extrai páginas e texto; PDFs sem camada textual suficiente ficam marcados como
`pendente_ocr` e fora do planejamento até OCR verificado. O PDF binário não
entra no GitHub e nenhuma questão ou card é criado.

Dependências externas não contidas no repositório: os próprios PDFs pagos,
variáveis de produção e dados reais do Supabase.
