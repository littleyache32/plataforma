import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DEFAULT_MENTOR_POLICY } from '../shared/mentor-policy.js'

describe('politica canonica do mentor', () => {
  it('mantem uma versao nova e o limiar de dez respostas', () => {
    expect(DEFAULT_MENTOR_POLICY).toMatchObject({ versao: '2026.08.7', amostra_minima: 10 })
    expect(DEFAULT_MENTOR_POLICY.decisao_semanal.amostra_minima_desempenho).toBe(10)
  })

  it('remove o limiar fixo de vinte das APIs do mentor', () => {
    const files = ['api/mentor.js', 'api/_lib/plano-handler.js'].map((path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')).join('\n')
    expect(files).not.toMatch(/amostra\s*>?=\s*20/)
  })

  it('mantem Gemini fora do fluxo operacional', () => {
    const files = ['api/mentor.js', 'api/_lib/plano-handler.js', 'shared/mentor.js', 'shared/planner.js'].map((path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')).join('\n')
    expect(files).not.toMatch(/GEMINI_API_KEY|generateContent|googleSearch/)
  })
})
