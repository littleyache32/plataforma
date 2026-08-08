import { PDFParse } from 'pdf-parse'
import { randomUUID } from 'node:crypto'
import { getSupabaseAdmin } from '../_lib/supabase.js'
import { generateJson } from '../_lib/gemini.js'
import { allowMethods, enforceRateLimit, fail, requireAccess } from '../_lib/http.js'

const materialSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['status', 'motivo', 'trechos'],
  properties: {
    status: { type: 'string', enum: ['aceito', 'recusado'] },
    motivo: { type: 'string' },
    trechos: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['texto', 'topico_nome'],
        properties: {
          texto: { type: 'string' },
          topico_nome: { anyOf: [{ type: 'string' }, { type: 'null' }] },
        },
      },
    },
  },
}

const PDF_LIMIT = 20 * 1024 * 1024

async function extractContent({ tipo, conteudo, arquivoBase64, storagePath }, supabase) {
  if (tipo === 'texto') return String(conteudo || '').trim()
  if (tipo !== 'pdf' || (!arquivoBase64 && !storagePath)) throw new Error('PDF obrigatorio.')
  let buffer
  if (storagePath) {
    if (!/^uploads\/[a-f0-9-]+\.pdf$/.test(String(storagePath))) throw new Error('Caminho do PDF invalido.')
    const { data, error } = await supabase.storage.from('materiais').download(storagePath)
    if (error) throw error
    buffer = Buffer.from(await data.arrayBuffer())
  } else buffer = Buffer.from(arquivoBase64, 'base64')
  if (buffer.length > PDF_LIMIT) throw new Error('PDF maior que 20 MB.')
  const parser = new PDFParse({ data: buffer })
  try {
    const result = await parser.getText()
    return String(result.text || '').trim()
  } finally {
    await parser.destroy()
    if (storagePath) await supabase.storage.from('materiais').remove([storagePath])
  }
}

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['GET', 'POST', 'PATCH']) || !requireAccess(req, res)) return
  const supabase = getSupabaseAdmin()

  try {
    if (req.method === 'POST' && req.body?.acao === 'preparar_pdf') {
      const size = Number(req.body?.tamanho || 0)
      if (!Number.isFinite(size) || size <= 0 || size > PDF_LIMIT) return res.status(400).json({ error: 'O PDF deve ter no maximo 20 MB.' })
      const path = `uploads/${randomUUID()}.pdf`
      const { data, error } = await supabase.storage.from('materiais').createSignedUploadUrl(path)
      if (error) throw error
      const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY
      if (!publishableKey) throw new Error('Chave publica do Supabase nao configurada.')
      return res.status(200).json({ path, token: data.token, supabaseUrl: process.env.SUPABASE_URL, publishableKey })
    }
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('material')
        .select('id,tipo,nome,status,motivo,forcado,criado_em,objetivo:objetivo_id(nome),materia:materia_id(nome)')
        .order('criado_em', { ascending: false })
        .limit(50)
      if (error) throw error
      return res.status(200).json({ materiais: data })
    }

    if (req.method === 'PATCH') {
      const id = String(req.body?.id || '')
      if (!id) return res.status(400).json({ error: 'Material obrigatorio.' })
      const { data: material, error } = await supabase
        .from('material')
        .update({ status: 'aceito', forcado: true, motivo: 'Entrada forcada pelo admin.' })
        .eq('id', id)
        .select('id,materia_id,conteudo')
        .single()
      if (error) throw error
      const { error: knowledgeError } = await supabase.from('conhecimento').insert({
        materia_id: material.materia_id,
        trecho: material.conteudo.slice(0, 12000),
        origem: `material-forcado:${material.id}`,
        material_id: material.id,
      })
      if (knowledgeError && knowledgeError.code !== '23505') throw knowledgeError
      return res.status(200).json({ ok: true })
    }

    const { materiaId, objetivoId, tipo, nome } = req.body || {}
    if (!materiaId || !objetivoId || !['texto', 'pdf'].includes(tipo)) return res.status(400).json({ error: 'Objetivo, materia e tipo validos sao obrigatorios.' })
    const content = await extractContent(req.body || {}, supabase)
    if (content.length < 120) return res.status(400).json({ error: 'Material curto demais para avaliacao.' })
    if (content.length > 120000) return res.status(413).json({ error: 'Material excede 120 mil caracteres.' })

    await enforceRateLimit(supabase, 'material', 10, 60)
    const [{ data: subject, error: subjectError }, { data: topics, error: topicsError }, { data: existing, error: existingError }] = await Promise.all([
      supabase.from('materia').select('id,nome,objetivo:objetivo_id(id,nome,tipo,banca)').eq('id', materiaId).eq('objetivo_id', objetivoId).single(),
      supabase.from('topico').select('id,nome').eq('materia_id', materiaId),
      supabase.from('conhecimento').select('trecho').eq('materia_id', materiaId).limit(20),
    ])
    if (subjectError || topicsError || existingError) throw subjectError || topicsError || existingError

    const evaluation = await generateJson({
      schema: materialSchema,
      prompt: `Avalie um material para o banco de conhecimento de uma plataforma pessoal de estudos.
Objetivo: ${subject.objetivo.nome} (${subject.objetivo.tipo})
Contexto ou banca: ${subject.objetivo.banca || 'nao definido'}
Materia: ${subject.nome}
Topicos existentes: ${(topics || []).map((topic) => topic.nome).join('; ')}

Recuse se for raso, sem conteudo verificavel, fora da materia ou majoritariamente repetido. Se parte for fraca, aceite apenas trechos novos, especificos e uteis. Trechos aceitos devem ser autocontidos e fieis ao texto. Explique a decisao de forma objetiva.

Amostras ja presentes para detectar repeticao:
${(existing || []).map((item) => item.trecho.slice(0, 800)).join('\n---\n') || 'Banco ainda sem material anexado.'}

Material recebido:
${content}`,
    })

    if (evaluation.status === 'aceito' && !evaluation.trechos?.length) {
      evaluation.status = 'recusado'
      evaluation.motivo = 'Nenhum trecho novo e util foi identificado.'
    }

    const { data: saved, error: saveError } = await supabase.from('material').insert({
      objetivo_id: objetivoId,
      materia_id: materiaId,
      tipo,
      nome: String(nome || '').slice(0, 180) || null,
      conteudo: content,
      status: evaluation.status,
      motivo: evaluation.motivo,
      forcado: false,
    }).select('id').single()
    if (saveError) throw saveError

    if (evaluation.status === 'aceito') {
      const knowledge = evaluation.trechos.map((excerpt) => {
        const normalized = String(excerpt.topico_nome || '').toLocaleLowerCase('pt-BR')
        const topic = topics.find((item) => item.nome.toLocaleLowerCase('pt-BR') === normalized)
        return {
          materia_id: materiaId,
          topico_id: topic?.id || null,
          trecho: String(excerpt.texto).trim(),
          origem: `material:${saved.id}`,
          material_id: saved.id,
        }
      }).filter((item) => item.trecho)
      const { error: knowledgeError } = await supabase.from('conhecimento').insert(knowledge)
      if (knowledgeError) throw knowledgeError
    }

    return res.status(201).json({ id: saved.id, status: evaluation.status, motivo: evaluation.motivo, trechos_aceitos: evaluation.status === 'aceito' ? evaluation.trechos.length : 0 })
  } catch (error) {
    return fail(res, error, 'Nao foi possivel avaliar o material.')
  }
}
