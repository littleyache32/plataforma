create or replace function enforce_exact_card_ceiling()
returns trigger language plpgsql as $$
declare
  total_count integer;
begin
  if new.ativa = true and new.ativo = true then
    select count(*) into total_count from question_card
    where topico_id = new.topico_id and ativa = true and ativo = true and id <> new.id;
    if total_count >= 30 then
      raise exception 'Limite do tópico atingido: 30 Question Cards.';
    end if;
  end if;
  return new;
end;
$$;

update acervo_meta set cards_alvo = 30, atualizado_em = now();

update mentor_conhecimento
set politica = jsonb_set(
  jsonb_set(politica, '{question_cards,total_inicial_ideal}', '1890'::jsonb, true),
  '{question_cards,cards_por_topico_coberto}', '30'::jsonb, true
)
where ativo = true;
