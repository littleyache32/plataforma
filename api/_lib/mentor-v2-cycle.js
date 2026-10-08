import { readOperationalCycle } from '../../shared/mentor-v2-cycle.js'
import { resolveMentorV2Policy } from '../../shared/mentor-v2-policy.js'

async function allRows(query) {
  const rows = []
  for (let offset = 0; ; offset += 500) {
    const result = await query().order('id').range(offset, offset + 499)
    if (result.error) throw result.error
    if (!Array.isArray(result.data)) throw new Error('Leitura do ciclo não confirmada.')
    rows.push(...result.data)
    if (result.data.length < 500) return rows
  }
}

// Called only by explicit plan preparation. No deletion, history rewrite, or
// automatic cycle activation. The canonical context must already define it.
export async function cancelPreviousCyclePlans({ supabase, inicio, today }) {
  const context = await supabase.from('mentor_contexto').select('id,dados').eq('id', 1).maybeSingle()
  if (context.error) throw context.error
  const cycle = readOperationalCycle(context.data?.dados?.ciclo_operacional)
  if (!cycle || inicio < cycle.inicio) return { canceladas: 0 }
  const policy = await supabase.from('conhecimento_modulo').select('id,modulo,ativo,versao,conteudo').eq('modulo', 'mentor').eq('ativo', true)
  if (policy.error) throw policy.error
  if (policy.data?.length !== 1 || !resolveMentorV2Policy(policy.data[0]).ok) return { canceladas: 0 }
  const rows = await allRows(() => supabase.from('sessao')
    .select('id,chave_mentor,tipo,status,origem,data,duracao_realizada,concluida_em')
    .eq('origem', 'mentor').eq('status', 'planejada').gte('data', today))
  const times = await allRows(() => supabase.from('tempo_estudo').select('id,sessao_id'))
  const executed = new Set(times.map((row) => row.sessao_id).filter(Boolean))
  const candidates = rows.filter((row) => ['estudo', 'exercicio', 'especial', 'revisao'].includes(row.tipo)
    && !row.chave_mentor?.includes(`:ciclo:${cycle.id}:`) && !executed.has(row.id)
    && !row.concluida_em && !(Number(row.duracao_realizada) > 0))
  let count = 0
  for (const row of candidates) {
    // Recheck execution immediately before each guarded status transition.
    const time = await supabase.from('tempo_estudo').select('id').eq('sessao_id', row.id)
    if (time.error) throw time.error
    if (time.data?.length) continue
    let query = supabase.from('sessao').update({ status: 'cancelada', cancelamento_origem: 'mentor' })
      .eq('id', row.id).eq('status', 'planejada')
    query = row.duracao_realizada == null ? query.is('duracao_realizada', null) : query.eq('duracao_realizada', row.duracao_realizada)
    query = row.concluida_em == null ? query.is('concluida_em', null) : query.eq('concluida_em', row.concluida_em)
    const changed = await query.select('id')
    if (changed.error) throw changed.error
    count += changed.data?.length || 0
  }
  return { canceladas: count }
}
