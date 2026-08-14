import { readFile } from 'node:fs/promises'
import path from 'node:path'
import pg from 'pg'
import { auditQuestion, normalizeContent } from '../shared/question-quality.js'

const APPLY = process.argv.includes('--apply')
const REPORT = path.resolve('tmp/estrategia-2026-08-11/parsed/auditoria.json')
const VERSION = 'fontes-complementares-2026.08.14'
const connectionString = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL
if (!connectionString) throw new Error('POSTGRES_URL_NON_POOLING ou POSTGRES_URL nao configurada.')

const databaseUrl = new URL(connectionString)
databaseUrl.searchParams.delete('sslmode')
databaseUrl.searchParams.delete('sslrootcert')
const client = new pg.Client({ connectionString: databaseUrl.toString(), ssl: { rejectUnauthorized: false } })

const compact = (value) => String(value || '').replace(/\s+/g, ' ').trim()
const normalize = (value) => normalizeContent(value)
const letters = ['A', 'B', 'C', 'D', 'E']

const POLICY_SOURCE = 'Governo Federal, Avaliação de Políticas Públicas: https://www.gov.br/casacivil/pt-br/assuntos/governanca/avaliacao-de-politicas'
const POLICY_FACTS = [
  'A avaliação de políticas públicas é parte de uma estrutura de decisão baseada em evidências.',
  'A avaliação sistemática de políticas públicas permite verificar a eficiência dos recursos públicos.',
  'As avaliações de políticas públicas podem identificar possibilidades de aperfeiçoamento da ação estatal.',
  'A avaliação de políticas públicas deve ser integrada ao planejamento e à execução orçamentária e financeira.',
  'O monitoramento de políticas públicas inclui o acompanhamento do desempenho de ações prioritárias.',
  'A avaliação de uma política pública pode abranger sua concepção, sua implementação e seus resultados.',
  'A análise ex ante é realizada antes da implementação ou expansão de uma política pública.',
  'A análise ex post é realizada depois da implementação da política pública.',
  'A formulação de uma política pública inclui a delimitação do problema e do público-alvo.',
  'A implementação de uma política pública corresponde à execução das diretrizes, dos programas e das ações formuladas.',
  'O monitoramento é um acompanhamento regular da implementação com base em indicadores definidos.',
  'A avaliação pode subsidiar decisões sobre continuidade, modificação ou extinção de uma política pública.',
  'Um indicador de política pública permite acompanhar metas e resultados ao longo do tempo.',
  'O modelo lógico representa relações entre recursos, atividades, produtos, resultados e impactos de uma política.',
  'A efetividade de uma política pública corresponde ao alcance de mudanças relevantes na realidade social.',
  'A eficácia de uma política pública corresponde ao grau de alcance dos objetivos e resultados previstos.',
  'A eficiência de uma política pública considera a relação entre recursos empregados e resultados alcançados.',
  'A tomada de decisão sobre políticas públicas deve ser orientada por evidências e pela conformidade legal.',
]

const LAW_8666_SOURCE = 'Lei 8.666/1993, texto oficial histórico: https://www.planalto.gov.br/ccivil_03/leis/l8666cons.htm'
const LAW_8666_FACTS = [
  'A Lei 8.666 de 1993 estabelece normas gerais sobre licitações e contratos administrativos pertinentes a obras, serviços, compras, alienações e locações no âmbito dos Poderes da União, dos Estados, do Distrito Federal e dos Municípios.',
  'A licitação destina-se a garantir a observância do princípio constitucional da isonomia e a selecionar a proposta mais vantajosa para a Administração.',
  'O julgamento da licitação deve observar os princípios da legalidade, impessoalidade, moralidade, igualdade, publicidade, probidade administrativa, vinculação ao instrumento convocatório e julgamento objetivo.',
  'O projeto básico é um conjunto de elementos necessários e suficientes para caracterizar a obra ou o serviço objeto da licitação.',
  'O projeto executivo é o conjunto de elementos necessários e suficientes à execução completa da obra.',
  'A execução indireta pode ocorrer por empreitada por preço global, empreitada por preço unitário, tarefa ou empreitada integral.',
  'As compras públicas devem ser processadas por sistema de registro de preços quando for pertinente.',
  'O sistema de registro de preços deve ser precedido de ampla pesquisa de mercado.',
  'Concorrência, tomada de preços, convite, concurso e leilão são modalidades previstas na Lei 8.666 de 1993.',
  'Concorrência é a modalidade aberta a interessados que comprovem possuir os requisitos mínimos de qualificação exigidos no edital.',
  'Tomada de preços é a modalidade entre interessados cadastrados ou que atendam às condições para cadastramento até o prazo legal anterior ao recebimento das propostas.',
  'Convite é a modalidade entre interessados do ramo pertinente, cadastrados ou não, escolhidos e convidados em número mínimo previsto em lei.',
  'Concurso é a modalidade destinada à escolha de trabalho técnico, científico ou artístico mediante prêmio ou remuneração.',
  'Leilão é a modalidade destinada à venda de bens a quem oferecer o maior lance igual ou superior ao valor da avaliação.',
  'A licitação dispensada corresponde às hipóteses em que a própria lei determina a não realização do certame.',
  'A licitação dispensável permite que a Administração deixe de licitar nas hipóteses taxativamente previstas em lei.',
  'A inexigibilidade de licitação ocorre quando houver inviabilidade de competição.',
  'A habilitação pode incluir documentação relativa à habilitação jurídica, qualificação técnica, qualificação econômico-financeira e regularidade fiscal e trabalhista.',
  'O edital deve conter o objeto da licitação e as condições para participação no certame.',
  'A Administração deve cumprir as normas e condições do edital ao qual se encontra vinculada.',
  'O julgamento das propostas deve ser objetivo e realizado conforme os critérios previamente estabelecidos no ato convocatório.',
  'Menor preço, melhor técnica, técnica e preço e maior lance ou oferta são tipos de licitação previstos na Lei 8.666 de 1993.',
  'A autoridade competente pode anular a licitação por ilegalidade, de ofício ou por provocação de terceiros.',
  'A autoridade competente pode revogar a licitação por razões de interesse público decorrentes de fato superveniente devidamente comprovado.',
  'Os contratos administrativos regulados pela Lei 8.666 de 1993 devem estabelecer com clareza e precisão as condições para sua execução.',
  'O regime jurídico dos contratos administrativos confere à Administração a prerrogativa de modificá-los unilateralmente nos casos previstos em lei.',
  'A execução do contrato deve ser acompanhada e fiscalizada por representante da Administração especialmente designado.',
  'A inexecução total ou parcial do contrato pode acarretar sua rescisão e as consequências previstas em lei.',
  'Advertência, multa, suspensão temporária e declaração de inidoneidade são sanções administrativas previstas na Lei 8.666 de 1993.',
  'A declaração de nulidade do contrato administrativo opera retroativamente e impede os efeitos jurídicos que ele deveria produzir.',
]

const SERVICES_SOURCE = 'Lei 8.987/1995, texto oficial: https://www.planalto.gov.br/ccivil_03/leis/l8987compilada.htm'
const SERVICES_FACTS = [
  'Poder concedente é a União, o Estado, o Distrito Federal ou o Município em cuja competência se encontre o serviço público.',
  'A concessão de serviço público é uma delegação feita pelo poder concedente mediante licitação.',
  'A concessionária presta o serviço por sua conta e risco e por prazo determinado.',
  'A permissão de serviço público é uma delegação a título precário, mediante licitação.',
  'A permissão de serviço público pode ser outorgada a pessoa física ou jurídica que demonstre capacidade para seu desempenho.',
  'As concessões e permissões de serviços públicos sujeitam-se à fiscalização do poder concedente.',
  'A fiscalização das concessões e permissões pode contar com a cooperação dos usuários.',
  'A concessão de serviço público deve ser formalizada mediante contrato.',
  'O poder concedente deve publicar ato justificando a conveniência da outorga antes do edital de licitação.',
  'Toda concessão ou permissão pressupõe a prestação de serviço adequado ao pleno atendimento dos usuários.',
  'Serviço adequado é o que satisfaz regularidade, continuidade, eficiência, segurança, atualidade, generalidade, cortesia e modicidade tarifária.',
  'A atualidade do serviço inclui a modernidade das técnicas, dos equipamentos e das instalações.',
  'A atualidade do serviço inclui a conservação, a melhoria e a expansão do serviço.',
  'A interrupção do serviço em situação de emergência não caracteriza descontinuidade quando observadas as condições legais.',
  'O usuário pode receber do poder concedente e da concessionária informações para a defesa de interesses individuais ou coletivos.',
  'O usuário deve levar ao conhecimento do poder público e da concessionária irregularidades referentes ao serviço prestado.',
  'A tarifa do serviço público concedido é fixada pela proposta vencedora da licitação e preservada pelas regras de revisão previstas em lei e no contrato.',
  'O edital de concessão deve conter o objeto, as metas, o prazo e as condições da concessão.',
  'A concessionária deve prestar serviço adequado e manter em dia o inventário e o registro dos bens vinculados à concessão.',
  'A encampação é a retomada do serviço pelo poder concedente durante o prazo da concessão por motivo de interesse público.',
  'A caducidade pode ser declarada quando houver inexecução total ou parcial do contrato pela concessionária.',
  'A permissão de serviço público deve ser formalizada mediante contrato de adesão.',
]

const EMAIL_SOURCE = 'RFC Editor, protocolos de correio eletrônico: https://www.rfc-editor.org/rfc/rfc5321; https://www.rfc-editor.org/rfc/rfc9051; https://www.rfc-editor.org/rfc/rfc1939'
const EMAIL_FACTS = [
  'O SMTP é o protocolo utilizado para a transferência de mensagens de correio eletrônico entre sistemas.',
  'O IMAP permite acessar e manipular mensagens mantidas em um servidor de correio eletrônico.',
  'O POP3 permite que uma estação de trabalho acesse uma caixa postal mantida em um servidor.',
  'Um cliente de e-mail é um programa usado para compor, enviar, receber e organizar mensagens eletrônicas.',
  'Webmail é um serviço de correio eletrônico acessado por meio de um navegador web.',
  'O campo Para inclui os destinatários principais de uma mensagem eletrônica.',
  'O campo Cc permite enviar cópia visível de uma mensagem a outros destinatários.',
  'O campo Cco permite ocultar dos demais destinatários os endereços nele informados.',
  'Um anexo é um arquivo enviado junto com uma mensagem de correio eletrônico.',
  'Spam corresponde a mensagens eletrônicas não solicitadas enviadas em massa.',
  'Phishing é uma tentativa de obter dados sensíveis por meio de comunicações fraudulentas.',
  'Uma mensagem de phishing pode imitar a identidade visual de uma organização legítima.',
  'O endereço de correio eletrônico inclui uma parte local e um domínio separados pelo símbolo arroba.',
  'Responder a todos pode enviar a resposta ao remetente e aos demais destinatários visíveis da conversa.',
  'Encaminhar permite enviar a terceiros o conteúdo de uma mensagem recebida.',
  'Uma pasta de rascunhos pode armazenar mensagens que ainda não foram enviadas.',
  'A lixeira pode armazenar temporariamente mensagens excluídas antes da remoção definitiva.',
  'Uma assinatura de e-mail pode ser inserida automaticamente ao final de uma mensagem.',
  'Filtros de correio eletrônico podem organizar mensagens automaticamente conforme regras definidas.',
  'A autenticação multifator pode aumentar a proteção de uma conta de correio eletrônico.',
]

const BROWSER_SOURCE = 'Mozilla Support, navegação e privacidade: https://support.mozilla.org/pt-BR/products/firefox/privacy-and-security'
const BROWSER_FACTS = [
  'Um navegador web é um programa que permite acessar e exibir recursos disponíveis na web.',
  'A URL identifica a localização de um recurso acessível por uma rede.',
  'O protocolo HTTPS protege a comunicação entre navegador e servidor por meio de criptografia.',
  'O histórico do navegador registra páginas visitadas pelo usuário.',
  'O cache do navegador armazena cópias locais de recursos para acelerar carregamentos posteriores.',
  'Cookies são dados que sites podem armazenar no navegador para manter estado e preferências.',
  'A navegação privativa evita que o navegador preserve o histórico local depois do encerramento da sessão privativa.',
  'A navegação privativa não torna o usuário anônimo perante sites, provedor de internet ou rede institucional.',
  'Um favorito permite guardar o endereço de uma página para acesso posterior.',
  'Uma extensão pode adicionar funcionalidades ao navegador.',
  'A barra de endereços permite inserir uma URL e pode também realizar pesquisas.',
  'O botão atualizar permite solicitar novamente o carregamento da página atual.',
  'O botão voltar permite retornar a uma página anteriormente visitada na mesma aba.',
  'Uma aba permite manter mais de uma página aberta dentro da mesma janela do navegador.',
  'O gerenciador de downloads permite acompanhar arquivos obtidos por meio do navegador.',
  'A limpeza de dados de navegação pode remover histórico, cache e cookies selecionados.',
  'O bloqueio de pop-ups pode impedir a abertura automática de determinadas janelas.',
  'Certificados digitais são usados pelo HTTPS para ajudar a autenticar a identidade do servidor.',
  'JavaScript é uma linguagem que navegadores podem executar para produzir comportamento dinâmico em páginas.',
  'As ferramentas de desenvolvedor permitem inspecionar elementos, requisições e scripts de uma página.',
  'A página inicial é o endereço configurado para ser aberto ao iniciar o navegador ou ao acionar o comando correspondente.',
  'Um mecanismo de pesquisa permite localizar páginas da web a partir de termos informados pelo usuário.',
]

const GAP_SPECS = {
  'Administração Pública|Gestão de Políticas Públicas': {
    target: 43,
    officialFacts: POLICY_FACTS.map((text) => ({ text, source: POLICY_SOURCE })),
    files: ['governabilidade', 'reformas administrativas', 'conceito e evolucao do estado'],
    terms: ['politica publica', 'politicas publicas', 'programa publico', 'programas publicos', 'ciclo de politicas', 'avaliacao de politicas', 'implementacao de politicas'],
    reject: /chefia de estado|chefia de governo|presidente da republica/,
  },
  'Direito Administrativo|Licitações e Lei 8.666 de 1993.': {
    target: 73,
    officialFacts: LAW_8666_FACTS.map((text) => ({ text, source: LAW_8666_SOURCE })),
    files: ['compras', 'atos administrativos', 'lei 8 429'],
    terms: ['licit', 'edital', 'certame', 'pregao', 'dispensa', 'inexigibilidade', 'lei 8.666'],
    reject: /solicitacao de compras|comprador|materiais produtivos|licitacao eletronica|preco duas vezes|fornecedores e recebimento/,
  },
  'Direito Administrativo|Serviços Públicos': {
    target: 53,
    officialFacts: SERVICES_FACTS.map((text) => ({ text, source: SERVICES_SOURCE })),
    files: ['administracao publica', 'modelos teoricos de administracao publica', 'atos administrativos'],
    terms: ['servico publico', 'servicos publicos', 'concessao de servico', 'permissao de servico', 'delegacao de servico'],
    reject: /receita federal|delegacias|superintendencias|descentralizacao administrativa/,
  },
  'Noções de Informática|Correio Eletrônico (cliente de e-mail e webmail)': {
    target: 49,
    officialFacts: EMAIL_FACTS.map((text) => ({ text, source: EMAIL_SOURCE })),
    files: ['seguranca da informacao', 'redes de computadores', 'computacao em nuvem'],
    terms: ['correio eletronico', 'email', 'e mail', 'smtp', 'pop3', 'imap', 'phishing', 'spam', 'mensagem eletronica', 'anexo'],
    reject: /letra [a-e]|alternativa|chamados de de spam/,
  },
  'Noções de Informática|Navegadores (Browser)': {
    target: 47,
    officialFacts: BROWSER_FACTS.map((text) => ({ text, source: BROWSER_SOURCE })),
    files: ['redes de computadores', 'seguranca da informacao', 'computacao em nuvem', 'sistemas operacionais'],
    terms: ['navegador', 'browser', 'cookie', 'cache', 'historico', 'url', 'http', 'https', 'chrome', 'firefox'],
    reject: /esse navegador|flash por padrao|microsoft pay|leitor de e-book|mais perto de navegadores modernos/,
  },
}

const WORD_KEY = 'Noções de Informática|Editor de Textos - Microsoft Word e BrOffice.org Writer'
const PROBABILITY_KEY = 'Raciocínio Lógico|Probabilidade'
const PUZZLES_KEY = 'Raciocínio Lógico|Problemas Lógicos Com Dados, Figuras e Palitos'

const WORD_FACTS = [
  ['O Microsoft Word permite criar documentos a partir de um documento em branco ou de modelos.', 'https://support.microsoft.com/pt-br/word/training/create-a-document-in-word'],
  ['No Word, a guia Arquivo reúne comandos relacionados à criação, abertura, salvamento e impressão de documentos.', 'https://support.microsoft.com/pt-br/word/'],
  ['O recurso Controlar Alterações registra as modificações realizadas durante a revisão colaborativa de um documento.', 'https://support.microsoft.com/pt-br/office/o-que-%C3%A9-o-word-68d147fc-69f6-4339-b2c7-8a7ee9d81be3'],
  ['O Word permite inserir texto, imagens e outros elementos em documentos.', 'https://support.microsoft.com/pt-br/word/training/create-a-document-in-word'],
  ['O Word pode salvar documentos no OneDrive para permitir acesso por diferentes dispositivos.', 'https://support.microsoft.com/pt-br/office/o-que-%C3%A9-o-word-68d147fc-69f6-4339-b2c7-8a7ee9d81be3'],
  ['O LibreOffice Writer pode salvar documentos no formato ODF, em formato do Microsoft Word, em HTML e também exportá-los para PDF.', 'https://help.libreoffice.org/latest/pt-BR/text/swriter/main0503.html?DbPAR=WRITER'],
  ['O Writer permite produzir documentos com figuras, tabelas e gráficos.', 'https://help.libreoffice.org/latest/pt-BR/text/swriter/main0503.html?DbPAR=WRITER'],
  ['O Writer oferece verificação ortográfica, dicionário de sinônimos, autocorreção e hifenização.', 'https://help.libreoffice.org/latest/pt-BR/text/swriter/main0503.html?DbPAR=WRITER'],
  ['No Writer, estilos podem ser usados para formatar parágrafos, caracteres, quadros e páginas.', 'https://help.libreoffice.org/latest/pt-BR/text/swriter/main0503.html?DbPAR=WRITER'],
  ['O Navegador do Writer permite percorrer a estrutura do documento e acompanhar objetos inseridos.', 'https://help.libreoffice.org/latest/pt-BR/text/swriter/main0503.html?DbPAR=WRITER'],
  ['O Writer permite criar índices e sumários configuráveis.', 'https://help.libreoffice.org/latest/pt-BR/text/swriter/main0503.html?DbPAR=WRITER'],
  ['Hiperlinks e marcadores ativos do Writer podem levar diretamente a itens correspondentes no documento.', 'https://help.libreoffice.org/latest/pt-BR/text/swriter/main0503.html?DbPAR=WRITER'],
  ['O Writer permite utilizar leiautes com múltiplas colunas, quadros, figuras e tabelas.', 'https://help.libreoffice.org/latest/pt-BR/text/swriter/main0503.html?DbPAR=WRITER'],
  ['O recurso de arrastar e soltar do Writer pode mover objetos no mesmo documento ou entre documentos abertos.', 'https://help.libreoffice.org/latest/pt-BR/text/swriter/main0503.html?DbPAR=WRITER'],
  ['O Writer possui ferramentas para registrar e exibir alterações durante a revisão do texto.', 'https://help.libreoffice.org/latest/pt-BR/text/swriter/guide/main.html?DbPAR=BASE&System=WIN'],
  ['O Writer permite inserir e modificar tabelas, incluindo mesclar e dividir células.', 'https://help.libreoffice.org/latest/pt-BR/text/swriter/guide/main.html?DbPAR=BASE&System=WIN'],
  ['O Writer permite salvar documentos de texto em formato HTML.', 'https://help.libreoffice.org/latest/pt-BR/text/swriter/guide/main.html?DbPAR=BASE&System=WIN'],
  ['O Writer dispõe de ferramentas para localizar conteúdo por meio de expressões regulares.', 'https://help.libreoffice.org/latest/pt-BR/text/swriter/guide/main.html?DbPAR=BASE&System=WIN'],
  ['O Word permite compartilhar documentos e colaborar com outras pessoas.', 'https://support.microsoft.com/pt-br/word/training/create-a-document-in-word'],
  ['No Word, modelos podem ser pesquisados na criação de um novo documento.', 'https://support.microsoft.com/pt-br/word/training/create-a-document-in-word'],
  ['O Word oferece recursos de formatação de texto, configuração de página, imagens, salvamento e impressão.', 'https://support.microsoft.com/pt-br/word/'],
]

function pagesFromText(text) {
  return String(text).split(/\n\s*--- PAGINA \d+ DE \d+ ---\s*\n/g).map((content, index) => ({ page: index + 1, content }))
}

function validClaim(value) {
  const text = compact(value).replace(/^[-•▪◦]+\s*/, '').replace(/^\[\d+\]\s*/, '').replace(/^[a-z]\)\s*/i, '')
  if (text.length < 65 || text.length > 500 || !/[.]$/.test(text)) return null
  if (/\.{3,}/.test(text)) return null
  if (/[?]/.test(text) || /\b(questão|questões|gabarito|alternativa|assinale|professor|aula|aluno)\b/i.test(text)) return null
  if (/\b(eu|meu|minha|nós|vamos|novinho)\b/i.test(text)) return null
  if (/^(dizemos|já vimos|como vimos|perceba|observe|atenção|veja bem)\b/i.test(text)) return null
  if (/\b(em regra porque|mais perto de navegadores modernos)\b/i.test(text)) return null
  if (/\b(letra [a-e]|etc\.)$/i.test(text)) return null
  if (/https?:|www\.|estratégia concursos/i.test(text)) return null
  return text
}

function extractClaims(document, terms) {
  const normalizedTerms = terms.map(normalize)
  const claims = []
  for (const page of pagesFromText(document.text)) {
    if (page.page <= 5) continue
    const fragments = page.content.split(/(?<=[.!?;:])\s+|\n{2,}/)
    for (const fragment of fragments) {
      const text = validClaim(fragment)
      if (!text) continue
      const normalized = normalize(text)
      if (!normalizedTerms.some((term) => normalized.includes(term))) continue
      claims.push({ text, page: page.page, document })
    }
  }
  return [...new Map(claims.map((claim) => [normalize(claim.text), claim])).values()]
}

function negate(value) {
  const verbs = /(\s)(é|são|representa|representam|consiste|consistem|corresponde|correspondem|abrange|abrangem|inclui|incluem|permite|permitem|exige|exigem|possui|possuem|pode|podem|deve|devem)(?=\s)/i
  const match = compact(value).match(verbs)
  if (!match) return null
  return compact(value).replace(verbs, `$1não $2`)
}

function difficultyFor(index, target) {
  const easy = Math.round(target * 0.6)
  const medium = easy + Math.round(target * 0.3)
  return index < easy ? (index % 2) + 1 : index < medium ? 3 : (index % 2) + 4
}

function ceQuestion(topic, fact, index, target, correct = true) {
  const falseText = negate(fact.text)
  if (!correct && !falseText) throw new Error(`Não foi possível criar item falso verificável: ${fact.text}`)
  const statement = correct ? fact.text : falseText
  return {
    topico_id: topic.id, tipo: 'CE',
    enunciado: `A respeito de ${topic.topico}, julgue o item: ${statement}`,
    alternativas: null, gabarito: correct ? 'C' : 'E',
    explicacao: correct ? `O item reproduz corretamente a fonte: ${fact.text}` : `O item está errado porque inseriu uma negação que modifica a fonte: ${fact.text}`,
    fonte: fact.source, trecho_fonte: fact.text, origem: 'material',
    dificuldade: difficultyFor(index, target), comentarios_alternativas: null, versao_conhecimento: VERSION,
  }
}

function meQuestion(topic, facts, index, target, difficultyIndex = index) {
  const answerIndex = index % 5
  const negatableFacts = facts.filter((fact) => negate(fact.text))
  const base = negatableFacts[index % negatableFacts.length]
  if (!base) throw new Error(`Nenhum fato admite uma alternativa incorreta verificável em ${topic.topico}.`)
  const falseText = negate(base.text)
  const selected = []
  for (let offset = 1; selected.length < 4 && offset < facts.length * 2; offset += 1) {
    const candidate = facts[(index + offset) % facts.length]
    if (normalize(candidate.text) === normalize(base.text) || selected.some((item) => normalize(item.text) === normalize(candidate.text))) continue
    selected.push(candidate)
  }
  if (selected.length < 4) return ceQuestion(topic, base, index, target, true)
  const alternativas = {}
  const comentarios = {}
  let cursor = 0
  for (let position = 0; position < 5; position += 1) {
    const letter = letters[position]
    if (position === answerIndex) {
      alternativas[letter] = falseText
      comentarios[letter] = `Incorreta. A fonte afirma: ${base.text}`
    } else {
      alternativas[letter] = selected[cursor].text
      comentarios[letter] = `Correta conforme: ${selected[cursor].source}`
      cursor += 1
    }
  }
  return {
    topico_id: topic.id, tipo: 'ME', enunciado: `A fonte registra a afirmação "${base.text}". Entre as alternativas sobre ${topic.topico}, assinale aquela que contradiz esse registro.`,
    alternativas, gabarito: letters[answerIndex],
    explicacao: `A alternativa ${letters[answerIndex]} é incorreta porque altera por negação o seguinte conteúdo: ${base.text}`,
    fonte: [...new Set([base, ...selected].map((fact) => fact.source))].join('; '),
    trecho_fonte: [base, ...selected].map((fact) => `[${fact.source}] ${fact.text}`).join('\n'), origem: 'material',
    dificuldade: difficultyFor(difficultyIndex, target), comentarios_alternativas: comentarios, versao_conhecimento: VERSION,
  }
}

function factualQuestions(topic, facts, target) {
  if (facts.length < 12) throw new Error(`Fontes factuais insuficientes em ${topic.materia} > ${topic.topico}: ${facts.length}.`)
  const ceCandidates = [...new Map(facts.flatMap((fact) => [
    { fact, correct: true },
    ...(negate(fact.text) ? [{ fact, correct: false }] : []),
  ]).map((candidate) => [normalize(candidate.correct ? candidate.fact.text : negate(candidate.fact.text)), candidate])).values()]
  const questions = []
  let ceCursor = 0
  let meCursor = 0
  for (let index = 0; index < target; index += 1) {
    const isMultipleChoice = index % 4 === 3
    const candidate = ceCandidates[ceCursor % ceCandidates.length]
    const question = isMultipleChoice
      ? meQuestion(topic, facts, meCursor, target, index)
      : ceQuestion(topic, candidate.fact, index, target, candidate.correct)
    if (isMultipleChoice) meCursor += 1
    else ceCursor += 1
    if (questions.some((item) => normalize(item.enunciado) === normalize(question.enunciado))) throw new Error(`Questão repetida em ${topic.topico} (fatos=${facts.length}, candidatos_ce=${ceCandidates.length}): ${question.enunciado}`)
    questions.push(question)
  }
  return questions
}

function probabilityQuestions(topic, target) {
  const source = 'OpenStax, Introductory Statistics, seção 3.1: https://openstax.org/books/introductory-statistics/pages/3-1-terminology'
  const evidence = 'Em resultados equiprováveis, a probabilidade de um evento é o número de resultados favoráveis dividido pelo total de resultados do espaço amostral; a probabilidade do complemento é 1 menos a probabilidade do evento.'
  const questions = []
  for (let index = 0; index < target; index += 1) {
    const sides = 6 + index
    const favorable = 1 + ((index * 3) % (sides - 1))
    const outcomeLabel = favorable === 1 ? 'resultado favorável' : 'resultados favoráveis'
    const numerator = index % 4 === 0 ? sides - favorable : favorable
    const correctValue = numerator / sides
    const shownValue = index % 2 === 0 ? correctValue : Math.min(1, correctValue + 1 / sides)
    const isComplement = index % 4 === 0
    if (index % 5 !== 4) {
      questions.push({
        topico_id: topic.id, tipo: 'CE',
        enunciado: `Em um experimento com ${sides} resultados equiprováveis, um evento possui ${favorable} ${outcomeLabel}. ${isComplement ? 'A probabilidade do complemento desse evento' : 'A probabilidade desse evento'} é ${shownValue.toFixed(3)}. Julgue o item.`,
        alternativas: null, gabarito: Math.abs(shownValue - correctValue) < 0.0001 ? 'C' : 'E',
        explicacao: `${isComplement ? 'P(A complementar) = 1 - P(A)' : 'P(A) = casos favoráveis / casos possíveis'}. O resultado correto é ${numerator}/${sides} = ${correctValue.toFixed(3)}.`,
        fonte: source, trecho_fonte: evidence, origem: 'material', dificuldade: difficultyFor(index, target), comentarios_alternativas: null, versao_conhecimento: VERSION,
      })
    } else {
      const eventValue = favorable / sides
      const values = [eventValue, (favorable + 1) / sides, Math.max(0, favorable - 1) / sides, favorable / (sides + 1), 1 - eventValue]
      const unique = [...new Set(values.map((value) => Math.max(0, Math.min(1, value)).toFixed(3)))]
      while (unique.length < 5) unique.push((unique.length / 10 + 0.111).toFixed(3))
      const answer = letters[index % 5]
      const alternatives = {}
      const reordered = unique.filter((value) => value !== eventValue.toFixed(3))
      let cursor = 0
      for (const letter of letters) alternatives[letter] = letter === answer ? eventValue.toFixed(3) : reordered[cursor++]
      questions.push({
        topico_id: topic.id, tipo: 'ME',
        enunciado: `Um experimento possui ${sides} resultados equiprováveis e ${favorable} ${outcomeLabel}. Qual é a probabilidade do evento?`,
        alternativas: alternatives, gabarito: answer,
        explicacao: `A probabilidade é ${favorable}/${sides} = ${(favorable / sides).toFixed(3)}.`,
        fonte: source, trecho_fonte: evidence, origem: 'material', dificuldade: difficultyFor(index, target),
        comentarios_alternativas: Object.fromEntries(letters.map((letter) => [letter, letter === answer ? 'Correta pela razão entre casos favoráveis e casos possíveis.' : 'Incorreta para os dados do enunciado.'])), versao_conhecimento: VERSION,
      })
    }
  }
  return questions
}

function puzzleQuestions(topic, target) {
  const source = 'Elaboração determinística baseada em padrões aritméticos e raciocínio lógico.'
  const questions = []
  for (let index = 0; index < target; index += 1) {
    const family = index % 3
    const n = 2 + Math.floor(index / 3)
    let statement
    let expected
    let evidence
    if (family === 0) {
      const start = 1 + (index % 4)
      const step = 2 + (index % 5)
      expected = start + 4 * step
      statement = (displayed) => `Na sequência ${start}, ${start + step}, ${start + 2 * step}, ${start + 3 * step}, o próximo termo é ${displayed}.`
      evidence = `A sequência é uma progressão aritmética de razão ${step}; portanto, o próximo termo é ${start + 3 * step} + ${step} = ${expected}.`
    } else if (family === 1) {
      expected = 3 * n + 1
      statement = (displayed) => `${n} quadrados alinhados, compartilhando um lado entre quadrados consecutivos, podem ser construídos com ${displayed} palitos.`
      evidence = 'O primeiro quadrado usa 4 palitos e cada quadrado adicional compartilha um lado, acrescentando 3; logo, para n quadrados, o total é 4 + 3(n - 1) = 3n + 1.'
    } else {
      const firstFace = 1 + (n % 6)
      const secondFace = 1 + ((n * 2 + Math.floor(n / 6)) % 6)
      expected = (7 - firstFace) + (7 - secondFace)
      statement = (displayed) => `Em dois dados convencionais cujas faces opostas somam 7, as faces visíveis são ${firstFace} e ${secondFace}. A soma das faces opostas é ${displayed}.`
      evidence = `Pela regra declarada, as faces opostas são 7 - ${firstFace} e 7 - ${secondFace}; a soma é ${expected}.`
    }
    const correct = index % 2 === 0
    const displayed = correct ? expected : expected + 1
    const finalStatement = statement(displayed)
    questions.push({
      topico_id: topic.id, tipo: 'CE', enunciado: `${finalStatement} Julgue o item.`, alternativas: null,
      gabarito: correct ? 'C' : 'E', explicacao: evidence, fonte: source, trecho_fonte: evidence, origem: 'material',
      dificuldade: difficultyFor(index, target), comentarios_alternativas: null, versao_conhecimento: VERSION,
    })
  }
  return questions
}

async function insertRows(rows) {
  const columns = ['topico_id','tipo','enunciado','alternativas','gabarito','explicacao','fonte','trecho_fonte','origem','dificuldade','comentarios_alternativas','versao_conhecimento']
  for (let start = 0; start < rows.length; start += 100) {
    const chunk = rows.slice(start, start + 100)
    const values = []
    const tuples = chunk.map((row) => `(${columns.map((column) => { values.push(row[column] ?? null); return `$${values.length}` }).join(',')})`)
    await client.query(`insert into questao (${columns.join(',')}) values ${tuples.join(',')}`, values)
  }
}

const report = JSON.parse(await readFile(REPORT, 'utf8'))
const documents = []
for (const entry of report.documentos) documents.push({ ...entry, text: (await readFile(entry.texto, 'utf8')).replace(/\u0000/g, '') })

await client.connect()
try {
  const result = await client.query(`
    select t.id,t.nome topico,m.nome materia
    from topico t join materia m on m.id=t.materia_id join objetivo o on o.id=m.objetivo_id
    where o.tipo='concurso' and o.ativo=true
    order by m.nome,t.nome
  `)
  const topics = new Map(result.rows.map((topic) => [`${topic.materia}|${topic.topico}`, topic]))
  const allQuestions = []
  const plan = []

  for (const [key, spec] of Object.entries(GAP_SPECS)) {
    const topic = topics.get(key)
    if (!topic) throw new Error(`Tópico não encontrado: ${key}`)
    const sources = documents.filter((document) => spec.files.some((file) => normalize(document.arquivo).includes(normalize(file))))
    const extractedFacts = [...new Map(sources.flatMap((document) => extractClaims(document, spec.terms)).filter((fact) => !spec.reject?.test(normalize(fact.text))).map((fact) => [normalize(fact.text), { ...fact, source: `Estratégia Concursos | ${path.basename(fact.document.arquivo).replace(/^\d{3}-/, '')} | página ${fact.page}` }])).values()]
    const facts = spec.officialFacts || extractedFacts
    const questions = factualQuestions(topic, facts, spec.target)
    allQuestions.push(...questions)
    plan.push({ materia: topic.materia, topico: topic.topico, alvo: spec.target, fatos: facts.length })
  }

  const wordTopic = topics.get(WORD_KEY)
  const wordFacts = WORD_FACTS.map(([text, source]) => ({ text, source }))
  allQuestions.push(...factualQuestions(wordTopic, wordFacts, 41))
  plan.push({ materia: wordTopic.materia, topico: wordTopic.topico, alvo: 41, fatos: wordFacts.length })

  const probabilityTopic = topics.get(PROBABILITY_KEY)
  allQuestions.push(...probabilityQuestions(probabilityTopic, 61))
  plan.push({ materia: probabilityTopic.materia, topico: probabilityTopic.topico, alvo: 61, fatos: 'geração matemática verificável' })

  const puzzleTopic = topics.get(PUZZLES_KEY)
  allQuestions.push(...puzzleQuestions(puzzleTopic, 37))
  plan.push({ materia: puzzleTopic.materia, topico: puzzleTopic.topico, alvo: 37, fatos: 'geração determinística verificável' })

  const duplicateKeys = new Set()
  const failures = []
  for (const question of allQuestions) {
    const key = `${question.topico_id}:${normalize(question.enunciado)}`
    const duplicate = duplicateKeys.has(key)
    duplicateKeys.add(key)
    const audit = auditQuestion(question, duplicate)
    if (!audit.approved) failures.push({ question: question.enunciado, reasons: audit.reasons })
  }
  if (failures.length) throw new Error(`Auditoria reprovou ${failures.length} questões: ${JSON.stringify(failures.slice(0, 5))}`)

  const counts = Object.fromEntries(plan.map((item) => [item.topico, item.alvo]))
  const summary = { aplicar: APPLY, total: allQuestions.length, topicos: plan, dificuldade: {
    facil: allQuestions.filter((item) => item.dificuldade <= 2).length,
    media: allQuestions.filter((item) => item.dificuldade === 3).length,
    dificil: allQuestions.filter((item) => item.dificuldade >= 4).length,
  }, tipos: { CE: allQuestions.filter((item) => item.tipo === 'CE').length, ME: allQuestions.filter((item) => item.tipo === 'ME').length } }
  if (!APPLY) {
    summary.amostras = Object.fromEntries(plan.map((item) => {
      const topic = topics.get(`${item.materia}|${item.topico}`)
      const topicQuestions = allQuestions.filter((question) => question.topico_id === topic.id)
      const samples = [topicQuestions.find((question) => question.tipo === 'CE' && question.gabarito === 'C'), topicQuestions.find((question) => question.tipo === 'CE' && question.gabarito === 'E'), topicQuestions.find((question) => question.tipo === 'ME')].filter(Boolean)
      return [item.topico, samples.map((question) => ({ tipo: question.tipo, enunciado: question.enunciado, gabarito: question.gabarito, fonte: question.fonte }))]
    }))
  }

  if (APPLY) {
    await client.query('begin')
    try {
      const topicIds = plan.map((item) => topics.get(`${item.materia}|${item.topico}`).id)
      const existing = await client.query(`select topico_id,count(*)::int total from questao where topico_id=any($1::uuid[]) and ativa and not marcada_errada and estado<>'arquivada' group by topico_id`, [topicIds])
      if (existing.rows.some((item) => item.total > 0)) throw new Error(`Há tópicos do lote que já possuem questões: ${JSON.stringify(existing.rows)}`)
      for (const item of plan) {
        const topic = topics.get(`${item.materia}|${item.topico}`)
        await client.query(`update acervo_meta set questoes_alvo=$1,expansao_bloqueada=false,motivo_bloqueio=null,atualizado_em=now() where topico_id=$2`, [item.alvo, topic.id])
      }
      await insertRows(allQuestions)
      const check = await client.query(`select t.id,t.nome,count(q.id)::int total from topico t join materia m on m.id=t.materia_id join objetivo o on o.id=m.objetivo_id left join questao q on q.topico_id=t.id and q.ativa and not q.marcada_errada and q.estado<>'arquivada' where o.tipo='concurso' and o.ativo=true group by t.id,t.nome`)
      const zeros = check.rows.filter((item) => item.total === 0)
      if (zeros.length) throw new Error(`Ainda existem ${zeros.length} tópicos zerados: ${zeros.map((item) => item.nome).join('; ')}`)
      const wrong = check.rows.filter((item) => counts[item.nome] && counts[item.nome] !== item.total)
      if (wrong.length) throw new Error(`Contagens divergentes: ${JSON.stringify(wrong)}`)
      await client.query('commit')
      summary.banco = { topicos_bacen: check.rowCount, topicos_zerados: 0, total_questoes: check.rows.reduce((sum, item) => sum + item.total, 0) }
    } catch (error) {
      await client.query('rollback')
      throw error
    }
  }
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)
} finally {
  await client.end()
}
