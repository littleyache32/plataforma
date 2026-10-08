import { describe, it, expect, vi } from 'vitest'
import definition from '../config/mentor-ciclo-atual.json'
import { prepareCycleContext } from '../shared/mentor-v2-cycle.js'
import { meetingDatabase } from './helpers/mentor-meeting-db.js'
import { evaluateMentorWeekV2 } from '../api/_lib/mentor-v2.js'
import { materializeMentorWeek, applyMentorWeekV2 } from '../api/_lib/mentor-v2-plan.js'
import { reconcileSessionDuration } from '../shared/session-duration.js'
import tempoHandler from '../api/_lib/tempo-handler.js'
import sessionHandler from '../api/_lib/sessoes-handler.js'
const transport = vi.hoisted(() => ({ db: null }))
vi.mock('../api/_lib/supabase.js', () => ({ getSupabaseAdmin: () => transport.db }))
vi.mock('../api/_lib/http.js', () => ({ allowMethods: () => true, requireAccess: () => true,
  queryParam: () => null, readSession: () => ({ sub: 'test' }), fail: (res, error) => res.status(500).json({ error: error.message }) }))
const response = () => ({ status(code) { this.code = code; return this }, json(body) { this.body = body; return this } })
const setup = () => {
  const db = meetingDatabase(), context = db.tables.mentor_contexto[0]
  context.dados = prepareCycleContext({ definition: { ...definition, ciclo: { ...definition.ciclo, inicio: '2026-10-08' } }, objectives: db.tables.objetivo, current: context.dados })
  context.dados.calendario_academico = { versao: 'calendario-academico-v2/1', aulas: [0, 1, 2, 3].map((dia) => ({ dia, objetivo_id: 'faculty', materia_id: dia % 2 ? 'b' : 'a' })) }
  db.tables.materia.forEach((row) => { row.nome = row.id })
  context.dados.disponibilidade.dias = [8, 9, 10, 11, 12].map((day) => ({ data: `2026-10-${String(day).padStart(2, '0')}`, minutos: 150 }))
  db.tables.materia.push(...['c', 'd'].map((id) => ({ id, objetivo_id: 'contest' })))
  db.tables.material.push(...['c', 'd'].map((id) => ({ id: `pdf-${id}`, nome: id, materia_id: id, objetivo_id: 'contest', status: 'aceito', ordem_curso: 1 })))
  return db
}
const run = (db, inicio = '2026-10-05', instant = '2026-10-08T15:00:00Z') => evaluateMentorWeekV2({ supabase: db, inicio, instanteReferencia: instant })
describe('MVP histórico sintético, bootstrap configurável 08/10 (não vigente)', () => {
  it('materializa somente 08 a 11, dois concursos/dia e Faculdade apenas na quinta', async () => {
    const rows = materializeMentorWeek(await run(setup()))
    expect(rows).toHaveLength(9)
    for (const day of ['08','09','10','11']) {
      const items = rows.filter((row) => row.data === `2026-10-${day}`)
      expect(items.filter((row) => row.objetivo_id === 'contest')).toHaveLength(2)
      expect(new Set(items.filter((row) => row.objetivo_id === 'contest').map((row) => row.materia_id)).size).toBe(2)
      expect(items.filter((row) => row.objetivo_id === 'faculty')).toHaveLength(day === '08' ? 1 : 0)
      expect(items.every((row) => row.duracao_estimada === 50 && row.tipo === 'estudo' && row.reason_codes.includes('INITIAL_CYCLE_BOOTSTRAP'))).toBe(true)
      expect(items.filter((row) => row.objetivo_id === 'contest').every((row) => row.material_id)).toBe(true)
    }
  })
  it('sem disponibilidade não inventa capacidade factual; capacidade menor não gera dívida', async () => {
    const db = setup(); db.tables.mentor_contexto[0].dados.disponibilidade.dias[0].minutos = 50
    const result = await run(db)
    expect(materializeMentorWeek(result)).toHaveLength(7)
    expect(result.plano_semanal.disponibilidade.divida_minutos).toBe(0)
    delete db.tables.mentor_contexto[0].dados.disponibilidade
    expect(materializeMentorWeek(await run(db))).toHaveLength(0)
  })
  it('persistência insert-only preserva execução, material em andamento e exclusão manual ao recalcular', async () => {
    const db = setup(); await applyMentorWeekV2({ supabase: db, evaluation: await run(db) })
    db.tables.sessao[0].status = 'feita'; db.tables.sessao[0].concluida_em = '2026-10-08T17:00:00Z'
    db.tables.sessao[1].status = 'cancelada'; db.tables.sessao[1].cancelamento_origem = 'usuario'
    db.tables.material_progresso.push({ material_id: db.tables.sessao[0].material_id, estado: 'em_andamento', concluido_em: null })
    await applyMentorWeekV2({ supabase: db, evaluation: await run(db, '2026-10-05', '2026-10-09T15:00:00Z') })
    expect(db.tables.sessao).toHaveLength(9)
    expect(db.tables.sessao[0].status).toBe('feita'); expect(db.tables.sessao[1].status).toBe('cancelada')
    expect(db.tables.material_progresso[0].estado).toBe('em_andamento')
    const next = await run(db, '2026-10-12', '2026-10-12T15:00:00Z')
    expect(next.carga_semanal.sinais.historico.some((row) => row.demandas_concluidas > 0 || row.demandas_elegiveis > 0)).toBe(true)
    expect(db.tables.sessao[0].data).toBe('2026-10-08')
  })
  it('Faculdade segue calendário sem PDF mesmo que todos seus materiais estejam concluídos', async () => {
    const db = setup(); db.tables.material.filter((row) => row.objetivo_id === 'faculty').forEach((row) => { row.ordem_curso = null })
    db.tables.material_progresso.push({ material_id: 'pdf-a', estado: 'concluido', concluido_em: '2026-10-07T15:00:00Z' })
    const faculty = materializeMentorWeek(await run(db)).filter((row) => row.objetivo_id === 'faculty')
    expect(faculty).toHaveLength(1)
    expect(faculty[0]).toMatchObject({ materia_id: 'b', material_id: null, titulo: 'b · Aula dada, aula estudada' })
  })
  it('tempo real deriva da soma concluída, sem completar demanda nem duplicar retries', async () => {
    const db = setup(); db.tables.sessao.push({ id: 'session', status: 'planejada' })
    db.tables.tempo_estudo.push({ id: 'a', sessao_id: 'session', status: 'concluido', segundos_acumulados: 1800 }, { id: 'b', sessao_id: 'session', status: 'concluido', segundos_acumulados: 1200 }, { id: 'active', sessao_id: 'session', status: 'rodando', segundos_acumulados: 500 })
    await reconcileSessionDuration(db, 'session'); await reconcileSessionDuration(db, 'session')
    expect(db.tables.sessao[0]).toEqual({ id: 'session', status: 'planejada', duracao_realizada: 50 })
  })
  it('backend pausa, retoma e conclui timer vinculado; concluir demanda preserva duração real', async () => {
    vi.useFakeTimers(); vi.setSystemTime('2026-10-08T15:00:00Z')
    try {
      const db = setup(); transport.db = db
      db.tables.sessao.push({ id: 'session', status: 'planejada', material_id: 'pdf-c' })
      db.tables.tempo_estudo.push({ id: 'timer', sessao_id: 'session', status: 'rodando', segundos_acumulados: 0, retomado_em: '2026-10-08T14:30:00Z' })
      let res = response(); await tempoHandler({ method: 'PATCH', body: { id: 'timer', acao: 'pausar' } }, res)
      expect(res.code).toBe(200); expect(res.body.timer.segundos_acumulados).toBe(1800)
      res = response(); await tempoHandler({ method: 'PATCH', body: { id: 'timer', acao: 'retomar' } }, res)
      expect(res.body.timer.status).toBe('rodando')
      vi.setSystemTime('2026-10-08T15:20:00Z')
      res = response(); await tempoHandler({ method: 'PATCH', body: { id: 'timer', acao: 'concluir' } }, res)
      expect(res.code).toBe(200); expect(db.tables.sessao[0].duracao_realizada).toBe(50)
      expect(db.tables.sessao[0].status).toBe('planejada')
      res = response(); await sessionHandler({ method: 'PATCH', body: { id: 'session', status: 'feita' } }, res)
      expect(res.code).toBe(200); expect(db.tables.sessao[0].duracao_realizada).toBe(50)
      expect(db.tables.sessao[0].material_id).toBe('pdf-c')
      res = response(); await tempoHandler({ method: 'PATCH', body: { id: 'timer', acao: 'retomar' } }, res)
      expect(res.code).toBe(409)
    } finally { vi.useRealTimers() }
  })
})
