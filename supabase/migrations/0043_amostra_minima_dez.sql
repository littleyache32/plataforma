update conhecimento_modulo
set ativo = false
where modulo = 'mentor';

insert into conhecimento_modulo (modulo, versao, titulo, descricao, conteudo, evidencias, ativo)
select
  modulo,
  '2026.08.6',
  titulo,
  'Conhecimento operacional com diagnóstico por tópico a partir de dez respostas.',
  jsonb_set(
    jsonb_set(conteudo, '{politica,amostra_minima}', '10'::jsonb, true),
    '{politica,decisao_semanal,amostra_minima_desempenho}',
    '10'::jsonb,
    true
  ),
  evidencias,
  true
from conhecimento_modulo
where modulo = 'mentor' and versao = '2026.08.5'
on conflict (modulo, versao) do update
set descricao = excluded.descricao,
    conteudo = excluded.conteudo,
    evidencias = excluded.evidencias,
    ativo = true,
    atualizado_em = now();

update mentor_conhecimento
set versao = '2026.08.6',
    politica = jsonb_set(
      jsonb_set(politica, '{amostra_minima}', '10'::jsonb, true),
      '{decisao_semanal,amostra_minima_desempenho}',
      '10'::jsonb,
      true
    )
where ativo = true;
