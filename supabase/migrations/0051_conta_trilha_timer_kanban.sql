create table if not exists app_usuario (
  id uuid primary key default gen_random_uuid(),
  handle text not null unique check (handle ~ '^@[a-z0-9._]{3,30}$'),
  senha_hash text not null,
  ativo boolean not null default true,
  descanso_ate timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
alter table app_usuario add column if not exists descanso_ate timestamptz;
alter table app_usuario enable row level security;

alter table material add column if not exists ordem_estudo integer;
update material
set ordem_estudo = coalesce(
  nullif((regexp_match(nome, '^\s*([0-9]+)'))[1], '')::integer,
  9999
)
where ordem_estudo is null;
create index if not exists idx_material_trilha on material(materia_id, ordem_estudo, nome);

alter table sessao add column if not exists material_id uuid references material(id) on delete set null;
create index if not exists idx_sessao_material on sessao(material_id, status);

alter table tempo_estudo drop constraint if exists tempo_estudo_contexto_check;
alter table tempo_estudo add constraint tempo_estudo_contexto_check check (contexto in ('demanda','disciplina','questao','card','simulado','livre'));

update objetivo
set config = coalesce(config, '{}'::jsonb) || '{
  "data_prova_provisoria": true,
  "janela_provavel_prova": {"inicio":"2027-03-01","fim":"2027-03-31"},
  "planejar_ate":"2027-03-31"
}'::jsonb
where tipo = 'concurso';
