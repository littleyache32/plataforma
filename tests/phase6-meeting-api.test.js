import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ database: null, prepareWeek: vi.fn() }))
vi.mock('../api/_lib/supabase.js', () => ({ getSupabaseAdmin: () => mocks.database }))
vi.mock('../api/_lib/http.js', () => ({ allowMethods: () => true, requireAccess: () => true, fail: vi.fn(), queryParam: vi.fn() }))
vi.mock('../api/_lib/plano-handler.js', () => ({ prepareMentorWeek: mocks.prepareWeek }))

import mentorHandler from '../api/mentor.js'
import { meetingDatabase } from './helpers/mentor-meeting-db.js'

function response() {
  const res = { statusCode: null, body: null }
  res.status = (code) => { res.statusCode = code; return res }
  res.json = (body) => { res.body = body; return res }
  return res
}

describe('persistência controlada do encontro da Fase 6', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mocks.prepareWeek.mockReset()
    mocks.database = meetingDatabase()
    mocks.database.tables.mentor_encontro_semanal = [{ semana_inicio: '2026-09-28', carga_percebida: 'pesada' }]
  })
  afterEach(() => vi.useRealTimers())

  it('grava fatos estruturados da semana sem antecipar o planejamento na quinta-feira', async () => {
    vi.setSystemTime(new Date('2026-10-01T12:00:00Z'))
    const res = response()
    await mentorHandler({ method: 'POST', body: {
      semanaInicio: '2026-09-28', cargaPercebida: 'pesada', classificacoes: ['problema_material'],
      fatos: { acontecimentos: 'Semana de prova', dificuldade_nivel: 'alta', dificuldade: 'Conteúdo extenso',
        impedimentos: 'Consulta médica', excecoes: 'Mudança de horário', indisponivel_em: ['2026-10-06'] },
    } }, res)
    expect(res.statusCode).toBe(200)
    const saved = mocks.database.writes.filter((row) => row.table === 'mentor_encontro_semanal')
    expect(saved).toHaveLength(1)
    expect(saved[0].payload).not.toHaveProperty('carga_percebida')
    expect(mocks.database.tables.mentor_encontro_semanal[0].carga_percebida).toBe('pesada')
    expect(saved[0].payload).toMatchObject({ semana_inicio: '2026-09-28',
      classificacoes: ['problema_material'], fatos: { acontecimentos: 'Semana de prova', dificuldade_nivel: 'alta',
        dificuldade: 'Conteúdo extenso', impedimentos: 'Consulta médica', excecoes: 'Mudança de horário', disponibilidade_ref: { fonte: 'mentor_contexto', datas: ['2026-10-06'] } } })
    expect(res.body.encontro_semanal.fatos.indisponivel_em).toEqual(['2026-10-06'])
    expect(res.body.planejamento_pendente).toBe(true)
    expect(mocks.prepareWeek).not.toHaveBeenCalled()
  })

  it('após registrar o encontro no domingo, solicita recálculo da próxima semana', async () => {
    vi.setSystemTime(new Date('2026-10-11T12:00:00Z'))
    mocks.prepareWeek.mockResolvedValue({ status: 200, body: { planejamento_estado: 'apos_encontro', total_planejado: 20 } })
    const res = response()
    await mentorHandler({ method: 'POST', body: { semanaInicio: '2026-10-05', cargaPercebida: 'adequada',
      fatos: { indisponivel_em: ['2026-10-13'] } } }, res)
    expect(mocks.database.writes.filter((row) => row.table === 'mentor_encontro_semanal')).toHaveLength(1)
    expect(res.body.encontro_semanal.fatos.indisponivel_em).toEqual(['2026-10-13'])
    expect(mocks.prepareWeek).toHaveBeenCalledExactlyOnceWith({ inicio: '2026-10-12', today: '2026-10-11', force: true, source: 'encontro' })
    expect(res.body).toMatchObject({ planejamento: { planejamento_estado: 'apos_encontro' }, planejamento_pendente: false })
  })

  it('POST materializa avaliação canônica antes de registrar o encontro e devolve ID para edição', async () => {
    vi.setSystemTime(new Date('2030-03-03T12:00:00Z'))
    mocks.prepareWeek.mockResolvedValue({ status: 200, body: {} })
    const res = response()
    await mentorHandler({ method: 'POST', body: { semanaInicio: '2030-02-25',
      fatos: { avaliacoes: [{ materia_id: 'b', tipo: 'prova', titulo: 'Prova real informada', data: '2030-03-07' }] } } }, res)
    expect(res.statusCode).toBe(200)
    expect(mocks.database.writes.map((row) => row.table)).toEqual(['compromisso', 'mentor_encontro_semanal'])
    const id = mocks.database.tables.compromisso[0].id
    expect(res.body.encontro_semanal.fatos.avaliacoes[0]).toMatchObject({ id, data: '2030-03-07' })
    expect(mocks.database.tables.mentor_encontro_semanal.at(-1).fatos.compromissos).toEqual([{ id }])
    expect(mocks.database.tables.mentor_encontro_semanal.at(-1).fatos).not.toHaveProperty('avaliacoes')
  })
})
