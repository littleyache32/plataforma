create table if not exists relato_card (
  id uuid primary key default gen_random_uuid(),
  question_card_id uuid not null references question_card(id) on delete cascade,
  motivo text not null check (motivo in ('card_ambiguo','card_incompleto','card_incorreto')),
  detalhe text,
  status text not null default 'aberto' check (status in ('aberto','resolvido','descartado')),
  criado_em timestamptz not null default now()
);
create index if not exists idx_relato_card_status on relato_card(status, criado_em desc);
alter table relato_card enable row level security;

create table if not exists sistema_falha (
  id uuid primary key default gen_random_uuid(),
  origem text not null,
  mensagem text not null,
  detalhe text,
  status text not null default 'aberta' check (status in ('aberta','resolvida')),
  criado_em timestamptz not null default now(),
  resolvida_em timestamptz
);
create index if not exists idx_sistema_falha_status on sistema_falha(status, criado_em desc);
alter table sistema_falha enable row level security;

alter table compromisso add column if not exists conteudo_previsto text;

drop index if exists idx_mentor_execucao_unica;
delete from mentor_execucao a using mentor_execucao b
where a.id > b.id and a.tipo = b.tipo and a.semana_inicio = b.semana_inicio and a.data_execucao = b.data_execucao;
create unique index if not exists idx_mentor_execucao_unica
  on mentor_execucao(tipo, semana_inicio, data_execucao);

update mentor_conhecimento
set politica = politica || '{
  "fechamento_semanal": true,
  "trajetoria_ate_prova": true,
  "novos_cards_por_dia": 10,
  "limite_diario_minutos": 480,
  "limite_pendencias_transferidas": 3,
  "bloquear_topico_sem_fonte": true
}'::jsonb
where ativo = true;
