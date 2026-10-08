import { describe, expect, it } from 'vitest'
import definition from '../config/mentor-ciclo-atual.json'
import { prepareCycleContext, operationalDayLimit } from '../shared/mentor-v2-cycle.js'
import { allocateMentorWeekCapacity } from '../shared/mentor-v2-availability.js'
import { evaluateMentorWeekV2 } from '../api/_lib/mentor-v2.js'
import { materializeMentorWeek, applyMentorWeekV2 } from '../api/_lib/mentor-v2-plan.js'
import { cancelPreviousCyclePlans } from '../api/_lib/mentor-v2-cycle.js'
import { prepareMentorWeek } from '../api/_lib/plano-handler.js'
import { meetingDatabase } from './helpers/mentor-meeting-db.js'

const start = '2026-10-12'
function database() {
  const db = meetingDatabase(), context = db.tables.mentor_contexto[0]
  context.dados = prepareCycleContext({ definition: { ...definition, ciclo: { ...definition.ciclo, inicio: start } }, objectives: db.tables.objetivo, current: context.dados })
  context.dados.disponibilidade.dias = Array.from({ length: 7 }, (_, i) => ({ data: `2026-10-${12 + i}`, minutos: 600 }))
  db.tables.materia.push(...['c', 'd'].map((id) => ({ id, objetivo_id: 'contest' })))
  db.tables.material.push(...['c', 'd'].map((id) => ({ id: `pdf-${id}`, materia_id: id, objetivo_id: 'contest', status: 'aceito', nome: id, ordem_curso: 1 })))
  return db
}
const run = (db, inicio = start) => evaluateMentorWeekV2({ supabase: db, inicio, instanteReferencia: `${inicio}T15:00:00Z` })

describe('Fase 3.17, baseline configurável e orçamento finito', () => {
  it('12/10 inicia 2 concurso + 1 Faculdade por dia, 21 demandas independentes de 50', async () => {
    const db = database(), result = await run(db), rows = materializeMentorWeek(result)
    expect(rows).toHaveLength(21)
    for (let i = 12; i <= 18; i++) {
      const day = rows.filter((row) => row.data === `2026-10-${i}`)
      expect(day.map((row) => row.objetivo_id).sort()).toEqual(['contest', 'contest', 'faculty'])
      expect(day.every((row) => row.duracao_estimada === 50 && row.tipo === 'estudo')).toBe(true)
    }
    expect(rows.reduce((sum, row) => sum + row.duracao_estimada, 0)).toBe(1050)
    expect(db.writes).toEqual([])
  })
  it('início é configuração mutável e semana anterior não é reconstruída', async () => {
    const db = database()
    expect((await run(db, '2026-10-05')).reason_codes).toContain('CYCLE_NOT_STARTED')
    const configured = structuredClone(definition); configured.ciclo.inicio = '2030-03-04'
    db.tables.mentor_contexto[0].dados = prepareCycleContext({ definition: configured, objectives: db.tables.objetivo, current: db.tables.mentor_contexto[0].dados })
    expect(db.tables.mentor_contexto[0].dados.ciclo_operacional.inicio).toBe('2030-03-04')
    expect(db.writes).toEqual([])
  })
  it('semana inicial não permite prática rotineira mesmo com flags antigas habilitadas', async () => {
    const db = database(), context = db.tables.mentor_contexto[0].dados
    context.rotina_pratica = { questoes: true, question_cards: true, revisao_pratica: true }
    db.tables.conhecimento_modulo[0].conteudo.politica.modalidades_permitidas.push('REVISAO', 'QUESTOES', 'QUESTION_CARDS')
    context.capacidade_inicial.slots.push({ dia: 0, objetivo_id: 'contest', atividade: 'QUESTOES', duracao_minutos: 50, materia_id: 'c', topico_id: 'topic-c' })
    expect(materializeMentorWeek(await run(db)).every((row) => row.tipo === 'estudo')).toBe(true)
  })
  it('tetos 450/240/180 restringem materialização e não são metas', () => {
    const availability = { versao: 'disponibilidade-v2/1', dias: [12, 17, 18].map((day) => ({ data: `2026-10-${day}`, minutos: 900 })) }
    const requests = availability.dias.flatMap((day, d) => Array.from({ length: 20 }, (_, index) => ({ index: d * 20 + index, day: day.data, minutes: 50 })))
    const result = allocateMentorWeekCapacity({ availability, requests, demands: [], commitments: [], weekStart: start, weekEnd: '2026-10-18', today: start })
    for (const day of availability.dias) expect(result.allocations.filter((row) => row.data === day.data).reduce((sum, row) => sum + row.minutos, 0)).toBeLessThanOrEqual(operationalDayLimit(day.data))
    expect([12, 17, 18].map((day) => operationalDayLimit(`2026-10-${day}`))).toEqual([450, 240, 180])
    expect(result.signal.divida_minutos).toBe(0)
  })
  it('disponibilidade menor reduz semana inicial sem despejar perda em outros dias', async () => {
    const db = database(); db.tables.mentor_contexto[0].dados.disponibilidade.dias[0].minutos = 0
    const result = await run(db), rows = materializeMentorWeek(result)
    expect(rows).toHaveLength(18)
    expect(rows.some((row) => row.data === start)).toBe(false)
    expect(result.reason_codes).toContain('AVAILABILITY_CONSTRAINT')
    expect(result.plano_semanal.disponibilidade.divida_minutos).toBe(0)
  })
  it('falta e boa semana isolada mantêm carga sem escada nem dívida', async () => {
    for (const status of ['feita', 'nao_concluida']) {
      const db = database()
      db.tables.sessao.push({ id: 'past', objetivo_id: 'contest', materia_id: 'c', tipo: 'estudo', status, data: '2026-10-05', duracao_estimada: 50 })
      const result = await run(db)
      expect(result.carga_semanal.acao).toBe('MATERIALIZAR_CAPACIDADE_CONFIGURADA')
      expect(result.carga_semanal.carga_proposta.minutos).toBe(1050)
      expect(result.fallback.aumentar_carga).toBe(false)
      expect(result.carga_semanal.alteracao_carga_autorizada).toBe(false)
      expect(result.carga_semanal.sinais.pendencias.divida_minutos).toBe(0)
      expect(materializeMentorWeek(result)).toHaveLength(21)
      expect(db.tables.sessao[0].data).toBe('2026-10-05')
    }
  })
  it('concurso intercala matérias sem pular o primeiro material pendente', async () => {
    const rows = materializeMentorWeek(await run(database())).filter((row) => row.objetivo_id === 'contest')
    expect(rows.filter((row) => row.data === start).map((row) => row.materia_id)).toEqual(['c', 'd'])
    expect(rows.every((row) => row.material_id === `pdf-${row.materia_id}`)).toBe(true)
  })
  it('cancelamento preserva feitas, execução parcial, timer ativo, compromissos e histórico', async () => {
    const db = database()
    db.tables.sessao = [
      { id: 'old', origem: 'mentor', status: 'planejada', tipo: 'estudo', data: start },
      { id: 'future', origem: 'mentor', status: 'planejada', tipo: 'estudo', data: '2026-11-02' },
      { id: 'done', origem: 'mentor', status: 'feita', tipo: 'estudo', data: start },
      { id: 'partial', origem: 'mentor', status: 'planejada', tipo: 'estudo', data: start, duracao_realizada: 20 },
      { id: 'timer', origem: 'mentor', status: 'planejada', tipo: 'estudo', data: start },
      { id: 'exam', origem: 'mentor', status: 'planejada', tipo: 'prova', data: start },
      { id: 'new', origem: 'mentor', status: 'planejada', tipo: 'estudo', data: start, chave_mentor: `v2:${start}:ciclo:${definition.ciclo.id}:0` },
    ]
    db.tables.tempo_estudo.push({ id: 'active', sessao_id: 'timer', status: 'rodando' })
    const original = structuredClone(db.tables.sessao)
    expect(await cancelPreviousCyclePlans({ supabase: db, inicio: start, today: '2026-10-07' })).toEqual({ canceladas: 2 })
    expect(db.tables.sessao.slice(2)).toEqual(original.slice(2))
    expect(db.tables.sessao[0]).toMatchObject({ status: 'cancelada', cancelamento_origem: 'mentor' })
    expect(await cancelPreviousCyclePlans({ supabase: db, inicio: start, today: '2026-10-07' })).toEqual({ canceladas: 0 })
    expect(db.tables.tempo_estudo).toHaveLength(1)
  })
  it('novo ciclo não duplica demandas após materializar e recalcular', async () => {
    const db = database()
    await applyMentorWeekV2({ supabase: db, evaluation: await run(db) })
    await applyMentorWeekV2({ supabase: db, evaluation: await run(db) })
    expect(db.tables.sessao).toHaveLength(21)
  })
  it('preparo cancela plano anterior antes de materializar, sem apagar origem antiga', async () => {
    const db = database()
    db.tables.sessao.push({ id: 'old', origem: 'mentor', status: 'planejada', tipo: 'estudo', data: start,
      data_planejada_original: start, objetivo_id: 'contest', materia_id: 'c', material_id: 'pdf-c',
      duracao_estimada: 50, chave_mentor: `v2:${start}:0:decision:historical` })
    const result = await prepareMentorWeek({ supabase: db, inicio: start, today: start, instanteReferencia: `${start}T15:00:00Z` })
    expect(result.status).toBe(200)
    expect(result.body.canceladas_ciclo_anterior).toBe(1)
    expect(result.body.criadas).toBe(21)
    expect(db.tables.sessao[0]).toMatchObject({ status: 'cancelada', chave_mentor: `v2:${start}:0:decision:historical` })
    expect(db.tables.sessao).toHaveLength(22)
  })
  it('falha no cancelamento impede materialização; nenhuma história é apagada', async () => {
    const db = database()
    db.tables.sessao.push({ id: 'old', origem: 'mentor', status: 'planejada', tipo: 'estudo', data: start,
      objetivo_id: 'contest', materia_id: 'c', duracao_estimada: 50 })
    db.fail = 'sessao'
    await expect(prepareMentorWeek({ supabase: db, inicio: start, today: start, instanteReferencia: `${start}T15:00:00Z` })).rejects.toThrow('synthetic write failure')
    expect(db.tables.sessao).toHaveLength(1)
    expect(db.tables.sessao[0].status).toBe('planejada')
    expect(db.tables.mentor_decisao).toEqual([])
  })
  it('segunda semana sem evidência mantém a base, não expande por calendário', async () => {
    const db = database()
    db.tables.mentor_contexto[0].dados.disponibilidade.dias = Array.from({ length: 7 }, (_, i) => ({ data: `2026-10-${19 + i}`, minutos: 600 }))
    const result = await run(db, '2026-10-19')
    expect(materializeMentorWeek(result)).toHaveLength(21)
    expect(result.carga_semanal.carga_proposta.minutos).toBe(1050)
    expect(result.carga_semanal.alteracao_carga_autorizada).toBe(false)
  })
  it('Faculdade respeita 2 por dia, excepcionalmente 3 por prazo factual, nunca 4', () => {
    const requests = Array.from({ length: 4 }, (_, index) => ({ index, day: start, minutes: 50, faculty: true, objectiveId: 'faculty' }))
    const args = { requests, demands: [], availability: { versao: 'disponibilidade-v2/1', dias: [{ data: start, minutos: 450 }] }, weekStart: start, weekEnd: '2026-10-18', today: start }
    expect(allocateMentorWeekCapacity({ ...args, commitments: [] }).allocations).toHaveLength(2)
    expect(allocateMentorWeekCapacity({ ...args, commitments: [{ id: 'exam', objetivo_id: 'faculty', tipo: 'prova', concluido: false, data: '2026-10-14' }] }).allocations).toHaveLength(3)
  })
})
