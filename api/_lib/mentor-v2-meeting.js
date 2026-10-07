import { createHash } from 'node:crypto'

const dateValid = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(new Date(`${value}T12:00:00Z`).getTime())
  && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value
const text = (value, limit = 600) => String(value || '').trim().slice(0, limit)
const uuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value || '')
function invalid(message) { const error = new Error(message); error.statusCode = 400; throw error }
function eventId(row) {
  const hex = createHash('sha256').update(JSON.stringify(['encontro-v2', row.objetivo_id, row.materia_id, row.tipo, row.titulo, row.data])).digest('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

// Fact reconciliation only. No load, priority, method or policy is writable here.
export async function reconcileMeetingFacts({ supabase, body, week, nextWeek, today, now }) {
  const input = body.fatos || {}
  if (typeof input !== 'object' || Array.isArray(input)) invalid('Informe fatos estruturados do encontro.')
  const allowed = ['acontecimentos', 'dificuldade_nivel', 'dificuldade', 'impedimentos', 'excecoes', 'indisponivel_em', 'avaliacoes', 'disponibilidade', 'compromissos']
  if (Object.keys(input).some((key) => !allowed.includes(key))
    || Object.keys(body).some((key) => !['semanaInicio', 'fatos', 'observacoes', 'classificacoes', 'cargaPercebida'].includes(key))) invalid('O encontro aceita fatos, não comandos de carga, prioridade, método ou algoritmo.')
  const difficulty = String(input.dificuldade_nivel || '')
  if (difficulty && !['baixa', 'media', 'alta'].includes(difficulty)) invalid('Classifique a dificuldade como baixa, média ou alta.')
  const end = new Date(`${nextWeek}T12:00:00Z`); end.setUTCDate(end.getUTCDate() + 6)
  const lastDay = end.toISOString().slice(0, 10)
  if (input.indisponivel_em !== undefined && !Array.isArray(input.indisponivel_em)) invalid('Informe as datas indisponíveis em uma lista.')
  const days = [...new Set(input.indisponivel_em || [])]
  if (days.some((day) => !dateValid(day) || day < nextWeek || day > lastDay)) invalid('Informe indisponibilidade somente para datas válidas da próxima semana.')
  const changes = input.disponibilidade || []
  if (!Array.isArray(changes) || changes.some((row) => !row || Object.keys(row).some((key) => !['data', 'minutos'].includes(key))
    || !dateValid(row.data) || row.data < nextWeek || row.data > lastDay || !Number.isInteger(row.minutos) || row.minutos < 0 || row.minutos > 1440)
    || new Set(changes.map((row) => row.data)).size !== changes.length) invalid('Informe minutos disponíveis por data da próxima semana.')
  const dates = new Map(changes.map((row) => [row.data, row.minutos]))
  for (const day of days) {
    if (dates.has(day) && dates.get(day) !== 0) invalid('Uma data indisponível não pode também informar minutos disponíveis.')
    dates.set(day, 0)
  }
  const assessments = input.avaliacoes || []
  const references = input.compromissos || []
  if (!Array.isArray(assessments) || assessments.length > 10 || !Array.isArray(references) || references.length > 10) invalid('Informe até dez provas/entregas e dez referências de compromisso.')
  const pending = [], ids = new Set(), blocks = [], unblocks = []
  // Validate every input before the first mutation.
  for (const item of assessments) {
    if (!item || Object.keys(item).some((key) => !['id', 'tipo', 'data', 'materia_id', 'titulo', 'bloqueante'].includes(key))
      || !['prova', 'entrega'].includes(item.tipo) || !dateValid(item.data) || (item.data < today && !item.id) || !item.materia_id || !text(item.titulo, 160)
      || (item.id && !uuid(item.id)) || (item.bloqueante !== undefined && typeof item.bloqueante !== 'boolean')) invalid('Informe tipo, data válida, disciplina e título de cada prova ou entrega.')
    const subject = await supabase.from('materia').select('id,objetivo_id,objetivo:objetivo_id(tipo)').eq('id', item.materia_id).maybeSingle()
    if (subject.error) throw subject.error
    if (subject.data?.objetivo?.tipo !== 'faculdade') invalid('Selecione uma disciplina da Faculdade.')
    const row = { objetivo_id: subject.data.objetivo_id, materia_id: subject.data.id, tipo: item.tipo, data: item.data, titulo: text(item.titulo, 160) }
    let existing
    if (item.id) {
      const result = await supabase.from('compromisso').select('*').eq('id', item.id).maybeSingle()
      if (result.error) throw result.error
      existing = result.data
      if (!existing || existing.objetivo_id !== row.objetivo_id || existing.materia_id !== row.materia_id || existing.tipo !== row.tipo) invalid('Compromisso não identificado. Alteração de prazo exige o ID canônico correspondente.')
      if (row.data < today && row.data !== existing.data) invalid('Uma mudança de prazo não pode criar compromisso no passado.')
    } else {
      const result = await supabase.from('compromisso').select('*').eq('objetivo_id', row.objetivo_id).eq('materia_id', row.materia_id).eq('tipo', row.tipo).eq('titulo', row.titulo).eq('data', row.data)
      if (result.error) throw result.error
      if (result.data.length > 1) invalid('Há compromissos equivalentes. Referencie o ID canônico, sem criar outro.')
      existing = result.data[0]
    }
    row.id = existing?.id || eventId(row)
    if (ids.has(row.id)) invalid('Referencie cada avaliação uma única vez no encontro.')
    pending.push({ row, existing })
    ids.add(row.id)
    if (item.bloqueante === true) blocks.push(row.id)
    if (item.bloqueante === false) unblocks.push(row.id)
  }
  for (const item of references) {
    if (!item || !uuid(item.id) || Object.keys(item).some((key) => !['id', 'bloqueante'].includes(key))
      || (item.bloqueante !== undefined && typeof item.bloqueante !== 'boolean')) invalid('Referencie um compromisso existente pelo ID canônico.')
    const result = await supabase.from('compromisso').select('id').eq('id', item.id).maybeSingle()
    if (result.error) throw result.error
    if (!result.data) invalid('Compromisso não encontrado.')
    ids.add(item.id)
    if (item.bloqueante === true) blocks.push(item.id)
    if (item.bloqueante === false) unblocks.push(item.id)
  }
  if (blocks.some((id) => unblocks.includes(id))) invalid('O mesmo compromisso não pode ter bloqueios contraditórios.')
  const narrative = { acontecimentos: text(input.acontecimentos), impedimentos: text(input.impedimentos), excecoes: text(input.excecoes), observacoes: text(body.observacoes, 1200) }
  const contextNeeded = dates.size || blocks.length || unblocks.length || Object.values(narrative).some(Boolean)
  let context, updated
  if (contextNeeded) {
    const result = await supabase.from('mentor_contexto').select('id,dados,atualizado_em').eq('id', 1).maybeSingle()
    if (result.error) throw result.error
    context = result.data
    if (!context) invalid('Configure o contexto canônico antes de registrar alterações factuais.')
    updated = structuredClone(context.dados || {})
    if (dates.size || blocks.length || unblocks.length) {
      const original = updated.disponibilidade
      if (original && original.versao !== 'disponibilidade-v2/1') invalid('A disponibilidade vigente precisa usar disponibilidade-v2/1 antes da reconciliação.')
      const available = original || { versao: 'disponibilidade-v2/1', dias: [] }
      if (!Array.isArray(available.dias) || available.dias.some((row) => !row || !dateValid(row.data) || !Number.isInteger(row.minutos) || row.minutos < 0 || row.minutos > 1440)
        || new Set(available.dias.map((row) => row.data)).size !== available.dias.length
        || (available.compromissos_bloqueantes !== undefined && !Array.isArray(available.compromissos_bloqueantes))) invalid('Disponibilidade canônica inválida.')
      const map = new Map(available.dias.map((row) => [row.data, row.minutos]))
      dates.forEach((minutes, day) => map.set(day, minutes))
      updated.disponibilidade = { ...available, dias: [...map].sort(([a], [b]) => a.localeCompare(b)).map(([data, minutos]) => ({ data, minutos })),
        compromissos_bloqueantes: [...new Set([...(available.compromissos_bloqueantes || []), ...blocks])].filter((id) => !unblocks.includes(id)).sort() }
    }
    if (Object.values(narrative).some(Boolean)) updated.eventos_encontro = [...(updated.eventos_encontro || []).filter((row) => row.semana_inicio !== week),
      { semana_inicio: week, semana_alvo: nextWeek, ...narrative }]
  }
  for (const { row, existing } of pending) {
    if (existing) {
      if (existing.data === row.data && existing.titulo === row.titulo) continue
      const result = await supabase.from('compromisso').update({ data: row.data, titulo: row.titulo }).eq('id', row.id).eq('data', existing.data).eq('titulo', existing.titulo).select('id')
      if (result.error) throw result.error
      if (result.data.length !== 1) throw new Error('O compromisso mudou durante o registro. Recarregue antes de tentar novamente.')
    } else {
      const result = await supabase.from('compromisso').upsert(row, { onConflict: 'id', ignoreDuplicates: true })
      if (result.error) throw result.error
    }
  }
  if (context && JSON.stringify(updated) !== JSON.stringify(context.dados)) {
    const result = await supabase.from('mentor_contexto').update({ dados: updated, atualizado_em: now }).eq('id', 1).eq('atualizado_em', context.atualizado_em).select('id')
    if (result.error) throw result.error
    if (result.data.length !== 1) throw new Error('O contexto mudou durante o registro. Recarregue antes de tentar novamente.')
  }
  return { acontecimentos: narrative.acontecimentos, dificuldade_nivel: difficulty || null, dificuldade: text(input.dificuldade),
    impedimentos: narrative.impedimentos, excecoes: narrative.excecoes,
    compromissos: [...ids].sort().map((id) => ({ id })),
    avaliacoes_refs: pending.map(({ row }) => row.id),
    disponibilidade_ref: dates.size || blocks.length || unblocks.length ? { fonte: 'mentor_contexto', id: 1, datas: [...dates.keys()].sort() } : null }
}

// Resolve current canonical values for editing; the meeting is not another agenda.
export async function hydrateMeetingFacts(supabase, meeting) {
  if (!meeting) return null
  const facts = meeting.fatos || {}
  const result = { ...meeting, fatos: { ...facts, avaliacoes: [] } }
  if (!facts.compromissos) return result // old snapshots stay historical, not actionable V2 events
  for (const { id } of facts.compromissos) {
    const row = await supabase.from('compromisso').select('id,materia_id,tipo,titulo,data').eq('id', id).maybeSingle()
    if (row.error) throw row.error
    if (row.data?.materia_id && (facts.avaliacoes_refs || []).includes(id)) result.fatos.avaliacoes.push(row.data)
  }
  if (facts.disponibilidade_ref) {
    const context = await supabase.from('mentor_contexto').select('dados').eq('id', 1).maybeSingle()
    if (context.error) throw context.error
    result.fatos.indisponivel_em = (context.data?.dados?.disponibilidade?.dias || []).filter((row) => facts.disponibilidade_ref.datas.includes(row.data) && row.minutos === 0).map((row) => row.data)
    result.fatos.disponibilidade = (context.data?.dados?.disponibilidade?.dias || []).filter((row) => facts.disponibilidade_ref.datas.includes(row.data))
  }
  return result
}
