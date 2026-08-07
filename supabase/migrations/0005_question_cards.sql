create table if not exists question_card (
  id uuid primary key default gen_random_uuid(),
  objetivo_id uuid not null references objetivo(id) on delete cascade,
  materia_id uuid not null references materia(id) on delete cascade,
  topico_id uuid not null references topico(id) on delete cascade,
  questao_id uuid references questao(id) on delete set null,
  chave text not null unique,
  frente text not null,
  verso text not null,
  fonte text not null,
  trecho_fonte text not null,
  ocorrencias integer not null default 1 check (ocorrencias > 0),
  repeticoes integer not null default 0 check (repeticoes >= 0),
  proxima_revisao timestamptz not null default now(),
  ultima_revisao timestamptz,
  criado_em timestamptz not null default now()
);

create table if not exists question_card_registro (
  id uuid primary key default gen_random_uuid(),
  question_card_id uuid not null references question_card(id) on delete cascade,
  resultado text not null check (resultado in ('lembrei', 'revisar')),
  criado_em timestamptz not null default now()
);

create index if not exists idx_question_card_fila on question_card(objetivo_id, proxima_revisao, criado_em);
create index if not exists idx_question_card_registro on question_card_registro(question_card_id, criado_em desc);

alter table question_card enable row level security;
alter table question_card_registro enable row level security;
