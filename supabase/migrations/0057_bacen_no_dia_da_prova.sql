begin;

update conhecimento_modulo
set ativo = false, atualizado_em = now()
where modulo = 'mentor';

insert into conhecimento_modulo (modulo, versao, titulo, descricao, conteudo, evidencias, ativo)
select
  'mentor',
  '2026.09.21',
  titulo,
  descricao,
  jsonb_set(
    conteudo,
    '{politica}',
    coalesce(conteudo->'politica', '{}'::jsonb) || '{
      "retomada": {
        "inicio":"2026-09-21",
        "fim_semana_especial":"2026-09-27",
        "zerar_pendencias_anteriores":true,
        "bloquear_questoes_e_cards_ate_autorizacao":true,
        "segunda_especial":{"faculdade":7,"concurso":2},
        "dia_prova_sem_faculdade":true,
        "dia_prova_bacen_blocos":2,
        "rotina_restante":{"faculdade":1,"concurso":2},
        "avaliacoes":[
          {"data":"2026-09-22","tipo":"prova","materia":"Teoria do Crime"},
          {"data":"2026-10-01","tipo":"prova","materia":"Teoria da Constituição e Direitos Fundamentais"},
          {"data":"2026-10-14","tipo":"prova","materia":"Teorias da Justiça"},
          {"data":"2026-10-19","tipo":"trabalho_em_grupo","materia":"Direito das Pessoas e dos Negócios Jurídicos"}
        ]
      }
    }'::jsonb,
    true
  ),
  evidencias || jsonb_build_array(jsonb_build_object(
    'tipo','correcao_confirmada',
    'fonte','mentorado',
    'data','2026-09-21',
    'descricao','No dia da prova de Faculdade, retirar somente a demanda acadêmica e manter dois blocos BACEN.'
  )),
  true
from conhecimento_modulo
where modulo = 'mentor' and versao = '2026.09.20'
order by criado_em desc
limit 1
on conflict (modulo, versao) do update
set conteudo = excluded.conteudo,
    evidencias = excluded.evidencias,
    ativo = true,
    atualizado_em = now();

insert into mentor_conhecimento (versao,titulo,descricao,politica,evidencias,ativo)
select '2026.09.21', titulo, descricao, conteudo->'politica', evidencias, true
from conhecimento_modulo
where modulo = 'mentor' and versao = '2026.09.21'
on conflict (versao) do update
set politica = excluded.politica,
    evidencias = excluded.evidencias,
    ativo = true;

update mentor_conhecimento
set ativo = false
where versao <> '2026.09.21';

commit;
