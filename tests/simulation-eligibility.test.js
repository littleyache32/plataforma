import { describe, expect, it } from 'vitest'
import { simulationEligibility } from '../shared/mentor.js'

describe('simulationEligibility', () => {
  it('proibe simulados antes de 7 de setembro', () => {
    expect(simulationEligibility({ date: '2026-09-06', adherence: 1, answeredQuestions: 100, overdueDemands: 0 }).eligible).toBe(false)
  })

  it('libera apenas a decisao do mentor depois da data e com sinais suficientes', () => {
    expect(simulationEligibility({ date: '2026-09-07', adherence: 0.8, answeredQuestions: 40, overdueDemands: 2 })).toMatchObject({ eligible: true, reason: 'mentor_pode_programar' })
    expect(simulationEligibility({ date: '2026-09-07', adherence: 0.5, answeredQuestions: 40, overdueDemands: 2 }).eligible).toBe(false)
  })
})
