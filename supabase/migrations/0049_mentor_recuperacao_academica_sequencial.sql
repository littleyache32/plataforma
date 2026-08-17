insert into conhecimento_modulo (modulo, versao, titulo, descricao, conteudo, evidencias, ativo)
select
  modulo,
  '2026.08.9',
  titulo,
  'Política canônica que recupera o conteúdo acadêmico acumulado desde a primeira aula antes de retornar ao regime aula dada, aula estudada.',
  jsonb_set(
    conteudo,
    '{politica,fase_inicial}',
    coalesce(conteudo#>'{politica,fase_inicial}', '{}'::jsonb) || '{
      "faculdade_recuperacao_ativa": true,
      "faculdade_blocos_recuperacao": 2,
      "faculdade_blocos_regular": 1,
      "faculdade_recuperacao_modo": "conteudo_acumulado_desde_primeira_aula",
      "faculdade_recuperacao_sem_topico_aleatorio": true,
      "faculdade_retorno": "aula_dada_aula_estudada"
    }'::jsonb,
    true
  ),
  evidencias,
  false
from conhecimento_modulo
where modulo = 'mentor' and versao = '2026.08.8'
on conflict (modulo, versao) do nothing;

update conhecimento_modulo set ativo = false, atualizado_em = now() where modulo = 'mentor';
update conhecimento_modulo set ativo = true, atualizado_em = now() where modulo = 'mentor' and versao = '2026.08.9';

insert into mentor_conhecimento (versao, titulo, descricao, politica, evidencias, ativo)
select
  '2026.08.9',
  titulo,
  'Política canônica que mantém dois blocos de recuperação acadêmica sobre o conteúdo acumulado até o mentorado informar que está em dia.',
  jsonb_set(
    politica,
    '{fase_inicial}',
    coalesce(politica->'fase_inicial', '{}'::jsonb) || '{
      "faculdade_recuperacao_ativa": true,
      "faculdade_blocos_recuperacao": 2,
      "faculdade_blocos_regular": 1,
      "faculdade_recuperacao_modo": "conteudo_acumulado_desde_primeira_aula",
      "faculdade_recuperacao_sem_topico_aleatorio": true,
      "faculdade_retorno": "aula_dada_aula_estudada"
    }'::jsonb,
    true
  ),
  evidencias,
  false
from mentor_conhecimento
where versao = '2026.08.8'
on conflict (versao) do nothing;

update mentor_conhecimento set ativo = false;
update mentor_conhecimento set ativo = true where versao = '2026.08.9';
