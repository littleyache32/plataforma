// Relational synthetic adapter, never a production connection or proof of SQL atomicity.
export function meetingDatabase() {
  const tables = { mentor_encontro_semanal: [], mentor_decisao: [], compromisso: [],
    mentor_contexto: [{ id: 1, atualizado_em: '2030-03-01T12:00:00Z', dados: { objetivo_principal_id: 'contest', rotina_pratica: {}, capacidade_inicial: { versao: 'capacidade-inicial-v2/1', revisao: 'meeting', slots: Array.from({ length: 7 }, (_, dia) => ({ dia, objetivo_id: 'faculty', atividade: 'ESTUDO', duracao_minutos: 50 })) }, disponibilidade: {
      versao: 'disponibilidade-v2/1', dias: Array.from({ length: 7 }, (_, i) => ({ data: `2030-03-${String(4 + i).padStart(2, '0')}`, minutos: 100 })) } } }],
    materia: [{ id: 'a', objetivo_id: 'faculty', objetivo: { tipo: 'faculdade' } }, { id: 'b', objetivo_id: 'faculty', objetivo: { tipo: 'faculdade' } }],
    objetivo: [{ id: 'contest', tipo: 'concurso' }, { id: 'faculty', tipo: 'faculdade' }], topico: [], sessao: [], tempo_estudo: [],
    material: ['a', 'b'].map((materia_id) => ({ id: `pdf-${materia_id}`, objetivo_id: 'faculty', materia_id, nome: materia_id, status: 'aceito', ordem_curso: 1, estado_extracao: 'texto' })),
    material_progresso: [], compromisso_topico: [], revisao_item: [], questao: [], registro: [], question_card: [],
    conhecimento_modulo: [{ id: 'policy', modulo: 'mentor', ativo: true, versao: 'synthetic', conteudo: { politica: {
      modelo: 'MENTOR_V2', versao_contrato: 'mentor-v2/1', modalidades_permitidas: ['ESTUDO'],
      regras: ['CONTINUIDADE_PLANO_EXISTENTE', 'PRIORIZACAO_CURRICULAR_SEMANAL', 'GERACAO_PLANO_SEMANAL'].map((id) => ({ id, habilitada: true })),
    } } }] }
  const db = { tables, writes: [], fail: null, conflictContext: false, from(table) {
    let payload, options, updating = false, single = false, page
    const filters = [], q = {}
    q.select = q.order = () => q
    q.eq = (key, value) => { filters.push((row) => row[key] === value); return q }
    q.is = (key, value) => { filters.push((row) => value === null ? row[key] == null : row[key] === value); return q }
    q.in = (key, values) => { filters.push((row) => values.includes(row[key])); return q }
    q.gte = (key, value) => { filters.push((row) => row[key] >= value); return q }
    q.lte = (key, value) => { filters.push((row) => row[key] <= value); return q }
    q.lt = (key, value) => { filters.push((row) => row[key] < value); return q }
    q.range = (from, to) => { page = [from, to]; return q }
    q.like = (key, pattern) => { filters.push((row) => row[key]?.startsWith(pattern.slice(0, -1))); return q }
    q.maybeSingle = q.single = () => { single = true; return q }
    q.update = (data) => { payload = data; updating = true; return q }
    q.upsert = (data, config) => { payload = data; options = config; return q }
    q.then = (resolve, reject) => Promise.resolve().then(() => {
      let rows = (tables[table] || []).filter((row) => filters.every((filter) => filter(row)))
      if (payload) {
        if (db.fail === table) return { data: null, error: new Error('synthetic write failure') }
        if (updating) {
          if (table === 'mentor_contexto' && db.conflictContext) rows = []
          rows.forEach((row) => Object.assign(row, structuredClone(payload)))
        } else {
          rows = []
          for (const row of Array.isArray(payload) ? payload : [payload]) {
            const old = tables[table].find((item) => item[options.onConflict] === row[options.onConflict])
            if (old && options.ignoreDuplicates) continue
            if (old) { Object.assign(old, structuredClone(row)); rows.push(old) }
            else { const inserted = { ...(table === 'compromisso' ? { concluido: false, peso: 3, duracao_minutos: 90 } : {}), ...structuredClone(row) }; tables[table].push(inserted); rows.push(inserted) }
          }
        }
        db.writes.push({ table, payload: structuredClone(payload) })
      }
      if (page) rows = rows.slice(page[0], page[1] + 1)
      return { data: structuredClone(single ? rows[0] || null : rows), error: null }
    }).then(resolve, reject)
    return q
  } }
  return db
}
