import { describe, expect, it } from 'vitest'
import { evaluateMentorWeekV2 } from '../api/_lib/mentor-v2.js'
import { materializeMentorWeek, applyMentorWeekV2 } from '../api/_lib/mentor-v2-plan.js'
import { validateMentorV2Decision } from '../shared/mentor-v2-policy.js'
import { meetingDatabase } from './helpers/mentor-meeting-db.js'

function dbFixture() {
  const db = meetingDatabase()
  db.tables.conhecimento_modulo[0].conteudo.politica.regras.push({ id: 'TRATAMENTO_PENDENCIAS_SEMANAIS', habilitada: true })
  db.tables.mentor_contexto[0].dados.capacidade_inicial.slots = [{ dia: 0, objetivo_id: 'faculty', atividade: 'ESTUDO', duracao_minutos: 50 }]
  db.tables.sessao = [{ id: 'old-a', chave_mentor: 'old-week-a', objetivo_id: 'faculty', materia_id: 'a', material_id: 'pdf-a', tipo: 'estudo',
    data: '2030-02-25', status: 'nao_concluida', duracao_estimada: 50, origem: 'mentor' }]
  return db
}
const run = (db, persist = false) => evaluateMentorWeekV2({ supabase: db, inicio: '2030-03-04', instanteReferencia: '2030-03-04T15:00:00Z', persist })
const treatments = (result) => result.decisoes.filter((row) => row.parametros.acao)

describe('pendências estratégicas V2, Fase 3.15', () => {
  it('conteúdo ainda relevante recebe nova origem ligada à pendência, sem mover sessão antiga', async () => {
    const db = dbFixture(), old = structuredClone(db.tables.sessao[0]), result = await run(db, true)
    const decision = treatments(result)[0], rows = materializeMentorWeek(result)
    expect(decision.tipo_decisao).toBe('REAGENDAR_SEMANA_FUTURA')
    expect(decision.parametros.novas_decisoes).toHaveLength(1)
    expect(rows).toHaveLength(1)
    expect(rows[0].id).not.toBe(old.id)
    expect(rows[0].data).toBe('2030-03-04')
    expect(result.decisoes.find((row) => row.tipo_decisao === 'CRIAR_DEMANDA').alvos_relacionados).toContainEqual({ entidade: 'sessao', id: old.id })
    await applyMentorWeekV2({ supabase: db, evaluation: result })
    expect(db.tables.sessao.find((row) => row.id === old.id)).toEqual(old)
    expect(db.tables.mentor_decisao[0].dados.avaliacao.pendencias.divida_minutos).toBe(0)
  })
  it('prova atual substitui seleção de pendência menos urgente, sem excluí-la do currículo', async () => {
    const db = dbFixture()
    db.tables.compromisso = [{ id: 'exam', objetivo_id: 'faculty', materia_id: 'b', tipo: 'prova', data: '2030-03-06', concluido: false }]
    const result = await run(db), decision = treatments(result)[0]
    expect(decision.tipo_decisao).toBe('SUBSTITUIR_PENDENCIA')
    expect(decision.reason_codes).toContain('PENDING_REPLACED')
    expect(materializeMentorWeek(result)[0].materia_id).toBe('b')
    expect(result.priorizacao.sinais.candidatos.some((row) => row.material_id === 'pdf-a')).toBe(true)
    expect(decision.parametros.novas_decisoes).toHaveLength(1)
    expect(db.tables.sessao[0].status).toBe('nao_concluida')
  })
  it('material canonicamente concluído encerra obrigação antiga sem apagar história ou inferir domínio', async () => {
    const db = dbFixture(), old = structuredClone(db.tables.sessao)
    db.tables.material_progresso = [{ material_id: 'pdf-a', estado: 'concluido', concluido_em: '2030-03-01T15:00:00Z' }]
    const result = await run(db), decision = treatments(result)[0]
    expect(decision.tipo_decisao).toBe('ABANDONAR_PENDENCIA')
    expect(decision.reason_codes).toContain('NO_LONGER_RELEVANT_PENDING')
    expect(decision.reason_codes).not.toContain('PENDING_DEFERRED')
    expect(decision.parametros.novas_decisoes).toEqual([])
    expect(materializeMentorWeek(result).every((row) => row.material_id !== 'pdf-a')).toBe(true)
    expect(db.tables.sessao).toEqual(old)
    expect(result.dominio).toBe('UNKNOWN')
  })
  it('várias pendências sem capacidade ficam mantidas, sem transportar sessões ou gerar dívida', async () => {
    const db = dbFixture(); db.tables.sessao.push({ ...db.tables.sessao[0], id: 'old-b', materia_id: 'b', material_id: 'pdf-b' })
    db.tables.mentor_contexto[0].dados.disponibilidade.dias.forEach((row) => { row.minutos = 0 })
    const before = structuredClone(db.tables.sessao), result = await run(db)
    expect(treatments(result).map((row) => row.tipo_decisao)).toEqual(['MANTER_PENDENCIA', 'MANTER_PENDENCIA'])
    expect(materializeMentorWeek(result)).toEqual([])
    expect(result.pendencias).toMatchObject({ divida_minutos: 0, aumenta_capacidade: false, altera_historico: false })
    expect(treatments(result).every((row) => row.reason_codes.includes('AVAILABILITY_CONSTRAINT'))).toBe(true)
    expect(db.tables.sessao).toEqual(before)
  })
  it('histórico extenso perdido não aumenta blocos/minutos configurados', async () => {
    const db = dbFixture()
    db.tables.sessao = Array.from({ length: 20 }, (_, index) => ({ ...db.tables.sessao[0], id: `pending-${index}` }))
    const result = await run(db)
    expect(materializeMentorWeek(result)).toHaveLength(1)
    expect(result.carga_semanal.carga_proposta.minutos).toBe(50)
    expect(treatments(result)).toHaveLength(20)
    expect(new Set(materializeMentorWeek(result).map((row) => row.id)).size).toBe(1)
  })
  it('redistribui continuidade por slots da nova semana sem alongar blocos', async () => {
    const db = dbFixture()
    db.tables.mentor_contexto[0].dados.capacidade_inicial.slots = [1, 3].map((dia) => ({ dia, objetivo_id: 'faculty', atividade: 'ESTUDO', duracao_minutos: 50 }))
    db.tables.material_progresso = [{ material_id: 'pdf-a', estado: 'em_andamento', concluido_em: null }]
    const result = await run(db), decision = treatments(result)[0]
    expect(decision.tipo_decisao).toBe('REDISTRIBUIR_PENDENCIA')
    expect(decision.parametros.novas_decisoes.map((row) => row.data)).toEqual(['2030-03-05', '2030-03-07'])
    expect(materializeMentorWeek(result).map((row) => row.duracao_estimada)).toEqual([50, 50])
  })
  it('identidade curricular ausente conserva pendência sem inventar abandono ou domínio', async () => {
    const db = dbFixture(); delete db.tables.sessao[0].material_id
    const result = await run(db), decision = treatments(result)[0]
    expect(decision.tipo_decisao).toBe('MANTER_PENDENCIA')
    expect(decision.reason_codes).toContain('INSUFFICIENT_EVIDENCE')
  })
  it('conclusão teórica não abandona automaticamente uma pendência de prática', async () => {
    const db = dbFixture(); db.tables.sessao[0].tipo = 'exercicio'
    db.tables.material_progresso = [{ material_id: 'pdf-a', estado: 'concluido', concluido_em: '2030-03-01T15:00:00Z' }]
    expect(treatments(await run(db))[0].tipo_decisao).toBe('MANTER_PENDENCIA')
    expect(treatments(await run(db))[0].reason_codes).toContain('INSUFFICIENT_EVIDENCE')
  })
  it('canceladas e concluídas não são faltas a reagendar', async () => {
    const db = dbFixture()
    db.tables.sessao[0].status = 'cancelada'; db.tables.sessao[0].cancelamento_origem = 'usuario'
    db.tables.sessao.push({ ...db.tables.sessao[0], id: 'done', status: 'feita', concluida_em: '2030-02-25T15:00:00Z' })
    expect(treatments(await run(db))).toEqual([])
  })
  it('regra exige ativação única explícita, nunca fallback histórico', async () => {
    const db = dbFixture(); db.tables.conhecimento_modulo[0].conteudo.politica.regras.pop()
    expect((await run(db)).pendencias).toBeUndefined()
  })
  it('reaplicar não duplica demanda nem modifica história', async () => {
    const db = dbFixture(), old = structuredClone(db.tables.sessao[0]), result = await run(db, true)
    await applyMentorWeekV2({ supabase: db, evaluation: result })
    await applyMentorWeekV2({ supabase: db, evaluation: result })
    const second = await run(db, true)
    await applyMentorWeekV2({ supabase: db, evaluation: second })
    expect(db.tables.sessao).toHaveLength(2)
    expect(db.tables.sessao[0]).toEqual(old)
    expect(treatments(second)[0].tipo_decisao).toBe('MANTER_PENDENCIA')
    expect(treatments(second)[0].alvos_relacionados).toContainEqual({ entidade: 'sessao', id: db.tables.sessao[1].id })
  })
  it('mesmos fatos e corte produzem decisões idênticas sem alterar os inputs', async () => {
    const db = dbFixture(), before = structuredClone(db.tables)
    expect(await run(db)).toEqual(await run(db))
    expect(db.tables).toEqual(before)
  })
  it('uma resposta isolada não abandona conteúdo nem troca a matéria pendente', async () => {
    const db = dbFixture()
    db.tables.topico = [{ id: 'topic-a', materia_id: 'a' }]
    db.tables.questao = [{ id: 'question', topico_id: 'topic-a' }]
    db.tables.registro = [{ id: 'attempt', questao_id: 'question', resultado: false, classificacao: 'certeza', criado_em: '2030-03-03T15:00:00Z' }]
    expect(treatments(await run(db))[0].tipo_decisao).toBe('REAGENDAR_SEMANA_FUTURA')
    expect(materializeMentorWeek(await run(db))[0].materia_id).toBe('a')
  })
  it('decisão adulterada não pode tratar cancelamento ou virar comando livre', async () => {
    const result = await run(dbFixture()), decision = structuredClone(treatments(result)[0])
    decision.parametros.acao = 'APAGAR'
    expect(() => validateMentorV2Decision(decision)).toThrow('pendência inválido')
  })
})
