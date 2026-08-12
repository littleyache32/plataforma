import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const outputRoot = join(root, 'output', 'plataforma-pessoal-vazia')
const allowedDirectories = ['api', 'public', 'src', 'shared', 'supabase', 'tests']
const allowedFiles = ['index.html', 'package-lock.json', 'package.json', 'vercel.json', 'vite.config.js']
const excluded = new Set([
  'api/_lib/acervo-handler.js',
  'api/_lib/rebuild-handler.js',
  'tests/mentor.test.js',
  'tests/planner.test.js',
  'tests/simulation-eligibility.test.js',
])

const resetMigration = `-- Esta migração existe apenas no pacote vazio distribuível.
-- Ela remove todo conteúdo demonstrativo criado pelas migrações históricas,
-- preservando somente a estrutura e as políticas pedagógicas genéricas.

truncate table objetivo restart identity cascade;
truncate table mentor_execucao restart identity cascade;
truncate table mentor_conhecimento restart identity cascade;
truncate table conhecimento_modulo restart identity cascade;
truncate table uso_api restart identity cascade;
truncate table topic_merge_map restart identity cascade;

insert into mentor_conhecimento (versao, titulo, descricao, politica, evidencias, ativo)
values (
  'base-vazia-1',
  'Política genérica do mentor',
  'Regras iniciais de diagnóstico e revisão, sem rotina, concurso ou faculdade previamente definidos.',
  '{
    "amostra_minima": 20,
    "janela_maxima": 60,
    "meia_vida_recencia_dias": 21,
    "prior_beta": {"acertos": 2, "erros": 2},
    "limiares": {"dominio": 0.68, "falsa_certeza": 0.12, "melhora_recente": 0.2},
    "pesos_confianca": {
      "certeza": {"acerto": 1.35, "erro": 2.2},
      "duvida": {"acerto": 0.9, "erro": 1.1},
      "eliminacao": {"acerto": 1.05, "erro": 1.2},
      "sem_conhecimento": {"acerto": 0.65, "erro": 1.4}
    },
    "agenda_faculdade": []
  }'::jsonb,
  '[
    {"principio":"pratica_de_recuperacao","fonte":"Roediger e Karpicke, 2006","doi":"10.1111/j.1467-9280.2006.01693.x"},
    {"principio":"pratica_distribuida","fonte":"Cepeda et al., 2006","doi":"10.1037/0033-2909.132.3.354"}
  ]'::jsonb,
  true
);

insert into conhecimento_modulo (modulo, versao, titulo, descricao, conteudo, evidencias, ativo)
values
  ('questoes', 'base-vazia-1', 'Conhecimento de questões', 'Regras gerais para questões objetivas e discursivas.',
    '{"objetivas":{"status":"ativo","formatos":["CE","ME"],"fonte_obrigatoria":true,"revisao_espacada":true},"discursivas":{"status":"bloqueado","banco_criado":false}}'::jsonb, '[]'::jsonb, true),
  ('question_cards', 'base-vazia-1', 'Conhecimento de Question Cards', 'Regras gerais de recuperação ativa e revisão espaçada.',
    '{"status":"ativo","revisao_espacada":true,"principios":["recuperacao_ativa","uma_ideia_por_card","pergunta_especifica","fonte_verificavel","sem_duplicidade"]}'::jsonb, '[]'::jsonb, true),
  ('mentor', 'base-vazia-1', 'Conhecimento do mentor', 'Política adaptativa inicial sem dados pessoais.',
    '{"politica":{"amostra_minima":20,"janela_maxima":60,"agenda_faculdade":[]},"demandas":{"planejamento_semanal":true,"remanejar_pendencias":true,"revisoes_como_demanda":true}}'::jsonb, '[]'::jsonb, true),
  ('simulados', 'base-vazia-1', 'Conhecimento de simulados', 'Módulo mantido bloqueado até configuração do proprietário.',
    '{"status":"bloqueado"}'::jsonb, '[]'::jsonb, true);
`

const readme = `# Plataforma Pessoal de Estudos

Esta é uma cópia vazia e independente da plataforma de estudos. Ela inclui questões objetivas, Question Cards com revisão espaçada, desempenho, semana orientada pelo mentor, materiais e infraestrutura para simulados.

Nenhuma matéria, questão, card, resposta, estatística, rotina, senha ou chave do proprietário original acompanha este pacote.

## O que você precisa criar

1. Uma conta própria no GitHub.
2. Um projeto próprio no Supabase.
3. Um projeto próprio na Vercel.
4. Uma senha exclusiva para acessar a plataforma.
5. Opcionalmente, uma chave Gemini própria para avaliar materiais e gerar questões.

Leia primeiro o arquivo [PRIMEIROS-PASSOS.md](PRIMEIROS-PASSOS.md).

## Desenvolvimento local

Requisitos: Node.js 24 ou superior.

\`\`\`bash
npm install
copy .env.example .env.local
npm run migrate
npm run dev:full
\`\`\`

## Verificação

\`\`\`bash
npm test
npm run lint
npm run build
\`\`\`

Nunca envie o arquivo \`.env.local\` ao GitHub e nunca use o prefixo \`VITE_\` em segredos.
`

const firstSteps = `# Primeiros passos

## 1. Descompactar e criar o repositório

Descompacte este pacote em uma pasta nova. Crie um repositório vazio na sua conta do GitHub e envie somente o conteúdo dessa pasta.

## 2. Criar o banco no Supabase

Crie um projeto novo e vazio no Supabase. Copie as chaves e a conexão PostgreSQL para o arquivo \`.env.local\`.

## 3. Configurar o arquivo local

Duplique \`.env.example\` com o nome \`.env.local\` e preencha:

\`\`\`text
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_PUBLISHABLE_KEY=
POSTGRES_URL_NON_POOLING=
APP_ACCESS_KEY=
CRON_SECRET=
GEMINI_API_KEY=
GEMINI_ENABLED=false
\`\`\`

Use uma senha longa e exclusiva em \`APP_ACCESS_KEY\`. A chave Gemini é opcional. Mantenha \`GEMINI_ENABLED=false\` enquanto não quiser usar IA.

## 4. Criar a estrutura do banco

No terminal da pasta:

\`\`\`bash
npm install
npm run migrate
\`\`\`

A última migração limpa todo conteúdo demonstrativo. O resultado contém zero objetivos, matérias, tópicos, questões, cards, sessões e estatísticas.

## 5. Publicar na Vercel

Importe o repositório na Vercel. Cadastre na Vercel as mesmas variáveis do \`.env.local\`. Não use variáveis com prefixo \`VITE_\` para chaves privadas.

## 6. Primeiro acesso

1. Entre com a senha definida em \`APP_ACCESS_KEY\`.
2. Mude para Administrador.
3. Abra Objetivos.
4. Crie Faculdade ou Concurso.
5. Adicione disciplinas e tópicos.
6. Abra Materiais para inserir o próprio conteúdo.

## 7. Conteúdo e IA

Sem Gemini, a estrutura, importações locais, prática, desempenho e revisões funcionam normalmente. A avaliação automática de materiais e a geração pelo painel exigem uma chave Gemini própria e \`GEMINI_ENABLED=true\`.

## Segurança

- Não compartilhe \`.env.local\`.
- Não copie chaves de outra pessoa.
- Não use o mesmo projeto Supabase de outra plataforma.
- Não use a mesma senha de acesso de outra instalação.
- Confira o histórico do Git antes de publicar.
`

const envExample = `# Backend somente. Nunca use o prefixo VITE_ em segredos.
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_PUBLISHABLE_KEY=
POSTGRES_URL_NON_POOLING=
APP_ACCESS_KEY=
CRON_SECRET=

# IA opcional. Mantenha desativada até decidir usar uma chave própria.
GEMINI_ENABLED=false
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.1-flash-lite
GEMINI_RESEARCH_MODEL=gemini-3-flash-preview
`

async function filesUnder(directory) {
  const result = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) result.push(...await filesUnder(path))
    else result.push(path)
  }
  return result
}

async function copySelected() {
  for (const directory of allowedDirectories) {
    for (const source of await filesUnder(join(root, directory))) {
      const name = relative(root, source).replaceAll('\\', '/') 
      if (excluded.has(name)) continue
      const destination = join(outputRoot, name)
      await mkdir(dirname(destination), { recursive: true })
      await cp(source, destination)
    }
  }
  for (const name of allowedFiles) await cp(join(root, name), join(outputRoot, name))
  for (const name of ['migrate.js', 'lint.js', 'audit-and-adapt-cards.js', 'audit-and-adapt-library.js', 'audit-coverage.js', 'audit-production.js', 'expand-offline-library.js']) {
    await mkdir(join(outputRoot, 'scripts'), { recursive: true })
    await cp(join(root, 'scripts', name), join(outputRoot, 'scripts', name))
  }
}

async function replaceIn(relativePath, replacements) {
  const path = join(outputRoot, relativePath)
  let content = await readFile(path, 'utf8')
  for (const [search, replacement] of replacements) content = content.replace(search, replacement)
  await writeFile(path, content)
}

async function sanitizeCode() {
  const textFiles = (await filesUnder(outputRoot)).filter((path) => /\.(?:js|jsx|css|html|json|sql|md)$/.test(path))
  for (const path of textFiles) {
    let content = await readFile(path, 'utf8')
    const genericReplacements = [
      ['BACEN', 'Concurso'], ['Bacen', 'Concurso'],
      ['Direito das Pessoas e dos Negócios Jurídicos', 'Disciplina demonstrativa 1'],
      ['Pessoas e Negócios Jurídicos', 'Disciplina demonstrativa 1'],
      ['Teoria da Constituição e Direitos Fundamentais', 'Disciplina demonstrativa 4'],
      ['Teorias da Constituição', 'Disciplina demonstrativa 4'],
      ['Teoria da Constituição', 'Disciplina demonstrativa 4'],
      ['Teorias da Justiça', 'Disciplina demonstrativa 3'],
      ['Teoria da Justiça', 'Disciplina demonstrativa 3'],
      ['Teoria do Crime', 'Disciplina demonstrativa 2'],
      ['direito das pessoas e dos negocios juridicos', 'disciplina demonstrativa 1'],
      ['pessoas e negocios juridicos', 'disciplina demonstrativa 1'],
      ['teoria da constituicao e direitos fundamentais', 'disciplina demonstrativa 4'],
      ['teorias da constituicao', 'disciplina demonstrativa 4'],
      ['teoria da constituicao', 'disciplina demonstrativa 4'],
      ['teorias da justica', 'disciplina demonstrativa 3'],
      ['teoria da justica', 'disciplina demonstrativa 3'],
      ['teoria do crime', 'disciplina demonstrativa 2'],
      ['2026-08-09', '2000-01-02'], ['2026-08-10', '2000-01-03'],
      ['2026-08-23', '2000-01-16'], ['2026-08-24', '2000-01-17'],
      ['2026-09-07', '2000-01-31'],
    ]
    for (const [search, replacement] of genericReplacements) content = content.replaceAll(search, replacement)
    await writeFile(path, content)
  }

  await replaceIn('api/_lib/seed-handler.js', [
    [/import archiveHandler[^\n]+\n/, ''],
    [/import rebuildHandler[^\n]+\n/, ''],
    [/\s*if \(queryParam\(req, 'recurso'\) === 'acervo'\)[^\n]+\n/, '\n'],
    [/\s*if \(queryParam\(req, 'recurso'\) === 'reconstruir'\)[^\n]+\n/, '\n'],
    [/import \{ queryParam \}[^\n]+\n/, ''],
  ])
  await replaceIn('src/App.jsx', [[
    'setCatalog(data.objetivos)\n    setObjectiveId',
    "setCatalog(data.objetivos)\n    if (!data.objetivos.length) { setMode('administrador'); setArea('objetivos') }\n    setObjectiveId",
  ]])
  await replaceIn('src/components/Week.jsx', [
    ["const mentorshipStart = '2026-08-10'", "const mentorshipStart = '2000-01-03'"],
    ["range.end < mentorshipStart ? 'A mentoria começa em 10 de agosto.' : ", ''],
  ])
  await replaceIn('shared/planner.js', [
    ["export const MENTORSHIP_START = '2026-08-10'", "export const MENTORSHIP_START = '2000-01-03'"],
    ["if (today < '2026-08-09') return false", "if (today < '2000-01-02') return false"],
    [/const onboarding = weekStart >= MENTORSHIP_START && weekStart < '2026-08-24'/, 'const onboarding = false'],
  ])
  await replaceIn('api/_lib/plano-handler.js', [[
    "const onboardingWithoutCards = inicio >= '2026-08-10' && inicio < '2026-08-24'",
    'const onboardingWithoutCards = false',
  ]])
  await replaceIn('shared/mentor-policy.js', [[
    /agenda_faculdade: \[[\s\S]*?\n  \],/,
    'agenda_faculdade: [],',
  ]])
  await replaceIn('shared/mentor.js', [
    [/export function mentorPhase\([\s\S]*?\n}\n\nexport function calculateTopicDiagnosis/, `export function mentorPhase() {
  return { id: 'adaptativa', titulo: 'Preparação adaptativa', descricao: 'O mentor combina estudo, revisão e questões conforme os dados disponíveis.' }
}

export function calculateTopicDiagnosis`],
    [/export function simulationEligibility\([\s\S]*?\n}\n\s*$/, `export function simulationEligibility({ adherence = 0, answeredQuestions = 0, overdueDemands = 0 }) {
  const signals = { adherenceEnough: adherence >= 0.75, practiceSampleEnough: answeredQuestions >= 40, backlogControlled: overdueDemands <= 3 }
  const eligible = Object.values(signals).every(Boolean)
  return { eligible, reason: eligible ? 'mentor_pode_programar' : 'criterios_pedagogicos_insuficientes', signals }
}
`],
  ])
}

async function writePackageFiles() {
  const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
  packageJson.name = 'plataforma-pessoal-de-estudos'
  packageJson.scripts = {
    dev: packageJson.scripts.dev,
    'dev:full': packageJson.scripts['dev:full'],
    build: packageJson.scripts.build,
    preview: packageJson.scripts.preview,
    test: packageJson.scripts.test,
    lint: packageJson.scripts.lint,
    migrate: packageJson.scripts.migrate,
    'audit:producao': packageJson.scripts['audit:producao'],
    'audit:cobertura': packageJson.scripts['audit:cobertura'],
    'audit:questoes': packageJson.scripts['audit:questoes'],
    'audit:cards': packageJson.scripts['audit:cards'],
    'acervo:expandir:offline': packageJson.scripts['acervo:expandir:offline'],
    'acervo:expandir:offline:aplicar': packageJson.scripts['acervo:expandir:offline:aplicar'],
  }
  await writeFile(join(outputRoot, 'package.json'), `${JSON.stringify(packageJson, null, 2)}\n`)
  const lockPath = join(outputRoot, 'package-lock.json')
  const lock = JSON.parse(await readFile(lockPath, 'utf8'))
  lock.name = packageJson.name
  if (lock.packages?.['']) lock.packages[''].name = packageJson.name
  await writeFile(lockPath, `${JSON.stringify(lock, null, 2)}\n`)
  await writeFile(join(outputRoot, 'README.md'), readme)
  await writeFile(join(outputRoot, 'PRIMEIROS-PASSOS.md'), firstSteps)
  await writeFile(join(outputRoot, '.env.example'), envExample)
  await writeFile(join(outputRoot, '.gitignore'), '.vercel\n.env*\n!.env.example\nnode_modules/\ndist/\n*.log\n')
  await writeFile(join(outputRoot, 'supabase', 'migrations', '0023_instalacao_vazia.sql'), resetMigration)

  const vercelPath = join(outputRoot, 'vercel.json')
  const vercel = JSON.parse(await readFile(vercelPath, 'utf8'))
  vercel.rewrites = vercel.rewrites.filter((item) => !['/api/admin/acervo', '/api/admin/reconstruir'].includes(item.source))
  await writeFile(vercelPath, `${JSON.stringify(vercel, null, 2)}\n`)
}

async function verifySanitization() {
  const failures = []
  const forbiddenNames = ['.env.local', '.env.production.local', '.git', '.vercel']
  const personalPatterns = [
    /tecocouto1/i,
    /littleyache32/i,
    /m4roc/i,
    /Direito das Pessoas e dos Negócios Jurídicos/i,
    /Teoria do Crime/i,
    /Teorias? da Justiça/i,
    /Teoria da Constituição e Direitos Fundamentais/i,
    /2026-08-10/,
  ]
  for (const path of await filesUnder(outputRoot)) {
    const name = relative(outputRoot, path).replaceAll('\\', '/') 
    if (forbiddenNames.some((item) => name.split('/').includes(item))) failures.push(`arquivo proibido: ${name}`)
    if (!/\.(?:js|jsx|css|html|json|sql|md|example)$/.test(path)) continue
    const content = await readFile(path, 'utf8')
    for (const pattern of personalPatterns) if (pattern.test(content)) failures.push(`${name}: conteúdo pessoal encontrado por ${pattern}`)
    if (/^(?:SUPABASE_SERVICE_ROLE_KEY|APP_ACCESS_KEY|GEMINI_API_KEY|POSTGRES_URL(?:_NON_POOLING)?)=\S+/m.test(content)) failures.push(`${name}: possível segredo preenchido`)
  }
  if (failures.length) throw new Error(`O pacote não passou na sanitização:\n${failures.join('\n')}`)
}

await rm(outputRoot, { recursive: true, force: true })
await mkdir(outputRoot, { recursive: true })
await copySelected()
await sanitizeCode()
await writePackageFiles()
await verifySanitization()
process.stdout.write(`${JSON.stringify({ ok: true, pasta: outputRoot }, null, 2)}\n`)
