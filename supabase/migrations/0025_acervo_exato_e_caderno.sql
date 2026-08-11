update acervo_meta
set questoes_alvo = 100,
    cards_alvo = 50,
    atualizado_em = now();

update mentor_conhecimento
set politica = jsonb_set(
      jsonb_set(politica, '{acervo,questoes_por_topico}', '100'::jsonb, true),
      '{acervo,cards_por_topico}', '50'::jsonb, true
    ) || '{
      "caderno_questoes": {
        "incluir_erro": true,
        "incluir_duvida": true,
        "incluir_sem_conhecimento": true,
        "usar_em_revisoes_futuras": true
      },
      "distribuicao_dificuldade": {"facil":60,"media":30,"dificil":10}
    }'::jsonb
where ativo = true;
