import Icon from './Icon.jsx'

export default function DiscursiveQuestions() {
  return <section>
    <header className="page-title compact">
      <div>
        <p className="eyebrow">TREINO ESCRITO</p>
        <h1>Questões discursivas</h1>
        <p>Área preparada para respostas escritas com padrão de resposta e correção comentada.</p>
      </div>
    </header>
    <div className="panel module-hold discursive-hold">
      <span><Icon name="discursivas" /></span>
      <h2>Estrutura pronta</h2>
      <p>O banco de questões discursivas será criado em uma etapa posterior. Cada item terá proposta, limite de resposta, padrão esperado, critérios de correção e comentário final.</p>
      <small>Nenhuma questão discursiva foi gerada nesta etapa.</small>
    </div>
  </section>
}
