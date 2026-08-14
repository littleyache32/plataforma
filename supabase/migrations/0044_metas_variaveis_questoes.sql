create or replace function enforce_question_ceiling()
returns trigger language plpgsql as $$
declare
  total_count integer;
  target_count integer;
begin
  if new.ativa = true and new.marcada_errada = false and new.estado <> 'arquivada' then
    select coalesce(am.questoes_alvo, 100)
      into target_count
      from acervo_meta am
      where am.topico_id = new.topico_id;

    target_count := coalesce(target_count, 100);

    select count(*) into total_count
    from questao
    where topico_id = new.topico_id
      and ativa = true
      and marcada_errada = false
      and estado <> 'arquivada'
      and (tg_op = 'INSERT' or id <> new.id);

    if total_count >= target_count then
      raise exception 'Meta variável do tópico atingida: % questões.', target_count;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_exact_question_ceiling on questao;
drop trigger if exists trg_question_ceiling on questao;
create trigger trg_question_ceiling
before insert or update of topico_id,ativa,marcada_errada,estado,dificuldade on questao
for each row execute function enforce_question_ceiling();
