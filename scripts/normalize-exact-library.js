import pg from 'pg'
import { buildTopicItems } from '../shared/offline-content.js'
import { normalizeContent } from '../shared/question-quality.js'
import { librarySpecs } from './acervo-specs.js'

const apply = process.argv.includes('--apply')
const connectionString = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL
if (!connectionString) throw new Error('POSTGRES_URL_NON_POOLING ou POSTGRES_URL não configurada.')

const databaseUrl = new URL(connectionString)
databaseUrl.searchParams.delete('sslmode')
databaseUrl.searchParams.delete('sslrootcert')
const client = new pg.Client({ connectionString: databaseUrl.toString(), ssl: { rejectUnauthorized: false } })
const quotas = { easy: 60, medium: 30, hard: 10 }

function curricularFallback(row) {
  const spec = librarySpecs.find((item) => item.subject === row.materia)
  const topic = spec?.topics?.find(([name]) => name === row.nome)
  if (!spec || !topic) return null
  const scope = String(topic[1] || '').replace(/\s+/g, ' ').trim()
  const elements = scope.split(/[,;]\s*/).map((item) => item.trim()).filter((item) => item.length >= 4)
  const statements = [
    `O estudo de ${row.nome} abrange ${scope}`,
    ...elements.map((item) => `No recorte curricular de ${row.nome}, o programa inclui ${item}`),
  ]
  return {
    text: `# ${row.nome}\n\n${statements.map((item) => `${item}.`).join('\n\n')}`,
    source: spec.basis,
    version: null,
  }
}

function chunks(items, size) {
  const result = []
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size))
  return result
}

function difficultyGroup(value) {
  const level = Number(value)
  return level <= 2 ? 'easy' : level === 3 ? 'medium' : 'hard'
}

function rankQuestions(a, b) {
  return Number(b.quantidade_tentativas || 0) - Number(a.quantidade_tentativas || 0)
    || Number(Boolean(b.usada)) - Number(Boolean(a.usada))
    || String(b.trecho_fonte || '').length - String(a.trecho_fonte || '').length
    || String(a.criado_em || '').localeCompare(String(b.criado_em || ''))
}

function rankCards(a, b) {
  return Number(b.repeticoes || 0) - Number(a.repeticoes || 0)
    || Number(Boolean(b.ultima_revisao)) - Number(Boolean(a.ultima_revisao))
    || String(b.trecho_fonte || '').length - String(a.trecho_fonte || '').length
    || String(a.criado_em || '').localeCompare(String(b.criado_em || ''))
}

async function insertQuestions(items) {
  const inserted = []
  for (const batch of chunks(items, 100)) {
    const values = []
    const rows = batch.map((item, rowIndex) => {
      const offset = rowIndex * 12
      values.push(item.topico_id, item.tipo, item.enunciado, item.alternativas, item.gabarito, item.explicacao, item.fonte, item.trecho_fonte, item.origem, item.dificuldade, item.versao_conhecimento, true)
      return `(${Array.from({ length: 12 }, (_, index) => `$${offset + index + 1}`).join(',')})`
    })
    const result = await client.query(`insert into questao (topico_id,tipo,enunciado,alternativas,gabarito,explicacao,fonte,trecho_fonte,origem,dificuldade,versao_conhecimento,ativa) values ${rows.join(',')} returning id,enunciado`, values)
    inserted.push(...result.rows)
  }
  return inserted
}

async function insertCards(items) {
  const inserted = []
  for (const batch of chunks(items, 100)) {
    const values = []
    const rows = batch.map((item, rowIndex) => {
      const offset = rowIndex * 13
      values.push(item.objetivo_id, item.materia_id, item.topico_id, item.chave, item.frente, item.verso, item.fonte, item.trecho_fonte, item.tipo_card, item.dificuldade, item.versao_conhecimento, true, true)
      return `(${Array.from({ length: 13 }, (_, index) => `$${offset + index + 1}`).join(',')})`
    })
    const result = await client.query(`insert into question_card (objetivo_id,materia_id,topico_id,chave,frente,verso,fonte,trecho_fonte,tipo_card,dificuldade,versao_conhecimento,ativa,ativo) values ${rows.join(',')} returning id,frente`, values)
    inserted.push(...result.rows)
  }
  return inserted
}

async function insertAudits(table, foreignKey, items) {
  for (const batch of chunks(items, 200)) {
    const values = []
    const rows = batch.map((item, rowIndex) => {
      const offset = rowIndex * 5
      values.push(item.id, item.status, JSON.stringify(item.criteria), item.reasons, new Date())
      return `(${Array.from({ length: 5 }, (_, index) => `$${offset + index + 1}`).join(',')})`
    })
    await client.query(`insert into ${table} (${foreignKey},status,criterios,motivos,auditado_em) values ${rows.join(',')}`, values)
  }
}

async function archiveIds(table, ids) {
  for (const batch of chunks(ids, 500)) {
    if (table === 'questao') {
      await client.query(`update questao set ativa=false, estado='arquivada' where id = any($1::uuid[])`, [batch])
      await client.query(`update questao_auditoria set status='arquivada', auditado_em=now() where questao_id = any($1::uuid[])`, [batch])
    } else {
      await client.query(`update question_card set ativa=false, ativo=false where id = any($1::uuid[])`, [batch])
      await client.query(`update question_card_auditoria set status='arquivado', auditado_em=now() where question_card_id = any($1::uuid[])`, [batch])
    }
  }
}

try {
  await client.connect()
  const topicsResult = await client.query(`
      select t.id,t.nome,m.id materia_id,m.nome materia,o.id objetivo_id,o.tipo contexto,
        coalesce(tk.trecho,sm.conteudo,mk.trecho) trecho,
        coalesce(tk.fonte,sm.nome,mk.fonte,m.nome || ' - material de estudo') fonte,
        coalesce(tk.versao,sm.versao,mk.versao) versao
      from topico t
      join materia m on m.id=t.materia_id
      join objetivo o on o.id=m.objetivo_id and o.ativo=true
      left join lateral (
        select k.trecho,coalesce(mat.nome,k.origem) fonte,coalesce(k.versao,mat.versao) versao
        from conhecimento k left join material mat on mat.id=k.material_id
        where k.topico_id=t.id order by (k.origem like 'acervo-completo:%') desc,length(k.trecho) desc limit 1
      ) tk on true
      left join lateral (
        select mat.conteudo,mat.nome,mat.versao from material mat
        where mat.materia_id=m.id and (mat.status='aceito' or mat.forcado=true)
        order by length(mat.conteudo) desc limit 1
      ) sm on true
      left join lateral (
        select string_agg(k.trecho,E'\n\n' order by length(k.trecho) desc) trecho,
          m.nome || ' - conhecimento consolidado' fonte,max(k.versao) versao
        from conhecimento k where k.materia_id=m.id
      ) mk on true
      order by o.tipo,m.nome,t.nome
    `)
  const questionResult = await client.query(`select id,topico_id,enunciado,dificuldade,quantidade_tentativas,usada,trecho_fonte,criado_em from questao where ativa=true and marcada_errada=false and estado<>'arquivada'`)
  const cardResult = await client.query(`select id,topico_id,frente,repeticoes,ultima_revisao,trecho_fonte,criado_em from question_card where ativa=true and ativo=true`)
  const topics = topicsResult.rows.filter((item) => normalizeContent(item.materia) !== 'analise e producao de texto')
  const questionsByTopic = Map.groupBy(questionResult.rows, (item) => item.topico_id)
  const cardsByTopic = Map.groupBy(cardResult.rows, (item) => item.topico_id)
  const allQuestions = []
  const allCards = []
  const archivedQuestions = []
  const archivedCards = []
  const coverage = []

  for (const row of topics) {
    const knowledge = row.trecho ? { text: row.trecho, source: row.fonte, version: row.versao } : curricularFallback(row)
    if (!knowledge?.text) throw new Error(`Sem material de origem para ${row.materia} > ${row.nome}.`)
    const existingQuestions = questionsByTopic.get(row.id) || []
    const keptQuestions = []
    for (const group of ['easy', 'medium', 'hard']) {
      const ranked = existingQuestions.filter((item) => difficultyGroup(item.dificuldade) === group).sort(rankQuestions)
      keptQuestions.push(...ranked.slice(0, quotas[group]))
      archivedQuestions.push(...ranked.slice(quotas[group]).map((item) => item.id))
    }
    const existingCards = [...(cardsByTopic.get(row.id) || [])].sort(rankCards)
    const keptCards = existingCards.slice(0, 20)
    archivedCards.push(...existingCards.slice(20).map((item) => item.id))
    const topic = { id: row.id, name: row.nome, subjectId: row.materia_id, subject: row.materia, objectiveId: row.objetivo_id, context: row.contexto }
    const built = buildTopicItems({ topic, knowledge, existingQuestions: keptQuestions, existingCards: keptCards, questionTarget: 100, cardTarget: 20, difficultyTargets: quotas })
    allQuestions.push(...built.questions)
    allCards.push(...built.cards)
    coverage.push({ contexto: row.contexto, materia: row.materia, topico: row.nome, unidades: built.units, questoes_antes: existingQuestions.length, questoes_arquivadas: existingQuestions.length - keptQuestions.length, questoes_novas: built.questions.length, cards_antes: existingCards.length, cards_arquivados: existingCards.length - keptCards.length, cards_novos: built.cards.length })
  }

  const summary = {
    modo: apply ? 'aplicação' : 'simulação',
    topicos: topics.length,
    questoes_novas: allQuestions.length,
    questoes_arquivadas: archivedQuestions.length,
    cards_novos: allCards.length,
    cards_arquivados: archivedCards.length,
    por_contexto: Object.fromEntries(['concurso', 'faculdade'].map((context) => [context, {
      topicos: coverage.filter((item) => item.contexto === context).length,
      questoes_novas: coverage.filter((item) => item.contexto === context).reduce((sum, item) => sum + item.questoes_novas, 0),
      cards_novos: coverage.filter((item) => item.contexto === context).reduce((sum, item) => sum + item.cards_novos, 0),
    }])),
  }

  if (apply) {
    await client.query('begin')
    try {
      await archiveIds('questao', archivedQuestions)
      await archiveIds('question_card', archivedCards)
      const insertedQuestions = await insertQuestions(allQuestions)
      const insertedCards = await insertCards(allCards)
      const questionMap = new Map(allQuestions.map((item) => [item.enunciado, item]))
      const cardMap = new Map(allCards.map((item) => [item.frente, item]))
      await insertAudits('questao_auditoria', 'questao_id', insertedQuestions.map((item) => { const source = questionMap.get(item.enunciado); return { id: item.id, status: 'aprovada', criteria: { ...source.audit.checks, alertas: source.audit.warnings }, reasons: [] } }))
      await insertAudits('question_card_auditoria', 'question_card_id', insertedCards.map((item) => { const source = cardMap.get(item.frente); return { id: item.id, status: 'aprovado', criteria: { recuperacao_ativa: !source.audit.warnings.includes('frente_pouco_interrogativa'), resposta_suficiente: !source.audit.warnings.includes('resposta_sem_fundamento'), alertas: source.audit.warnings }, reasons: [] } }))
      const verification = await client.query(`
        select t.id,
          count(q.id) filter (where q.ativa=true and q.marcada_errada=false and q.estado<>'arquivada') questoes,
          count(q.id) filter (where q.ativa=true and q.marcada_errada=false and q.estado<>'arquivada' and q.dificuldade<=2) faceis,
          count(q.id) filter (where q.ativa=true and q.marcada_errada=false and q.estado<>'arquivada' and q.dificuldade=3) medias,
          count(q.id) filter (where q.ativa=true and q.marcada_errada=false and q.estado<>'arquivada' and q.dificuldade>=4) dificeis,
          (select count(*) from question_card c where c.topico_id=t.id and c.ativa=true and c.ativo=true) cards
        from topico t left join questao q on q.topico_id=t.id where t.id=any($1::uuid[]) group by t.id
      `, [topics.map((item) => item.id)])
      const invalid = verification.rows.filter((item) => Number(item.questoes) !== 100 || Number(item.faceis) !== 60 || Number(item.medias) !== 30 || Number(item.dificeis) !== 10 || Number(item.cards) !== 20)
      if (invalid.length) throw new Error(`Verificação final falhou em ${invalid.length} tópicos.`)
      await client.query(`update acervo_meta set questoes_alvo=100,cards_alvo=20,atualizado_em=now()`)
      await client.query('commit')
      summary.questoes_inseridas = insertedQuestions.length
      summary.cards_inseridos = insertedCards.length
      summary.verificados = verification.rows.length
    } catch (error) {
      await client.query('rollback')
      throw error
    }
  }
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)
} finally {
  await client.end()
}
