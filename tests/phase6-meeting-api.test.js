import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ database: null, prepareWeek: vi.fn() }))
vi.mock('../api/_lib/supabase.js', () => ({ getSupabaseAdmin: () => mocks.database }))
vi.mock('../api/_lib/http.js', () => ({ allowMethods: () => true, requireAccess: () => true, fail: vi.fn(), queryParam: vi.fn() }))
vi.mock('../api/_lib/plano-handler.js', () => ({ prepareMentorWeek: mocks.prepareWeek }))

import mentorHandler from '../api/mentor.js'

function response() {
  const res = { statusCode: null, body: null }
  res.status = (code) => { res.statusCode = code; return res }
  res.json = (body) => { res.body = body; return res }
  return res
}

describe('persistência controlada do encontro da Fase 6', () => {
  const saved = []
  beforeEach(() => {
    vi.useFakeTimers()
    saved.length = 0
    mocks.prepareWeek.mockReset()
    mocks.database = {
      from: (table) => {
        expect(table).toBe('mentor_encontro_semanal')
        return {
          upsert: (payload, options) => {
            saved.push({ payload, options })
            return { select: () => ({ single: async () => ({ data: payload, error: null }) }) }
          },
        }
      },
    }
  })
  afterEach(() => vi.useRealTimers())

  it('grava fatos estruturados da semana sem antecipar o planejamento na quinta-feira', async () => {
    vi.setSystemTime(new Date('2026-10-01T12:00:00Z'))
    const res = response()
    await mentorHandler({ method: 'POST', body: {
      semanaInicio: '2026-09-28', cargaPercebida: 'pesada', classificacoes: ['problema_material'],
      fatos: { acontecimentos: 'Semana de prova', dificuldade_nivel: 'alta', dificuldade: 'Conteúdo extenso',
        impedimentos: 'Consulta médica', excecoes: 'Mudança de horário', indisponivel_em: ['2026-10-06', '2026-11-01'] },
    } }, res)
    expect(res.statusCode).toBe(200)
    expect(saved).toHaveLength(1)
    expect(saved[0].options).toEqual({ onConflict: 'semana_inicio' })
    expect(saved[0].payload).toMatchObject({ semana_inicio: '2026-09-28', carga_percebida: 'pesada',
      classificacoes: ['problema_material'], fatos: { acontecimentos: 'Semana de prova', dificuldade_nivel: 'alta',
        dificuldade: 'Conteúdo extenso', impedimentos: 'Consulta médica', excecoes: 'Mudança de horário', indisponivel_em: ['2026-10-06'] } })
    expect(res.body.planejamento_pendente).toBe(true)
    expect(mocks.prepareWeek).not.toHaveBeenCalled()
  })

  it('após registrar o encontro no domingo, solicita recálculo da próxima semana', async () => {
    vi.setSystemTime(new Date('2026-10-11T12:00:00Z'))
    mocks.prepareWeek.mockResolvedValue({ status: 200, body: { planejamento_estado: 'apos_encontro', total_planejado: 20 } })
    const res = response()
    await mentorHandler({ method: 'POST', body: { semanaInicio: '2026-10-05', cargaPercebida: 'adequada',
      fatos: { indisponivel_em: ['2026-10-13'] } } }, res)
    expect(saved).toHaveLength(1)
    expect(saved[0].payload.fatos.indisponivel_em).toEqual(['2026-10-13'])
    expect(mocks.prepareWeek).toHaveBeenCalledExactlyOnceWith({ inicio: '2026-10-12', today: '2026-10-11', force: true, source: 'encontro' })
    expect(res.body).toMatchObject({ planejamento: { planejamento_estado: 'apos_encontro' }, planejamento_pendente: false })
  })
})
