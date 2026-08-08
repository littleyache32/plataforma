import { getSupabaseAdmin } from './_lib/supabase.js'
import { allowMethods, fail, queryParam, requireAccess } from './_lib/http.js'

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['GET']) || !requireAccess(req, res)) return
  try {
    const supabase = getSupabaseAdmin()
    const objetivoId = queryParam(req, 'objetivoId')
    const materialId = queryParam(req, 'materialId')
    if (!objetivoId) return res.status(400).json({ error: 'Objetivo obrigatorio.' })

    if (materialId) {
      const { data, error } = await supabase.from('material').select('id,nome,conteudo,criado_em,materia:materia_id(id,nome)').eq('id', materialId).eq('objetivo_id', objetivoId).eq('status', 'aceito').single()
      if (error) throw error
      return res.status(200).json({ material: data })
    }

    const { data, error } = await supabase.from('material').select('id,nome,criado_em,materia:materia_id(id,nome)').eq('objetivo_id', objetivoId).eq('status', 'aceito').order('criado_em')
    if (error) throw error
    return res.status(200).json({ materiais: data || [] })
  } catch (error) {
    return fail(res, error, 'Nao foi possivel carregar as apostilas.')
  }
}

