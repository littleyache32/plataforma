-- Derived duration belongs to the database transaction that changes real time.
create index if not exists idx_tempo_estudo_sessao_concluido
  on public.tempo_estudo(sessao_id) where status = 'concluido';

create or replace function public.reconcile_session_time_duration()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  old_session uuid;
  new_session uuid;
  affected_session uuid;
begin
  if TG_OP = 'UPDATE' and OLD.status is not distinct from NEW.status
    and OLD.sessao_id is not distinct from NEW.sessao_id
    and OLD.segundos_acumulados is not distinct from NEW.segundos_acumulados then
    return NEW;
  end if;

  if TG_OP <> 'INSERT' and OLD.status = 'concluido' then
    old_session := OLD.sessao_id;
  end if;
  if TG_OP <> 'DELETE' and NEW.status = 'concluido' then
    new_session := NEW.sessao_id;
  end if;

  if TG_WHEN = 'BEFORE' then
    -- NO KEY UPDATE is compatible with FK KEY SHARE locks from concurrent inserts.
    -- Acquire both parent locks in UUID order before changing the child record.
    perform s.id from public.sessao s
      where s.id = any(array[old_session, new_session])
      order by s.id for no key update;
  else
    for affected_session in
      select distinct value from unnest(array[old_session, new_session]) as ids(value)
      where value is not null order by value
    loop
      -- A separate statement after the lock sees committed predecessors at READ COMMITTED.
      update public.sessao s set duracao_realizada = (
        select round(coalesce(sum(t.segundos_acumulados), 0)::numeric / 60)::integer
        from public.tempo_estudo t
        where t.sessao_id = affected_session and t.status = 'concluido'
      ) where s.id = affected_session;
    end loop;
  end if;
  if TG_OP = 'DELETE' then return OLD; end if;
  return NEW;
end;
$$;

revoke all on function public.reconcile_session_time_duration() from public;

create trigger tempo_session_duration_lock
  before insert or update or delete on public.tempo_estudo
  for each row execute function public.reconcile_session_time_duration();

create trigger tempo_session_duration_reconcile
  after insert or update or delete on public.tempo_estudo
  for each row execute function public.reconcile_session_time_duration();

-- Normalize only the derived field; preserve all original time and session records.
update public.sessao s set duracao_realizada = (
  select round(coalesce(sum(t.segundos_acumulados), 0)::numeric / 60)::integer
  from public.tempo_estudo t where t.sessao_id = s.id and t.status = 'concluido'
);
