import { describe, expect, it } from 'vitest'
import { evaluateMentorV2, validateMentorV2Decision, resolveMentorV2Policy } from '../shared/mentor-v2-policy.js'
import { applyMentorWeekV2, materializeMentorWeek, mentorDemandId } from '../api/_lib/mentor-v2-plan.js'
import { prepareMentorWeek } from '../api/_lib/plano-handler.js'
import { readMentorDemandTrace } from '../api/_lib/mentor-v2-trace.js'

const start = '2030-03-04', instant = '2030-03-04T15:00:00Z'
function fixture() {
  const capacity = Array.from({ length: 7 }, (_, dia) => [
    { dia, objetivo_id: 'contest', atividade: 'ESTUDO', duracao_minutos: 50 },
    { dia, objetivo_id: 'contest', atividade: 'ESTUDO', duracao_minutos: 30 },
    { dia, objetivo_id: 'faculty', atividade: 'ESTUDO', duracao_minutos: 50 },
  ]).flat()
  const policyRecord = { id: 'p', modulo: 'mentor', ativo: true, versao: 'v2-synthetic', conteudo: { politica: {
    modelo: 'MENTOR_V2', versao_contrato: 'mentor-v2/1', modalidades_permitidas: ['ESTUDO'],
    regras: ['CONTINUIDADE_PLANO_EXISTENTE', 'PRIORIZACAO_CURRICULAR_SEMANAL', 'GERACAO_PLANO_SEMANAL'].map((id) => ({ id, habilitada: true })),
    capacidade_semanal: capacity,
  } } }
  const facts = { context: { id: 1, rotina_pratica: {}, objetivo_principal_id: 'contest' }, demands: [], planIdentities: [],
    subjects: [{ id: 'a', objetivo_id: 'contest' }, { id: 'b', objetivo_id: 'contest' }, { id: 'c', objetivo_id: 'faculty' }],
    topics: [{ id: 'ta', materia_id: 'a', nome: 'Conteúdo A' }],
    loadSources: { objectives: [{ id: 'contest', tipo: 'concurso' }, { id: 'faculty', tipo: 'faculdade' }], history: [], times: [], commitments: [] },
    prioritySources: { materials: [['a1', 'a', 'contest', 1], ['a2', 'a', 'contest', 2], ['b1', 'b', 'contest', 1], ['c1', 'c', 'faculty', 1]].map(([id, materia_id, objetivo_id, ordem_curso]) =>
      ({ id, materia_id, objetivo_id, ordem_curso, nome: `Aula ${id}`, status: 'aceito', estado_extracao: 'texto' })),
      progress: [], commitmentTopics: [], reviews: [], questions: [], attempts: [], cards: [] } }
  return { policyRecord, facts, weekStart: start, referenceInstant: instant, evaluationId: 'evaluation' }
}
const run = (input = fixture()) => evaluateMentorV2(input)
const creations = (result) => result.decisoes.filter((row) => row.tipo_decisao === 'CRIAR_DEMANDA')

// Controlled relational adapter, not proof of PostgreSQL transactions/concurrency.
function database(input = fixture()) {
  const tables = { conhecimento_modulo: [input.policyRecord], mentor_contexto: [{ id: 1, dados: input.facts.context }],
    sessao: input.facts.demands, materia: input.facts.subjects, topico: input.facts.topics,
    objetivo: input.facts.loadSources.objectives, compromisso: input.facts.loadSources.commitments,
    tempo_estudo: input.facts.loadSources.times, material: input.facts.prioritySources.materials,
    material_progresso: input.facts.prioritySources.progress, compromisso_topico: [],
    revisao_item: input.facts.prioritySources.reviews, questao: input.facts.prioritySources.questions,
    registro: input.facts.prioritySources.attempts, question_card: input.facts.prioritySources.cards, mentor_decisao: [] }
  const db = { tables, writes: [], reads: [], fail: null, from(table) {
    db.reads.push(table)
    let payload = null, options = null, single = false, page = null, updating = false
    const filters = [], q = {}
    q.select = q.order = () => q
    q.range = (from, to) => { page = [from, to]; return q }
    q.maybeSingle = q.single = () => { single = true; return q }
    q.eq = (key, value) => { filters.push((row) => row[key] === value); return q }
    q.gte = (key, value) => { filters.push((row) => row[key] >= value); return q }
    q.lte = (key, value) => { filters.push((row) => row[key] <= value); return q }
    q.lt = (key, value) => { filters.push((row) => row[key] < value); return q }
    q.like = (key, pattern) => { filters.push((row) => row[key]?.startsWith(pattern.slice(0, -1))); return q }
    q.in = (key, values) => { filters.push((row) => values.includes(row[key])); return q }
    q.update = (data) => { payload = data; updating = true; return q }
    q.upsert = (data, config) => { payload = data; options = config; return q }
    q.then = (resolve, reject) => Promise.resolve().then(() => {
      if (payload) {
        if (db.fail === table) return { data: null, error: new Error('synthetic write failure') }
        if (updating) {
          const changed = tables[table].filter((row) => filters.every((filter) => filter(row)))
          changed.forEach((row) => Object.assign(row, structuredClone(payload)))
          db.writes.push({ table, payload: structuredClone(payload), method: 'update' })
          return { data: changed, error: null }
        }
        const rows = Array.isArray(payload) ? payload : [payload]
        const inserted = rows.filter((row) => !tables[table].some((old) => old[options.onConflict] === row[options.onConflict]))
        tables[table].push(...structuredClone(inserted)); db.writes.push({ table, payload: structuredClone(payload), options })
        return { data: single ? inserted[0] : inserted, error: null }
      }
      let rows = (tables[table] || []).filter((row) => filters.every((filter) => filter(row)))
      if (page) rows = rows.slice(page[0], page[1] + 1)
      return { data: single ? rows[0] || null : rows, error: null }
    }).then(resolve, reject)
    return q
  } }
  return db
}

describe('geração de semana V2', () => {
  it('monta sete dias, cada demanda com contexto, duração, prioridade e decisão rastreável', () => {
    const result = run(), rows = materializeMentorWeek(result)
    expect(creations(result)).toHaveLength(21)
    expect(new Set(rows.map((row) => row.data)).size).toBe(7)
    expect(rows.filter((row) => row.objetivo_id === 'contest')).toHaveLength(14)
    expect(rows.filter((row) => row.objetivo_id === 'faculty')).toHaveLength(7)
    expect(rows.every((row) => row.origem === 'mentor' && row.materia_id && row.material_id && row.titulo && row.reason_codes.length && row.prioridade === 1)).toBe(true)
    expect(creations(result).every(validateMentorV2Decision)).toBe(true)
    expect(result.carga_semanal.carga_proposta).toMatchObject({ demandas: 21, minutos: 910 })
    expect(result.reason_codes).not.toContain('LOAD_MAINTAINED')
  })
  it('mesmos inputs geram as mesmas decisões e IDs sem mutação dos fatos', () => {
    const input = fixture(), before = structuredClone(input)
    expect(run(input)).toEqual(run(input)); expect(input).toEqual(before)
    expect(materializeMentorWeek(run(input))).toEqual(materializeMentorWeek(run(input)))
  })
  it('vários blocos permanecem separados e não concluem nem pulam material longo', () => {
    const rows = materializeMentorWeek(run())
    expect(rows.some((row) => row.material_id === 'a2')).toBe(false)
    expect(rows.filter((row) => row.material_id === 'a1').length).toBeGreaterThan(1)
    expect(rows.every((row) => [30, 50].includes(row.duracao_estimada))).toBe(true)
  })
  it('conclusão explícita elimina material antigo sem reiniciar curso', () => {
    const input = fixture(); input.facts.prioritySources.progress.push({ material_id: 'a1', estado: 'concluido', concluido_em: '2030-03-01T15:00:00Z' })
    const rows = materializeMentorWeek(run(input))
    expect(rows.some((row) => row.material_id === 'a1')).toBe(false)
    expect(rows.some((row) => row.material_id === 'a2')).toBe(true)
  })
  it('falta histórica devolve conteúdo à seleção, nunca acrescenta slots ou empurra sessão antiga', () => {
    const input = fixture(); input.facts.loadSources.history.push({ id: 'lost', objetivo_id: 'contest', materia_id: 'a', material_id: 'a1',
      tipo: 'estudo', status: 'nao_concluida', data: '2030-03-01', duracao_estimada: 50 })
    const result = run(input), rows = materializeMentorWeek(result)
    expect(rows).toHaveLength(21); expect(rows.some((row) => row.id === 'lost')).toBe(false)
    expect(rows.some((row) => row.material_id === 'a1')).toBe(true)
  })
  it('não recria exclusão ou demanda movida para fora da semana pela mesma chave', () => {
    const input = fixture(); input.facts.planIdentities.push({ id: 'deleted', chave_mentor: `v2:${start}:0`, status: 'cancelada', cancelamento_origem: 'usuario', data: start },
      { id: 'moved', chave_mentor: `v2:${start}:1`, status: 'planejada', data: '2030-03-11', movida_em: instant })
    const rows = materializeMentorWeek(run(input))
    expect(rows).toHaveLength(19)
    expect(rows.some((row) => [0, 1].some((index) => row.chave_mentor === `v2:${start}:${index}`))).toBe(false)
  })
  it('não soma base configurada a plano manual/legado já existente', () => {
    const input = fixture(); input.facts.demands.push({ id: 'existing', objetivo_id: 'contest', materia_id: 'a', status: 'planejada',
      tipo: 'estudo', data: start, duracao_estimada: 50, origem: 'manual' })
    expect(creations(run(input))).toEqual([])
    expect(run(input).plano_semanal.limitacoes).toContain('PLANO_EXISTENTE_PRESERVADO_SEM_SOBREPOSICAO')
  })
  it('não reconstrói dias passados durante a semana', () => {
    const input = fixture(); input.referenceInstant = '2030-03-06T15:00:00Z'
    expect(materializeMentorWeek(run(input)).every((row) => row.data >= '2030-03-06')).toBe(true)
    expect(creations(run(input))).toHaveLength(15)
  })
  it('sem configuração de carga inicial registra pendência e não inventa números', () => {
    const input = fixture(); delete input.policyRecord.conteudo.politica.capacidade_semanal
    const result = run(input)
    expect(creations(result)).toEqual([])
    expect(result.plano_semanal).toMatchObject({ pendente: true, limitacoes: ['CAPACIDADE_SEMANAL_NAO_CONFIGURADA'] })
  })
  it.each(['SIMULADO', 'PROVA', 'livre'])('não aceita modalidade futura/não tipada %s', (atividade) => {
    const input = fixture(); input.policyRecord.conteudo.politica.capacidade_semanal[0].atividade = atividade
    expect(run(input).resultado).toBe('NAO_AVALIAVEL')
  })
  it.each([-1, 7, 1.5])('recusa dia semanal inválido %s', (dia) => {
    const input = fixture(); input.policyRecord.conteudo.politica.capacidade_semanal[0].dia = dia
    expect(resolveMentorV2Policy(input.policyRecord).ok).toBe(false)
  })
  it.each([0, 60, 90, 100, -5])('recusa duração de bloco de Estudo incompatível %s', (duration) => {
    const input = fixture(); input.policyRecord.conteudo.politica.capacidade_semanal[0].duracao_minutos = duration
    expect(run(input).resultado).toBe('NAO_AVALIAVEL')
  })
  it.each(['QUESTOES', 'QUESTION_CARDS', 'REVISAO'])('materializa %s somente com autorização, capacidade e conteúdo explícitos', (activity) => {
    const input = fixture(), policy = input.policyRecord.conteudo.politica
    policy.modalidades_permitidas.push(activity)
    policy.capacidade_semanal = [{ dia: 0, objetivo_id: 'contest', atividade: activity, duracao_minutos: 30, materia_id: 'a', topico_id: 'ta', ...(activity === 'REVISAO' ? { revisao_id: 'r' } : {}) }]
    input.facts.context.rotina_pratica = { questoes: true, question_cards: true, revisao_pratica: true }
    input.facts.prioritySources.questions = [{ id: 'q', topico_id: 'ta' }]
    input.facts.prioritySources.cards = [{ id: 'card', topico_id: 'ta' }]
    input.facts.prioritySources.reviews = [{ id: 'r', questao_id: 'q', motivo: 'erro', status: 'pendente', agendada_para: '2030-03-04T14:00:00Z' }]
    const result = run(input), rows = materializeMentorWeek(result)
    expect(rows).toHaveLength(1)
    expect(rows[0].tipo).toBe({ QUESTOES: 'exercicio', QUESTION_CARDS: 'especial', REVISAO: 'revisao' }[activity])
    expect(rows[0].topico_id).toBe('ta')
    input.facts.context.rotina_pratica = {}
    expect(creations(run(input))).toEqual([])
  })
  it('revisão futura ou já concluída não vira demanda atual', () => {
    const input = fixture(); input.policyRecord.conteudo.politica.modalidades_permitidas.push('REVISAO')
    input.policyRecord.conteudo.politica.capacidade_semanal = [{ dia: 0, objetivo_id: 'contest', atividade: 'REVISAO', duracao_minutos: 30, materia_id: 'a', topico_id: 'ta', revisao_id: 'r' }]
    input.facts.context.rotina_pratica.revisao_pratica = true
    input.facts.prioritySources.questions = [{ id: 'q', topico_id: 'ta' }]
    input.facts.prioritySources.reviews = [{ id: 'r', questao_id: 'q', motivo: 'erro', status: 'pendente', agendada_para: '2030-03-05T14:00:00Z' }]
    expect(creations(run(input))).toEqual([])
    input.facts.prioritySources.reviews[0].agendada_para = '2030-03-03T14:00:00Z'; input.facts.prioritySources.reviews[0].status = 'concluida'
    expect(creations(run(input))).toEqual([])
  })
  it('materializador recusa avaliação indisponível, chave duplicada ou origem divergente', () => {
    const result = run(); result.resultado = 'NAO_AVALIAVEL'
    expect(() => materializeMentorWeek(result)).toThrow()
    result.resultado = 'DECISOES_EMITIDAS'; result.decisoes.push(result.decisoes[0])
    expect(() => materializeMentorWeek(result)).toThrow()
    const other = run(); other.decisoes[0].avaliacao_ref = 'wrong'
    expect(() => materializeMentorWeek(other)).toThrow()
  })
  it('não aceita adulterar duração, data ou chave de uma decisão contra sua capacidade', () => {
    const base = creations(run())[0]
    for (const change of [(row) => { row.duracao_minutos = 60 }, (row) => { row.alvo_temporal.data = '2030-03-05' },
      (row) => { row.parametros.chave_mentor = `v2:${start}:999` }]) {
      const row = structuredClone(base); change(row)
      expect(() => validateMentorV2Decision(row)).toThrow()
    }
  })
})

describe('aplicação controlada no banco e endpoint de semana', () => {
  it('integra fatos, sinais, policy, decisão, semana persistida e motivo original', async () => {
    const input = fixture()
    input.facts.prioritySources.progress.push({ material_id: 'a1', estado: 'concluido', concluido_em: '2030-03-01T15:00:00Z' })
    const db = database(input)
    const result = await prepareMentorWeek({ supabase: db, inicio: start, today: start, instanteReferencia: instant })
    expect(result.status).toBe(200)
    const evaluation = result.body.avaliacao_mentor_v2
    expect(evaluation.priorizacao.sinais).toBeDefined()
    expect(evaluation.carga_semanal.sinais).toBeDefined()
    expect(evaluation.dominio).toBe('UNKNOWN')
    expect(db.tables.sessao).toHaveLength(21)
    expect(db.tables.sessao.some((row) => row.material_id === 'a1')).toBe(false)
    expect(db.tables.sessao.some((row) => row.material_id === 'a2')).toBe(true)
    const before = structuredClone(db.tables)
    for (const row of db.tables.sessao) {
      const trace = await readMentorDemandTrace({ supabase: db, id: row.id, audit: true })
      expect(trace.estado).toBe('RASTREAVEL')
      expect(validateMentorV2Decision(trace.decisao)).toBe(true)
      expect(trace.policy_ref).toEqual(evaluation.policy_ref)
      expect(trace.avaliacao_ref).toBe(evaluation.avaliacao_ref)
      expect(trace.inputs_relevantes.length).toBeGreaterThan(0)
      expect(trace.reason_codes).toEqual(row.reason_codes)
      expect(trace.demanda_original).toEqual(row)
      expect(trace.explicacao.length).toBeLessThan(100)
    }
    expect(db.tables).toEqual(before)
    expect(db.reads).not.toContain('mentor_conhecimento')
  })
  it('configurações históricas fora da policy canônica não alteram demandas V2', async () => {
    const clean = database(), dirty = database()
    dirty.tables.mentor_conhecimento = [{ ativo: true, carga: 100, inicio: '2026-08-17', alvo: 2250 }]
    dirty.tables.conhecimento_modulo.push({ id: 'old-specialist', modulo: 'planejamento', ativo: true, conteudo: { carga: 90 } })
    dirty.tables.objetivo.forEach((row) => { row.config = { fase_inicial: { bloco_estudo_minutos: 90 }, reinicio: '2026-09-14' } })
    Object.assign(dirty.tables.mentor_contexto[0].dados, { fase: 'adaptacao_2', inicio: '2026-08-17', carga_atual: 100, carga_percebida: 'leve' })
    for (const db of [clean, dirty]) await prepareMentorWeek({ supabase: db, inicio: start, today: start, instanteReferencia: instant })
    const projected = (db) => db.tables.sessao.map(({ chave_mentor, ...row }) => row)
    expect(projected(dirty)).toEqual(projected(clean))
    expect(dirty.tables.sessao.every((row) => [30, 50].includes(row.duracao_estimada))).toBe(true)
    expect(dirty.reads).not.toContain('mentor_conhecimento')
    expect(dirty.tables.mentor_conhecimento[0].ativo).toBe(true)
  })
  it('ausência ou concorrência de policy vigente preserva plano e não resgata regras antigas', async () => {
    for (const policies of [[], [fixture().policyRecord, { id: 'v1', modulo: 'mentor', ativo: true, conteudo: { carga: 90 } }]]) {
      const db = database(); db.tables.conhecimento_modulo = policies
      db.tables.mentor_conhecimento = [{ ativo: true, carga: 100 }]
      const before = structuredClone(db.tables)
      const result = await prepareMentorWeek({ supabase: db, inicio: start, today: start, instanteReferencia: instant })
      expect(result.status).toBe(503)
      expect(result.body.avaliacao_mentor_v2.decisoes).toEqual([])
      expect(result.body.criadas).toBe(0)
      expect(db.writes).toEqual([])
      expect(db.tables).toEqual(before)
      expect(db.reads).not.toContain('mentor_conhecimento')
    }
  })
  it('grava decisão antes das demandas e retorna as criações confirmadas', async () => {
    const db = database(), result = await prepareMentorWeek({ supabase: db, inicio: start, today: start, instanteReferencia: instant })
    expect(result.status).toBe(200)
    expect(result.body).toMatchObject({ criadas: 21, planejamento_estado: 'gerado', planejamento_pendente: false })
    expect(db.writes.map((row) => row.table)).toEqual(['mentor_decisao', 'sessao'])
    expect(result.body.demandas.every((row) => row.decisao_id && row.avaliacao_ref)).toBe(true)
  })
  it('recalcular mantém concluídas, canceladas, reordenadas e movidas para outra semana', async () => {
    const db = database(); await prepareMentorWeek({ supabase: db, inicio: start, today: start, instanteReferencia: instant })
    db.tables.sessao[0].status = 'feita'; db.tables.sessao[0].concluida_em = instant
    db.tables.sessao[1].status = 'cancelada'; db.tables.sessao[1].cancelamento_origem = 'usuario'
    db.tables.sessao[2].data = '2030-03-11'; db.tables.sessao[2].movida_em = instant
    db.tables.sessao[3].ordem = 25; db.tables.sessao[3].ordenada_em = instant
    const before = structuredClone(db.tables.sessao)
    const result = await prepareMentorWeek({ supabase: db, inicio: start, today: start, instanteReferencia: '2030-03-04T16:00:00Z' })
    expect(result.body.criadas).toBe(0); expect(db.tables.sessao).toEqual(before)
  })
  it('retry da aplicação não duplica, nem sobrescreve sessão modificada depois da decisão', async () => {
    const db = database(), evaluation = run()
    expect((await applyMentorWeekV2({ supabase: db, evaluation })).criadas).toBe(21)
    db.tables.sessao[0].data = '2030-03-11'; db.tables.sessao[0].status = 'cancelada'
    expect((await applyMentorWeekV2({ supabase: db, evaluation })).criadas).toBe(0)
    expect(db.tables.sessao).toHaveLength(21)
    expect(db.tables.sessao[0].data).toBe('2030-03-11')
  })
  it('mover não reescreve a decisão original registrada', async () => {
    const db = database(); await prepareMentorWeek({ supabase: db, inicio: start, today: start, instanteReferencia: instant })
    const decision = structuredClone(db.tables.mentor_decisao[0])
    db.tables.sessao[0].data = '2030-03-05'; db.tables.sessao[0].movida_em = instant
    expect(db.tables.mentor_decisao[0]).toEqual(decision)
    expect(db.tables.sessao[0].data_planejada_original).toBe(start)
    expect(db.tables.sessao[0].chave_mentor.split(':decision:')[1]).toBe(creations(decision.dados.avaliacao)[0].decisao_id)
  })
  it('falha na gravação não informa sucesso; decisão preservada permite repetir a aplicação', async () => {
    const db = database(); db.fail = 'sessao'
    await expect(prepareMentorWeek({ supabase: db, inicio: start, today: start, instanteReferencia: instant })).rejects.toThrow('synthetic write failure')
    expect(db.tables.sessao).toHaveLength(0); expect(db.tables.mentor_decisao).toHaveLength(1)
    db.fail = null
    expect((await prepareMentorWeek({ supabase: db, inicio: start, today: start, instanteReferencia: instant })).body.criadas).toBe(21)
  })
  it('IDs independem do material selecionado ou do instante de recálculo', () => {
    expect(mentorDemandId(`v2:${start}:0`)).toBe(mentorDemandId(`v2:${start}:0`))
    expect(mentorDemandId(`v2:${start}:0`)).not.toBe(mentorDemandId('v2:2030-03-11:0'))
  })
  it('proposta de outro instante mantém identidade e decisão original da primeira criação', async () => {
    const db = database(), first = run(), nextInput = fixture()
    nextInput.referenceInstant = '2030-03-04T16:00:00Z'; nextInput.evaluationId = 'other-evaluation'
    const next = run(nextInput)
    await applyMentorWeekV2({ supabase: db, evaluation: first })
    const before = structuredClone(db.tables.sessao)
    expect((await applyMentorWeekV2({ supabase: db, evaluation: next })).criadas).toBe(0)
    expect(db.tables.sessao).toEqual(before)
    expect(db.tables.sessao[0].chave_mentor).toContain(creations(first)[0].decisao_id)
  })
  it('capacidade ausente não retorna sucesso falso de geração nem grava demandas', async () => {
    const input = fixture(); delete input.policyRecord.conteudo.politica.capacidade_semanal
    const db = database(input)
    const result = await prepareMentorWeek({ supabase: db, inicio: start, today: start, instanteReferencia: instant })
    expect(result).toMatchObject({ status: 503, body: { criadas: 0, planejamento_pendente: true, planejamento_estado: 'planejamento_parcial' } })
    expect(db.tables.sessao).toEqual([])
  })
  it('fechamento mantém histórico de faltas e gera outra semana sem dívida nem transporte de sessões', async () => {
    const db = database()
    await prepareMentorWeek({ supabase: db, inicio: start, today: start, instanteReferencia: instant })
    const originalIds = db.tables.sessao.map((row) => row.id)
    db.tables.sessao[0].status = 'feita'; db.tables.sessao[0].concluida_em = instant
    db.tables.sessao[1].status = 'cancelada'; db.tables.sessao[1].cancelamento_origem = 'usuario'
    const result = await prepareMentorWeek({ supabase: db, inicio: '2030-03-11', today: '2030-03-11', instanteReferencia: '2030-03-11T15:00:00Z' })
    expect(result.body).toMatchObject({ criadas: 21, encerradas: 19 })
    const newWeek = db.tables.sessao.filter((row) => row.data >= '2030-03-11')
    expect(newWeek).toHaveLength(21)
    expect(newWeek.every((row) => !originalIds.includes(row.id))).toBe(true)
    expect(db.tables.sessao[0].status).toBe('feita'); expect(db.tables.sessao[1].status).toBe('cancelada')
    expect(db.tables.sessao.slice(2, 21).every((row) => row.status === 'nao_concluida' && row.data <= '2030-03-10')).toBe(true)
  })
})
