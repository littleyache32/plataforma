import { isMaterialCompleted } from './material-progress.js'

// Factual projection only. Ranking and selection belong to mentor-v2-policy.
export function calculateMentorV2PriorityFacts(facts, referenceInstant) {
  const source = facts.prioritySources
  if (!source || ['materials', 'progress', 'commitmentTopics', 'reviews', 'questions', 'attempts'].some((key) => !Array.isArray(source[key]))) {
    throw new Error('FONTES_PRIORIZACAO_INCOMPLETAS')
  }
  const unique = (rows, key) => {
    const ids = rows.map((row) => row[key])
    if (ids.some((id) => !id) || new Set(ids).size !== ids.length) throw new Error(`IDENTIDADE_PRIORIZACAO_INVALIDA:${key}`)
    return [...rows].sort((a, b) => String(a[key]).localeCompare(String(b[key])))
  }
  const materials = unique(source.materials, 'id'), progress = unique(source.progress, 'material_id')
  const subjects = new Map(facts.subjects.map((row) => [row.id, row]))
  const topics = new Map(facts.topics.map((row) => [row.id, row]))
  const byMaterial = new Map(progress.map((row) => [row.material_id, row]))
  for (const row of progress) {
    if (!materials.some((material) => material.id === row.material_id)
      || !['em_andamento', 'concluido'].includes(row.estado)
      || (row.estado === 'em_andamento' && row.concluido_em != null)
      || (row.estado === 'concluido' && (!isMaterialCompleted(row) || !Number.isFinite(Date.parse(row.concluido_em))
        || Date.parse(row.concluido_em) > Date.parse(referenceInstant)))) throw new Error('PROGRESSO_CURRICULAR_INVALIDO')
  }
  const grouped = new Map(), gaps = []
  for (const row of materials) {
    if (subjects.get(row.materia_id)?.objetivo_id !== row.objetivo_id) throw new Error('VINCULO_MATERIAL_INVALIDO')
    if (row.status !== 'aceito') continue
    grouped.set(row.materia_id, [...(grouped.get(row.materia_id) || []), row])
  }
  const candidates = []
  const history = [...(facts.loadSources?.history || []), ...facts.demands]
  for (const [subjectId, rows] of grouped) {
    if (rows.some((row) => !Number.isInteger(row.ordem_curso) || row.ordem_curso <= 0)
      || new Set(rows.map((row) => row.ordem_curso)).size !== rows.length) {
      gaps.push({ materia_id: subjectId, motivo: 'ORDEM_CURRICULAR_NAO_IDENTIFICADA' }); continue
    }
    const pending = [...rows].sort((a, b) => a.ordem_curso - b.ordem_curso)
      .find((row) => !isMaterialCompleted(byMaterial.get(row.id)))
    if (!pending) continue // Completed curriculum never restarts implicitly.
    if (pending.estado_extracao === 'pendente_ocr') {
      gaps.push({ materia_id: subjectId, motivo: 'MATERIAL_ATUAL_PENDENTE_OCR' }); continue
    }
    const completed = history.filter((row) => row.materia_id === subjectId && row.status === 'feita'
      && Number.isFinite(Date.parse(row.concluida_em)) && Date.parse(row.concluida_em) <= Date.parse(referenceInstant))
    candidates.push({ objetivo_id: pending.objetivo_id, materia_id: subjectId, material_id: pending.id,
      ordem_curso: pending.ordem_curso, estado: byMaterial.get(pending.id)?.estado || 'nao_iniciado',
      ultima_execucao: completed.map((row) => row.concluida_em).sort((a, b) => Date.parse(b) - Date.parse(a))[0] || null })
  }
  const commitments = facts.loadSources?.commitments || []
  for (const link of source.commitmentTopics) {
    const commitment = commitments.find((row) => row.id === link.compromisso_id), topic = topics.get(link.topico_id)
    if (!commitment || !topic || subjects.get(topic.materia_id)?.objetivo_id !== commitment.objetivo_id
      || (commitment.materia_id && commitment.materia_id !== topic.materia_id)) throw new Error('VINCULO_COMPROMISSO_INVALIDO')
  }
  // Queue entries are facts of a need, not proof of sufficient mastery evidence.
  const questions = new Map(unique(source.questions, 'id').map((row) => [row.id, row]))
  const reviews = unique(source.reviews, 'id').map((row) => {
    const question = questions.get(row.questao_id), topic = topics.get(question?.topico_id)
    if (!question || !topic) throw new Error('VINCULO_REVISAO_INVALIDO')
    return { ...row, topico_id: topic.id, materia_id: topic.materia_id,
      vencida_no_corte: row.status === 'pendente' && Number.isFinite(Date.parse(row.agendada_para))
        && Date.parse(row.agendada_para) <= Date.parse(referenceInstant), reteste: row.motivo === 'checagem' }
  })
  const attempts = unique(source.attempts, 'id')
  for (const row of attempts) {
    if (!questions.has(row.questao_id) || !Number.isFinite(Date.parse(row.criado_em))
      || Date.parse(row.criado_em) > Date.parse(referenceInstant)) throw new Error('TENTATIVA_PRIORIZACAO_INVALIDA')
  }
  return { candidatos: candidates.sort((a, b) => a.material_id.localeCompare(b.material_id)),
    lacunas: gaps.sort((a, b) => a.materia_id.localeCompare(b.materia_id)),
    necessidades_revisao: reviews, observacoes_questoes: attempts,
    qualificacao_desempenho: 'SEM_REGRA_DE_SUFICIENCIA_APROVADA',
    snapshot: { materials, progress, commitmentTopics: [...source.commitmentTopics].sort((a, b) =>
      a.compromisso_id.localeCompare(b.compromisso_id) || a.topico_id.localeCompare(b.topico_id)),
      reviews: unique(source.reviews, 'id'), questions: [...questions.values()], attempts } }
}
