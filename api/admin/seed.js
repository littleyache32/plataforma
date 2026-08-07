import { getSupabaseAdmin } from '../_lib/supabase.js'
import { generateJson, researchWithGrounding } from '../_lib/gemini.js'
import { generationPrompt, normalizeQuestion, questionBatchSchema, researchPrompt } from '../_lib/questions.js'
import { allowMethods, enforceRateLimit, fail, requireAccess } from '../_lib/http.js'

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['POST']) || !requireAccess(req, res)) return
  const supabase = getSupabaseAdmin()
  let jobId

  try {
    const topicoId = String(req.body?.topicoId || '')
    const quantidade = Math.min(20, Math.max(1, Number(req.body?.quantidade || 20)))
    if (!topicoId || !Number.isInteger(quantidade)) return res.status(400).json({ error: 'Topico e quantidade inteira sao obrigatorios.' })

    const [{ data: topic, error: topicError }, { count, error: countError }] = await Promise.all([
      supabase.from('topico').select('id,nome,materia:materia_id(id,nome,objetivo:objetivo_id(id,nome,tipo,banca))').eq('id', topicoId).single(),
      supabase.from('questao').select('id', { count: 'exact', head: true }).eq('topico_id', topicoId).neq('estado', 'arquivada').eq('marcada_errada', false),
    ])
    if (topicError) throw topicError
    if (countError) throw countError

    if ((count || 0) >= quantidade) {
      return res.status(200).json({ geradas: 0, disponiveis: count, cache: true, mensagem: 'O banco ja possui questoes suficientes neste topico.' })
    }

    await enforceRateLimit(supabase, 'seed', 4, 60)

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

    const objective = topic.materia.objetivo
    const research = await researchWithGrounding(researchPrompt({
      objetivo: objective.nome,
      tipoObjetivo: objective.tipo,
      banca: objective.banca,
      materia: topic.materia.nome,
      topico: topic.nome,
    }))
    const webEvidence = research.evidencias.map((item, index) => ({ id: index + 1, texto: item.texto, titulo: item.titulo, url: item.url }))
    const materialEvidence = (knowledge || []).map((item, index) => ({
      id: webEvidence.length + index + 1,
      texto: item.trecho,
      titulo: item.origem,
      url: '',
    }))
    const evidencias = [...webEvidence, ...materialEvidence]
    if (!webEvidence.length) throw new Error('O grounding nao devolveu blocos de evidencia vinculados; lote rejeitado.')

    const result = await generateJson({
      prompt: generationPrompt({
        objetivo: objective.nome,
        tipoObjetivo: objective.tipo,
        banca: objective.banca,
        materia: topic.materia.nome,
        topico: topic.nome,
        quantidade: faltam,
        evidencias,
      }),
      schema: questionBatchSchema,
    })
    const hasMaterial = (knowledge || []).length > 0
    const rejeitadas = []
    const normalized = (result.questoes || []).flatMap((question, index) => {
      try {
        return [normalizeQuestion(question, {
          topicoId,
          origem: hasMaterial ? 'material' : 'ia',
          evidencias,
        })]
      } catch (error) {
        rejeitadas.push(`Questao ${index + 1}: ${String(error.message || error).slice(0, 160)}`)
        return []
      }
    })
    if (!normalized.length) throw new Error(`Nenhuma questao valida foi devolvida. ${rejeitadas[0] || ''}`)
    if (faltam >= 2 && /cebraspe/i.test(objective.banca || '') && !['CE', 'ME'].every((type) => normalized.some((question) => question.tipo === type))) {
      throw new Error('O lote nao contem os dois formatos Cebraspe obrigatorios.')
    }

    let inserted = 0
    for (const [index, question] of normalized.entries()) {
      const { error } = await supabase.from('questao').insert(question)
      if (!error) inserted += 1
      else if (error.code !== '23505') rejeitadas.push(`Questao valida ${index + 1} recusada pelo banco: ${String(error.message || error).slice(0, 160)}`)
    }

    if (!inserted && rejeitadas.length) throw new Error(`O banco recusou todas as questoes. ${rejeitadas[0]}`)

    await supabase.from('seeding_job').update({
      status: 'concluido',
      geradas: inserted,
      mensagem: `${research.fontes.length} fontes, ${webEvidence.length} evidencias, ${inserted} aceitas e ${rejeitadas.length} recusadas${rejeitadas.length ? `: ${rejeitadas.slice(0, 3).join(' | ')}` : ''}`.slice(0, 500),
      concluido_em: new Date().toISOString(),
    }).eq('id', jobId)

    return res.status(201).json({ geradas: inserted, rejeitadas: rejeitadas.length, fontes: research.fontes.length, evidencias: webEvidence.length, cache: false })
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
