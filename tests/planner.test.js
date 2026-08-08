import { describe, expect, it } from 'vitest'
import { buildMentorWeek, canGenerateMentorWeek } from '../shared/planner.js'

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

  it('so libera a proxima semana a partir do domingo', () => {
    expect(canGenerateMentorWeek({ weekStart: '2026-08-10', today: '2026-08-07' })).toBe(true)
    expect(canGenerateMentorWeek({ weekStart: '2026-08-17', today: '2026-08-15' })).toBe(false)
    expect(canGenerateMentorWeek({ weekStart: '2026-08-17', today: '2026-08-16' })).toBe(true)
    expect(canGenerateMentorWeek({ weekStart: '2026-08-17', today: '2026-08-18' })).toBe(true)
    expect(canGenerateMentorWeek({ weekStart: '2026-08-03', today: '2026-08-07' })).toBe(false)
  })

  it('usa aula dada, aula estudada de segunda a quinta e exclui texto dos cards', () => {
    const withWriting = [...catalog, { id: 'facul-2', tipo: 'faculdade', materias: [{ id: 'texto', nome: 'Análise e Produção de Texto', topicos: [{ id: 'texto-1', nome: 'Redação' }] }] }]
    const result = buildMentorWeek({ weekStart: '2026-08-10', catalog: withWriting })
    const facultyStudy = result.filter((item) => item.tipo === 'estudo' && item.data <= '2026-08-13')
    expect(facultyStudy).toHaveLength(4)
    expect(facultyStudy.every((item) => item.titulo.startsWith('Aula dada, aula estudada'))).toBe(true)
    expect(result.filter((item) => item.tipo === 'especial').every((item) => item.materia_id !== 'texto')).toBe(true)
  })
})
