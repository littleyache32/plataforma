import { getSupabaseAdmin } from './_lib/supabase.js'
import { allowMethods, fail, queryParam, requireAccess } from './_lib/http.js'

const classifications = ['certeza', 'duvida', 'eliminacao', 'sem_conhecimento']

function shuffle(items) { return [...items].sort(() => Math.random() - 0.5) }

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['GET', 'POST', 'PATCH']) || !requireAccess(req, res)) return
  const supabase = getSupabaseAdmin()
  try {
    if (req.method === 'GET') {
      const id = queryParam(req, 'id')
      if (!id) {
        const objetivoId = queryParam(req, 'objetivoId')
        let query = supabase.from('simulado').select('id,quantidade,duracao_minutos,status,iniciado_em,finalizado_em,criado_em,materia:materia_id(nome)').order('criado_em', { ascending: false })
        if (objetivoId) query = query.eq('objetivo_id', objetivoId)
        const { data, error } = await query.limit(30)
        if (error) throw error
        return res.status(200).json({ simulados: data })
      }
      const { data: simulation, error: simulationError } = await supabase.from('simulado').select('id,objetivo_id,materia_id,quantidade,duracao_minutos,status,iniciado_em,finalizado_em,materia:materia_id(nome)').eq('id', id).single()
      if (simulationError) throw simulationError
      const { data: items, error: itemsError } = await supabase.from('simulado_item').select('id,ordem,resposta,classificacao,eliminadas,tempo,pulada,questao:questao_id(id,tipo,enunciado,alternativas,gabarito,explicacao,fonte,trecho_fonte)').eq('simulado_id', id).order('ordem')
      if (itemsError) throw itemsError
      const completed = simulation.status === 'finalizado'
      return res.status(200).json({ simulado: simulation, itens: (items || []).map((item) => completed ? { ...item, resultado: item.resposta === item.questao.gabarito ? 'acerto' : 'erro' } : { ...item, questao: { ...item.questao, gabarito: undefined, explicacao: undefined, fonte: undefined, trecho_fonte: undefined } }) })
    }

    if (req.method === 'POST') {
      const { objetivoId, materiaId, quantidade = 10, duracaoMinutos = 30 } = req.body || {}
      if (!objetivoId) return res.status(400).json({ error: 'Objetivo obrigatorio.' })
      const amount = Math.min(50, Math.max(2, Number(quantidade) || 10))
      const { data: subjects, error: subjectsError } = await supabase.from('materia').select('id').eq('objetivo_id', objetivoId)
      if (subjectsError) throw subjectsError
      const validSubjects = (subjects || []).map((item) => item.id)
      const selectedSubjects = materiaId ? validSubjects.filter((id) => id === materiaId) : validSubjects
      if (!selectedSubjects.length) return res.status(400).json({ error: 'Materia nao pertence ao objetivo selecionado.' })
      const { data: topics, error: topicsError } = await supabase.from('topico').select('id').in('materia_id', selectedSubjects)
      if (topicsError) throw topicsError
      const { data: questions, error: questionsError } = await supabase.from('questao').select('id').in('topico_id', (topics || []).map((item) => item.id)).eq('marcada_errada', false).neq('estado', 'arquivada')
      if (questionsError) throw questionsError
      if ((questions || []).length < 2) return res.status(422).json({ error: 'Ainda nao ha questoes suficientes para este simulado.' })
      const selected = shuffle(questions).slice(0, amount)
      const { data: simulation, error: simulationError } = await supabase.from('simulado').insert({ objetivo_id: objetivoId, materia_id: materiaId || null, quantidade: selected.length, duracao_minutos: Math.max(5, Number(duracaoMinutos) || 30) }).select('id').single()
      if (simulationError) throw simulationError
      const { error: itemsError } = await supabase.from('simulado_item').insert(selected.map((question, index) => ({ simulado_id: simulation.id, questao_id: question.id, ordem: index + 1 })))
      if (itemsError) throw itemsError
      return res.status(201).json({ id: simulation.id })
    }

    const { simuladoId, itemId, resposta, classificacao, eliminadas, tempo, pular, finalizar } = req.body || {}
    if (!simuladoId) return res.status(400).json({ error: 'Simulado obrigatorio.' })
    if (finalizar) {
      const { error } = await supabase.from('simulado').update({ status: 'finalizado', finalizado_em: new Date().toISOString() }).eq('id', simuladoId)
      if (error) throw error
      return res.status(200).json({ ok: true })
    }
    if (!itemId || (!pular && (!resposta || !classifications.includes(classificacao)))) return res.status(400).json({ error: 'Resposta e classificacao validas sao obrigatorias.' })
    const { error } = await supabase.from('simulado_item').update({ resposta: pular ? null : String(resposta).toUpperCase(), classificacao: pular ? null : classificacao, eliminadas: Array.isArray(eliminadas) ? eliminadas : [], tempo: Math.max(0, Number(tempo) || 0), pulada: Boolean(pular) }).eq('id', itemId).eq('simulado_id', simuladoId)
    if (error) throw error
    return res.status(200).json({ ok: true })
  } catch (error) { return fail(res, error, 'Nao foi possivel processar o simulado.') }
}
