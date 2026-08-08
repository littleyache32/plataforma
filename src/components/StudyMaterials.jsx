import { useEffect, useMemo, useState } from 'react'
import { api } from '../api.js'

function ArticleContent({ content }) {
  return <div className="study-content">{String(content || '').split('\n').map((line, index) => {
    const key = `${index}-${line.slice(0, 20)}`
    if (line.startsWith('### ')) return <h3 key={key}>{line.slice(4)}</h3>
    if (line.startsWith('## ')) return <h2 key={key}>{line.slice(3)}</h2>
    if (line.startsWith('# ')) return <h1 key={key}>{line.slice(2)}</h1>
    if (/^[-*] /.test(line)) return <p className="study-list-item" key={key}>{line.slice(2)}</p>
    if (line.startsWith('> ')) return <blockquote key={key}>{line.slice(2)}</blockquote>
    return line.trim() ? <p key={key}>{line}</p> : <span className="study-space" key={key} />
  })}</div>
}

export default function StudyMaterials({ objective }) {
  const [materials, setMaterials] = useState([])
  const [subjectId, setSubjectId] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [selected, setSelected] = useState(null)
  const [message, setMessage] = useState('')
  const filtered = useMemo(() => subjectId ? materials.filter((item) => item.materia?.id === subjectId) : materials, [materials, subjectId])

  useEffect(() => {
    if (!objective?.id) return
    api(`/api/estudo?objetivoId=${objective.id}`).then((data) => { setMaterials(data.materiais); setSubjectId(''); setSelectedId(''); setSelected(null); setMessage('') }).catch((error) => setMessage(error.message))
  }, [objective?.id])

  useEffect(() => {
    if (!selectedId || !objective?.id) return
    api(`/api/estudo?objetivoId=${objective.id}&materialId=${selectedId}`).then((data) => setSelected(data.material)).catch((error) => setMessage(error.message))
  }, [selectedId, objective?.id])

  return <section><header className="page-title"><div><p className="eyebrow">BIBLIOTECA DE ESTUDO</p><h1>Apostilas</h1><p>Material didático completo, separado das questões e organizado por disciplina.</p></div></header><div className="study-layout"><aside className="panel study-index"><label>Disciplina</label><select value={subjectId} onChange={(event) => { setSubjectId(event.target.value); setSelectedId(''); setSelected(null) }}><option value="">Todas as disciplinas</option>{(objective?.materias || []).map((item) => <option value={item.id} key={item.id}>{item.nome}</option>)}</select><div>{filtered.map((item) => <button className={selectedId === item.id ? 'active' : ''} key={item.id} onClick={() => setSelectedId(item.id)}><small>{item.materia?.nome}</small><b>{item.nome || 'Apostila'}</b></button>)}</div></aside><article className="panel study-reader">{selected ? <><header><small>{selected.materia?.nome}</small><h1>{selected.nome}</h1></header><ArticleContent content={selected.conteudo} /></> : <div className="question-empty"><span>▤</span><h2>{message || (materials.length ? 'Escolha uma apostila para começar.' : 'As apostilas estão sendo construídas.')}</h2><p>Os capítulos aparecerão aqui depois da importação do acervo.</p></div>}</article></div></section>
}

