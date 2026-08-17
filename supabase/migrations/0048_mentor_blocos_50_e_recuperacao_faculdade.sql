alter table mentor_encontro_semanal drop constraint if exists mentor_encontro_classificacoes_check;
alter table mentor_encontro_semanal add constraint mentor_encontro_classificacoes_check check (
  classificacoes <@ array[
    'dificuldade_conteudo','dificuldade_volume','dificuldade_questoes',
    'dificuldade_revisao','problema_material','estrategia_funcionou','prioridade_percebida',
    'faculdade_atrasada','faculdade_em_dia'
  ]::text[]
);

insert into conhecimento_modulo (modulo, versao, titulo, descricao, conteudo, evidencias, ativo)
select
  modulo,
  '2026.08.8',
  titulo,
  'Política canônica com blocos de 50 minutos, recuperação temporária da Faculdade e continuidade protegida do BACEN.',
  jsonb_set(
    jsonb_set(
      jsonb_set(
        conteudo,
        '{politica,fase_inicial}',
        coalesce(conteudo#>'{politica,fase_inicial}', '{}'::jsonb) || '{
          "bloco_estudo_minutos": 50,
          "intervalo_minutos": 10,
          "faculdade_recuperacao_ativa": true,
          "faculdade_blocos_recuperacao": 2,
          "faculdade_blocos_regular": 1,
          "bacen_blocos_segunda_sexta": 2,
          "bacen_blocos_fim_semana": 2,
          "bacen_minimo_blocos_semana_avaliacao": 1
        }'::jsonb,
        true
      ),
      '{politica,prioridades}',
      coalesce(conteudo#>'{politica,prioridades}', '{}'::jsonb) || '{
        "concurso_principal": true,
        "faculdade_recuperacao_temporaria": true,
        "preservar_concurso_em_semana_avaliacao": true,
        "intervalo_nao_conta_como_estudo": true
      }'::jsonb,
      true
    ),
    '{politica,previsoes}',
    '{
      "exigir_data_alvo_oficial": true,
      "exigir_tempo_real_registrado": true,
      "proibir_prazos_e_capacidade_ocultos": true
    }'::jsonb,
    true
  ),
  evidencias,
  false
from conhecimento_modulo
where modulo = 'mentor' and versao = '2026.08.7'
on conflict (modulo, versao) do nothing;

update conhecimento_modulo
set ativo = false, atualizado_em = now()
where modulo = 'mentor';

update conhecimento_modulo
set ativo = true, atualizado_em = now()
where modulo = 'mentor' and versao = '2026.08.8';

insert into mentor_conhecimento (versao, titulo, descricao, politica, evidencias, ativo)
select
  '2026.08.8',
  titulo,
  'Política canônica com recuperação acadêmica temporária, blocos de 50 minutos e proteção da continuidade do BACEN.',
  politica || '{
    "fase_inicial": {
      "bloco_estudo_minutos": 50,
      "intervalo_minutos": 10,
      "faculdade_recuperacao_ativa": true,
      "faculdade_blocos_recuperacao": 2,
      "faculdade_blocos_regular": 1,
      "bacen_blocos_segunda_sexta": 2,
      "bacen_blocos_fim_semana": 2,
      "bacen_minimo_blocos_semana_avaliacao": 1
    },
    "prioridades": {
      "concurso_principal": true,
      "faculdade_recuperacao_temporaria": true,
      "preservar_concurso_em_semana_avaliacao": true,
      "intervalo_nao_conta_como_estudo": true
    },
    "previsoes": {
      "exigir_data_alvo_oficial": true,
      "exigir_tempo_real_registrado": true,
      "proibir_prazos_e_capacidade_ocultos": true
    }
  }'::jsonb,
  evidencias,
  false
from mentor_conhecimento
where versao = '2026.08.7'
on conflict (versao) do nothing;

update mentor_conhecimento set ativo = false;
update mentor_conhecimento set ativo = true where versao = '2026.08.8';
