create table if not exists tempo_estudo (
  id uuid primary key default gen_random_uuid(),
  operacao_id text unique,
  sessao_id uuid references sessao(id) on delete set null,
  objetivo_id uuid references objetivo(id) on delete cascade,
  materia_id uuid references materia(id) on delete set null,
  topico_id uuid references topico(id) on delete set null,
  contexto text not null check (contexto in ('demanda','disciplina','questao','card','livre')),
  titulo text not null,
  status text not null default 'rodando' check (status in ('rodando','pausado','concluido')),
  segundos_acumulados integer not null default 0 check (segundos_acumulados >= 0),
  iniciado_em timestamptz not null default now(),
  retomado_em timestamptz default now(),
  finalizado_em timestamptz,
  atualizado_em timestamptz not null default now()
);
create unique index if not exists idx_tempo_estudo_ativo on tempo_estudo((status in ('rodando','pausado'))) where status in ('rodando','pausado');
create index if not exists idx_tempo_estudo_periodo on tempo_estudo(iniciado_em desc);
alter table tempo_estudo enable row level security;

alter table registro add column if not exists operacao_id text;
create unique index if not exists idx_registro_operacao on registro(operacao_id) where operacao_id is not null;
alter table question_card_registro add column if not exists operacao_id text;
create unique index if not exists idx_card_registro_operacao on question_card_registro(operacao_id) where operacao_id is not null;

create table if not exists edital_versao (
  id uuid primary key default gen_random_uuid(),
  objetivo_id uuid not null references objetivo(id) on delete cascade,
  nome text not null,
  publicado_em date,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
alter table edital_versao enable row level security;

create table if not exists edital_item (
  id uuid primary key default gen_random_uuid(),
  edital_id uuid not null references edital_versao(id) on delete cascade,
  topico_id uuid references topico(id) on delete set null,
  nome text not null,
  classificacao text not null check (classificacao in ('mantido','novo','removido','sem_material')),
  impacto text,
  criado_em timestamptz not null default now(),
  unique(edital_id,nome)
);
alter table edital_item enable row level security;

create table if not exists backup_snapshot (
  id uuid primary key default gen_random_uuid(),
  tipo text not null default 'automatico' check (tipo in ('automatico','manual')),
  status text not null default 'valido' check (status in ('valido','restaurado')),
  dados jsonb not null,
  criado_em timestamptz not null default now(),
  restaurado_em timestamptz
);
create index if not exists idx_backup_snapshot_data on backup_snapshot(criado_em desc);
alter table backup_snapshot enable row level security;

create or replace function criar_backup_snapshot(p_tipo text default 'automatico') returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  insert into backup_snapshot(tipo,dados) values (p_tipo, jsonb_build_object(
    'registro',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from registro x),
    'question_card_registro',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from question_card_registro x),
    'sessao',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from sessao x),
    'compromisso',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from compromisso x),
    'revisao_item',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from revisao_item x),
    'tempo_estudo',(select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from tempo_estudo x)
  )) returning id into v_id;
  delete from backup_snapshot where criado_em < now() - interval '90 days';
  return v_id;
end $$;

create or replace function restaurar_backup_snapshot(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  select dados into v from backup_snapshot where id=p_id and status='valido' for update;
  if v is null then raise exception 'Backup invalido'; end if;
  delete from question_card_registro; delete from registro; delete from revisao_item; delete from tempo_estudo; delete from sessao; delete from compromisso;
  insert into compromisso select * from jsonb_populate_recordset(null::compromisso, v->'compromisso');
  insert into sessao select * from jsonb_populate_recordset(null::sessao, v->'sessao');
  insert into tempo_estudo select * from jsonb_populate_recordset(null::tempo_estudo, v->'tempo_estudo');
  insert into registro select * from jsonb_populate_recordset(null::registro, v->'registro');
  insert into question_card_registro select * from jsonb_populate_recordset(null::question_card_registro, v->'question_card_registro');
  insert into revisao_item select * from jsonb_populate_recordset(null::revisao_item, v->'revisao_item');
  update backup_snapshot set status='restaurado',restaurado_em=now() where id=p_id;
end $$;
