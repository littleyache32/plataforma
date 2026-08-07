import { getSupabaseAdmin } from './_lib/supabase.js'
import { allowMethods, fail, requireAccess } from './_lib/http.js'

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['GET', 'POST', 'PATCH']) || !requireAccess(req, res)) return
  const supabase = getSupabaseAdmin()
  try {
    if (req.method === 'GET') {
      const { data, error } = await supabase.from('objetivo').select('id,tipo,nome,banca,situacao,data_alvo,config,ativo').order('criado_em')
      if (error) throw error
      return res.status(200).json({ objetivos: data })
    }

    if (req.method === 'PATCH') {
      const { objetivoId, materiaNome, topicos = [] } = req.body || {}
      if (!objetivoId || String(materiaNome || '').trim().length < 2) return res.status(400).json({ error: 'Objetivo e disciplina validos sao obrigatorios.' })
      const { data: subject, error: subjectError } = await supabase.from('materia').insert({ objetivo_id: objetivoId, nome: String(materiaNome).trim() }).select('id,nome').single()
      if (subjectError) throw subjectError
      const cleanTopics = [...new Set(topicos.map((item) => String(item).trim()).filter((item) => item.length >= 2))]
      if (cleanTopics.length) {
        const { error: topicsError } = await supabase.from('topico').insert(cleanTopics.map((nome) => ({ materia_id: subject.id, nome })))
        if (topicsError) throw topicsError
      }
      return res.status(201).json({ materia: subject, topicos: cleanTopics.length })
    }

    const { tipo, nome, banca, dataAlvo } = req.body || {}
    if (!['faculdade', 'concurso'].includes(tipo) || String(nome || '').trim().length < 3) {
      return res.status(400).json({ error: 'Tipo e nome valido sao obrigatorios.' })
    }
    const { data, error } = await supabase.from('objetivo').insert({
      tipo,
      nome: String(nome).trim(),
      banca: tipo === 'concurso' ? String(banca || '').trim() || null : null,
      data_alvo: dataAlvo || null,
    }).select('id,tipo,nome,banca,situacao,data_alvo,config,ativo').single()
    if (error) throw error
    return res.status(201).json({ objetivo: data })
  } catch (error) {
    return fail(res, error, 'Nao foi possivel processar os objetivos.')
  }
}
