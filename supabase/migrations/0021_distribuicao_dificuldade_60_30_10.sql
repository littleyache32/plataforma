update mentor_conhecimento
set politica = politica || '{
  "distribuicao_questoes": {
    "faceis_percentual": 60,
    "medias_percentual": 30,
    "dificeis_percentual": 10,
    "preservar_validas_existentes": true,
    "compensar_com_novas_questoes": true
  }
}'::jsonb
where ativo = true;
