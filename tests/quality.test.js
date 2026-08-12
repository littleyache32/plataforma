import { describe, expect, it } from 'vitest'
import { auditQuestion } from '../shared/question-quality.js'
import { auditCard, inferCardType } from '../shared/card-quality.js'
import { buildEfficientCardContent } from '../shared/card-content.js'

describe('auditoria do acervo', () => {
  it('aprova questão CE completa e vinculada à evidência', () => {
    const result = auditQuestion({ tipo: 'CE', enunciado: 'A Constituição Federal protege a liberdade de expressão.', alternativas: null, gabarito: 'C', explicacao: 'A liberdade de expressão integra o conjunto de direitos fundamentais.', fonte: 'Constituição Federal, artigo 5º.', trecho_fonte: 'O artigo 5º da Constituição protege direitos fundamentais e a liberdade de expressão.', dificuldade: 2 })
    expect(result.approved).toBe(true)
  })
  it('arquiva múltipla escolha com alternativas duplicadas', () => {
    const result = auditQuestion({ tipo: 'ME', enunciado: 'Assinale a alternativa correta acerca do conteúdo apresentado.', alternativas: { A: 'igual', B: 'igual', C: 'três', D: 'quatro', E: 'cinco' }, gabarito: 'C', explicacao: 'A alternativa C corresponde ao fundamento apresentado.', fonte: 'Fonte oficial completa', trecho_fonte: 'O fundamento apresentado estabelece de forma expressa que a terceira alternativa é a adequada.', dificuldade: 3 })
    expect(result.reasons).toContain('alternativas_duplicadas')
  })
  it('reconhece cards de distinção e exige fonte', () => {
    expect(inferCardType({ frente: 'Qual a diferença entre eficiência e eficácia?' })).toBe('distincao')
    expect(auditCard({ frente: 'Qual a diferença entre eficiência e eficácia?', verso: 'Eficiência otimiza recursos; eficácia alcança o resultado.', fonte: '', trecho_fonte: 'Texto suficientemente longo para servir como evidência rastreável.' }).approved).toBe(false)
  })
  it('estrutura card atômico com contexto, escopo, resposta direta e explicação', () => {
    const card = buildEfficientCardContent('A taxa Selic provoca redução da inflação.', 'Política monetária')
    expect(card.frente).toContain('[Política monetária]')
    expect(card.frente).toContain('(efeito principal)')
    expect(card.respostaDireta).toBe('redução da inflação')
    expect(card.explicacaoCurta).toBe('A taxa Selic provoca redução da inflação.')
    expect(card.modeloCard).toBe('causa_efeito')
  })
})
