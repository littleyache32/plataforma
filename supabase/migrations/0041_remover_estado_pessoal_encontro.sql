alter table mentor_encontro_semanal drop column if exists sono;
alter table mentor_encontro_semanal drop column if exists energia;
alter table mentor_encontro_semanal drop column if exists humor;

update conhecimento_modulo
set conteudo = jsonb_set(
      conteudo,
      '{politica,encontro_semanal}',
      jsonb_build_object(
        'frequencia', 'semanal',
        'sinais', jsonb_build_array('carga_percebida', 'observacoes'),
        'nao_inferir_estado_pessoal', true,
        'nao_usar_sono_energia_humor', true,
        'nao_aumentar_carga_apenas_por_sinal_subjetivo', true,
        'sobrecarga_declarada_pode_reduzir_carga', true
      ),
      true
    ),
    atualizado_em = now()
where modulo = 'mentor' and versao = '2026.08.4';
