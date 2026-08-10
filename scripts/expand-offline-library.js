import pg from 'pg'
import { buildTopicItems } from '../shared/offline-content.js'

const apply = process.argv.includes('--apply')
const connectionString = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL
if (!connectionString) throw new Error('POSTGRES_URL_NON_POOLING ou POSTGRES_URL não configurada.')

const databaseUrl = new URL(connectionString)
databaseUrl.searchParams.delete('sslmode')
databaseUrl.searchParams.delete('sslrootcert')
const client = new pg.Client({ connectionString: databaseUrl.toString(), ssl: { rejectUnauthorized: false } })

function chunks(items, size) {
  const result = []
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size))
  return result
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
    const result = await client.query(`
      insert into questao (topico_id,tipo,enunciado,alternativas,gabarito,explicacao,fonte,trecho_fonte,origem,dificuldade,versao_conhecimento,ativa)
      values ${rows.join(',')}
      returning id,enunciado
    `, values)
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
    const result = await client.query(`
      insert into question_card (objetivo_id,materia_id,topico_id,chave,frente,verso,fonte,trecho_fonte,tipo_card,dificuldade,versao_conhecimento,ativa,ativo)
      values ${rows.join(',')}
      returning id,frente
    `, values)
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

try {
  await client.connect()
  const topicsResult = await client.query(`
      select t.id, t.nome, m.id materia_id, m.nome materia, o.id objetivo_id, o.tipo contexto,
        k.trecho, k.origem, coalesce(k.versao, mat.versao) versao,
        coalesce(mat.nome, m.nome || ' - material de estudo') fonte
      from topico t
      join materia m on m.id = t.materia_id
      join objetivo o on o.id = m.objetivo_id and o.ativo = true
      join lateral (
        select k.* from conhecimento k
        where k.topico_id = t.id
        order by (k.origem like 'acervo-completo:%') desc, length(k.trecho) desc
        limit 1
      ) k on true
      left join material mat on mat.id = k.material_id
      order by o.tipo, m.nome, t.nome
    `)
  const questionResult = await client.query(`select topico_id,enunciado from questao where ativa = true and marcada_errada = false`)
  const cardResult = await client.query(`select topico_id,frente from question_card where ativa = true and ativo = true`)

  const questionsByTopic = Map.groupBy(questionResult.rows, (item) => item.topico_id)
  const cardsByTopic = Map.groupBy(cardResult.rows, (item) => item.topico_id)
  const allQuestions = []
  const allCards = []
  const coverage = []

  for (const row of topicsResult.rows.filter((item) => !['analise e producao de texto', 'análise e produção de texto'].includes(String(item.materia).toLocaleLowerCase('pt-BR')))) {
    const topic = { id: row.id, name: row.nome, subjectId: row.materia_id, subject: row.materia, objectiveId: row.objetivo_id, context: row.contexto }
    const existingQuestions = questionsByTopic.get(row.id) || []
    const existingCards = cardsByTopic.get(row.id) || []
    const built = buildTopicItems({ topic, knowledge: { text: row.trecho, source: row.fonte, version: row.versao }, existingQuestions, existingCards })
    allQuestions.push(...built.questions)
    allCards.push(...built.cards)
    coverage.push({ contexto: row.contexto, materia: row.materia, topico: row.nome, unidades: built.units, questoes_antes: existingQuestions.length, questoes_novas: built.questions.length, cards_antes: existingCards.length, cards_novos: built.cards.length })
  }

  const incomplete = coverage.filter((item) => item.questoes_antes + item.questoes_novas < 30 || item.cards_antes + item.cards_novos < 50)
  if (incomplete.length) throw new Error(`Planejamento incompleto em ${incomplete.length} tópicos.`)

  const summary = {
    modo: apply ? 'aplicação' : 'simulação',
    topicos: coverage.length,
    questoes_novas: allQuestions.length,
    cards_novos: allCards.length,
    bloqueios_qualidade: 0,
    por_contexto: Object.fromEntries(['concurso', 'faculdade'].map((context) => [context, {
      topicos: coverage.filter((item) => item.contexto === context).length,
      questoes_novas: coverage.filter((item) => item.contexto === context).reduce((sum, item) => sum + item.questoes_novas, 0),
      cards_novos: coverage.filter((item) => item.contexto === context).reduce((sum, item) => sum + item.cards_novos, 0),
    }])),
  }

  if (apply) {
    await client.query('begin')
    try {
      const insertedQuestions = await insertQuestions(allQuestions)
      const insertedCards = await insertCards(allCards)
      const questionMap = new Map(allQuestions.map((item) => [item.enunciado, item]))
      const cardMap = new Map(allCards.map((item) => [item.frente, item]))
      await insertAudits('questao_auditoria', 'questao_id', insertedQuestions.map((item) => {
        const source = questionMap.get(item.enunciado)
        return { id: item.id, status: 'aprovada', criteria: { ...source.audit.checks, alertas: source.audit.warnings }, reasons: [] }
      }))
      await insertAudits('question_card_auditoria', 'question_card_id', insertedCards.map((item) => {
        const source = cardMap.get(item.frente)
        return { id: item.id, status: 'aprovado', criteria: { recuperacao_ativa: !source.audit.warnings.includes('frente_pouco_interrogativa'), resposta_suficiente: !source.audit.warnings.includes('resposta_sem_fundamento'), alertas: source.audit.warnings }, reasons: [] }
      }))
      await client.query('commit')
      summary.questoes_inseridas = insertedQuestions.length
      summary.cards_inseridos = insertedCards.length
    } catch (error) {
      await client.query('rollback')
      throw error
    }
  }
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)
} finally {
  await client.end()
}
