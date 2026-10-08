import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import handler from '../api/_lib/questoes-handler.js'

const state = vi.hoisted(() => ({ db: null, enabled: true }))
vi.mock('../api/_lib/supabase.js', () => ({ getSupabaseAdmin: () => state.db }))
vi.mock('../api/_lib/http.js', () => ({ allowMethods: () => true, requireAccess: () => true,
  queryParam: (req, key) => req.query?.[key], fail: (res, error) => res.status(500).json({ error: error.message }) }))
vi.mock('../shared/study-access.js', () => ({ BACEN_PRACTICE_START: '', isBacenPracticeOpen: () => true,
  allowedStudiedTopics: (requested, studied) => requested.filter((id) => studied.includes(id)),
  currentPracticeFlags: async () => ({ question_cards: state.enabled }) }))

async function request({ enabled = true, quota = 0, type = 'faculdade', fresh = false, active = true, goal = 'g' } = {}) {
  state.enabled = enabled
  const card = { id: 'c', ativa: active, objetivo_id: goal, materia_id: 'm', topico_id: 't',
    objetivo: { tipo: type }, materia: { nome: 'Direito' }, topico: { id: 't' },
    ultima_revisao: fresh ? null : '2026-10-01T15:00:00Z', proxima_revisao: '2099-10-10T15:00:00Z' }
  state.db = { from(table) {
    const filters = []; let single = false, head = false
    return { select(fields, options) { head = options?.head; return this },
      eq(key, value) { filters.push((row) => row[key] === value); return this },
      gte() { return this }, lt() { return this }, not() { return this },
      maybeSingle() { single = true; return this },
      then(resolve) {
        const rows = table === 'objetivo' ? [{ id: 'g', tipo: type }] : table === 'sessao' ? [] : [card]
        const data = rows.filter((row) => filters.every((filter) => filter(row)))
        resolve({ data: head ? null : single ? data[0] || null : data, count: quota, error: null })
      },
    }
  } }
  const res = { status(code) { this.code = code; return this }, json(body) { this.body = body; return this } }
  await handler({ method: 'GET', query: { recurso: 'cards', cardId: 'c', objetivoId: 'g', materiaId: 'm', topicoId: 't' } }, res)
  return res
}

describe('Fase 4.9, ação Revisar abre o card exato', () => {
  it('abre card agendado para o futuro sem alterar vencimento ou dados', async () => {
    const res = await request()
    expect(res.code).toBe(200)
    expect(res.body.cards).toHaveLength(1)
    expect(res.body.cards[0]).toMatchObject({ id: 'c', vencido: false, proxima_revisao: '2099-10-10T15:00:00Z' })
  })
  it('não abre card inativo ou de outro objetivo', async () => {
    expect((await request({ active: false })).code).toBe(404)
    expect((await request({ goal: 'outro' })).code).toBe(404)
  })
  it('preserva bloqueio de prática', async () => { expect((await request({ enabled: false })).code).toBe(423) })
  it('preserva limite diário de cards novos', async () => { expect((await request({ fresh: true, quota: 10 })).code).toBe(423) })
  it('não libera card novo de conteúdo BACEN não estudado', async () => {
    expect((await request({ fresh: true, type: 'concurso' })).code).toBe(423)
  })
  it('navegação e consulta transportam identidade exata, sem iniciar timer', () => {
    const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
    const cards = readFileSync(new URL('../src/components/QuestionCards.jsx', import.meta.url), 'utf8')
    expect(app).toContain('cardId: item.item_id')
    expect(cards).toContain("params.set('cardId', reviewTargetId)")
    expect(cards).toContain('item.id === reviewTargetId || item.vencido')
    expect(cards).not.toMatch(/autoStart\s*=\s*\{true\}/)
  })
})
