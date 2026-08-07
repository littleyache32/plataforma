import { PDFParse } from 'pdf-parse'
import { getSupabaseAdmin } from '../_lib/supabase.js'
import { generateJson } from '../_lib/gemini.js'
import { allowMethods, fail, requireAccess } from '../_lib/http.js'

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

async function extractContent({ tipo, conteudo, arquivoBase64 }) {
  if (tipo === 'texto') return String(conteudo || '').trim()
  if (tipo !== 'pdf' || !arquivoBase64) throw new Error('PDF em base64 obrigatorio.')
  const buffer = Buffer.from(arquivoBase64, 'base64')
  if (buffer.length > 8 * 1024 * 1024) throw new Error('PDF maior que 8 MB.')
  const parser = new PDFParse({ data: buffer })
  try {
    const result = await parser.getText()
    return String(result.text || '').trim()
  } finally {
    await parser.destroy()
  }
}

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['GET', 'POST', 'PATCH']) || !requireAccess(req, res)) return
  const supabase = getSupabaseAdmin()

  try {
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('material')
        .select('id,tipo,nome,status,motivo,forcado,criado_em,materia:materia_id(nome)')
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

    const { materiaId, tipo, nome } = req.body || {}
    if (!materiaId || !['texto', 'pdf'].includes(tipo)) return res.status(400).json({ error: 'Materia e tipo validos sao obrigatorios.' })
    const content = await extractContent(req.body || {})
    if (content.length < 120) return res.status(400).json({ error: 'Material curto demais para avaliacao.' })
    if (content.length > 120000) return res.status(413).json({ error: 'Material excede 120 mil caracteres.' })

    const [{ data: subject, error: subjectError }, { data: topics, error: topicsError }, { data: existing, error: existingError }] = await Promise.all([
      supabase.from('materia').select('id,nome').eq('id', materiaId).single(),
      supabase.from('topico').select('id,nome').eq('materia_id', materiaId),
      supabase.from('conhecimento').select('trecho').eq('materia_id', materiaId).limit(20),
    ])
    if (subjectError || topicsError || existingError) throw subjectError || topicsError || existingError

    const evaluation = await generateJson({
      schema: materialSchema,
      prompt: `Avalie um material para o banco de conhecimento do concurso BACEN Tecnico, banca Cebraspe.
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
