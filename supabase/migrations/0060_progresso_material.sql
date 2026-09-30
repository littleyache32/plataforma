create table if not exists material_progresso (
  material_id uuid primary key references material(id) on delete cascade,
  concluido_em timestamptz not null default now()
);

alter table material_progresso enable row level security;
