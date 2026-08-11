export function normalizeStrategyText(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

const PACKAGE_SUBJECT = {
  '0f62a2ad': 'Arquivologia',
  '2bd2158c': 'Ética na Administração Pública',
  '576a47da': 'Noções de Informática',
  '5dfff807': 'Administração Geral',
  '79918b2b': 'Direito Constitucional',
  '8093d0d0': 'Português',
  '8815a19a': 'Administração de Recursos Materiais',
  '8a3ddcb7': 'Gestão de Pessoas',
  '9c1f14ec': 'Direito Administrativo',
  'd5e20f19': 'Contabilidade Geral',
  'd746c4ea': 'Raciocínio Lógico',
}

export function subjectForStrategyDocument(relativePath) {
  const normalized = normalizeStrategyText(relativePath)
  const packageKey = Object.keys(PACKAGE_SUBJECT).find((key) => normalized.includes(key))
  let subject = PACKAGE_SUBJECT[packageKey]
  if (packageKey === '2bd2158c' && normalized.includes('improbidade')) subject = 'Direito Administrativo'
  if (packageKey === '5dfff807' && (normalized.includes('conceito e evolucao do estado') || normalized.includes('governabilidade governanca accountability'))) subject = 'Administração Pública'
  if (packageKey === '8a3ddcb7' && (normalized.includes('reformas administrativas') || normalized.includes('modelos teoricos de administracao publica'))) subject = 'Administração Pública'
  return subject
}

const sources = {
  'Português|Ortografia': ['ortografia e acentuacao', 'semantica geral'],
  'Português|Morfologia': ['formacao de palavras', 'classes i', 'classes de palavras ii', 'classes de palavras iii', 'classes de palavras iv'],
  'Português|Morfologia - Verbos': ['classes de palavras ii', 'classes de palavras iii', 'classes de palavras iv', 'correlacao verbal e vozes verbais'],
  'Português|Morfologia - Pronomes': ['classes i', 'classes de palavras ii', 'classes de palavras iii', 'colocacao pronominal'],
  'Português|Sintaxe': ['sintaxe da oracao', 'sintaxe do periodo', 'concordancia', 'regencia verbal e nominal', 'crase'],
  'Português|Pontuação': ['pontuacao', 'coesao e coerencia'],
  'Português|Interpretação de Textos': ['interpretacao de textos', 'tipologia textual', 'coesao e coerencia', 'variacao linguistica'],

  'Direito Constitucional|Teoria da Constituição': ['teoria geral da constituicao'],
  'Direito Constitucional|Princípios Fundamentais da República': ['principios fundamentais'],
  'Direito Constitucional|Teoria dos Direitos Fundamentais': ['teoria geral dos direitos fundamentais'],
  'Direito Constitucional|Direitos Individuais': ['direitos e garantias fundamentais direitos e deveres individuais'],
  'Direito Constitucional|Direitos Individuais - Remédios Constitucionais e Garantias Processuais': ['direitos e garantias fundamentais direitos e deveres individuais'],
  'Direito Constitucional|Direitos Sociais': ['direitos e garantias fundamentais'],
  'Direito Constitucional|Administração Pública - Disposições Gerais e Servidores Públicos': ['administracao publica'],
  'Direito Constitucional|Organização dos Poderes': ['poder legislativo', 'poder executivo', 'poder judiciario', 'processo legislativo'],
  'Direito Constitucional|Poder Legislativo': ['poder legislativo', 'processo legislativo'],
  'Direito Constitucional|Poder Executivo': ['poder executivo'],
  'Direito Constitucional|Poder Judiciário': ['poder judiciario'],
  'Direito Constitucional|Organização do Poder Judiciário': ['poder judiciario'],

  'Direito Administrativo|Regime jurídico administrativo': ['atos administrativos'],
  'Direito Administrativo|Atos administrativos': ['atos administrativos'],
  'Direito Administrativo|Serviços Públicos': [],
  'Direito Administrativo|Agentes públicos e Lei 8.112 de 1990': ['lei 8 112'],
  'Direito Administrativo|Improbidade administrativa - Lei nº 8.429 de 1992 e Lei nº 14.230 de 2021': ['improbidade administrativa', 'lei no 8 429'],
  'Direito Administrativo|Licitações e Lei 8.666 de 1993.': [],

  'Administração Pública|Organização e Estrutura do Estado, Governo e Administração': ['conceito e evolucao do estado', 'modelos teoricos de administracao publica', 'reformas administrativas'],
  'Administração Pública|Gestão de Políticas Públicas': [],
  'Administração Pública|Governabilidade, Governança e Accountability': ['governabilidade governanca accountability'],
  'Administração Pública|Modelos teóricos de Administração Pública': ['modelos teoricos de administracao publica', 'reformas administrativas'],

  'Administração Geral|Gestão Estratégica': ['planejamento ferramentas estrategicas', 'planejamento parte i'],
  'Administração Geral|Organizações, Sistemas e Métodos': ['organizacao', 'conceitos introdutorios'],

  'Ética na Administração Pública|Introdução, Ética e Moral e Orientações Gerais': ['etica moral valores e virtudes'],
  'Ética na Administração Pública|Código de Ética Profissional do Servidor Público Civil do Poder Executivo Federal - Decreto nº 1.171 de 1994': ['codigo de etica profissional'],

  'Noções de Informática|Sistema Operacional': ['sistemas operacionais windows', 'sistemas operacionais linux'],
  'Noções de Informática|Windows Explorer - conceitos de organização de pastas e arquivos': ['sistemas operacionais windows'],
  'Noções de Informática|Editor de Textos - Microsoft Word e BrOffice.org Writer': [],
  'Noções de Informática|Redes de Computadores': ['redes de computadores'],
  'Noções de Informática|Internet': ['redes de computadores', 'intranet x extranet', 'computacao em nuvem'],
  'Noções de Informática|Segurança da Informação': ['seguranca da informacao', 'nocoes iniciais de seguranca'],
  'Noções de Informática|Navegadores (Browser)': [],
  'Noções de Informática|Correio Eletrônico (cliente de e-mail e webmail)': [],

  'Raciocínio Lógico|Fundamentos de Lógica': ['estruturas logicas', 'logica de primeira ordem'],
  'Raciocínio Lógico|Equivalência Lógica e Negação de Proposições': ['equivalencias logicas'],
  'Raciocínio Lógico|Lógica de Argumentação - Diagramas e Operadores Lógicos': ['logica de argumentacao', 'diagramas logicos', 'logica de primeira ordem'],
  'Raciocínio Lógico|Diagramas de Venn (Conjuntos)': ['teoria dos conjuntos', 'diagramas logicos'],
  'Raciocínio Lógico|Probabilidade': [],
  'Raciocínio Lógico|Problemas Lógicos Com Dados, Figuras e Palitos': [],
  'Raciocínio Lógico|Problemas Lógicos': ['estruturas logicas', 'sistemas lineares'],
  'Raciocínio Lógico|Raciocínio Matemático': ['sistemas lineares', 'matrizes e determinantes', 'teoria dos conjuntos'],

  'Contabilidade Geral|Contabilidade - Noções Gerais': ['aspectos introdutorios', 'contas fgv', 'patrimonio fgv', 'escrituracao', 'atos e fatos', 'cpc 00'],
  'Contabilidade Geral|Balanço Patrimonial': ['balanco patrimonial', 'cpc 25', 'cpc 27', 'cpc 04', 'cpc 18'],
  'Contabilidade Geral|Demonstração do Resultado do Exercício': ['demonstracao do resultado do exercicio'],
  'Contabilidade Geral|Outras Demonstrações': ['dmpl', 'cpc 26'],
  'Contabilidade Geral|Demonstração dos Fluxos de Caixa - DFC': ['demonstracao dos fluxos de caixas'],
  'Contabilidade Geral|Demonstração do Valor Adicionado - DVA': ['demonstracao do valor adicionado'],

  'Administração de Recursos Materiais|Administração de Estoques': ['gestao de estoques', 'conceitos de estoques'],
  'Administração de Recursos Materiais|Conceitos Básicos na Administração de Recursos Materiais': ['administracao de recursos materiais'],
  'Administração de Recursos Materiais|Classificação de Materiais': ['classificacao de materiais'],
  'Administração de Recursos Materiais|Administração de Compras': ['compras'],
  'Administração de Recursos Materiais|Armazenagem': ['logistica e supply chain', 'gestao de estoques'],
  'Administração de Recursos Materiais|Administração Patrimonial': ['administracao de recursos patrimoniais'],

  'Gestão de Pessoas|Agregando Pessoas': ['recrutamento e selecao'],
  'Gestão de Pessoas|Desenvolvendo Pessoas': ['treinamento e desenvolvimento'],
  'Gestão de Pessoas|Remuneração e Benefícios': ['remuneracao salarios beneficios'],
  'Gestão de Pessoas|Desenho de Cargos': ['analise e descricao de cargos'],
  'Gestão de Pessoas|Gestão de Competências': ['gestao por competencias'],
  'Gestão de Pessoas|Comportamento de Pessoas nas Organizações': ['motivacao', 'comunicacao', 'cultura e clima', 'direcao lideranca', 'gestao do desempenho', 'gestao de pessoas objetivos'],
  'Gestão de Pessoas|Gestão Participativa e Trabalho em Equipe': ['trabalho em equipe grupos'],
  'Gestão de Pessoas|Qualidade de vida no trabalho': ['qualidade de vida no trabalho'],

  'Arquivologia|Conceitos Fundamentais': ['conceitos fundamentais de arquivologia', 'documentos arquivisticos', 'ciclo vital dos documentos', 'sistemas e metodos de arquivamento'],
  'Arquivologia|Gestão de Documentos / Arquivos Corrente e Intermediário': ['gestao de documentos e arquivo corrente', 'atividades de protocolo', 'arquivo intermediario', 'ciclo vital dos documentos'],
}

export function sourcePatternsForTopic(subject, topic) {
  return sources[`${subject}|${topic}`] || []
}

export function matchesStrategyTopic(documentPath, subject, topic) {
  const normalized = normalizeStrategyText(documentPath)
  return sourcePatternsForTopic(subject, topic).some((pattern) => normalized.includes(normalizeStrategyText(pattern)))
}

export const STRATEGY_TOPIC_SOURCE_MAP = sources
