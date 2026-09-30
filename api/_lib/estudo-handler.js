import { getSupabaseAdmin } from './supabase.js'
import { allowMethods, fail, queryParam, requireAccess } from './http.js'

export default async function studyHandler(req, res) {
  if (!allowMethods(req, res, ['GET', 'PATCH']) || !requireAccess(req, res)) return
  try {
    const supabase = getSupabaseAdmin()
    const objetivoId = queryParam(req, 'objetivoId') || req.body?.objetivoId
    const materialId = queryParam(req, 'materialId') || req.body?.materialId
    if (!objetivoId) return res.status(400).json({ error: 'Objetivo obrigatorio.' })

    if (req.method === 'PATCH') {
      if (!materialId || typeof req.body?.concluido !== 'boolean') return res.status(400).json({ error: 'Material e estado de conclusão obrigatórios.' })
      const material = await supabase.from('material').select('id').eq('id', materialId).eq('objetivo_id', objetivoId).eq('status', 'aceito').maybeSingle()
      if (material.error) throw material.error
      if (!material.data) return res.status(404).json({ error: 'Material não encontrado.' })
      const result = req.body.concluido
        ? await supabase.from('material_progresso').upsert({ material_id: materialId }, { onConflict: 'material_id' })
        : await supabase.from('material_progresso').delete().eq('material_id', materialId)
      if (result.error) throw result.error
      return res.status(200).json({ material_id: materialId, concluido: req.body.concluido })
    }

    if (materialId && queryParam(req, 'progresso') === '1') {
      const { data, error } = await supabase.from('material_progresso').select('material_id').eq('material_id', materialId).maybeSingle()
      if (error) throw error
      return res.status(200).json({ material_id: materialId, concluido: Boolean(data) })
    }

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

