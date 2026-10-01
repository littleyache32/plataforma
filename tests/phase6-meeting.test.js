import { describe, expect, it } from 'vitest'
import { closeMentorWeek, mondayForDate } from '../api/_lib/plano-handler.js'
import { buildMentorWeek, reconcileMentorDemands } from '../shared/planner.js'

const context = {
  fase: 'adaptacao_teorica_1', inicio: '2026-10-02', fim_etapa_1: '2026-10-08', fim_etapa_2: '2026-10-15',
  etapa_1: { concurso: 2, faculdade: 1 }, etapa_2: { concurso: 3, faculdade: 1 }, carga_atual: { concurso: 3, faculdade: 1 },
}
const catalog = [
  { id: 'bacen', tipo: 'concurso', materias: [{ id: 'portugues', nome: 'Português', topicos: [{ id: 'p1', nome: 'Texto' }] }] },
  { id: 'faculdade', tipo: 'faculdade', materias: [
    { id: 'crime', nome: 'Teoria do Crime', topicos: [] },
    { id: 'justica', nome: 'Teorias da Justiça', topicos: [] },
  ] },
]

describe('encontro e fechamento da Fase 6', () => {
  it('usa calendário de Brasília para identificar a semana do encontro', () => {
    expect(mondayForDate('2026-10-11')).toBe('2026-10-05')
    expect(mondayForDate('2026-10-11', true)).toBe('2026-10-12')
  })

  it('recalcula plano provisório com fatos do encontro sem duplicar chaves', () => {
    const provisional = buildMentorWeek({ weekStart: '2026-10-12', catalog, menteeContext: context })
    const meeting = { semana_inicio: '2026-10-05', fatos: { indisponivel_em: ['2026-10-13'] } }
    const revised = buildMentorWeek({ weekStart: '2026-10-12', catalog, menteeContext: context, weeklyMeeting: meeting,
      commitments: [{ objetivo_id: 'faculdade', materia_id: 'justica', tipo: 'prova', titulo: 'Prova de Justiça', data: '2026-10-14', concluido: false }] })
    const existing = provisional.map((item) => ({ ...item, status: 'planejada' }))
    const result = reconcileMentorDemands(revised, existing)
    expect(revised.some((item) => item.data === '2026-10-13')).toBe(false)
    expect(revised.find((item) => item.data === '2026-10-12' && item.objetivo_id === 'faculdade').materia_id).toBe('justica')
    expect(new Set(result.demands.map((item) => item.chave_mentor)).size).toBe(result.demands.length)
    expect(existing.filter((item) => !result.activeKeys.has(item.chave_mentor)).every((item) => item.data === '2026-10-13')).toBe(true)
    expect(revised.filter((item) => item.data === '2026-10-14')).toHaveLength(provisional.filter((item) => item.data === '2026-10-14').length)
  })

  it('fecha apenas semana vencida e repetir o fechamento não duplica faltas', async () => {
    let rows = [{ id: 'missed' }]
    const calls = []
    function result(value) {
      const chain = { eq: (...args) => { calls.push(['eq', ...args]); return chain }, gte: (...args) => { calls.push(['gte', ...args]); return chain }, lte: (...args) => { calls.push(['lte', ...args]); return chain }, in: (...args) => { calls.push(['in', ...args]); return chain }, then: (resolve, reject) => Promise.resolve(value()).then(resolve, reject) }
      return chain
    }
    const supabase = { from: () => ({ select: () => result(() => ({ data: rows, error: null })), update: (payload) => { calls.push(['update', payload]); rows = []; return result(() => ({ error: null })) } }) }
    expect(await closeMentorWeek({ inicio: '2026-10-05', today: '2026-10-11', supabase })).toEqual({ closed: 0 })
    expect(await closeMentorWeek({ inicio: '2026-10-05', today: '2026-10-12', supabase })).toEqual({ closed: 1 })
    expect(await closeMentorWeek({ inicio: '2026-10-05', today: '2026-10-12', supabase })).toEqual({ closed: 0 })
    expect(calls).toContainEqual(['lte', 'data', '2026-10-11'])
    expect(calls).toContainEqual(['update', { status: 'nao_concluida' }])
  })
})
