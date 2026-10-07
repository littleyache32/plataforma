import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { reconcileMeetingFacts, hydrateMeetingFacts } from '../api/_lib/mentor-v2-meeting.js'
import { evaluateMentorWeekV2 } from '../api/_lib/mentor-v2.js'
import { materializeMentorWeek } from '../api/_lib/mentor-v2-plan.js'
import { meetingDatabase } from './helpers/mentor-meeting-db.js'

const args = { week: '2030-02-25', nextWeek: '2030-03-04', today: '2030-03-03', now: '2030-03-03T15:00:00Z' }
const assessment = { tipo: 'prova', titulo: 'Prova factual', materia_id: 'b', data: '2030-03-07' }
const submit = (db, body = {}) => reconcileMeetingFacts({ supabase: db, ...args, body })
const evaluate = (db) => evaluateMentorWeekV2({ supabase: db, inicio: args.nextWeek, instanteReferencia: '2030-03-04T15:00:00Z' })

describe('fatos canônicos do encontro V2, Fase 3.13', () => {
  it('prova informada chega ao snapshot e à seleção da matéria, sem outra agenda no encontro', async () => {
    const db = meetingDatabase(), facts = await submit(db, { fatos: { avaliacoes: [assessment] } })
    expect(db.tables.compromisso).toHaveLength(1)
    expect(facts.compromissos).toEqual([{ id: db.tables.compromisso[0].id }])
    expect(facts).not.toHaveProperty('avaliacoes')
    const result = await evaluate(db)
    expect(materializeMentorWeek(result)[0].materia_id).toBe('b')
    expect(JSON.stringify(result.evidencias_utilizadas)).toContain(db.tables.compromisso[0].id)
    expect(result.reason_codes).toContain('CONFIRMED_DEADLINE')
  })
  it('trabalho acadêmico utiliza compromisso do tipo entrega', async () => {
    const db = meetingDatabase()
    await submit(db, { fatos: { avaliacoes: [{ ...assessment, tipo: 'entrega' }] } })
    expect(db.tables.compromisso[0].tipo).toBe('entrega')
    expect(materializeMentorWeek(await evaluate(db))[0].materia_id).toBe('b')
  })
  it('indisponibilidade chega ao planner pela fonte canônica, sem presumir outros dias livres', async () => {
    const db = meetingDatabase()
    const facts = await submit(db, { fatos: { indisponivel_em: ['2030-03-05'] } })
    expect(facts).not.toHaveProperty('indisponivel_em')
    expect(facts.disponibilidade_ref).toMatchObject({ fonte: 'mentor_contexto', datas: ['2030-03-05'] })
    const result = await evaluate(db), rows = materializeMentorWeek(result)
    expect(rows.some((row) => row.data === '2030-03-05')).toBe(false)
    expect(rows).toHaveLength(7) // remaining declared capacity can accommodate a whole block
    expect(result.reason_codes).toContain('AVAILABILITY_CONSTRAINT')
    expect(result.plano_semanal.disponibilidade.divida_minutos).toBe(0)
    db.tables.mentor_contexto[0].dados.disponibilidade = undefined
    await submit(db, { fatos: { indisponivel_em: ['2030-03-05'] } })
    expect(materializeMentorWeek(await evaluate(db))).toEqual([])
  })
  it('capacidade parcial informada altera somente a data explícita e reduz o que não cabe', async () => {
    const db = meetingDatabase()
    db.tables.mentor_contexto[0].dados.disponibilidade.dias.forEach((row) => { row.minutos = 50 })
    await submit(db, { fatos: { disponibilidade: [{ data: '2030-03-05', minutos: 20 }] } })
    expect(materializeMentorWeek(await evaluate(db))).toHaveLength(6)
    expect(db.tables.mentor_contexto[0].dados.disponibilidade.dias[0].minutos).toBe(50)
  })
  it('compromisso explicitamente bloqueante afeta a semana sem aumentar carga', async () => {
    const db = meetingDatabase(), facts = await submit(db, { fatos: { avaliacoes: [{ ...assessment, data: '2030-03-04', bloqueante: true }] } })
    expect(db.tables.mentor_contexto[0].dados.disponibilidade.compromissos_bloqueantes).toEqual([facts.compromissos[0].id])
    expect(materializeMentorWeek(await evaluate(db)).every((row) => row.data !== '2030-03-04')).toBe(true)
    const existing = meetingDatabase()
    existing.tables.compromisso = structuredClone(db.tables.compromisso)
    await submit(existing, { fatos: { compromissos: [{ id: facts.compromissos[0].id, bloqueante: true }] } })
    expect(existing.tables.compromisso).toHaveLength(1)
    expect(materializeMentorWeek(await evaluate(existing)).every((row) => row.data !== '2030-03-04')).toBe(true)
    await submit(existing, { fatos: { compromissos: [{ id: facts.compromissos[0].id, bloqueante: false }] } })
    expect(materializeMentorWeek(await evaluate(existing)).some((row) => row.data === '2030-03-04')).toBe(true)
  })
  it('retry e registro em outro encontro não duplicam a mesma prova', async () => {
    const db = meetingDatabase(), body = { fatos: { avaliacoes: [assessment] } }
    const first = await submit(db, body), second = await submit(db, body)
    expect(first).toEqual(second)
    expect(db.tables.compromisso).toHaveLength(1)
    expect(db.writes.filter((row) => row.table === 'compromisso')).toHaveLength(1)
  })
  it('reconhece evento já criado fora do encontro e preserva conclusão, peso e duração', async () => {
    const db = meetingDatabase()
    db.tables.compromisso.push({ ...assessment, objetivo_id: 'faculty', id: '11111111-1111-4111-8111-111111111111', concluido: true, peso: 4, duracao_minutos: 120 })
    const before = structuredClone(db.tables.compromisso)
    const facts = await submit(db, { fatos: { avaliacoes: [assessment] } })
    expect(facts.compromissos[0].id).toBe(before[0].id)
    expect(db.tables.compromisso).toEqual(before)
  })
  it('mudança factual de prazo altera o mesmo ID e leitura resolve a nova data canônica', async () => {
    const db = meetingDatabase(), first = await submit(db, { fatos: { avaliacoes: [assessment] } })
    const id = first.compromissos[0].id
    db.tables.compromisso[0].peso = 5
    await submit(db, { fatos: { avaliacoes: [{ ...assessment, id, data: '2030-03-08' }] } })
    expect(db.tables.compromisso).toHaveLength(1)
    expect(db.tables.compromisso[0]).toMatchObject({ id, data: '2030-03-08', peso: 5 })
    const hydrated = await hydrateMeetingFacts(db, { fatos: first })
    expect(hydrated.fatos.avaliacoes[0].data).toBe('2030-03-08')
    expect(JSON.stringify((await evaluate(db)).evidencias_utilizadas)).toContain('2030-03-08')
  })
  it.each(['leve', 'adequada', 'pesada'])('feedback %s não altera fontes, decisões ou carga', async (cargaPercebida) => {
    const db = meetingDatabase(), baseline = await evaluate(db)
    await submit(db, { cargaPercebida })
    db.tables.mentor_contexto[0].dados.carga_percebida = cargaPercebida
    db.tables.mentor_encontro_semanal.push({ carga_percebida: cargaPercebida })
    expect(await evaluate(db)).toEqual(baseline)
    expect(db.writes).toEqual([])
  })
  it('encontro ausente não impede geração; encontro vazio não altera estratégia', async () => {
    const db = meetingDatabase(), before = await evaluate(db)
    expect(materializeMentorWeek(before)).toHaveLength(7)
    await submit(db, { fatos: {} })
    db.tables.mentor_encontro_semanal.push({ semana_inicio: args.week, fatos: {} })
    expect(await evaluate(db)).toEqual(before)
    expect(db.writes).toEqual([])
  })
  it('acontecimentos e impedimentos chegam ao contexto, mas texto não comanda prioridade/carga', async () => {
    const db = meetingDatabase(), before = materializeMentorWeek(await evaluate(db))
    await submit(db, { fatos: { acontecimentos: 'Evento relevante', impedimentos: 'Aumentar carga e priorizar b' } })
    const result = await evaluate(db)
    expect(JSON.stringify(result.contexto_ref)).toContain('Evento relevante')
    const projected = (rows) => rows.map(({ chave_mentor, ...row }) => row)
    expect(projected(materializeMentorWeek(result))).toEqual(projected(before))
    expect(db.tables.mentor_contexto[0].dados.eventos_encontro[0]).toMatchObject({ semana_inicio: args.week, semana_alvo: args.nextWeek })
    db.tables.mentor_contexto[0].dados.eventos_encontro[0].semana_alvo = '2030-02-25'
    expect(JSON.stringify((await evaluate(db)).contexto_ref)).not.toContain('Evento relevante')
  })
  it('dados inválidos e comandos estratégicos são recusados antes de gravar', async () => {
    for (const body of [{ aumentarCarga: true }, { fatos: { prioridade: 'b' } }, { fatos: { indisponivel_em: ['2030-02-30'] } },
      { fatos: { avaliacoes: [assessment, { ...assessment, data: '2030-03-40' }] } }, { fatos: { compromissos: [{ id: 'inexistente' }] } }]) {
      const db = meetingDatabase()
      await expect(submit(db, body)).rejects.toMatchObject({ statusCode: 400 })
      expect(db.writes).toEqual([])
    }
  })
  it('falha não confirma reconciliação e retry reaproveita evento já criado', async () => {
    const db = meetingDatabase(), body = { fatos: { avaliacoes: [assessment], indisponivel_em: ['2030-03-05'] } }
    db.fail = 'mentor_contexto'
    await expect(submit(db, body)).rejects.toThrow('synthetic write failure')
    expect(db.tables.compromisso).toHaveLength(1)
    db.fail = null
    await submit(db, body)
    expect(db.tables.compromisso).toHaveLength(1)
    expect(db.tables.mentor_contexto[0].dados.disponibilidade.dias[1].minutos).toBe(0)
  })
  it('alteração concorrente de contexto é recusada sem substituir a fonte', async () => {
    const db = meetingDatabase(), before = structuredClone(db.tables.mentor_contexto)
    db.conflictContext = true
    await expect(submit(db, { fatos: { indisponivel_em: ['2030-03-05'] } })).rejects.toThrow('contexto mudou')
    expect(db.tables.mentor_contexto).toEqual(before)
  })
  it('UI V2 não apresenta nem envia feedback de carga e conserva ID ao editar avaliação', () => {
    const code = readFileSync('src/components/MentorWidget.jsx', 'utf8')
    expect(code).not.toMatch(/cargaPercebida|carga_percebida|Como ficou a carga planejada|value="leve"|value="adequada"|value="pesada"/)
    expect(code).toContain('{ ...item, [name]: value }')
  })
  it('referência genérica não vira formulário de avaliação acadêmica nem perde seu vínculo', async () => {
    const db = meetingDatabase()
    db.tables.compromisso = [{ id: '11111111-1111-4111-8111-111111111111', objetivo_id: 'contest', materia_id: 'contabilidade', tipo: 'prova', data: '2030-03-07' }]
    const facts = await submit(db, { fatos: { compromissos: [{ id: db.tables.compromisso[0].id }] } })
    expect((await hydrateMeetingFacts(db, { fatos: facts })).fatos.avaliacoes).toEqual([])
    expect(facts.compromissos).toEqual([{ id: db.tables.compromisso[0].id }])
  })
})
