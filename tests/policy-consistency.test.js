import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DEFAULT_MENTOR_POLICY } from '../shared/mentor-policy.js'

// Historical contract preserved; these defaults are not operational V2 policy.
describe('politica V1 historica e isolamento operacional', () => {
  it('Semana não condiciona a integração ao início histórico de setembro', () => {
    const week = readFileSync('src/components/Week.jsx', 'utf8')
    expect(week).not.toMatch(/mentorshipStart|2026-09-14|14 de setembro/)
  })
  it('isola também dependências transitivas locais dos entrypoints V2', () => {
    const visited = new Set()
    const roots = ['api/mentor.js', 'api/_lib/plano-handler.js', 'api/_lib/painel-handler.js', 'api/cron/mentor.js']
    function visit(path) {
      path = resolve(path)
      if (visited.has(path)) return
      visited.add(path)
      expect(path.replaceAll('\\', '/')).not.toMatch(/\/(?:mentor-policy|mentor-decision|mentor-specialists|module-knowledge)\.js$|\/shared\/(?:mentor|planner)\.js$/)
      const source = readFileSync(path, 'utf8')
      for (const match of source.matchAll(/(?:from\s*|import\s*\(\s*)['"](\.[^'"]+\.js)['"]/g)) visit(resolve(dirname(path), match[1]))
    }
    roots.forEach(visit)
    expect([...visited].some((path) => path.endsWith('mentor-v2-policy.js'))).toBe(true)
    expect([...visited].some((path) => path.endsWith('mentor-v2-plan.js'))).toBe(true)
  })
  it('preserva a versao e os parametros historicos sem aprova-los para V2', () => {
    expect(DEFAULT_MENTOR_POLICY).toMatchObject({ versao: '2026.09.21.1', amostra_minima: 10 })
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

  it('nao executa o ciclo quinzenal antigo de expansao de questoes', () => {
    const cron = readFileSync(new URL('../api/cron/mentor.js', import.meta.url), 'utf8')
    expect(cron).not.toMatch(/planejar_expansao_questoes_bacen|p_alvo:\s*2250/)
  })
})
