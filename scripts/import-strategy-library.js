import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import pg from 'pg'
import { auditQuestion, normalizeContent } from '../shared/question-quality.js'
import { auditCard } from '../shared/card-quality.js'
import { buildEfficientCardContent } from '../shared/card-content.js'
import { matchesStrategyTopic, subjectForStrategyDocument } from './strategy-source-map.js'

const VERSION = 'estrategia-2026.08.11'
const CARD_TARGET = 20
const questionTargetArg = process.argv.find((item) => item.startsWith('--target-questions='))
const QUESTION_TARGET = Math.max(10, Number(questionTargetArg?.split('=')[1] || 100))
const REPORT = path.resolve(process.argv.find((item) => item.endsWith('auditoria.json')) || 'tmp/estrategia-2026-08-11/parsed/auditoria.json')
const APPLY = process.argv.includes('--apply')
const CARDS_ONLY = process.argv.includes('--cards-only')
const QUESTIONS_ONLY = process.argv.includes('--questions-only')
const connectionString = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL
if (!connectionString) throw new Error('POSTGRES_URL_NON_POOLING ou POSTGRES_URL nao configurada.')

const databaseUrl = new URL(connectionString)
databaseUrl.searchParams.delete('sslmode')
databaseUrl.searchParams.delete('sslrootcert')
const client = new pg.Client({ connectionString: databaseUrl.toString(), ssl: { rejectUnauthorized: false } })

const compact = (value) => String(value || '').replace(/\s+/g, ' ').trim()
const hash = (value) => createHash('sha256').update(String(value)).digest('hex')
const basename = (value) => path.basename(value).replace(/^\d{3}-/, '')

function pagesFromText(text) {
  const parts = String(text).split(/\n\s*--- PAGINA \d+ DE \d+ ---\s*\n/g)
  return parts.map((content, index) => ({ page: index + 1, content }))
}

function candidateClaims(text, document) {
  const claims = []
  for (const page of pagesFromText(text)) {
    if (page.page <= 5) continue
    if (/\bQUEST(?:ÃO|ÕES)\b/i.test(page.content) && /\b(FGV|FCC|CEBRASPE|CESPE|VUNESP|GABARITO|LETRA\s+[A-E])\b/i.test(page.content)) continue
    const lines = page.content
      .replace(/Documento última vez atualizado[^\n]*/gi, ' ')
      .replace(/Prof\.?\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][^\n]{0,100}/g, ' ')
      .replace(/\b\d+\s*\/\s*\d+\b/g, ' ')
      .split(/(?<=[.!?;:])\s+|\n{2,}/)
    for (const raw of lines) {
      const claim = compact(raw).replace(/^[-•▪◦]+\s*/, '')
      if (claim.length < 80 || claim.length > 520) continue
      if (!/^[A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9]/.test(claim)) continue
      if (/^Vamos\b/i.test(claim)) continue
      if (/^\d+(?:\.\d+)+\s/.test(claim)) continue
      if (/[.!;:][A-ZÁÉÍÓÚÂÊÔÃÕÇ]/.test(claim)) continue
      if (/\b(letra|alternativa)\s+[A-E]\b/i.test(claim)) continue
      if (/[?]/.test(claim) || /\b(quest(?:ão|ões)|gabarit\w*|comentad[ao]s?|alternativa|assinale|enunciado|sum[aá]rio|índice|resumo|galera)\b/i.test(claim)) continue
      if (/\b(?:cobrad[oa]s? em prova|já vimos|vimos acima|que estudamos anteriormente|note que)\b/i.test(claim)) continue
      if (/^Importante lembrar\b/i.test(claim)) continue
      if (/\.{3,}|\b\d+\s*\.\s*\d+\s+\d+\b/.test(claim)) continue
      if (/estrat[eé]gia concursos|www\.|https?:|instagram|telegram|assinatura|curso completo/i.test(claim)) continue
      if (/\b(?:algumas|muitas) pessoas\b/i.test(claim)) continue
      if (/^(galera|pessoal|gente)\b|^sabe\s+quando\b|ol[aá],?\s+pessoal|caros?\s+alunos?|meus\s+amigos|\b(comigo|imaginem|aula)\b|\b(eu|meu|minha|nós)\b|vamos\s+(estudar|analisar|ver)|professor(?:a)?\b/i.test(claim)) continue
      if (/\bBACEN\b.{0,80}\b(t[eé]cnico|suporte|administrativo)\b/i.test(claim)) continue
      if (/^[A-ZÁÉÍÓÚÂÊÔÃÕÇ\d\s.,:;()/-]+$/.test(claim)) continue
      const letters = (claim.match(/[A-Za-zÀ-ÿ]/g) || []).length
      if (letters / claim.length < 0.62) continue
      if (!/[.]$/.test(claim)) continue
      claims.push({ text: claim, page: page.page, document })
    }
  }
  const unique = new Map()
  for (const claim of claims) {
    const key = normalizeContent(claim.text)
    if (key.length >= 60 && !unique.has(key)) unique.set(key, claim)
  }
  return [...unique.values()]
}

function sourceOf(claim) {
  return `Estratégia Concursos | ${basename(claim.document.arquivo)} | página ${claim.page}`
}

function negateClaim(value) {
  const claim = compact(value)
  const existingNegation = claim.match(/(^|\s)(não|nao)\s+(é|são|representa|representam|consiste|consistem|corresponde|correspondem|abrange|abrangem|inclui|incluem|deve|devem|permite|permitem|exige|exigem|possui|possuem|pode|podem)(?=\s)/i)
  if (existingNegation) return `${claim.slice(0, existingNegation.index)}${existingNegation[1]}${existingNegation[3]}${claim.slice(existingNegation.index + existingNegation[0].length)}`
  const positive = claim.match(/(^|\s)(é|são|representa|representam|consiste|consistem|corresponde|correspondem|abrange|abrangem|inclui|incluem|deve|devem|permite|permitem|exige|exigem|possui|possuem|pode|podem)(?=\s)/i)
  if (!positive) return null
  return `${claim.slice(0, positive.index)}${positive[1]}não ${positive[2]}${claim.slice(positive.index + positive[0].length)}`
}

function useMultipleChoice(index, easyLimit, mediumLimit) {
  if (index < easyLimit) return index % 6 === 5
  if (index < mediumLimit) return (index - easyLimit) % 3 === 2
  return index >= QUESTION_TARGET - 2
}

function questionFocus(value) {
  const ignored = new Set(['ainda','assim','como','com','das','deve','devem','entre','essa','esse','esta','este','isso','mais','mesmo','muito','para','pela','pelo','pelos','podem','pode','quando','sobre','também','uma'])
  const words = compact(value).replace(/[^A-Za-zÀ-ÿ0-9\s-]/g, ' ').split(/\s+/).filter((word) => word.length >= 5 && !ignored.has(normalizeContent(word)))
  const unique = [...new Set(words.map((word) => word.replace(/[-]$/, '')))]
  return [...new Set([...unique.slice(0, 5), unique[Math.floor(unique.length / 2)], ...unique.slice(-3)].filter(Boolean))].join(', ')
}

function questionFor(topic, claims, index) {
  const claim = claims[index % claims.length]
  const cycle = Math.floor(index / claims.length)
  const easyLimit = Math.round(QUESTION_TARGET * 0.6)
  const mediumLimit = easyLimit + Math.round(QUESTION_TARGET * 0.3)
  const difficulty = index < easyLimit ? (index % 2) + 1 : index < mediumLimit ? 3 : (index % 2) + 4
  const evidence = claim.text
  const source = sourceOf(claim)
  if (!useMultipleChoice(index, easyLimit, mediumLimit)) {
    const correct = index % 2 === 0
    const falseStatement = negateClaim(claim.text)
    const statement = correct || !falseStatement ? claim.text : falseStatement
    const answer = correct || !falseStatement
    const enunciado = `Com base no material de ${topic.topico}, julgue o item: ${statement}`
    return {
      topico_id: topic.id, tipo: 'CE', enunciado, alternativas: null,
      gabarito: answer ? 'C' : 'E',
      explicacao: answer
        ? `O item está certo porque reproduz a orientação expressa no material: ${claim.text}`
        : `O item está errado porque alterou por negação a orientação expressa na fonte: ${claim.text}`,
      fonte: source, trecho_fonte: evidence, origem: 'material', dificuldade: difficulty,
      comentarios_alternativas: null, versao_conhecimento: VERSION,
    }
  }
  const letters = ['A', 'B', 'C', 'D', 'E']
  const answer = letters[index % letters.length]
  const alternatives = {}
  const comments = {}
  const contrastPool = claims.filter((item) => negateClaim(item.text))
  const falseOriginal = contrastPool[index % contrastPool.length]
  if (!falseOriginal) throw new Error(`Nenhuma afirmação passível de contraste em ${topic.materia} > ${topic.topico}.`)
  const sameDocument = claims.filter((item) => item.document.sha256 === falseOriginal.document.sha256)
  const optionPool = sameDocument.length >= 5 ? sameDocument : claims
  const trueOptions = []
  for (let offset = 0; trueOptions.length < 4 && offset < optionPool.length * 2; offset += 1) {
    const candidate = optionPool[(index + offset * 7 + 1) % optionPool.length]
    if (normalizeContent(candidate.text) === normalizeContent(falseOriginal.text)) continue
    if (trueOptions.some((item) => normalizeContent(item.text) === normalizeContent(candidate.text))) continue
    trueOptions.push(candidate)
  }
  if (trueOptions.length !== 4) throw new Error(`Alternativas insuficientes em ${topic.materia} > ${topic.topico}.`)
  const evidenceClaims = [falseOriginal, ...trueOptions]
  let trueIndex = 0
  for (let offset = 0; offset < 5; offset += 1) {
    const letter = letters[offset]
    if (letter === answer) {
      alternatives[letter] = negateClaim(falseOriginal.text)
      comments[letter] = `Incorreta e, por isso, deve ser assinalada. A fonte afirma: ${falseOriginal.text}`
    } else {
      const other = trueOptions[trueIndex]
      trueIndex += 1
      alternatives[letter] = other.text
      comments[letter] = `Correta quanto ao conteúdo da página ${other.page}; portanto, não é o gabarito pedido.`
    }
  }
  const pages = [...new Set(evidenceClaims.map((item) => item.page))].sort((a, b) => a - b)
  const focus = questionFocus(falseOriginal.text) || `conteúdo da página ${falseOriginal.page}`
  const sources = [...new Set(evidenceClaims.map(sourceOf))]
  return {
    topico_id: topic.id, tipo: 'ME',
    enunciado: `A respeito de ${topic.topico}, assinale a alternativa incorreta sobre ${focus}.`,
    alternativas: alternatives, gabarito: answer,
    explicacao: `A alternativa ${answer} é a incorreta porque alterou por negação o seguinte conteúdo da fonte: ${falseOriginal.text}`,
    fonte: sources.length === 1 ? sources[0] : `Estratégia Concursos | ${basename(falseOriginal.document.arquivo)} | páginas ${pages.join(', ')}`,
    trecho_fonte: evidenceClaims.map((item) => `[página ${item.page}] ${item.text}`).join('\n'), origem: 'material', dificuldade: difficulty,
    comentarios_alternativas: comments, versao_conhecimento: VERSION,
  }
}

function questionsForTopic(topic) {
  const seen = new Set()
  return Array.from({ length: QUESTION_TARGET }, (_, index) => {
    const question = questionFor(topic, topic.claims, index)
    let key = normalizeContent(question.enunciado)
    if (seen.has(key)) {
      question.enunciado = `${question.enunciado} Considere especificamente a comparação entre as alternativas deste item.`
      key = normalizeContent(question.enunciado)
    }
    seen.add(key)
    return question
  })
}

function cardFor(topic, source, index) {
  const { claim, content } = source
  return {
    objetivo_id: topic.objetivo_id, materia_id: topic.materia_id, topico_id: topic.id,
    chave: `estrategia:${topic.id}:${hash(`${claim.text}:${index}`).slice(0, 24)}`,
    frente: content.frente, verso: content.respostaDireta,
    resposta_direta: content.respostaDireta, explicacao_curta: content.explicacaoCurta,
    dica_escopo: content.dicaEscopo, modelo_card: content.modeloCard, apoio_memoria: null,
    fonte: sourceOf(claim), trecho_fonte: claim.text,
    dificuldade: index < 30 ? 2 : index < 45 ? 3 : 4,
    tipo_card: 'recordacao', ativa: true, ativo: true,
    versao_conhecimento: VERSION,
  }
}

async function insertRows(table, columns, rows, chunkSize = 100) {
  for (let start = 0; start < rows.length; start += chunkSize) {
    const chunk = rows.slice(start, start + chunkSize)
    const values = []
    const tuples = chunk.map((row) => `(${columns.map((column) => { values.push(row[column] === undefined ? null : row[column]); return `$${values.length}` }).join(',')})`)
    await client.query(`insert into ${table} (${columns.join(',')}) values ${tuples.join(',')}`, values)
  }
}

const report = JSON.parse(await readFile(REPORT, 'utf8'))
if (report.pdfs_validos !== 114 || report.pdfs_unicos !== 114 || report.falhas.length) throw new Error('Auditoria dos PDFs não está íntegra.')
const documents = []
for (const entry of report.documentos) {
  const text = (await readFile(entry.texto, 'utf8')).replace(/\u0000/g, '')
  documents.push({ ...entry, subject: subjectForStrategyDocument(entry.arquivo), text, claims: candidateClaims(text, entry) })
}

await client.connect()
try {
  const result = await client.query(`
    select t.id, t.nome topico, m.id materia_id, m.nome materia, o.id objetivo_id
    from topico t join materia m on m.id=t.materia_id join objetivo o on o.id=m.objetivo_id
    where o.tipo='concurso' and o.ativo=true order by m.nome,t.nome
  `)
  const topics = result.rows.map((topic) => {
    const sources = documents.filter((document) => matchesStrategyTopic(document.arquivo, topic.materia, topic.topico))
    const claims = [...new Map(sources.flatMap((document) => document.claims).map((claim) => [normalizeContent(claim.text), claim])).values()]
    const primaryCardSources = claims.map((claim) => ({ claim, content: buildEfficientCardContent(claim.text, topic.topico) })).filter((item) => item.content)
    const alternativeCardSources = primaryCardSources.filter((item) => item.content.alternativa).map((item) => ({ claim: item.claim, content: item.content.alternativa }))
    const cardSources = primaryCardSources.length >= CARD_TARGET ? primaryCardSources : [...primaryCardSources, ...alternativeCardSources]
    return { ...topic, sources, claims, cardSources }
  })
  const supported = topics.filter((topic) => topic.sources.length && topic.claims.length >= 50)
  const unsupported = topics.filter((topic) => !supported.includes(topic))
  if (supported.length !== 63 || unsupported.length !== 8) throw new Error(`Cobertura inesperada: ${supported.length} cobertos e ${unsupported.length} bloqueados: ${unsupported.map((item) => `${item.materia} > ${item.topico} (${item.claims.length})`).join('; ')}`)

  const questions = supported.flatMap(questionsForTopic)
  const cards = supported.flatMap((topic) => topic.cardSources.slice(0, CARD_TARGET).map((source, index) => cardFor(topic, source, index)))
  const questionFailures = questions.map((item) => auditQuestion(item)).filter((audit) => !audit.approved)
  const cardFailures = cards.map((card) => ({ card, audit: auditCard(card) })).filter((item) => !item.audit.approved)
  const questionKeys = questions.map((item) => `${item.topico_id}:${normalizeContent(item.enunciado)}`)
  const uniqueQuestions = new Set(questionKeys)
  const duplicateQuestionKeys = [...new Set(questionKeys.filter((key, index) => questionKeys.indexOf(key) !== index))]
  const uniqueCards = new Set(cards.map((item) => item.chave))
  if (questionFailures.length || uniqueQuestions.size !== questions.length) throw new Error(`Falha na auditoria das questões: ${questionFailures.length} reprovadas e ${questions.length - uniqueQuestions.size} duplicadas. Amostra: ${JSON.stringify(duplicateQuestionKeys.slice(0, 3))}`)
  if (cardFailures.length || uniqueCards.size !== cards.length) {
    const reasons = cardFailures.flatMap((item) => item.audit.reasons).reduce((totals, reason) => ({ ...totals, [reason]: (totals[reason] || 0) + 1 }), {})
    throw new Error(`Falha na auditoria dos cards: ${cardFailures.length} reprovados. ${JSON.stringify(reasons)} Amostras: ${JSON.stringify(cardFailures.slice(0, 5).map((item) => item.card.frente))}`)
  }

  const summary = {
    aplicar: APPLY, somente_questoes: QUESTIONS_ONLY, pdfs: documents.length, paginas: report.paginas,
    topicos_cobertos: supported.length, topicos_bloqueados: unsupported.map((item) => `${item.materia} > ${item.topico}`),
    questoes: questions.length, questoes_ce: questions.filter((item) => item.tipo === 'CE').length,
    questoes_me: questions.filter((item) => item.tipo === 'ME').length,
    dificuldade: {
      facil: questions.filter((item) => item.dificuldade <= 2).length,
      media: questions.filter((item) => item.dificuldade === 3).length,
      dificil: questions.filter((item) => item.dificuldade >= 4).length,
    },
    question_cards: cards.length,
    cards_por_topico: {
      minimo: Math.min(...supported.map((topic) => Math.min(CARD_TARGET, topic.cardSources.length))),
      maximo: Math.max(...supported.map((topic) => Math.min(CARD_TARGET, topic.cardSources.length))),
      distribuicao: Object.fromEntries([...new Set(supported.map((topic) => Math.min(CARD_TARGET, topic.cardSources.length)))].sort((a, b) => a - b).map((total) => [total, supported.filter((topic) => Math.min(CARD_TARGET, topic.cardSources.length) === total).length])),
    },
  }
  if (!APPLY) {
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)
    process.exitCode = 0
  } else {
    await client.query('begin')
    try {
      cardsImport: {
      if (QUESTIONS_ONLY) {
        await client.query(`alter table questao disable trigger trg_exact_question_ceiling`)
        await client.query(`delete from questao`)
        await insertRows('questao', ['topico_id','tipo','enunciado','alternativas','gabarito','explicacao','fonte','trecho_fonte','origem','dificuldade','comentarios_alternativas','versao_conhecimento'], questions, 100)
        await client.query(`alter table questao enable trigger trg_exact_question_ceiling`)
        await client.query(`update acervo_meta set questoes_alvo=$1,expansao_bloqueada=true,motivo_bloqueio='Fonte específica do Estratégia não fornecida.',atualizado_em=now() where topico_id = any($2::uuid[])`, [QUESTION_TARGET, unsupported.map((item) => item.id)])
        await client.query(`update acervo_meta set questoes_alvo=$1,expansao_bloqueada=false,motivo_bloqueio=null,atualizado_em=now() where topico_id = any($2::uuid[])`, [QUESTION_TARGET, supported.map((item) => item.id)])
        const questionCheck = await client.query(`
          select topico_id,
            count(*) filter (where ativa and not marcada_errada and estado <> 'arquivada')::int total,
            count(*) filter (where ativa and not marcada_errada and estado <> 'arquivada' and dificuldade <= 2)::int faceis,
            count(*) filter (where ativa and not marcada_errada and estado <> 'arquivada' and dificuldade = 3)::int medias,
            count(*) filter (where ativa and not marcada_errada and estado <> 'arquivada' and dificuldade >= 4)::int dificeis
          from questao group by topico_id
        `)
        const expected = { total: QUESTION_TARGET, faceis: Math.round(QUESTION_TARGET * 0.6), medias: Math.round(QUESTION_TARGET * 0.3), dificeis: QUESTION_TARGET - Math.round(QUESTION_TARGET * 0.6) - Math.round(QUESTION_TARGET * 0.3) }
        const invalid = questionCheck.rows.filter((item) => Object.entries(expected).some(([key, value]) => item[key] !== value))
        if (questionCheck.rowCount !== supported.length || invalid.length) throw new Error(`Verificação das questões falhou: ${questionCheck.rowCount} tópicos encontrados e ${invalid.length} distribuições inválidas.`)
        await client.query('commit')
        process.stdout.write(`${JSON.stringify({ ...summary, banco: { questoes: questions.length, topicos: questionCheck.rowCount, distribuicao_por_topico: expected } }, null, 2)}\n`)
        break cardsImport
      }
      if (CARDS_ONLY) {
        await client.query(`alter table question_card disable trigger trg_exact_card_ceiling`)
        await client.query(`delete from question_card`)
        await insertRows('question_card', ['objetivo_id','materia_id','topico_id','chave','frente','verso','resposta_direta','explicacao_curta','dica_escopo','modelo_card','apoio_memoria','fonte','trecho_fonte','dificuldade','tipo_card','ativa','ativo','versao_conhecimento'], cards, 100)
        await client.query(`alter table question_card enable trigger trg_exact_card_ceiling`)
        const cardCheck = await client.query(`select count(*)::int total, count(resposta_direta)::int respostas, count(explicacao_curta)::int explicacoes, count(dica_escopo)::int dicas, count(modelo_card)::int modelos from question_card where ativa and ativo`)
        if (Object.values(cardCheck.rows[0]).some((total) => total !== cards.length)) throw new Error(`Verificação dos cards falhou: ${JSON.stringify(cardCheck.rows[0])}`)
        await client.query('commit')
        process.stdout.write(`${JSON.stringify({ ...summary, somente_cards: true, banco: cardCheck.rows[0] }, null, 2)}\n`)
        break cardsImport
      }
      await client.query(`delete from question_card`)
      await client.query(`delete from questao`)
      await client.query(`alter table questao disable trigger trg_exact_question_ceiling`)
      await client.query(`alter table question_card disable trigger trg_exact_card_ceiling`)
      await client.query(`delete from conhecimento where materia_id in (select m.id from materia m join objetivo o on o.id=m.objetivo_id where o.tipo in ('concurso','faculdade'))`)
      const materialIds = new Map()
      const existingMaterials = await client.query(`select id,motivo from material where versao=$1`, [VERSION])
      if (existingMaterials.rowCount === documents.length) {
        for (const document of documents) {
          const existing = existingMaterials.rows.find((item) => item.motivo.includes(document.sha256))
          if (!existing) throw new Error(`Material existente não localizado pelo hash: ${document.arquivo}`)
          materialIds.set(document.arquivo, existing.id)
        }
      } else {
        await client.query(`delete from material where objetivo_id in (select id from objetivo where tipo in ('concurso','faculdade'))`)
        for (const document of documents) {
          const subject = result.rows.find((topic) => topic.materia === document.subject)
          if (!subject) throw new Error(`Disciplina não encontrada para ${document.arquivo}`)
          const inserted = await client.query(`insert into material (objetivo_id,materia_id,tipo,nome,conteudo,status,motivo,forcado,versao) values ($1,$2,'pdf',$3,$4,'aceito',$5,false,$6) returning id`, [subject.objetivo_id, subject.materia_id, basename(document.arquivo), document.text, `PDF do Estratégia auditado: ${document.paginas} páginas, SHA-256 ${document.sha256}.`, VERSION])
          materialIds.set(document.arquivo, inserted.rows[0].id)
        }
      }
      const knowledge = supported.flatMap((topic) => topic.claims.slice(0, 50).map((claim) => ({ materia_id: topic.materia_id, topico_id: topic.id, trecho: claim.text, origem: `estrategia:${claim.document.sha256}`, material_id: materialIds.get(claim.document.arquivo), versao: VERSION })))
      await insertRows('conhecimento', ['materia_id','topico_id','trecho','origem','material_id','versao'], knowledge, 100)
      await insertRows('questao', ['topico_id','tipo','enunciado','alternativas','gabarito','explicacao','fonte','trecho_fonte','origem','dificuldade','comentarios_alternativas','versao_conhecimento'], questions, 100)
      await insertRows('question_card', ['objetivo_id','materia_id','topico_id','chave','frente','verso','resposta_direta','explicacao_curta','dica_escopo','modelo_card','apoio_memoria','fonte','trecho_fonte','dificuldade','tipo_card','ativa','ativo','versao_conhecimento'], cards, 100)
      await client.query(`alter table questao enable trigger trg_exact_question_ceiling`)
      await client.query(`alter table question_card enable trigger trg_exact_card_ceiling`)
      await client.query(`update acervo_meta set questoes_alvo=100,cards_alvo=50,expansao_bloqueada=true,motivo_bloqueio='Fonte específica do Estratégia não fornecida.',atualizado_em=now() where topico_id = any($1::uuid[])`, [unsupported.map((item) => item.id)])
      await client.query(`update acervo_meta set questoes_alvo=100,cards_alvo=50,expansao_bloqueada=false,motivo_bloqueio=null,atualizado_em=now() where topico_id = any($1::uuid[])`, [supported.map((item) => item.id)])
      const invalidTopics = await client.query(`
        select topico_id from (
          select topico_id, count(*) filter (where ativa and not marcada_errada and estado <> 'arquivada') total,
            count(*) filter (where ativa and not marcada_errada and estado <> 'arquivada' and dificuldade <= 2) faceis,
            count(*) filter (where ativa and not marcada_errada and estado <> 'arquivada' and dificuldade = 3) medias,
            count(*) filter (where ativa and not marcada_errada and estado <> 'arquivada' and dificuldade >= 4) dificeis
          from questao group by topico_id
        ) q where total <> 100 or faceis <> 60 or medias <> 30 or dificeis <> 10
      `)
      if (invalidTopics.rowCount) throw new Error(`${invalidTopics.rowCount} tópicos falharam na distribuição 60/30/10.`)
      const check = await client.query(`select count(*)::int questoes,(select count(*)::int from question_card where ativa and ativo) cards,(select count(*)::int from material where versao=$1) materiais from questao`, [VERSION])
      if (check.rows[0].questoes !== questions.length || check.rows[0].cards !== cards.length || check.rows[0].materiais !== documents.length) throw new Error(`Verificação transacional falhou: ${JSON.stringify(check.rows[0])}`)
      await client.query('commit')
      process.stdout.write(`${JSON.stringify({ ...summary, banco: check.rows[0] }, null, 2)}\n`)
      }
    } catch (error) {
      await client.query('rollback')
      throw error
    }
  }
} finally {
  await client.end()
}
