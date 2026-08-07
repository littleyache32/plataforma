create table if not exists simulado (
  id uuid primary key default gen_random_uuid(),
  objetivo_id uuid not null references objetivo(id) on delete cascade,
  materia_id uuid references materia(id) on delete set null,
  quantidade integer not null check (quantidade > 0),
  duracao_minutos integer not null check (duracao_minutos > 0),
  status text not null default 'em_andamento' check (status in ('em_andamento', 'finalizado')),
  iniciado_em timestamptz not null default now(),
  finalizado_em timestamptz,
  criado_em timestamptz not null default now()
);

create table if not exists simulado_item (
  id uuid primary key default gen_random_uuid(),
  simulado_id uuid not null references simulado(id) on delete cascade,
  questao_id uuid not null references questao(id) on delete restrict,
  ordem integer not null check (ordem > 0),
  resposta text,
  classificacao text check (classificacao in ('certeza', 'duvida', 'eliminacao', 'sem_conhecimento')),
  eliminadas jsonb not null default '[]'::jsonb,
  tempo integer not null default 0 check (tempo >= 0),
  pulada boolean not null default false,
  unique (simulado_id, ordem),
  unique (simulado_id, questao_id)
);

create index if not exists idx_simulado_objetivo on simulado(objetivo_id, criado_em desc);
create index if not exists idx_simulado_item on simulado_item(simulado_id, ordem);
alter table simulado enable row level security;
alter table simulado_item enable row level security;
