const CACHE_TTL = 5 * 60 * 1000
const cache = new Map()

export async function loadModuleKnowledge(supabase, modulo) {
  const cached = cache.get(modulo)
  if (cached && cached.expiresAt > Date.now()) return cached.value

  const { data, error } = await supabase.from('conhecimento_modulo')
    .select('modulo,versao,titulo,descricao,conteudo,evidencias')
    .eq('modulo', modulo)
    .eq('ativo', true)
    .order('criado_em', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  cache.set(modulo, { value: data, expiresAt: Date.now() + CACHE_TTL })
  return data
}
