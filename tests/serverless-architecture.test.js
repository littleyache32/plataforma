import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function entrypoints(directory = 'api') {
  return readdirSync(directory, { withFileTypes: true }).flatMap((item) => {
    if (item.name === '_lib') return []
    const path = join(directory, item.name)
    if (item.isDirectory()) return entrypoints(path)
    return item.name.endsWith('.js') ? [path.replaceAll('\\', '/')] : []
  })
}

describe('arquitetura serverless gratuita', () => {
  it('carrega o modulo de materiais sem inicializar o leitor de PDF', async () => {
    const module = await import('../api/_lib/materiais-handler.js')
    expect(module.default).toBeTypeOf('function')
  })

  it('mantem exatamente sete funcoes de entrada', () => {
    expect(entrypoints().sort()).toEqual([
      'api/admin.js', 'api/auth.js', 'api/cron/mentor.js', 'api/desempenho.js',
      'api/estudos.js', 'api/mentor.js', 'api/planejamento.js',
    ])
  })

  it('preserva as rotas publicas dos modulos consolidados', () => {
    const config = JSON.parse(readFileSync('vercel.json', 'utf8'))
    const sources = new Set(config.rewrites.map((item) => item.source))
    for (const route of ['/api/catalogo', '/api/questoes', '/api/pratica', '/api/objetivos', '/api/sessoes', '/api/placar', '/api/simulados', '/api/admin/materiais', '/api/admin/seed', '/api/admin/painel']) expect(sources.has(route)).toBe(true)
  })

  it('prepara a semana no domingo a meia-noite de Brasilia', () => {
    const config = JSON.parse(readFileSync('vercel.json', 'utf8'))
    expect(config.crons).toContainEqual({ path: '/api/cron/mentor', schedule: '0 3 * * 0' })
  })
})
