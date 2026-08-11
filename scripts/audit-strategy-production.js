import pg from 'pg'

const connectionString = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL
if (!connectionString) throw new Error('Banco não configurado.')
const url = new URL(connectionString)
url.searchParams.delete('sslmode')
url.searchParams.delete('sslrootcert')
const client = new pg.Client({ connectionString: url.toString(), ssl: { rejectUnauthorized: false } })

await client.connect()
try {
  const totals = await client.query(`select
      (select count(*)::int from material where versao='estrategia-2026.08.11') materiais,
      (select count(*)::int from questao where ativa and not marcada_errada and estado <> 'arquivada') questoes,
      (select count(*)::int from question_card where ativa and ativo) cards`)
  const coverage = await client.query(`select topico_id,count(*)::int total,
      count(*) filter(where dificuldade<=2)::int faceis,
      count(*) filter(where dificuldade=3)::int medias,
      count(*) filter(where dificuldade>=4)::int dificeis,
      count(*) filter(where tipo='CE')::int ce,
      count(*) filter(where tipo='ME')::int me
      from questao where ativa and not marcada_errada and estado <> 'arquivada'
      group by topico_id order by topico_id`)
  const blocked = await client.query(`select count(*)::int total from acervo_meta am join topico t on t.id=am.topico_id join materia m on m.id=t.materia_id join objetivo o on o.id=m.objetivo_id where o.tipo='concurso' and am.expansao_bloqueada`)
  const oldSessions = await client.query(`select count(*)::int total from sessao where data < date '2026-08-17'`)
  const triggers = await client.query(`select tgname,tgenabled from pg_trigger where tgname in ('trg_exact_question_ceiling','trg_exact_card_ceiling') order by tgname`)
  const noisyItems = await client.query(`select
    (select count(*)::int from questao where trecho_fonte ~* '\m(questão|questões|gabarito|gabaritou|comentada|comentadas|comentado|comentados|alternativa|assinale|enunciado|galera|imaginem)\M|olá,? pessoal|sabe quando|\mletra [a-e]\M' or trecho_fonte like '%?%' or trecho_fonte !~ '[.]$') questoes,
    (select count(*)::int from question_card where trecho_fonte ~* '\m(questão|questões|gabarito|gabaritou|comentada|comentadas|comentado|comentados|alternativa|assinale|enunciado|galera|imaginem)\M|olá,? pessoal|sabe quando|\mletra [a-e]\M' or trecho_fonte like '%?%' or trecho_fonte !~ '[.]$') cards`)
  const noisySamples = (noisyItems.rows[0].questoes || noisyItems.rows[0].cards) ? await client.query(`
    select distinct trecho_fonte from questao
    where trecho_fonte ~* '\m(questão|questões|gabarito|gabaritou|comentada|comentadas|comentado|comentados|alternativa|assinale|enunciado|galera|imaginem)\M|olá,? pessoal|sabe quando|\mletra [a-e]\M' or trecho_fonte like '%?%' or trecho_fonte !~ '[.]$'
    limit 20
  `) : { rows: [] }
  const invalid = coverage.rows.filter((item) => item.total !== 100 || item.faceis !== 60 || item.medias !== 30 || item.dificeis !== 10 || item.ce !== 75 || item.me !== 25)
  const result = { ...totals.rows[0], topicos_cobertos: coverage.rowCount, topicos_invalidos: invalid.length, topicos_bloqueados: blocked.rows[0].total, sessoes_antes_inicio: oldSessions.rows[0].total, ruido_editorial: noisyItems.rows[0], amostras_ruido: noisySamples.rows, gatilhos: triggers.rows }
  if (result.materiais !== 114 || result.questoes !== 6300 || result.cards !== 3150 || result.topicos_cobertos !== 63 || result.topicos_invalidos || result.topicos_bloqueados !== 8 || result.sessoes_antes_inicio || result.ruido_editorial.questoes || result.ruido_editorial.cards || triggers.rows.some((item) => item.tgenabled !== 'O')) throw new Error(`Auditoria falhou: ${JSON.stringify(result)}`)
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
} finally {
  await client.end()
}
