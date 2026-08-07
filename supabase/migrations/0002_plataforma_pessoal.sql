create table if not exists objetivo (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('faculdade', 'concurso')),
  nome text not null unique,
  banca text,
  situacao text not null default 'ativo',
  data_alvo date,
  config jsonb not null default '{}'::jsonb,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

insert into objetivo (tipo, nome, banca, situacao, config)
values ('concurso', 'BACEN Técnico - Área 1', 'Cebraspe', 'preparação', '{"orgao":"Banco Central do Brasil","cargo":"Técnico","area":"1"}'::jsonb)
on conflict (nome) do nothing;

alter table materia add column if not exists objetivo_id uuid references objetivo(id) on delete cascade;
update materia
set objetivo_id = (select id from objetivo where nome = 'BACEN Técnico - Área 1')
where objetivo_id is null;
alter table materia alter column objetivo_id set not null;
alter table materia drop constraint if exists materia_nome_key;
create unique index if not exists idx_materia_objetivo_nome on materia(objetivo_id, nome);
create index if not exists idx_materia_objetivo on materia(objetivo_id);

alter table material add column if not exists objetivo_id uuid references objetivo(id) on delete cascade;
update material mat
set objetivo_id = m.objetivo_id
from materia m
where mat.materia_id = m.id and mat.objetivo_id is null;
alter table material alter column objetivo_id set not null;
create index if not exists idx_material_objetivo on material(objetivo_id, criado_em desc);

alter table questao add column if not exists ultima_resolucao timestamptz;
alter table questao add column if not exists quantidade_tentativas integer not null default 0 check (quantidade_tentativas >= 0);
alter table questao add column if not exists proxima_revisao timestamptz;
alter table questao add column if not exists dificuldade integer not null default 3 check (dificuldade between 1 and 5);
alter table questao add column if not exists estado text not null default 'nova' check (estado in ('nova', 'aprendendo', 'revisao', 'dominada', 'arquivada'));

create table if not exists revisao_item (
  id uuid primary key default gen_random_uuid(),
  questao_id uuid not null references questao(id) on delete cascade,
  motivo text not null check (motivo in ('falsa_certeza', 'erro', 'baixa_confianca', 'checagem')),
  prioridade integer not null check (prioridade between 1 and 4),
  status text not null default 'pendente' check (status in ('pendente', 'concluida')),
  agendada_para timestamptz not null default now(),
  criado_em timestamptz not null default now(),
  concluida_em timestamptz
);
create unique index if not exists idx_revisao_pendente_questao on revisao_item(questao_id) where status = 'pendente';
create index if not exists idx_revisao_fila on revisao_item(status, prioridade, agendada_para);

create table if not exists relato_questao (
  id uuid primary key default gen_random_uuid(),
  questao_id uuid not null references questao(id) on delete cascade,
  motivo text not null check (motivo in ('gabarito_incorreto', 'questao_ambigua', 'fonte_insuficiente', 'conteudo_desatualizado', 'erro_formatacao')),
  detalhe text,
  status text not null default 'aberto' check (status in ('aberto', 'resolvido', 'descartado')),
  criado_em timestamptz not null default now()
);
create index if not exists idx_relato_status on relato_questao(status, criado_em desc);

create table if not exists uso_api (
  id uuid primary key default gen_random_uuid(),
  acao text not null,
  criado_em timestamptz not null default now()
);
create index if not exists idx_uso_api_acao_data on uso_api(acao, criado_em desc);

create table if not exists sessao (
  id uuid primary key default gen_random_uuid(),
  objetivo_id uuid not null references objetivo(id) on delete cascade,
  materia_id uuid references materia(id) on delete set null,
  topico_id uuid references topico(id) on delete set null,
  titulo text not null,
  tipo text not null default 'estudo' check (tipo in ('estudo', 'questoes', 'revisao', 'simulado', 'aula', 'prova', 'trabalho')),
  data date not null,
  duracao_estimada integer not null default 50 check (duracao_estimada > 0),
  duracao_realizada integer check (duracao_realizada >= 0),
  status text not null default 'planejada' check (status in ('planejada', 'feita', 'parcial', 'remanejada')),
  criado_em timestamptz not null default now()
);
create index if not exists idx_sessao_data on sessao(data, objetivo_id);

alter table objetivo enable row level security;
alter table revisao_item enable row level security;
alter table relato_questao enable row level security;
alter table uso_api enable row level security;
alter table sessao enable row level security;
