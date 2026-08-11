create or replace function enforce_exact_question_ceiling()
returns trigger language plpgsql as $$
declare
  total_count integer;
  group_count integer;
  group_limit integer;
begin
  if new.ativa = true and new.marcada_errada = false and new.estado <> 'arquivada' then
    select count(*) into total_count from questao
    where topico_id = new.topico_id and ativa = true and marcada_errada = false and estado <> 'arquivada' and id <> new.id;
    if new.dificuldade <= 2 then group_limit := 60;
    elsif new.dificuldade = 3 then group_limit := 30;
    else group_limit := 10;
    end if;
    select count(*) into group_count from questao
    where topico_id = new.topico_id and ativa = true and marcada_errada = false and estado <> 'arquivada' and id <> new.id
      and case when new.dificuldade <= 2 then dificuldade <= 2 when new.dificuldade = 3 then dificuldade = 3 else dificuldade >= 4 end;
    if total_count >= 100 or group_count >= group_limit then
      raise exception 'Limite exato do tópico atingido: 100 questões em 60/30/10.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_exact_question_ceiling on questao;
create trigger trg_exact_question_ceiling
before insert or update of topico_id,ativa,marcada_errada,estado,dificuldade on questao
for each row execute function enforce_exact_question_ceiling();

create or replace function enforce_exact_card_ceiling()
returns trigger language plpgsql as $$
declare
  total_count integer;
begin
  if new.ativa = true and new.ativo = true then
    select count(*) into total_count from question_card
    where topico_id = new.topico_id and ativa = true and ativo = true and id <> new.id;
    if total_count >= 50 then
      raise exception 'Limite exato do tópico atingido: 50 Question Cards.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_exact_card_ceiling on question_card;
create trigger trg_exact_card_ceiling
before insert or update of topico_id,ativa,ativo on question_card
for each row execute function enforce_exact_card_ceiling();
