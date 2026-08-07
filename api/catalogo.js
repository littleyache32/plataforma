import { getSupabaseAdmin } from './_lib/supabase.js'
import { allowMethods, fail, requireAccess } from './_lib/http.js'

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['GET']) || !requireAccess(req, res)) return
  try {
    const { data, error } = await getSupabaseAdmin()
      .from('materia')
      .select('id,nome,topicos:topico(id,nome)')
      .order('nome')
    if (error) throw error
    data.forEach((materia) => materia.topicos?.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')))
    return res.status(200).json({ materias: data })
  } catch (error) {
    return fail(res, error, 'Nao foi possivel carregar as materias.')
  }
}

