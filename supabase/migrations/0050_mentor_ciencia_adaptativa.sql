insert into conhecimento_modulo (modulo, versao, titulo, descricao, conteudo, evidencias, ativo)
select
  modulo,
  '2026.08.10',
  titulo,
  'Política science-based que separa aplicação imediata de retenção, usa dados individuais e mantém parâmetros operacionais calibráveis.',
  jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            conteudo,
            '{politica,evidencia_individual}',
            '{"intervalo_minimo_reteste_dias":2,"retestes_espacados_minimos":2,"separar_primeira_tentativa_repeticao_imediata_e_reteste":true,"acerto_imediato_nao_confirma_retencao":true,"primeira_tentativa_mede_aplicacao":true,"parametros_iniciais_calibraveis":true}'::jsonb,
            true
          ),
          '{politica,fundamento_decisao}',
          '{"ordem":["evidencia_cientifica","dados_individuais","contexto_real"],"aplicar_melhor_evidencia_disponivel_primeiro":true,"adaptar_somente_com_dados_suficientes":true,"nenhuma_mudanca_por_evento_isolado":true,"diagnosticar_dificuldade_antes_de_recomendar_formato":true,"formatos_nao_automaticos":["releitura","resumo","videoaula"],"criterios_para_manter_tecnica":["retencao","aplicacao","velocidade","aderencia"],"contexto":["peso","incidencia","banca","proximidade_prova","disponibilidade_semanal","obrigacoes_faculdade"]}'::jsonb,
          true
        ),
        '{politica,parametros_operacionais}',
        '{"natureza":"provisorios_versionados_calibraveis","percentuais_nao_sao_verdades_cientificas":true,"bloco_50_10_e_preferencia_do_mentorado":true}'::jsonb,
        true
      ),
      '{politica,pesos_confianca,eliminacao}',
      '{"acerto":0.75,"erro":1.15}'::jsonb,
      true
    ),
    '{politica,base_cientifica}',
    '[
      {"tema":"recuperacao_ativa_e_retencao_tardia","doi":"10.1111/j.1467-9280.2006.01693.x"},
      {"tema":"pratica_distribuida","doi":"10.1037/0033-2909.132.3.354"},
      {"tema":"feedback_corretivo_e_retencao","doi":"10.3758/MC.36.3.604"},
      {"tema":"feedback_em_acerto_de_baixa_confianca","doi":"10.1037/0278-7393.34.4.918"},
      {"tema":"erros_de_alta_confianca","doi":"10.1037/a0021962"},
      {"tema":"recorrencia_de_erro_de_alta_confianca","doi":"10.3758/s13423-011-0173-y"},
      {"tema":"intercalacao_para_discriminacao","doi":"10.3758/s13421-012-0272-7"},
      {"tema":"transferencia_por_testes","doi":"10.1037/a0019902"}
    ]'::jsonb,
    true
  ),
  evidencias,
  false
from conhecimento_modulo
where modulo = 'mentor' and versao = '2026.08.9'
on conflict (modulo, versao) do nothing;

update conhecimento_modulo set ativo = false, atualizado_em = now() where modulo = 'mentor';
update conhecimento_modulo set ativo = true, atualizado_em = now() where modulo = 'mentor' and versao = '2026.08.10';

insert into mentor_conhecimento (versao, titulo, descricao, politica, evidencias, ativo)
select
  '2026.08.10',
  titulo,
  'Política science-based que separa aplicação imediata de retenção, usa dados individuais e mantém parâmetros operacionais calibráveis.',
  jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            politica,
            '{evidencia_individual}',
            '{"intervalo_minimo_reteste_dias":2,"retestes_espacados_minimos":2,"separar_primeira_tentativa_repeticao_imediata_e_reteste":true,"acerto_imediato_nao_confirma_retencao":true,"primeira_tentativa_mede_aplicacao":true,"parametros_iniciais_calibraveis":true}'::jsonb,
            true
          ),
          '{fundamento_decisao}',
          '{"ordem":["evidencia_cientifica","dados_individuais","contexto_real"],"aplicar_melhor_evidencia_disponivel_primeiro":true,"adaptar_somente_com_dados_suficientes":true,"nenhuma_mudanca_por_evento_isolado":true,"diagnosticar_dificuldade_antes_de_recomendar_formato":true,"formatos_nao_automaticos":["releitura","resumo","videoaula"],"criterios_para_manter_tecnica":["retencao","aplicacao","velocidade","aderencia"],"contexto":["peso","incidencia","banca","proximidade_prova","disponibilidade_semanal","obrigacoes_faculdade"]}'::jsonb,
          true
        ),
        '{parametros_operacionais}',
        '{"natureza":"provisorios_versionados_calibraveis","percentuais_nao_sao_verdades_cientificas":true,"bloco_50_10_e_preferencia_do_mentorado":true}'::jsonb,
        true
      ),
      '{pesos_confianca,eliminacao}',
      '{"acerto":0.75,"erro":1.15}'::jsonb,
      true
    ),
    '{base_cientifica}',
    '[
      {"tema":"recuperacao_ativa_e_retencao_tardia","doi":"10.1111/j.1467-9280.2006.01693.x"},
      {"tema":"pratica_distribuida","doi":"10.1037/0033-2909.132.3.354"},
      {"tema":"feedback_corretivo_e_retencao","doi":"10.3758/MC.36.3.604"},
      {"tema":"feedback_em_acerto_de_baixa_confianca","doi":"10.1037/0278-7393.34.4.918"},
      {"tema":"erros_de_alta_confianca","doi":"10.1037/a0021962"},
      {"tema":"recorrencia_de_erro_de_alta_confianca","doi":"10.3758/s13423-011-0173-y"},
      {"tema":"intercalacao_para_discriminacao","doi":"10.3758/s13421-012-0272-7"},
      {"tema":"transferencia_por_testes","doi":"10.1037/a0019902"}
    ]'::jsonb,
    true
  ),
  evidencias,
  false
from mentor_conhecimento
where versao = '2026.08.9'
on conflict (versao) do nothing;

update mentor_conhecimento set ativo = false;
update mentor_conhecimento set ativo = true where versao = '2026.08.10';
