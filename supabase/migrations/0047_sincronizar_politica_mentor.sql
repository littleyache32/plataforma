update mentor_conhecimento
set politica = politica
  || jsonb_build_object('amostra_minima', 10)
  || jsonb_build_object(
    'decisao_semanal',
    coalesce(politica->'decisao_semanal', '{}'::jsonb)
      || jsonb_build_object('amostra_minima_desempenho', 10)
  )
where ativo = true and versao = '2026.08.7';

update conhecimento_modulo
set conteudo = jsonb_set(
  conteudo,
  '{politica}',
  coalesce(conteudo->'politica', '{}'::jsonb)
    || jsonb_build_object('amostra_minima', 10)
    || jsonb_build_object(
      'decisao_semanal',
      coalesce(conteudo#>'{politica,decisao_semanal}', '{}'::jsonb)
        || jsonb_build_object('amostra_minima_desempenho', 10)
    ),
  true
), atualizado_em = now()
where modulo = 'mentor' and ativo = true and versao = '2026.08.7';
