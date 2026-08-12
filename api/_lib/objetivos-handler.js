import { getSupabaseAdmin } from './supabase.js'
import { allowMethods, fail, queryParam, requireAccess } from './http.js'

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['GET', 'POST', 'PATCH']) || !requireAccess(req, res)) return
  const supabase = getSupabaseAdmin()
  try {
    if (queryParam(req, 'recurso') === 'compromissos') {
      if (req.method === 'GET') {
        const { data, error } = await supabase.from('compromisso').select('id,titulo,tipo,data,peso,duracao_minutos,conteudo_previsto,concluido,objetivo:objetivo_id(id,nome,tipo),materia:materia_id(id,nome)').order('data')
        if (error) throw error
        return res.status(200).json({ compromissos: data || [] })
      }
      if (req.method === 'PATCH') {
        const { id, concluido } = req.body || {}
        if (!id || typeof concluido !== 'boolean') return res.status(400).json({ error: 'Compromisso e estado sao obrigatorios.' })
        const { error } = await supabase.from('compromisso').update({ concluido }).eq('id', id)
        if (error) throw error
        return res.status(200).json({ ok: true })
      }
      const { objetivoId, materiaId, titulo, tipo, data, peso = 3, duracaoMinutos = 90, conteudoPrevisto = '' } = req.body || {}
      if (!objetivoId || !titulo || !['prova', 'entrega'].includes(tipo) || !/^\d{4}-\d{2}-\d{2}$/.test(String(data || ''))) return res.status(400).json({ error: 'Preencha objetivo, titulo, tipo e data.' })
      const duration = tipo === 'prova' ? Math.max(30, Number(duracaoMinutos) || 90) : Math.min(90, Math.max(30, Number(duracaoMinutos) || 60))
      const { data: item, error } = await supabase.from('compromisso').insert({ objetivo_id: objetivoId, materia_id: materiaId || null, titulo: String(titulo).trim(), tipo, data, peso: Math.min(5, Math.max(1, Number(peso) || 3)), duracao_minutos: duration, conteudo_previsto: String(conteudoPrevisto).trim().slice(0, 4000) || null }).select('id').single()
      if (error) throw error
      return res.status(201).json({ compromisso: item })
    }
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
