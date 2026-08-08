import { describe, expect, it } from 'vitest'
import { buildMentorWeek } from '../shared/planner.js'

const catalog = [
  { id: 'bacen', tipo: 'concurso', materias: [{ id: 'cont', nome: 'Contabilidade', topicos: [{ id: 'cont-1', nome: 'Balanço' }] }] },
  { id: 'facul', tipo: 'faculdade', materias: [{ id: 'civil', nome: 'Direito Civil', topicos: [{ id: 'civil-1', nome: 'Pessoas' }] }] },
]

describe('buildMentorWeek', () => {
  it('planeja questoes e cards todos os dias sem exceder 90 minutos por atividade', () => {
    const result = buildMentorWeek({ weekStart: '2026-08-10', catalog, pendingReviews: 3 })
    expect(result.filter((item) => item.tipo === 'exercicio')).toHaveLength(7)
    expect(result.filter((item) => item.tipo === 'especial')).toHaveLength(7)
    expect(Math.max(...result.map((item) => item.duracao_estimada))).toBe(90)
  })

  it('reduz as demandas de sabado e domingo e inclui correcao', () => {
    const result = buildMentorWeek({ weekStart: '2026-08-10', catalog, pendingReviews: 1 })
    const weekend = result.filter((item) => item.data >= '2026-08-15')
    const totals = weekend.reduce((map, item) => map.set(item.data, (map.get(item.data) || 0) + item.duracao_estimada), new Map())
    expect([...totals.values()]).toEqual([120, 120])
    expect(result.some((item) => item.tipo === 'revisao')).toBe(true)
  })

  it('deixa sexta com mais carga do que os dias de faculdade', () => {
    const result = buildMentorWeek({ weekStart: '2026-08-10', catalog })
    const total = (day) => result.filter((item) => item.data === day).reduce((sum, item) => sum + item.duracao_estimada, 0)
    expect(total('2026-08-10')).toBe(180)
    expect(total('2026-08-14')).toBe(240)
  })

  it('mantem chaves estaveis para impedir duplicidade ao recarregar', () => {
    const first = buildMentorWeek({ weekStart: '2026-08-10', catalog })
    const second = buildMentorWeek({ weekStart: '2026-08-10', catalog })
    expect(second.map((item) => item.chave_mentor)).toEqual(first.map((item) => item.chave_mentor))
  })
})
