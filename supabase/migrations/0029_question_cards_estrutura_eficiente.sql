alter table question_card
  add column if not exists resposta_direta text,
  add column if not exists explicacao_curta text,
  add column if not exists dica_escopo text,
  add column if not exists apoio_memoria text,
  add column if not exists modelo_card text;

alter table question_card drop constraint if exists question_card_modelo_card_check;
alter table question_card add constraint question_card_modelo_card_check
  check (modelo_card is null or modelo_card in ('pergunta_resposta','cloze','causa_efeito'));

update acervo_meta set cards_alvo = 50, atualizado_em = now()
where cards_alvo is distinct from 50;

update mentor_conhecimento
set politica = politica || '{
  "question_cards": {
    "total_inicial_ideal": 3150,
    "cards_por_topico_coberto": 50,
    "principio_atomico": true,
    "contexto_minimo": true,
    "recuperacao_ativa": true,
    "resposta_direta_primeiro": true,
    "explicacao_maxima_frases": 2,
    "apoio_visual_ou_mnemonico": "somente_quando_util_e_fiel",
    "modelos": ["pergunta_resposta","cloze","causa_efeito"]
  }
}'::jsonb
where ativo = true;
