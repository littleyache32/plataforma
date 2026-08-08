import { GoogleGenAI } from '@google/genai'

let client

function getGemini() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY nao configurada no servidor.')
  }
  if (!client) client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  return client
}

export function parseJson(text) {
  const cleaned = String(text || '').trim().replace(/^```json\s*/i, '').replace(/\s*```$/, '')
  try {
    return JSON.parse(cleaned)
  } catch (initialError) {
    // Alguns provedores acrescentam uma frase antes ou depois do JSON mesmo com
    // responseMimeType. Aceitamos somente o primeiro objeto completo, sem tentar
    // corrigir campos, e registramos falha se ele ainda nao for JSON valido.
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1))
      } catch {
        // A excecao abaixo preserva uma mensagem clara para o seeding_job.
      }
    }
    throw new Error(`Resposta JSON invalida do Gemini: ${initialError.message}`)
  }
}

function groundingSources(response) {
  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || []
  return chunks
    .map((chunk) => chunk.web)
    .filter((web) => web?.uri)
    .map((web) => ({ titulo: web.title || 'Fonte consultada', url: web.uri }))
    .filter((source, index, all) => all.findIndex((item) => item.url === source.url) === index)
}

function groundingEvidence(response) {
  const metadata = response.candidates?.[0]?.groundingMetadata
  const chunks = metadata?.groundingChunks || []
  const supports = metadata?.groundingSupports || []
  const evidence = []

  for (const support of supports) {
    const text = String(support.segment?.text || '').trim()
    if (!text) continue
    for (const chunkIndex of support.groundingChunkIndices || []) {
      const web = chunks[chunkIndex]?.web
      if (!web?.uri) continue
      evidence.push({ texto: text, titulo: web.title || 'Fonte consultada', url: web.uri })
    }
  }

  return evidence.filter((item, index, all) => all.findIndex((other) => other.texto === item.texto && other.url === item.url) === index)
}

export async function researchWithGrounding(prompt, { model = process.env.GEMINI_RESEARCH_MODEL || 'gemini-3-flash-preview' } = {}) {
  const ai = getGemini()
  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: { tools: [{ googleSearch: {} }] },
  })
  return { texto: response.text || '', fontes: groundingSources(response), evidencias: groundingEvidence(response) }
}

export async function generateGroundedJson({ prompt, schema }) {
  const ai = getGemini()
  const model = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite'
  const baseConfig = {
    tools: [{ googleSearch: {} }],
  }

  let response
  try {
    response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        ...baseConfig,
        responseMimeType: 'application/json',
        responseJsonSchema: schema,
      },
    })
  } catch (error) {
    // Alguns modelos rejeitam schema e busca na mesma chamada. Mantemos a busca
    // e exigimos JSON no prompt como fallback, sem abrir mao do grounding.
    if (!String(error?.message).match(/schema|tool|mime|400/i)) throw error
    response = await ai.models.generateContent({
      model,
      contents: `${prompt}\nResponda somente com JSON valido, sem markdown.`,
      config: baseConfig,
    })
  }

  return {
    data: parseJson(response.text || ''),
    sources: groundingSources(response),
  }
}

export async function generateJson({ prompt, schema, model = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite' }) {
  const ai = getGemini()
  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseJsonSchema: schema,
    },
  })
  return parseJson(response.text || '')
}
