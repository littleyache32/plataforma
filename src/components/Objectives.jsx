import { useState } from 'react'
import { api } from '../api.js'

export default function Objectives({ catalog, objective, onCatalogChange }) {
  const [form, setForm] = useState({ tipo: 'concurso', nome: '', banca: '' })
  const [structure, setStructure] = useState({ materia: '', topicos: '' })
  const [message, setMessage] = useState('')

  async function create(event) {
    event.preventDefault(); setMessage('')
    try {
      await api('/api/objetivos', { method: 'POST', body: JSON.stringify(form) })
      setForm({ tipo: 'concurso', nome: '', banca: '' }); await onCatalogChange()
    } catch (err) { setMessage(err.message) }
  }

  async function addSubject(event) {
    event.preventDefault(); setMessage('')
    try {
      await api('/api/objetivos', { method: 'PATCH', body: JSON.stringify({ objetivoId: objective.id, materiaNome: structure.materia, topicos: structure.topicos.split('\n') }) })
      setStructure({ materia: '', topicos: '' }); await onCatalogChange()
    } catch (err) { setMessage(err.message) }
  }

  return (
    <section><header className="page-title"><div><p className="eyebrow">ESTRUTURA DE LONGO PRAZO</p><h1>Objetivos</h1><p>Faculdade e qualquer número de concursos usam a mesma engrenagem.</p></div></header>
      <div className="objective-cards">{catalog.map((item) => <article className="objective-card panel" key={item.id}><div className="objective-type"><span className={`type-dot ${item.tipo}`}></span>{item.tipo}</div><h2>{item.nome}</h2><p>{item.banca || 'Contexto acadêmico'} · {item.situacao}</p><div className="subject-tags">{item.materias?.slice(0, 5).map((subject) => <span key={subject.id}>{subject.nome}</span>)}{!item.materias?.length && <small>Adicione a primeira disciplina</small>}</div></article>)}</div>
      <div className="two-columns">
        <form className="panel form-card" onSubmit={create}><span className="eyebrow">NOVO OBJETIVO</span><h2>Criar frente de estudo</h2><label>Tipo</label><select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}><option value="concurso">Concurso</option><option value="faculdade">Faculdade</option></select><label>Nome</label><input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex.: 2º semestre de Direito" required />{form.tipo === 'concurso' && <><label>Banca</label><input value={form.banca} onChange={(e) => setForm({ ...form, banca: e.target.value })} placeholder="Ex.: Cebraspe" /></>}<button className="primary">Criar objetivo</button></form>
        <form className="panel form-card" onSubmit={addSubject}><span className="eyebrow">ESTRUTURA</span><h2>Adicionar disciplina</h2><p className="muted">Em: {objective?.nome}</p><label>Disciplina</label><input value={structure.materia} onChange={(e) => setStructure({ ...structure, materia: e.target.value })} placeholder="Ex.: Direito Civil" required /><label>Tópicos, um por linha</label><textarea rows="5" value={structure.topicos} onChange={(e) => setStructure({ ...structure, topicos: e.target.value })} placeholder={'Pessoas naturais\nBens\nFatos jurídicos'} /><button className="primary" disabled={!objective}>Adicionar estrutura</button></form>
      </div>{message && <div className="alert error">{message}</div>}
    </section>
  )
}
