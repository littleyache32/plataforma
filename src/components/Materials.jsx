import { useEffect, useState } from 'react'
import { api, toBase64 } from '../api.js'

export default function Materials({ objective }) {
  const subjects = objective?.materias || []
  const [subjectId, setSubjectId] = useState(subjects[0]?.id || '')
  const [text, setText] = useState('')
  const [file, setFile] = useState(null)
  const [materials, setMaterials] = useState([])
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => setSubjectId(subjects[0]?.id || ''), [objective?.id])
  const load = () => api('/api/admin/materiais').then((data) => setMaterials(data.materiais)).catch((err) => setStatus(err.message))
  useEffect(() => { load() }, [])

  async function submit(event) {
    event.preventDefault(); setLoading(true); setStatus('Avaliando qualidade, pertinência e repetição...')
    try {
      const payload = file
        ? { objetivoId: objective.id, materiaId: subjectId, tipo: 'pdf', nome: file.name, arquivoBase64: await toBase64(file) }
        : { objetivoId: objective.id, materiaId: subjectId, tipo: 'texto', nome: 'Texto colado', conteudo: text }
      const result = await api('/api/admin/materiais', { method: 'POST', body: JSON.stringify(payload) })
      setStatus(`${result.status.toUpperCase()}: ${result.motivo}`); setText(''); setFile(null); load()
    } catch (err) { setStatus(err.message) } finally { setLoading(false) }
  }

  async function force(id) {
    await api('/api/admin/materiais', { method: 'PATCH', body: JSON.stringify({ id }) }); load()
  }

  return (
    <section><header className="page-title"><div><p className="eyebrow">CONHECIMENTO</p><h1>Materiais</h1><p>O que você anexa passa por verificação antes de alimentar questões.</p></div></header>
      <div className="two-columns materials-layout"><form className="panel form-card" onSubmit={submit}><span className="eyebrow">NOVA ENTRADA</span><h2>Anexar ao objetivo</h2><label>Disciplina</label><select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>{subjects.map((item) => <option value={item.id} key={item.id}>{item.nome}</option>)}</select><label>Texto</label><textarea rows="8" value={text} onChange={(e) => { setText(e.target.value); if (e.target.value) setFile(null) }} placeholder="Cole um material, resumo ou anotação..." /><div className="or"><span>ou PDF</span></div><label className="file-input"><input type="file" accept="application/pdf" onChange={(e) => { setFile(e.target.files[0]); if (e.target.files[0]) setText('') }} /><span>{file ? file.name : 'Selecionar PDF de até 8 MB'}</span></label><button className="primary" disabled={loading || !subjectId || (!file && text.length < 120)}>Verificar material</button>{status && <div className="status-box">{status}</div>}<small className="limit-note">Fotos, slides, DOCX e links serão adicionados quando o fluxo de armazenamento for definido.</small></form>
        <article className="panel list-panel"><div className="panel-heading"><h2>Histórico</h2><span>{materials.length}</span></div>{materials.length ? materials.map((item) => <div className="material-row" key={item.id}><div><small>{item.objetivo?.nome} · {item.materia?.nome}</small><b>{item.nome || 'Material sem nome'}</b><p>{item.motivo}</p></div><div><span className={`badge ${item.status}`}>{item.forcado ? 'FORÇADO' : item.status.toUpperCase()}</span>{item.status === 'recusado' && <button className="secondary" onClick={() => force(item.id)}>Forçar entrada</button>}</div></div>) : <div className="empty-inline">Nenhum material avaliado.</div>}</article>
      </div>
    </section>
  )
}
