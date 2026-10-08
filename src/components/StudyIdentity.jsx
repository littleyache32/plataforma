import Icon from './Icon.jsx'

// Identidade visual apenas. Não participa de priorização ou seleção curricular.
const SUBJECT_ACCENTS = ['#4f756d', '#647485', '#927565', '#7c8065', '#81798b', '#95876a']
export function subjectAccent(subject, name = '') {
  const key = String(subject?.id || subject?.nome || name || 'sem-materia').normalize('NFKC').trim().toLocaleLowerCase('pt-BR')
  let hash = 0
  for (const character of key) hash = (Math.imul(hash, 31) + character.codePointAt(0)) >>> 0
  return SUBJECT_ACCENTS[hash % SUBJECT_ACCENTS.length]
}

export function SubjectLabel({ subject, name }) {
  return <span className="subject-identity" style={{ '--subject-accent': subjectAccent(subject, name) }}><i aria-hidden="true"/>{name || subject?.nome || 'Matéria a definir'}</span>
}

export function ContextLabel({ type }) {
  if (!['concurso', 'faculdade'].includes(type)) return null
  return <span className={`context-identity ${type}`}><i aria-hidden="true"/>{type === 'faculdade' ? 'Faculdade' : 'BACEN'}</span>
}

const ACTIVITIES = {
  estudo: ['Estudo', 'materiais', 'estudo'], aula: ['Estudo', 'materiais', 'estudo'], trabalho: ['Estudo', 'materiais', 'estudo'],
  revisao: ['Revisão', 'revisoes', 'revisao'], exercicio: ['Exercício', 'questoes', 'exercicio'], questoes: ['Questões', 'questoes', 'exercicio'],
  especial: ['Especial', 'objetivos', 'especial'], cards: ['Question Cards', 'cards', 'cards'], question_cards: ['Question Cards', 'cards', 'cards'],
  simulado: ['Simulado', 'prazos', 'simulado'], prova: ['Prova', 'prazos', 'simulado'],
}
export function ActivityLabel({ type }) {
  const [label, icon, activity] = ACTIVITIES[type] || ACTIVITIES.estudo
  return <span className={`activity-identity ${activity}`}><Icon name={icon}/>{label}</span>
}

// Apresentação apenas: não seleciona conteúdo nem altera a demanda persistida.
export function demandSubject(item) {
  return item.materia?.nome || item.material?.disciplina_curso || 'Matéria a definir'
}

export function demandContent(item) {
  const regularAcademic = item.objetivo?.tipo === 'faculdade'
    && (item.tipo === 'aula' || item.reason_codes?.includes('ACADEMIC_CLASS_SAME_DAY')
      || /aula dada[,\s]*aula estudada/i.test(item.titulo || ''))
  return regularAcademic ? 'Aula dada, aula estudada' : item.titulo
}

export default function DemandIdentity({ item }) {
  return <div className="demand-card-top"><SubjectLabel subject={item.materia} name={demandSubject(item)}/><div className="demand-identities"><ContextLabel type={item.objetivo?.tipo}/><ActivityLabel type={item.tipo}/></div></div>
}
