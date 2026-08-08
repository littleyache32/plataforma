import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const apply = process.argv.includes('--apply')
const sourceRoot = process.argv.slice(2).find((argument) => !argument.startsWith('--'))

if (!sourceRoot) throw new Error('Informe a pasta extraida Colecao_BACEN_e_Faculdade.')

const subjects = [
  {
    folder: '01_Fundamentos_de_Contabilidade',
    json: '01_BACEN_Fundamentos_de_Contabilidade_Questoes.json',
    theory: '01_BACEN_Fundamentos_de_Contabilidade_Teoria.md',
    sourceName: 'Apostila BACEN - Fundamentos de Contabilidade - versão curada',
    databaseName: 'Contabilidade',
    topic(moduleNumber) { return moduleNumber >= 8 && moduleNumber <= 10 ? 'Demonstrações contábeis' : 'Contabilidade geral' },
    curate(text) {
      return text
        .replace(
          /No método de custo, o investimento é mantido pelo valor de aquisição[\s\S]*?É o método aplicável a participações sem influência significativa\./,
          'Participações sem controle, controle conjunto ou influência significativa devem ser tratadas conforme as normas de instrumentos financeiros, em regra o CPC 48. O custo não é uma regra universal de mensuração atual para essas participações. Já investimentos em controladas, coligadas e empreendimentos controlados em conjunto observam as regras próprias de equivalência patrimonial nas demonstrações aplicáveis.',
        )
        .replace(
          'a Escrituração Contábil Digital (ECD), que transmite Diário e Razão em arquivo eletrônico.',
          'a Escrituração Contábil Digital (ECD), que abrange Livro Diário e auxiliares, Livro Razão e auxiliares, Balancetes Diários, Balanços e fichas de lançamento em arquivo eletrônico.',
        )
        .concat('\n\n## Fontes oficiais da curadoria\n\n- Comitê de Pronunciamentos Contábeis: CPC 18, CPC 27 e CPC 48 - https://www.cpc.org.br/CPC/Documentos-Emitidos/Pronunciamentos\n- Receita Federal, Escrituração Contábil Digital - https://www.gov.br/sped/pt-br/assuntos/escrituracoes-digitais/ecd\n')
    },
  },
  {
    folder: '02_Lingua_Portuguesa',
    json: '02_BACEN_Lingua_Portuguesa_Questoes.json',
    theory: '02_BACEN_Lingua_Portuguesa_Teoria.md',
    sourceName: 'Apostila BACEN - Língua Portuguesa - versão curada',
    databaseName: 'Português e Redação Oficial',
    topic(moduleNumber) {
      if (moduleNumber === 14) return 'Compreensão e interpretação de textos'
      if (moduleNumber === 15) return 'Redação oficial'
      return 'Gramática e emprego da língua portuguesa'
    },
    curate(text) {
      return text.concat('\n\n## Fontes oficiais da curadoria\n\n- Manual de Redação da Presidência da República - https://www.gov.br/pt-br/servicos/consultar-o-manual-de-redacao-da-presidencia-da-republica\n- Decreto nº 9.758/2019 - https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2019/decreto/d9758.htm\n')
    },
  },
  {
    folder: '03_Raciocinio_Logico_Quantitativo',
    json: '03_BACEN_Raciocinio_Logico_Quantitativo_Questoes.json',
    theory: '03_BACEN_Raciocinio_Logico_Quantitativo_Teoria.md',
    sourceName: 'Apostila BACEN - Raciocínio Lógico e Quantitativo - versão curada',
    databaseName: 'Raciocínio Lógico e Quantitativo',
    topic(moduleNumber) {
      if (moduleNumber === 11) return 'Estatística'
      if (moduleNumber === 12) return 'Matemática financeira'
      return 'Lógica proposicional e argumentação'
    },
    curate(text) { return text },
  },
]

const stopWords = new Set('a o as os de da do das dos e em no na nos nas um uma para por com sem que qual quais como se ao aos ou é são foi ser tem têm sua seu seus suas'.split(' '))
const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').replace(/[^a-z0-9%]+/g, ' ').replace(/\s+/g, ' ').trim()
const tokens = (value) => new Set(normalize(value).split(' ').filter((token) => token.length > 2 && !stopWords.has(token)))
const moduleNumber = (question) => Number(String(question.modulo).match(/Módulo\s+(\d+)/i)?.[1] || 0)
const manualEvidence = {
  '03_BACEN_Raciocinio_Logico_Quantitativo-023': '**n(A ou B) = n(A) + n(B) − n(A e B).**',
}

function sections(markdown) {
  const matches = [...markdown.matchAll(/^# Módulo\s+(\d+)\.[^\n]*$/gm)]
  return matches.map((match, index) => ({
    number: Number(match[1]),
    title: match[0].replace(/\s*\{#[^}]+\}\s*$/, '').replace(/^#\s*/, ''),
    text: markdown.slice(match.index, matches[index + 1]?.index || markdown.length).trim(),
  }))
}

function evidenceFor(question, section) {
  const expected = tokens(`${question.enunciado} ${question.explicacao} ${question.gabarito}`)
  const candidates = section.text.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length >= 45 && line.length <= 900 && !line.startsWith('#') && !line.startsWith('!!!') && !line.startsWith('<'))
  let best = null
  for (const line of candidates) {
    const actual = tokens(line)
    const overlap = [...expected].filter((token) => actual.has(token)).length
    const score = expected.size ? overlap / expected.size : 0
    if (!best || score > best.score) best = { line, score }
  }
  if (!best) throw new Error(`Sem evidência para ${question.id}`)
  return best
}

function wrongAnswer(answer) {
  if (answer === 'V') return 'F'
  const numbers = [...String(answer).matchAll(/\d+(?:[.,]\d+)?/g)]
  if (numbers.length) {
    const last = numbers.at(-1)
    const raw = last[0]
    const value = Number(raw.replaceAll('.', '').replace(',', '.'))
    const changed = Number.isInteger(value) ? value + Math.max(1, Math.round(Math.abs(value) * 0.1)) : value + 1
    const replacement = raw.includes(',') ? changed.toFixed(2).replace('.', ',') : changed.toLocaleString('pt-BR')
    return `${answer.slice(0, last.index)}${replacement}${answer.slice(last.index + raw.length)}`
  }
  return `não ${answer}`
}

function convertOpen(question, openIndex) {
  const correctClaim = openIndex % 2 === 0
  const claim = correctClaim ? question.gabarito : wrongAnswer(question.gabarito)
  return {
    ...question,
    tipo: 'CE',
    enunciado: `${question.enunciado} A partir dos dados apresentados, julgue o item: o resultado é ${claim}.`,
    alternativas: null,
    gabarito: correctClaim ? 'C' : 'E',
    explicacao: `${correctClaim ? 'O item está correto.' : 'O item está errado.'} ${question.explicacao}`,
  }
}

function rebalanceMultipleChoice(question, meIndex) {
  const letters = ['A', 'B', 'C', 'D', 'E']
  const desired = letters[meIndex % letters.length]
  if (question.gabarito === desired) return question
  const alternatives = { ...question.alternativas }
  const correctText = alternatives[question.gabarito]
  alternatives[question.gabarito] = alternatives[desired]
  alternatives[desired] = correctText
  return { ...question, alternativas: alternatives, gabarito: desired }
}

function difficulty(question) {
  const complex = /calcule|apure|determinante|probabilidade|lançamento|média|depreciação|equivalência|balanço|demonstração/i.test(question.enunciado)
  if (question.tipo === 'ME' && complex) return 4
  if (question.tipo === 'CE' && question.enunciado.length < 100) return 2
  return 3
}

function curateKnownIssue(question) {
  if (question.id === '02_BACEN_Lingua_Portuguesa-018') return { ...question, enunciado: 'Assinale a frase correta quanto ao emprego dos pronomes pessoais.' }
  if (question.id === '02_BACEN_Lingua_Portuguesa-033') return { ...question, enunciado: 'Assinale a frase correta quanto à concordância verbal e nominal.' }
  if (question.id === '03_BACEN_Raciocinio_Logico_Quantitativo-023') return { ...question, enunciado: 'Se n(A) = 20, n(B) = 30 e n(A ∩ B) = 8, então n(A ∪ B) é igual a:' }
  if (question.id !== '01_BACEN_Fundamentos_de_Contabilidade-063') return question
  return {
    ...question,
    tipo: 'CE',
    enunciado: 'Investimentos em controladas e coligadas com influência significativa podem ser tratados, em qualquer demonstração contábil e sem exceção, como simples instrumentos financeiros mensurados exclusivamente pelo custo.',
    alternativas: null,
    gabarito: 'E',
    explicacao: 'O item generaliza incorretamente. Controladas, coligadas e empreendimentos controlados em conjunto observam regras próprias, incluindo a equivalência patrimonial nas demonstrações aplicáveis; o custo não é regra universal.',
  }
}

function validate(questions, materials, knowledge) {
  const errors = []
  const unique = new Set()
  for (const question of questions) {
    const key = `${question.topicName}:${normalize(question.enunciado)}`
    if (unique.has(key)) errors.push(`Questão duplicada: ${question.id}`)
    unique.add(key)
    if (!['CE', 'ME'].includes(question.tipo)) errors.push(`Tipo inválido: ${question.id}`)
    if (question.tipo === 'CE' && (question.alternativas !== null || !['C', 'E'].includes(question.gabarito))) errors.push(`CE inválida: ${question.id}`)
    if (question.tipo === 'ME' && (Object.keys(question.alternativas || {}).join('') !== 'ABCDE' || !'ABCDE'.includes(question.gabarito))) errors.push(`ME inválida: ${question.id}`)
    if (!question.fonte || !question.trecho_fonte) errors.push(`Fonte ausente: ${question.id}`)
    if (!question.externalSource && !question.materialContent.includes(question.trecho_fonte)) errors.push(`Trecho não literal: ${question.id}`)
  }
  const ce = questions.filter((question) => question.tipo === 'CE').length
  if (ce <= questions.length / 2) errors.push('CE não é predominante.')
  if (materials.length !== 3 || knowledge.length < 40) errors.push('Materiais ou conhecimento incompletos.')
  if (errors.length) throw new Error(errors.join('\n'))
}

async function prepare() {
  const questions = []
  const materials = []
  const knowledge = []
  let openIndex = 0
  let meIndex = 0

  for (const subject of subjects) {
    const folder = path.join(sourceRoot, 'BACEN', subject.folder)
    const rawTheory = await readFile(path.join(folder, subject.theory), 'utf8')
    const materialContent = subject.curate(rawTheory)
    const materialSections = sections(materialContent)
    const sourceQuestions = JSON.parse(await readFile(path.join(folder, subject.json), 'utf8'))
    materials.push({ ...subject, content: materialContent })

    for (const section of materialSections) {
      knowledge.push({ subjectName: subject.databaseName, topicName: subject.topic(section.number), module: section.title, text: section.text, sourceName: subject.sourceName })
    }

    for (const sourceQuestion of sourceQuestions) {
      let question = curateKnownIssue(sourceQuestion)
      if (question.tipo === 'aberta') question = convertOpen(question, openIndex++)
      else if (question.tipo === 'CE') question = { ...question, gabarito: question.gabarito === 'Certo' ? 'C' : 'E' }
      if (question.tipo === 'ME') question = rebalanceMultipleChoice(question, meIndex++)
      const number = moduleNumber(question)
      const section = materialSections.find((item) => item.number === number)
      if (!section) throw new Error(`Módulo ${number} não encontrado para ${question.id}`)
      const evidence = manualEvidence[question.id] ? { line: manualEvidence[question.id], score: 1 } : evidenceFor(question, section)
      const isEcd = question.id === '01_BACEN_Fundamentos_de_Contabilidade-073'
      questions.push({
        ...question,
        materia: subject.databaseName,
        topicName: subject.topic(number),
        dificuldade: difficulty(question),
        fonte: isEcd ? 'Receita Federal - Escrituração Contábil Digital - https://www.gov.br/sped/pt-br/assuntos/escrituracoes-digitais/ecd' : `${subject.sourceName} - ${section.title}`,
        trecho_fonte: isEcd ? 'A Escrituração Contábil Digital - ECD consiste em módulo do Sistema Público de Escrituração Digital que permite a escrituração em formato eletrônico do Livro Diário, Livro Razão, Balancetes Diários, Balanços e fichas de lançamento.' : evidence.line,
        origem: 'material',
        evidenceScore: evidence.score,
        materialContent,
        externalSource: isEcd,
      })
    }
  }
  validate(questions, materials, knowledge)
  return { questions, materials, knowledge }
}

async function importData(dataset) {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
  if (!url || !key) throw new Error('Supabase não configurado.')
  const supabase = createClient(url, key, { auth: { persistSession: false } })
  const { data: catalog, error: catalogError } = await supabase.from('materia').select('id,nome,objetivo_id,topicos:topico(id,nome)')
  if (catalogError) throw catalogError
  const subjectsByName = new Map(catalog.map((item) => [item.nome, item]))
  const materialIds = new Map()

  for (const material of dataset.materials) {
    const subject = subjectsByName.get(material.databaseName)
    if (!subject) throw new Error(`Matéria não encontrada: ${material.databaseName}`)
    const { data: existing, error: existingError } = await supabase.from('material').select('id').eq('materia_id', subject.id).eq('nome', material.sourceName).maybeSingle()
    if (existingError) throw existingError
    if (existing) {
      const { error } = await supabase.from('material').update({ objetivo_id: subject.objetivo_id, conteudo: material.content, status: 'aceito', motivo: 'Conteúdo auditado e curado para importação.', forcado: false }).eq('id', existing.id)
      if (error) throw error
      materialIds.set(material.databaseName, existing.id)
    } else {
      const { data, error } = await supabase.from('material').insert({ objetivo_id: subject.objetivo_id, materia_id: subject.id, tipo: 'texto', nome: material.sourceName, conteudo: material.content, status: 'aceito', motivo: 'Conteúdo auditado e curado para importação.', forcado: false }).select('id').single()
      if (error) throw error
      materialIds.set(material.databaseName, data.id)
    }
  }

  for (const item of dataset.knowledge) {
    const subject = subjectsByName.get(item.subjectName)
    const topic = subject?.topicos.find((candidate) => candidate.nome === item.topicName)
    if (!topic) throw new Error(`Tópico não encontrado: ${item.subjectName} / ${item.topicName}`)
    const materialId = materialIds.get(item.subjectName)
    const { data: existing, error: findError } = await supabase.from('conhecimento').select('id').eq('material_id', materialId).eq('origem', item.module).maybeSingle()
    if (findError) throw findError
    const payload = { materia_id: subject.id, topico_id: topic.id, trecho: item.text, origem: item.module, material_id: materialId }
    const { error } = existing ? await supabase.from('conhecimento').update(payload).eq('id', existing.id) : await supabase.from('conhecimento').insert(payload)
    if (error) throw error
  }

  const questionGroups = Map.groupBy(dataset.questions, (question) => `${question.materia}\u0000${question.topicName}`)
  for (const [groupKey, questions] of questionGroups) {
    const [subjectName, topicName] = groupKey.split('\u0000')
    const subject = subjectsByName.get(subjectName)
    const topic = subject?.topicos.find((candidate) => candidate.nome === topicName)
    if (!topic) throw new Error(`Tópico não encontrado: ${subjectName} / ${topicName}`)
    const { data: existingItems, error: findError } = await supabase.from('questao').select('id,enunciado').eq('topico_id', topic.id)
    if (findError) throw findError
    const existingByText = new Map(existingItems.map((item) => [normalize(item.enunciado), item.id]))
    const pendingInserts = []
    for (const question of questions) {
      const payload = { topico_id: topic.id, tipo: question.tipo, enunciado: question.enunciado, alternativas: question.alternativas, gabarito: question.gabarito, explicacao: question.explicacao, fonte: question.fonte, trecho_fonte: question.trecho_fonte, origem: 'material', dificuldade: question.dificuldade }
      const existingId = existingByText.get(normalize(question.enunciado))
      if (existingId) {
        const { error } = await supabase.from('questao').update(payload).eq('id', existingId)
        if (error) throw error
      } else pendingInserts.push(payload)
    }
    for (let index = 0; index < pendingInserts.length; index += 100) {
      const { error } = await supabase.from('questao').insert(pendingInserts.slice(index, index + 100))
      if (error) throw error
    }
  }
}

const dataset = await prepare()
const typeCounts = Object.fromEntries(['CE', 'ME'].map((type) => [type, dataset.questions.filter((item) => item.tipo === type).length]))
const answerCounts = Object.fromEntries(['A', 'B', 'C', 'D', 'E'].map((answer) => [answer, dataset.questions.filter((item) => item.tipo === 'ME' && item.gabarito === answer).length]))
const difficultyCounts = Object.fromEntries([1, 2, 3, 4, 5].map((level) => [level, dataset.questions.filter((item) => item.dificuldade === level).length]))
const lowEvidence = dataset.questions.filter((item) => !item.externalSource && item.evidenceScore < 0.05).map((item) => ({ id: item.id, score: item.evidenceScore, trecho: item.trecho_fonte }))

console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', questions: dataset.questions.length, materials: dataset.materials.length, knowledge: dataset.knowledge.length, typeCounts, answerCounts, difficultyCounts, lowEvidence }, null, 2))
if (lowEvidence.length) throw new Error('Há evidências com baixa aderência; revise antes de importar.')
if (apply) {
  await importData(dataset)
  console.log('Importação curada concluída.')
}
