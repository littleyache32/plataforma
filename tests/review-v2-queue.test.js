import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { orderReviewQueue, reviewCategory } from '../shared/review-v2-queue.js'
import { questionReviewEvidence, cardReviewEvidence } from '../shared/review-v2-evidence.js'
import { evaluateReviewEligibility } from '../shared/review-v2-eligibility.js'
import { createPlannedReviewReference } from '../shared/review-v2-model.js'

const corte = '2026-10-07T15:00:00Z'
function item(id, changes = {}) {
  const evidencia = questionReviewEvidence({ registro: { id: `r-${id}`, questao_id: id, resultado: 'erro', classificacao: 'certeza', criado_em: '2026-10-01T15:00:00Z' }, questao: { id, topico_id: 'topic' }, corte })
  const elegibilidade = evaluateReviewEligibility({ evidencia, qualificacoes: [{ criterio: 'FALSA_CERTEZA', estado: 'CONFIRMADO', regra_ref: { id: 'test', versao: '1' }, fontes: [{ entidade: 'registro', id: `r-${id}` }] }] })
  return { fonte: { tipo: 'RETESTE_QUESTAO', entidade: 'revisao_item', id: `need-${id}`, alvo: { entidade: 'questao', id } }, evidencia, elegibilidade, agendada_para: corte, ...changes }
}
function signal(item, valor) { return { valor, regra_ref: { id: 'test', versao: '1' }, fontes: [{ entidade: 'registro', id: `r-${item.fonte.alvo.id}` }] } }
function demand(item, changes = {}) {
  return { id: 's', status: 'planejada', data: '2026-10-07', prioritaria: true, cobertura_adequada: true,
    regra_ref: { id: 'coverage', versao: 'test/1' }, revisao_ref: createPlannedReviewReference({ sessao_id: 's', decisao_id: 'decision', fontes: [item.fonte] }), ...changes }
}
const run = (itens, demandas = []) => orderReviewQueue({ itens, demandas, corte })

describe('Fase 4.4, Central complementar e ordenação relativa', () => {
  it('urgência qualificada precede volume, sem score arbitrário', () => {
    const a = item('a'), b = item('b')
    a.sinais = { volume_evidencia: signal(a, 1000) }; b.sinais = { urgencia: signal(b, 'IMEDIATA') }
    expect(run([a, b]).itens.map((row) => row.fonte.alvo.id)).toEqual(['b', 'a'])
  })
  it.each(['importancia', 'persistencia_erro', 'retestes_anteriores', 'volume_evidencia', 'cobertura', 'recencia_segundos'])('%s afeta ordem quando qualificado', (name) => {
    const a = item('a'), b = item('b')
    b.sinais = { [name]: signal(b, name === 'importancia' ? 'HIGH' : name === 'cobertura' ? true : 10) }
    expect(run([a, b]).itens[0].fonte.alvo.id).toBe('b')
  })
  it('revisão vencida sobe sem exigir prioridade automática no Plano', () => {
    const result = run([item('a'), item('b', { agendada_para: '2026-10-06T15:00:00Z' })])
    expect(result.itens[0].fonte.alvo.id).toBe('b')
    expect(result.itens[0].reason_codes_ordenacao).toContain('REVIEW_OVERDUE')
  })
  it('falsa certeza e falta de conhecimento usam motivos qualificados, não campo cru', () => {
    const a = item('a'), b = item('b')
    a.elegibilidade.reason_codes = ['REVIEW_KNOWLEDGE_GAP']
    expect(run([a, b]).itens[0].fonte.alvo.id).toBe('b')
  })
  it('cobertura prioritária exata no Plano não ganha outra ação na Central', () => {
    const a = item('a'), result = run([a], [demand(a)])
    expect(result.itens).toEqual([])
    expect(result.cobertos_no_plano[0]).toMatchObject({ sessao_id: 's', decisao_id: 'decision', reason_codes: ['REVIEW_COVERED_BY_PRIORITY_PLAN'] })
    expect(a.elegibilidade.elegivel).toBe(true)
  })
  it.each([{ status: 'cancelada' }, { status: 'feita' }, { data: '2026-10-06' }, { data: '2026-10-08' }, { cobertura_adequada: false }, { prioritaria: false }, { regra_ref: null }])('cobertura inadequada não oculta a necessidade: %j', (changes) => {
    const a = item('a')
    expect(run([a], [demand(a, changes)]).itens).toHaveLength(1)
  })
  it('mesmo tópico ou questão não substitui referência à ocorrência exata', () => {
    const a = item('a'), other = item('a', { fonte: { tipo: 'RETESTE_QUESTAO', entidade: 'revisao_item', id: 'other-need', alvo: { entidade: 'questao', id: 'a' } } })
    expect(run([a], [demand(other)]).itens).toHaveLength(1)
  })
  it('card elegível por FSRS pode ser coberto sem exigir questão no mesmo bloco', () => {
    const evidencia = cardReviewEvidence({ card: { id: 'c' }, corte })
    const elegibilidade = evaluateReviewEligibility({ evidencia, fsrs: { algoritmo: 'FSRS', card_id: 'c', versao_algoritmo: 'test', versao_configuracao: 'test', referencia: { entidade: 'question_card', id: 'c' }, calculado_em: corte, proxima_revisao: corte } })
    const card = { evidencia, elegibilidade, agendada_para: corte, fonte: { tipo: 'SRS_QUESTION_CARD', entidade: 'question_card', id: 'c', alvo: { entidade: 'question_card', id: 'c' } } }
    expect(run([card]).itens).toHaveLength(1)
    expect(run([card], [demand(card)]).itens).toHaveLength(0)
  })
  it('movimento manual para depois reabre ação complementar sem reescrever origem', () => {
    const a = item('a'), plan = demand(a), original = structuredClone(plan.revisao_ref)
    expect(run([a], [plan]).itens).toHaveLength(0)
    plan.data = '2026-10-10'
    expect(run([a], [plan]).itens).toHaveLength(1)
    expect(plan.revisao_ref).toEqual(original)
  })
  it('futuros não aparecem em Atenção e classificação usa Brasília', () => {
    expect(reviewCategory('2026-10-08T01:00:00Z', corte)).toBe('Hoje')
    expect(reviewCategory('2026-10-08T15:00:00Z', corte)).toBe('Depois')
    expect(reviewCategory('2026-10-06T15:00:00Z', corte)).toBe('Atenção')
    expect(reviewCategory(null, corte)).toBe('Depois')
    expect(run([item('a')]).categorias.map((row) => row.nome)).toEqual(['Hoje', 'Atenção', 'Depois'])
  })
  it('não elegíveis não entram na fila acionável', () => {
    const a = item('a'); a.elegibilidade.elegivel = false; a.elegibilidade.resultado = 'EVIDENCIA_INSUFICIENTE'
    expect(run([a]).itens).toEqual([])
    expect(run([a]).nao_elegiveis).toHaveLength(1)
  })
  it('empates, permutas e dados ausentes não inventam importância ou domínio', () => {
    const a = item('a'), b = item('b'), before = structuredClone([a, b])
    expect(run([a, b])).toEqual(run([b, a]))
    expect([a, b]).toEqual(before)
    expect(run([a]).itens[0].sinais_utilizados.importancia.known).toBe(false)
  })
  it('rejeita duplicação, sinais sem proveniência e elegibilidade de outro corte', () => {
    const a = item('a')
    expect(() => run([a, a])).toThrow('duplicada')
    expect(() => run([{ ...a, sinais: { urgencia: { valor: 'IMEDIATA' } } }])).toThrow('proveniência')
    a.elegibilidade.corte = '2026-10-06T15:00:00Z'
    expect(() => run([a])).toThrow('incompatível')
  })
  it('UI utiliza as mesmas três categorias sem novo planner', () => {
    const source = readFileSync(new URL('../src/components/ReviewCenter.jsx', import.meta.url), 'utf8')
    expect(source).toContain('REVIEW_CATEGORIES.map')
    expect(source).toContain('data.categorias?.find')
  })
})
