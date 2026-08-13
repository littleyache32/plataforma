export const DEFAULT_MENTOR_POLICY = Object.freeze({
  versao: '2026.08.2',
  amostra_minima: 20,
  janela_maxima: 60,
  meia_vida_recencia_dias: 21,
  prior_beta: { acertos: 2, erros: 2 },
  limiares: {
    dominio: 0.68,
    falsa_certeza: 0.12,
    melhora_recente: 0.2,
  },
  pesos_confianca: {
    certeza: { acerto: 1.35, erro: 2.2 },
    duvida: { acerto: 0.9, erro: 1.1 },
    eliminacao: { acerto: 1.05, erro: 1.2 },
    sem_conhecimento: { acerto: 0.65, erro: 1.4 },
  },
  fase_inicial: {
    inicio: '2026-08-17',
    fim: '2026-08-30',
    bacen_minutos_diarios: 180,
    faculdade_minutos_segunda_quinta: 60,
    question_cards_faculdade_dias: [5, 6],
    question_cards_faculdade_minutos: 30,
    questoes_bacen: false,
    question_cards_bacen: false,
    simulados: false,
  },
  aprendizagem: {
    sequencia: ['aquisicao', 'recuperacao', 'aplicacao', 'correcao', 'reteste', 'transferencia_para_prova'],
    desbloqueio_pratica: 'topico_estudado',
    inicio_pratica_bacen: '2026-08-31',
    preservar_revisoes_anteriores: true,
    evitar_topico_avancado_nao_estudado: true,
  },
  agenda_faculdade: [
    { dia: 0, duracao: 60, aliases: ['direito das pessoas e dos negocios juridicos', 'pessoas e negocios juridicos'] },
    { dia: 1, duracao: 60, aliases: ['teoria do crime'] },
    { dia: 2, duracao: 60, aliases: ['teorias da justica', 'teoria da justica'] },
    { dia: 3, duracao: 60, aliases: ['teoria da constituicao e direitos fundamentais', 'teorias da constituicao', 'teoria da constituicao'] },
  ],
})

export function resolveMentorPolicy(policy = {}) {
  return {
    ...DEFAULT_MENTOR_POLICY,
    ...policy,
    prior_beta: { ...DEFAULT_MENTOR_POLICY.prior_beta, ...(policy.prior_beta || {}) },
    limiares: { ...DEFAULT_MENTOR_POLICY.limiares, ...(policy.limiares || {}) },
    pesos_confianca: { ...DEFAULT_MENTOR_POLICY.pesos_confianca, ...(policy.pesos_confianca || {}) },
    fase_inicial: { ...DEFAULT_MENTOR_POLICY.fase_inicial, ...(policy.fase_inicial || {}) },
    aprendizagem: { ...DEFAULT_MENTOR_POLICY.aprendizagem, ...(policy.aprendizagem || {}) },
    agenda_faculdade: Array.isArray(policy.agenda_faculdade) ? policy.agenda_faculdade : DEFAULT_MENTOR_POLICY.agenda_faculdade,
  }
}
