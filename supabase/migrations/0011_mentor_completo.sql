create table if not exists compromisso (
  id uuid primary key default gen_random_uuid(),
  objetivo_id uuid not null references objetivo(id) on delete cascade,
  materia_id uuid references materia(id) on delete set null,
  titulo text not null,
  tipo text not null check (tipo in ('prova', 'entrega')),
  data date not null,
  peso smallint not null default 3 check (peso between 1 and 5),
  duracao_minutos integer not null default 90 check (duracao_minutos > 0),
  concluido boolean not null default false,
  criado_em timestamptz not null default now()
);

create index if not exists idx_compromisso_data on compromisso(concluido, data, peso desc);
alter table compromisso enable row level security;

alter table sessao add column if not exists movida_pelo_mentor_em timestamptz;

