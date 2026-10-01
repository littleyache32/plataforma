import { MENTOR_SPECIALIST_MODULES } from '../../shared/mentor-specialists.js'

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

export async function loadMentorSpecialists(supabase) {
  const cached = cache.get('mentor_specialists')
  if (cached && cached.expiresAt > Date.now()) return cached.value
  const { data, error } = await supabase.from('conhecimento_modulo')
    .select('modulo,versao,conteudo').in('modulo', MENTOR_SPECIALIST_MODULES).eq('ativo', true)
  if (error) throw error
  const byModule = new Map((data || []).map((item) => [item.modulo, item]))
  const missing = MENTOR_SPECIALIST_MODULES.filter((modulo) => !byModule.has(modulo))
  if (missing.length) throw new Error(`Conhecimento dos especialistas ausente: ${missing.join(', ')}.`)
  const value = MENTOR_SPECIALIST_MODULES.map((modulo) => byModule.get(modulo))
  cache.set('mentor_specialists', { value, expiresAt: Date.now() + CACHE_TTL })
  return value
}
