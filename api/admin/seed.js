import { getSupabaseAdmin } from '../_lib/supabase.js'
import { generateGroundedJson } from '../_lib/gemini.js'
import { generationPrompt, normalizeQuestion, questionBatchSchema } from '../_lib/questions.js'
import { allowMethods, fail, requireAccess } from '../_lib/http.js'

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['POST']) || !requireAccess(req, res)) return
  const supabase = getSupabaseAdmin()
  let jobId

  try {
    const topicoId = String(req.body?.topicoId || '')
    const quantidade = Math.min(20, Math.max(1, Number(req.body?.quantidade || 20)))
    if (!topicoId || !Number.isInteger(quantidade)) return res.status(400).json({ error: 'Topico e quantidade inteira sao obrigatorios.' })

    const [{ data: topic, error: topicError }, { count, error: countError }] = await Promise.all([
      supabase.from('topico').select('id,nome,materia:materia_id(id,nome)').eq('id', topicoId).single(),
      supabase.from('questao').select('id', { count: 'exact', head: true }).eq('topico_id', topicoId).eq('usada', false).eq('marcada_errada', false),
    ])
    if (topicError) throw topicError
    if (countError) throw countError

    if ((count || 0) >= quantidade) {
      return res.status(200).json({ geradas: 0, disponiveis: count, cache: true, mensagem: 'O banco ja possui questoes suficientes neste topico.' })
    }

    const faltam = Math.min(20, quantidade - (count || 0))
    const { data: job, error: jobError } = await supabase
      .from('seeding_job')
      .insert({ topico_id: topicoId, quantidade: faltam, status: 'processando' })
      .select('id')
      .single()
    if (jobError) throw jobError
    jobId = job.id

    const { data: knowledge, error: knowledgeError } = await supabase
      .from('conhecimento')
      .select('trecho,origem')
      .or(`topico_id.eq.${topicoId},and(topico_id.is.null,materia_id.eq.${topic.materia.id})`)
      .limit(12)
    if (knowledgeError) throw knowledgeError

    const result = await generateGroundedJson({
      prompt: generationPrompt({
        materia: topic.materia.nome,
        topico: topic.nome,
        quantidade: faltam,
        conhecimento: (knowledge || []).map((item) => `[${item.origem}] ${item.trecho}`).join('\n\n'),
      }),
      schema: questionBatchSchema,
    })

    if (!result.sources.length) throw new Error('O Gemini nao devolveu fontes de grounding; lote rejeitado.')
    const hasMaterial = (knowledge || []).length > 0
    const normalized = (result.data.questoes || []).map((question) => normalizeQuestion(question, {
      topicoId,
      origem: hasMaterial ? 'material' : 'ia',
      sources: result.sources,
    }))
    if (normalized.length !== faltam) throw new Error(`O Gemini devolveu ${normalized.length} de ${faltam} questoes.`)
    if (faltam >= 2 && !['CE', 'ME'].every((type) => normalized.some((question) => question.tipo === type))) {
      throw new Error('O lote nao contem os dois formatos Cebraspe obrigatorios.')
    }

    let inserted = 0
    for (const question of normalized) {
      const { error } = await supabase.from('questao').insert(question)
      if (!error) inserted += 1
      else if (error.code !== '23505') throw error
    }

    await supabase.from('seeding_job').update({
      status: 'concluido',
      geradas: inserted,
      mensagem: `${result.sources.length} fontes consultadas`,
      concluido_em: new Date().toISOString(),
    }).eq('id', jobId)

    return res.status(201).json({ geradas: inserted, fontes: result.sources.length, cache: false })
  } catch (error) {
    if (jobId) {
      await supabase.from('seeding_job').update({
        status: 'erro',
        mensagem: String(error?.message || error).slice(0, 500),
        concluido_em: new Date().toISOString(),
      }).eq('id', jobId)
    }
    return fail(res, error, 'Falha ao gerar o lote. Nenhuma questao sem fonte foi aceita.')
  }
}

