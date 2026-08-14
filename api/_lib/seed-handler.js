import { getSupabaseAdmin } from './supabase.js'
import { generateJson } from './gemini.js'
import { disciplineGenerationPrompt, disciplineQuestionBatchSchema, normalizeQuestion } from './questions.js'
import { allowMethods, enforceRateLimit, fail, queryParam, requireAccess } from './http.js'
import { allocateDisciplineQuestions } from '../../shared/question-distribution.js'
import archiveHandler from './acervo-handler.js'
import rebuildHandler from './rebuild-handler.js'
import panelHandler from './painel-handler.js'

const difficultyPlan = (total) => {
  const faceis = Math.round(total * 0.6)
  const medias = Math.round(total * 0.3)
  return { faceis, medias, dificeis: total - faceis - medias }
}

const difficultyCounts = (questions) => ({
  faceis: questions.filter((item) => item.dificuldade <= 2).length,
  medias: questions.filter((item) => item.dificuldade === 3).length,
  dificeis: questions.filter((item) => item.dificuldade >= 4).length,
})

export default async function handler(req, res) {
  if (queryParam(req, 'recurso') === 'painel') return panelHandler(req, res)
  if (!allowMethods(req, res, ['POST']) || !requireAccess(req, res)) return
  if (queryParam(req, 'recurso') === 'acervo') return archiveHandler(req, res)
  if (queryParam(req, 'recurso') === 'reconstruir') return rebuildHandler(req, res)
  const supabase = getSupabaseAdmin()
  let jobId

  try {
    const materiaId = String(req.body?.materiaId || '')
    const quantidade = Math.min(20, Math.max(1, Number(req.body?.quantidade || 20)))
    if (!materiaId || !Number.isInteger(quantidade)) return res.status(400).json({ error: 'Disciplina e quantidade inteira sao obrigatorias.' })

    const [{ data: subject, error: subjectError }, { data: existing, error: existingError }] = await Promise.all([
      supabase.from('materia').select('id,nome,peso_prova,objetivo:objetivo_id(id,nome,tipo,banca),topicos:topico(id,nome,incidencia)').eq('id', materiaId).single(),
      supabase.from('questao').select('topico_id,topico!inner(materia_id)').eq('topico.materia_id', materiaId).eq('ativa', true).neq('estado', 'arquivada').eq('marcada_errada', false),
    ])
    if (subjectError) throw subjectError
    if (existingError) throw existingError
    if (!subject.topicos?.length) return res.status(422).json({ error: 'A disciplina nao possui topicos para receber questoes.' })

    const currentCounts = (existing || []).reduce((counts, item) => {
      counts[item.topico_id] = (counts[item.topico_id] || 0) + 1
      return counts
    }, {})
    const distribuicao = allocateDisciplineQuestions({ topics: subject.topicos, total: quantidade, currentCounts, subjectWeight: subject.peso_prova })
    const topicIds = new Set(distribuicao.map((item) => item.id))
    const { data: knowledge, error: knowledgeError } = await supabase
      .from('conhecimento')
      .select('trecho,origem,topico_id,material:material_id(nome)')
      .eq('materia_id', materiaId)
      .limit(100)
    if (knowledgeError) throw knowledgeError

    const evidencias = (knowledge || [])
      .filter((item) => !item.topico_id || topicIds.has(item.topico_id))
      .map((item, index) => ({
        id: index + 1,
        texto: item.trecho,
        titulo: item.material?.nome || item.origem || 'Material aprovado',
        url: '',
        topicoId: item.topico_id,
      }))
    if (!evidencias.length) {
      const error = new Error('Adicione e aceite material desta disciplina antes de gerar questoes.')
      error.statusCode = 422
      throw error
    }

    const missingEvidence = distribuicao.filter((allocation) => !evidencias.some((item) => !item.topicoId || item.topicoId === allocation.id))
    if (missingEvidence.length) return res.status(422).json({ error: `Falta conhecimento que sustente os topicos selecionados pelo mentor: ${missingEvidence.map((item) => item.nome).join(', ')}.` })

    await enforceRateLimit(supabase, 'seed', 4, 60)
    const { data: job, error: jobError } = await supabase
      .from('seeding_job')
      .insert({ materia_id: materiaId, topico_id: null, quantidade, status: 'processando' })
      .select('id')
      .single()
    if (jobError) throw jobError
    jobId = job.id

    const plannedDifficulty = difficultyPlan(quantidade)
    const result = await generateJson({
      prompt: disciplineGenerationPrompt({
        objetivo: subject.objetivo.nome,
        tipoObjetivo: subject.objetivo.tipo,
        banca: subject.objetivo.banca,
        materia: subject.nome,
        quantidade,
        distribuicao: distribuicao.map((item) => ({ topicoId: item.id, topico: item.nome, quantidade: item.quantidade })),
        dificuldades: plannedDifficulty,
        evidencias,
      }),
      schema: disciplineQuestionBatchSchema([...topicIds]),
    })
    const rejected = []
    const normalized = (result.questoes || []).flatMap((question, index) => {
      try {
        const evidence = evidencias.find((item) => item.id === Number(question.evidencia_id))
        if (evidence?.topicoId && evidence.topicoId !== question.topico_id) throw new Error('Evidencia pertence a outro topico.')
        return [normalizeQuestion(question, { topicoId: question.topico_id, origem: 'material', evidencias })]
      } catch (error) {
        rejected.push(`Questao ${index + 1}: ${String(error.message || error).slice(0, 160)}`)
        return []
      }
    })
    if (normalized.length !== quantidade || rejected.length) throw new Error(`O lote foi rejeitado por nao conter exatamente ${quantidade} questoes validas. ${rejected[0] || ''}`)
    if (!distribuicao.every((allocation) => normalized.filter((question) => question.topico_id === allocation.id).length === allocation.quantidade)) throw new Error('O lote nao respeitou a distribuicao de topicos decidida pelo mentor.')
    if (JSON.stringify(difficultyCounts(normalized)) !== JSON.stringify(plannedDifficulty)) throw new Error('O lote nao respeitou a distribuicao de dificuldade 60-30-10.')
    if (quantidade >= 2 && /cebraspe/i.test(subject.objetivo.banca || '') && !['CE', 'ME'].every((type) => normalized.some((question) => question.tipo === type))) throw new Error('O lote nao contem os dois formatos Cebraspe obrigatorios.')

    const { error: insertError } = await supabase.from('questao').insert(normalized)
    if (insertError) throw insertError

    await supabase.from('seeding_job').update({
      status: 'concluido',
      geradas: normalized.length,
      mensagem: `${evidencias.length} trechos de material e ${normalized.length} questoes aceitas em lote disciplinar.`.slice(0, 500),
      concluido_em: new Date().toISOString(),
    }).eq('id', jobId)

    return res.status(201).json({
      geradas: normalized.length,
      rejeitadas: 0,
      fontes: evidencias.length,
      distribuicao: distribuicao.map((item) => ({ topicoId: item.id, topico: item.nome, quantidade: item.quantidade })),
    })
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
