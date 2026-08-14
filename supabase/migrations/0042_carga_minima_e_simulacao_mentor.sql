update conhecimento_modulo set ativo = false where modulo = 'mentor';

insert into conhecimento_modulo (modulo, versao, titulo, descricao, conteudo, evidencias, ativo)
select
  modulo,
  '2026.08.5',
  titulo,
  'Conhecimento operacional com carga mínima, tempo real sem teto e adaptação sustentada por aderência e capacidade demonstrada.',
  jsonb_set(
    jsonb_set(
      jsonb_set(
        conteudo,
        '{politica,fase_inicial}',
        jsonb_build_object(
          'inicio', '2026-08-17',
          'fim', '2026-09-06',
          'faculdade_minutos_segunda_sexta', 60,
          'bacen_minutos_segunda_sexta', 120,
          'bacen_minutos_fim_semana', 120,
          'question_cards_inicio', '2026-08-31',
          'question_cards_diarios_minutos', 30,
          'semanas', jsonb_build_array(
            jsonb_build_object('inicio', '2026-08-17', 'fim', '2026-08-23', 'segunda_sexta', 180, 'sabado', 120, 'domingo', 120, 'question_cards', 0),
            jsonb_build_object('inicio', '2026-08-24', 'fim', '2026-08-30', 'segunda_sexta', 180, 'sabado', 120, 'domingo', 120, 'question_cards', 0),
            jsonb_build_object('inicio', '2026-08-31', 'fim', '2026-09-06', 'segunda_sexta', 180, 'sabado', 120, 'domingo', 120, 'question_cards', 30)
          ),
          'questoes_bacen', false,
          'question_cards_bacen', false,
          'simulados', false
        ),
        true
      ),
      '{politica,progressao_carga}',
      jsonb_build_object(
        'incremento_minutos', 60,
        'minimo_segunda_sexta', 180,
        'minimo_sabado', 120,
        'minimo_domingo', 120,
        'reduzir_abaixo_de', 0.70,
        'aumentar_acima_de', 0.85,
        'semanas_para_aumentar', 2,
        'maximo_pendencias_para_aumentar', 3,
        'exigir_capacidade_real_para_aumentar', true,
        'tempo_real_sem_teto', true,
        'ignorar_tempo_excedente_quando_concluida', true
      ),
      true
    ),
    '{politica,decisao_semanal,fontes}',
    (conteudo #> '{politica,decisao_semanal,fontes}') || '"tempo_real_estudado"'::jsonb,
    true
  ),
  evidencias,
  true
from conhecimento_modulo
where modulo = 'mentor' and versao = '2026.08.4'
on conflict (modulo, versao) do update
set descricao = excluded.descricao,
    conteudo = excluded.conteudo,
    evidencias = excluded.evidencias,
    ativo = true,
    atualizado_em = now();

update mentor_conhecimento
set versao = '2026.08.5',
    politica = politica || jsonb_build_object(
      'fase_inicial', jsonb_build_object(
        'inicio', '2026-08-17', 'fim', '2026-09-06',
        'faculdade_minutos_segunda_sexta', 60,
        'bacen_minutos_segunda_sexta', 120,
        'bacen_minutos_fim_semana', 120,
        'question_cards_inicio', '2026-08-31',
        'question_cards_diarios_minutos', 30,
        'semanas', jsonb_build_array(
          jsonb_build_object('inicio', '2026-08-17', 'fim', '2026-08-23', 'segunda_sexta', 180, 'sabado', 120, 'domingo', 120, 'question_cards', 0),
          jsonb_build_object('inicio', '2026-08-24', 'fim', '2026-08-30', 'segunda_sexta', 180, 'sabado', 120, 'domingo', 120, 'question_cards', 0),
          jsonb_build_object('inicio', '2026-08-31', 'fim', '2026-09-06', 'segunda_sexta', 180, 'sabado', 120, 'domingo', 120, 'question_cards', 30)
        )
      ),
      'progressao_carga', jsonb_build_object(
        'incremento_minutos', 60,
        'minimo_segunda_sexta', 180,
        'minimo_sabado', 120,
        'minimo_domingo', 120,
        'reduzir_abaixo_de', 0.70,
        'aumentar_acima_de', 0.85,
        'semanas_para_aumentar', 2,
        'maximo_pendencias_para_aumentar', 3,
        'exigir_capacidade_real_para_aumentar', true,
        'tempo_real_sem_teto', true
      )
    )
where ativo = true;
