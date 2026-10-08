import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { projectReviewCenter } from '../shared/review-v2-center.js'
import ReviewCenter, { ReviewCenterList } from '../src/components/ReviewCenter.jsx'
import handler from '../api/_lib/revisoes-handler.js'

const state = vi.hoisted(() => ({ db: null }))
vi.mock('../api/_lib/supabase.js', () => ({ getSupabaseAdmin: () => state.db }))
vi.mock('../api/_lib/http.js', () => ({ allowMethods: () => true, requireAccess: () => true,
  queryParam: (req, key) => req.query?.[key], fail: (res, error) => res.status(500).json({ error: error.message }) }))
const corte = '2026-10-07T15:00:00Z', flags = { questoes: true, question_cards: true, revisao_pratica: true }
const policy = { id: 'p', versao: 'v2-test', modulo: 'mentor', ativo: true, conteudo: { politica: {
  modelo: 'MENTOR_V2', versao_contrato: 'mentor-v2/1', modalidades_permitidas: ['ESTUDO'],
  regras: [{ id: 'CONTINUIDADE_PLANO_EXISTENTE', habilitada: true }],
} } }
const subject = { id: 'm', nome: 'Direito', objetivo_id: 'goal' }
const topic = { nome: 'Conceito', materia: subject }
function question(id, date, goal = 'goal') {
  return { id: `need-${id}`, status: 'pendente', motivo: 'erro', agendada_para: date, prioridade: 9999,
    questao: { id, topico_id: 't', topico: { ...topic, materia: { ...subject, objetivo_id: goal } } } }
}
function card(id, date) { return { id, ativa: true, proxima_revisao: date, topico_id: 't', topico: topic, ultima_revisao: '2026-10-01T14:00:00Z' } }
function fixture() {
  return { corte, policy_ref: { id: policy.id, versao: policy.versao }, flags,
    questoes: [question('today', corte), question('past', '2026-10-06T15:00:00Z'), question('future', '2026-10-09T15:00:00Z')],
    cards: [card('card-future', '2026-10-10T15:00:00Z')], registros: [] }
}
const render = (data) => renderToStaticMarkup(<ReviewCenterList data={data} onOpenQuestion={() => {}} onOpenCards={() => {}} />)
afterEach(() => vi.useRealTimers())
function database(args = fixture()) {
  const tables = { mentor_contexto: { dados: { rotina_pratica: args.flags } }, conhecimento_modulo: [policy],
    revisao_item: args.questoes, question_card: args.cards, registro: args.registros, sessao: [] }
  const calls = []
  return { tables, calls, from(table) {
    const predicates = [], call = { table, range: null }; calls.push(call)
    const query = {
      select() { return this }, single() { return this }, order() { return this },
      eq(key, value) { predicates.push((row) => row[key] === value); return this },
      in(key, values) { predicates.push((row) => values.includes(row[key])); return this },
      lte(key, value) { predicates.push((row) => row[key] <= value); return this },
      gte(key, value) { predicates.push((row) => row[key] >= value); return this },
      not(key, op, value) { predicates.push((row) => row[key] != value); return this },
      range(start, end) { call.range = [start, end]; return this },
      then(resolve) {
        if (tables[table]?.error) return resolve({ data: null, error: new Error('Falha na leitura') })
        const raw = tables[table]
        const data = Array.isArray(raw) ? raw.filter((row) => predicates.every((filter) => filter(row))) : raw
        resolve({ data: Array.isArray(data) && call.range ? data.slice(call.range[0], call.range[1] + 1) : data, error: null })
      },
    }; return query
  } }
}
async function apiResponse(db, goal = 'goal') {
  vi.useFakeTimers(); vi.setSystemTime(corte); state.db = db
  const res = { code: null, body: null, status(code) { this.code = code; return this }, json(body) { this.body = body; return this } }
  await handler({ method: 'GET', query: { objetivoId: goal } }, res)
  return res
}

describe('Fase 4.9, motor e apresentação da Central', () => {
  it('projeta fatos reais nas três categorias, inclusive agendamentos futuros', () => {
    const result = projectReviewCenter(fixture())
    expect(result.categorias.map((group) => [group.nome, group.itens.length])).toEqual([['Hoje', 1], ['Atenção', 1], ['Depois', 2]])
  })
  it('motor ordena sinais qualificados sem devolver score/percentual bruto à UI', () => {
    const args = fixture(); args.questoes = [question('a', corte), question('z', corte)]
    args.registros = [{ id: 'r-a', questao_id: 'a', resultado: 'erro', classificacao: 'sem_conhecimento', criado_em: corte },
      { id: 'r-z', questao_id: 'z', resultado: 'erro', classificacao: 'certeza', criado_em: corte }]
    const result = projectReviewCenter(args)
    expect(result.itens.filter((item) => item.tipo === 'questao').map((item) => item.item_id)).toEqual(['z', 'a'])
    expect(result.itens[0].motivo).toContain('falsa certeza')
    expect(JSON.stringify(result)).not.toMatch(/prioridade_relativa|sinais_utilizados|vector|9999/)
  })
  it('última interação vem da tentativa mais recente, sem inferir domínio', () => {
    const args = fixture(); args.registros = [
      { id: 'old', questao_id: 'today', criado_em: '2026-10-01T15:00:00Z', resultado: 'erro', classificacao: 'certeza' },
      { id: 'new', questao_id: 'today', criado_em: corte, resultado: 'acerto', classificacao: 'duvida' },
    ]
    expect(projectReviewCenter(args).itens.find((item) => item.item_id === 'today').ultima_interacao).toBe(corte)
    expect(render(projectReviewCenter(args))).not.toContain('domínio')
  })
  it('sem interação não inventa data e sem policy não ressuscita ranking V1', () => {
    const args = fixture(); args.policy_ref = null
    const result = projectReviewCenter(args)
    expect(result.itens.find((item) => item.item_id === 'today').ultima_interacao).toBeNull()
    expect(result.itens.every((item) => !Object.hasOwn(item, 'prioridade'))).toBe(true)
  })
  it('card futuro é calendário observado, nunca vencido/FSRS fabricado', () => {
    const result = projectReviewCenter(fixture())
    expect(result.itens.find((item) => item.tipo === 'card').categoria).toBe('Depois')
    expect(JSON.stringify(result)).not.toMatch(/FSRS|estabilidade|retenção/)
  })
  it('Brasília classifica outro dia UTC ainda como Hoje', () => {
    const args = fixture(); args.questoes = [question('night', '2026-10-08T01:00:00Z')]
    expect(projectReviewCenter(args).itens[0].categoria).toBe('Hoje')
  })
  it('filtra objetivo e preserva os fatos sem mutação', () => {
    const args = fixture(); args.questoes.push(question('other', corte, 'other'))
    args.objetivoId = 'goal'; const before = structuredClone(args)
    expect(projectReviewCenter(args).itens).toHaveLength(4)
    expect(args).toEqual(before)
  })
  it('UI renderiza matéria/tópico, tipo, motivo, última interação e Revisar, sem enunciado enorme', () => {
    const html = render(projectReviewCenter(fixture()))
    expect(html).toContain('HOJE'); expect(html).toContain('ATENÇÃO'); expect(html).toContain('DEPOIS')
    expect(html).toContain('Direito'); expect(html).toContain('Conceito'); expect(html).toContain('Question Card')
    expect(html).toContain('Última interação'); expect(html).toContain('Revisar →')
    expect(html).not.toMatch(/9999|prioridade_relativa|Dashboard/)
  })
  it('estados vazios são discretos e não criam cards vazios', () => {
    const html = render({ categorias: [] })
    expect(html).toContain('Nenhuma revisão para hoje.')
    expect(html).toContain('Nenhuma revisão futura.')
    expect(html).not.toContain('panel review-center')
  })
  it('carregamento não anuncia fila vazia antes da resposta', () => {
    const html = renderToStaticMarkup(<ReviewCenter objective={{ id: 'goal' }} />)
    expect(html).toContain('Carregando revisões')
    expect(html).not.toContain('Nenhuma revisão')
  })
  it('ações enviam o item correto aos callbacks de questão/card', () => {
    const data = projectReviewCenter(fixture()), onOpenQuestion = vi.fn(), onOpenCards = vi.fn()
    const articles = ReviewCenterList({ data, onOpenQuestion, onOpenCards })
    for (const article of articles) for (const button of article.props.children[1]) button.props.onClick()
    expect(onOpenQuestion.mock.calls.map(([item]) => item.item_id)).toEqual(['today', 'past', 'future'])
    expect(onOpenCards.mock.calls[0][0].item_id).toBe('card-future')
  })
  it('gate fechado mantém ação disabled, sem liberar prática pela UI', () => {
    const args = fixture(); args.flags = {}
    expect(render(projectReviewCenter(args))).toContain('disabled=""')
  })
  it('API liga dados, motor e grupos consumidos pela UI, exclusivamente em leitura', async () => {
    const db = database(), res = await apiResponse(db)
    expect(res.code).toBe(200)
    expect(res.body.categorias.find((group) => group.nome === 'Depois').itens).toHaveLength(2)
    expect(render(res.body)).toContain('DEPOIS')
    expect(db.calls.some((call) => call.table === 'conhecimento_modulo')).toBe(true)
  })
  it('API não corta a fila nos primeiros 100 ou 500 registros', async () => {
    const args = fixture(); args.questoes = Array.from({ length: 501 }, (_, i) => question(`q-${i}`, corte)); args.cards = []
    const db = database(args), res = await apiResponse(db)
    expect(res.body.itens).toHaveLength(501)
    expect(db.calls.filter((call) => call.table === 'revisao_item')).toHaveLength(2)
  })
  it('API filtra itens concluídos, cards sem agendamento e objetivo diferente', async () => {
    const args = fixture(); args.questoes[0].status = 'concluida'; args.questoes.push(question('other', corte, 'other'))
    args.cards.push(card('new-card', null))
    const res = await apiResponse(database(args))
    expect(res.body.itens.map((item) => item.item_id).sort()).toEqual(['card-future', 'future', 'past'])
  })
  it('API respeita gates sem consultar fontes de prática bloqueadas', async () => {
    const args = fixture(); args.flags = {}
    const db = database(args), res = await apiResponse(db)
    expect(res.body.itens).toEqual([])
    expect(db.calls.some((call) => ['revisao_item', 'question_card', 'registro'].includes(call.table))).toBe(false)
  })
  it('falha de consulta não é apresentada como fila vazia sincronizada', async () => {
    const db = database(); db.tables.revisao_item = { error: true }
    expect((await apiResponse(db)).code).toBe(500)
  })
})
