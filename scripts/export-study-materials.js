import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
if (!process.env.SUPABASE_URL || !key) throw new Error('Supabase não configurado.')
const supabase = createClient(process.env.SUPABASE_URL, key, { auth: { persistSession: false } })

const rows = []
for (let from = 0; ; from += 1000) {
  const { data, error } = await supabase
    .from('conhecimento')
    .select('id,trecho,origem,material:material_id(nome,conteudo),topico:topico_id(id,nome,materia:materia_id(id,nome,objetivo:objetivo_id(nome,tipo)))')
    .like('origem', 'acervo-completo:%')
    .range(from, from + 999)
  if (error) throw error
  rows.push(...data)
  if (data.length < 1000) break
}

const chapters = rows.flatMap((item) => {
  const subject = item.topico?.materia
  if (!subject?.objetivo || !item.topico?.nome) return []
  return [{
    contexto: subject.objetivo.tipo,
    objetivo: subject.objetivo.nome,
    materia: subject.nome,
    topico: item.topico.nome,
    conteudo: String(item.material?.conteudo || item.trecho || '').trim(),
  }]
}).sort((a, b) => a.contexto.localeCompare(b.contexto, 'pt-BR') || a.materia.localeCompare(b.materia, 'pt-BR') || a.topico.localeCompare(b.topico, 'pt-BR'))

const outputDir = path.resolve('tmp', 'pdfs')
await mkdir(outputDir, { recursive: true })
await writeFile(path.join(outputDir, 'study_materials.json'), `${JSON.stringify(chapters, null, 2)}\n`, 'utf8')
process.stdout.write(`${JSON.stringify({ capitulos: chapters.length, materias: new Set(chapters.map((item) => `${item.contexto}|${item.materia}`)).size, arquivo: path.join(outputDir, 'study_materials.json') })}\n`)
