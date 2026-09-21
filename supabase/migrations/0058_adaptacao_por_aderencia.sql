begin;

update conhecimento_modulo
set ativo = false, atualizado_em = now()
where modulo = 'mentor';

insert into conhecimento_modulo (modulo, versao, titulo, descricao, conteudo, evidencias, ativo)
select
  'mentor',
  '2026.09.21.1',
  titulo,
  descricao,
  jsonb_set(
    conteudo,
    '{politica}',
    coalesce(conteudo->'politica', '{}'::jsonb) || '{
      "adaptacao_estudo": {
        "somente_estudo_ate":"2026-10-11",
        "pratica_primeira_semana_possivel":"2026-10-12",
        "pratica_exige_semanas_aderentes":2,
        "pratica_limiar_aderencia":0.85,
        "faculdade_maximo_blocos_dia":2,
        "faculdade_aula_dada_estudada_segunda_quinta":true,
        "priorizar_bacen_na_semana":true
      }
    }'::jsonb,
    true
  ),
  evidencias || jsonb_build_array(jsonb_build_object(
    'tipo','correcao_confirmada',
    'fonte','mentorado',
    'data','2026-09-21',
    'descricao','Manter apenas estudo basico por duas semanas; liberar questoes e Question Cards somente com aderencia sustentada. Faculdade limitada a dois blocos por dia e BACEN priorizado na semana.'
  )),
  true
from conhecimento_modulo
where modulo = 'mentor' and versao = '2026.09.21'
order by criado_em desc
limit 1
on conflict (modulo, versao) do update
set conteudo = excluded.conteudo,
    evidencias = excluded.evidencias,
    ativo = true,
    atualizado_em = now();

insert into mentor_conhecimento (versao,titulo,descricao,politica,evidencias,ativo)
select '2026.09.21.1', titulo, descricao, conteudo->'politica', evidencias, true
from conhecimento_modulo
where modulo = 'mentor' and versao = '2026.09.21.1'
on conflict (versao) do update
set politica = excluded.politica,
    evidencias = excluded.evidencias,
    ativo = true;

update mentor_conhecimento
set ativo = false
where versao <> '2026.09.21.1';

commit;
