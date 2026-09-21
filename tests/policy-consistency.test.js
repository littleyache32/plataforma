import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DEFAULT_MENTOR_POLICY } from '../shared/mentor-policy.js'

describe('politica canonica do mentor', () => {
  it('mantem uma versao nova e o limiar de dez respostas', () => {
    expect(DEFAULT_MENTOR_POLICY).toMatchObject({ versao: '2026.09.20', amostra_minima: 10 })
    expect(DEFAULT_MENTOR_POLICY.fase_inicial).toMatchObject({ bloco_estudo_minutos: 50, intervalo_minutos: 10, faculdade_blocos_recuperacao: 2, bacen_blocos_segunda_sexta: 2 })
    expect(DEFAULT_MENTOR_POLICY.decisao_semanal.amostra_minima_desempenho).toBe(10)
    expect(DEFAULT_MENTOR_POLICY.parametros_operacionais).toMatchObject({
      natureza: 'provisorios_versionados_calibraveis',
      percentuais_nao_sao_verdades_cientificas: true,
      bloco_50_10_e_preferencia_do_mentorado: true,
    })
    expect(DEFAULT_MENTOR_POLICY.fundamento_decisao.ordem).toEqual(['evidencia_cientifica', 'dados_individuais', 'contexto_real'])
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
