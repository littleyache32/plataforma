import { describe, expect, it } from 'vitest'
import { questionReviewEvidence, cardReviewEvidence, contentReviewEvidence } from '../shared/review-v2-evidence.js'

const corte = '2026-10-07T15:00:00Z'
const registro = { id: 'r', questao_id: 'q', resultado: 'erro', classificacao: 'certeza', criado_em: '2026-10-06T15:00:00Z' }
const questao = { id: 'q', topico_id: 't' }
const question = (extra = {}) => questionReviewEvidence({ registro, questao, corte, ...extra })
const event = (entidade, id, observado_em) => ({ material_id: 'm', referencia: { entidade, id }, observado_em })

describe('Fase 4.2, evidências observacionais de revisão', () => {
  it.each(['sem_conhecimento', 'eliminacao', 'duvida', 'certeza'])('preserva %s sem prioridade automática', (classificacao) => {
    const result = question({ registro: { ...registro, classificacao } })
    expect(result.observacoes.confianca).toBe(classificacao)
    expect(result.autoriza_decisao).toBe(false)
    expect(result).not.toHaveProperty('prioridade')
    expect(result).not.toHaveProperty('agendada_para')
  })
  it.each(['erro', 'acerto'])('resultado %s não implica domínio', (resultado) => {
    const result = question({ registro: { ...registro, resultado } })
    expect(result.observacoes.resultado).toBe(resultado)
    expect(result.observacoes.falsa_certeza).toBe(resultado === 'erro')
    expect(result).not.toHaveProperty('dominio')
  })
  it('confiança ausente é desconhecida, não falsa certeza ou falta de conhecimento', () => {
    const result = question({ registro: { ...registro, classificacao: null } })
    expect(result.observacoes).toMatchObject({ confianca: null, falsa_certeza: null, tipo_tentativa: 'UNKNOWN' })
  })
  it('recência usa corte explícito e referências canônicas', () => {
    const result = question()
    expect(result.observacoes.recencia.segundos_desde_observacao).toBe(86400)
    expect(result.alvo.topico_id).toBe('t')
    expect(result.fontes).toContainEqual({ entidade: 'registro', id: 'r' })
  })
  it.each(['REPETICAO', 'RETESTE'])('%s exige contexto explícito e mantém erro-alvo', (tipo) => {
    const result = question({ contexto: { tipo, referencia: { entidade: 'revisao_item', id: 'need' } }, erroAlvo: { ...registro, id: 'earlier-error' } })
    expect(result.observacoes.tipo_tentativa).toBe(tipo)
    expect(result.observacoes.erro_alvo.id).toBe('earlier-error')
    expect(() => question({ contexto: { tipo } })).toThrow('proveniência')
  })
  it('não transforma acerto em erro-alvo e rejeita tentativa de outra questão', () => {
    expect(() => question({ erroAlvo: { ...registro, resultado: 'acerto' } })).toThrow('erro factual')
    expect(() => question({ questao: { id: 'other' } })).toThrow('incompatíveis')
    expect(() => question({ contexto: { tipo: 'RETESTE', referencia: { entidade: 'texto_livre', id: 'x' } } })).toThrow('Origem')
  })
  it('card com vencimento não recebe estado FSRS fabricado', () => {
    const result = cardReviewEvidence({ card: { id: 'c', proxima_revisao: corte }, corte })
    expect(result.observacoes).toMatchObject({ vencido: true, historico_avaliacoes: null, recencia: null, estado_fsrs: { disponibilidade: 'NAO_IMPLEMENTADO', valor: null } })
    expect(result.autoriza_decisao).toBe(false)
    expect(cardReviewEvidence({ card: { id: 'c' }, corte }).observacoes.vencido).toBeNull()
    expect(cardReviewEvidence({ card: { id: 'c', proxima_revisao: '2030-01-01T15:00:00Z' }, corte }).observacoes.vencido).toBe(false)
  })
  it.each(['novamente', 'dificil', 'bom', 'facil', 'lembrei', 'revisar'])('avaliação %s permanece factual inclusive no legado', (resultado) => {
    const result = cardReviewEvidence({ card: { id: 'c' }, avaliacoes: [{ id: 'cr', question_card_id: 'c', resultado, criado_em: registro.criado_em }], corte })
    expect(result.observacoes.historico_avaliacoes[0].resultado).toBe(resultado)
    expect(result.observacoes.completude_historico).toBe('NAO_COMPROVADA')
  })
  it('não perde distinção entre histórico ausente e lista conhecida vazia', () => {
    expect(cardReviewEvidence({ card: { id: 'c' }, avaliacoes: [], corte }).observacoes.historico_avaliacoes).toEqual([])
  })
  it('rejeita duplicação e avaliações de outro card', () => {
    const row = { id: 'cr', question_card_id: 'c', resultado: 'bom' }
    expect(() => cardReviewEvidence({ card: { id: 'c' }, avaliacoes: [row, row], corte })).toThrow('duplicada')
    expect(() => cardReviewEvidence({ card: { id: 'other' }, avaliacoes: [row], corte })).toThrow('outro card')
  })
  it('conteúdo separa estudo, progresso e eventos posteriores sem inferir retenção', () => {
    const result = contentReviewEvidence({ material: { id: 'm' }, progresso: { material_id: 'm', estado: 'em_andamento' }, corte,
      estudos: [event('sessao', 's', '2026-10-05T15:00:00Z')],
      exposicoes: [event('tempo_estudo', 'time', '2026-10-06T15:00:00Z')],
      praticas: [event('registro', 'r', '2026-10-04T15:00:00Z')] })
    expect(result.observacoes.progresso.estado).toBe('em_andamento')
    expect(result.observacoes.exposicoes_posteriores[0].posterior_ao_ultimo_estudo).toBe(true)
    expect(result.observacoes.praticas_posteriores[0].posterior_ao_ultimo_estudo).toBe(false)
    expect(result).not.toHaveProperty('retencao')
  })
  it('ausência de estudo não significa que não houve prática ou que conteúdo está dominado', () => {
    const result = contentReviewEvidence({ material: { id: 'm' }, corte, praticas: [event('registro', 'r', registro.criado_em)] })
    expect(result.observacoes.ultimo_estudo_em).toBeNull()
    expect(result.observacoes.praticas_posteriores[0].posterior_ao_ultimo_estudo).toBeNull()
    expect(result.observacoes.progresso).toBeNull()
  })
  it('recusa vínculos de material incompatíveis e observações futuras ou sem fuso', () => {
    expect(() => contentReviewEvidence({ material: { id: 'm' }, progresso: { material_id: 'other' }, corte })).toThrow('outro material')
    expect(() => question({ registro: { ...registro, criado_em: '2026-10-08T15:00:00Z' } })).toThrow('posterior')
    expect(() => question({ corte: '2026-10-07T15:00:00' })).toThrow('fuso')
  })
  it('mesmos inputs produzem o mesmo envelope e não alteram fatos', () => {
    const before = structuredClone(registro)
    expect(question()).toEqual(question())
    expect(registro).toEqual(before)
  })
})
