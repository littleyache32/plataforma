// The factual completed time records are the source. Never increment a cache.
export async function reconcileSessionDuration(supabase, sessionId) {
  if (!sessionId) return
  const result = await supabase.from('tempo_estudo').select('segundos_acumulados').eq('sessao_id', sessionId).eq('status', 'concluido')
  if (result.error) throw result.error
  const minutes = Math.round((result.data || []).reduce((total, row) => total + Number(row.segundos_acumulados || 0), 0) / 60)
  const saved = await supabase.from('sessao').update({ duracao_realizada: minutes }).eq('id', sessionId)
  if (saved.error) throw saved.error
}
