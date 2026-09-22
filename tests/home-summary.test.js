import { describe, expect, it } from 'vitest'
import { duration, summarizeHome, weekDates } from '../src/home-summary.js'

describe('resumo inicial', () => {
  it('usa a semana de segunda a domingo sem depender do fuso do navegador', () => {
    expect(weekDates('2026-09-22')).toEqual([
      '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24',
      '2026-09-25', '2026-09-26', '2026-09-27',
    ])
  })

  it('conta apenas tempo concluído e demandas feitas, sem confundir plano com tempo real', () => {
    const history = [
      { status: 'concluido', iniciado_em: '2026-09-22T10:00:00Z', segundos: 3600, materia: { nome: 'Português' } },
      { status: 'rodando', iniciado_em: '2026-09-22T11:00:00Z', segundos: 900, materia: { nome: 'Português' } },
      { status: 'concluido', iniciado_em: '2026-09-21T14:00:00Z', segundos: 1800, materia: { nome: 'Direito' } },
    ]
    const sessions = [
      { id: '1', data: '2026-09-22', status: 'feita', duracao_estimada: 50 },
      { id: '2', data: '2026-09-22', status: 'planejada', duracao_estimada: 50 },
      { id: '3', data: '2026-09-23', status: 'planejada', duracao_estimada: 50 },
    ]
    const summary = summarizeHome(history, sessions, '2026-09-22')
    expect(summary.todaySeconds).toBe(3600)
    expect(summary.weekSeconds).toBe(5400)
    expect(summary.studiedDays).toBe(2)
    expect(summary.todayDone).toBe(1)
    expect(summary.todayTotal).toBe(2)
    expect(summary.todayPlanned).toBe(6000)
    expect(summary.nextDemands.map((item) => item.id)).toEqual(['2', '3'])
    expect(duration(summary.weekSeconds)).toBe('1h30min')
  })
})
