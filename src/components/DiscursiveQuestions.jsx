import Icon from './Icon.jsx'

export default function DiscursiveQuestions() {
  return <section>
    <header className="page-title compact">
      <div>
        <p className="eyebrow">TREINO ESCRITO</p>
        <h1>Questões discursivas</h1>
        <p>Esta modalidade não está disponível nesta etapa.</p>
      </div>
    </header>
    <div className="panel module-hold discursive-hold">
      <span><Icon name="bloqueado" /></span>
      <h2>Área temporariamente bloqueada</h2>
      <p>As questões discursivas permanecerão fechadas enquanto o banco de questões objetivas e as revisões espaçadas forem consolidados.</p>
      <small>Nenhuma questão discursiva será criada ou exibida agora.</small>
    </div>
  </section>
}
