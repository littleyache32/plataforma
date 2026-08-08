create table if not exists mentor_execucao (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('diaria','semanal','manual')),
  semana_inicio date not null,
  status text not null check (status in ('iniciada','concluida','falhou')),
  data_execucao date not null,
  politica_versao text,
  entrada jsonb not null default '{}'::jsonb,
  resultado jsonb not null default '{}'::jsonb,
  erro text,
  iniciado_em timestamptz not null default now(),
  concluido_em timestamptz
);
create unique index if not exists idx_mentor_execucao_unica on mentor_execucao(tipo, semana_inicio, data_execucao) where status = 'concluida';
alter table mentor_execucao enable row level security;

create table if not exists mentor_decisao (
  id uuid primary key default gen_random_uuid(),
  execucao_id uuid references mentor_execucao(id) on delete cascade,
  topico_id uuid references topico(id) on delete cascade,
  tipo text not null,
  decisao text not null,
  justificativa text not null,
  confianca numeric(5,4),
  dados jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now()
);
alter table mentor_decisao enable row level security;

create table if not exists mentor_previsao (
  id uuid primary key default gen_random_uuid(),
  objetivo_id uuid not null references objetivo(id) on delete cascade,
  semana_inicio date not null,
  cenario text not null check (cenario in ('conservador','provavel','acelerado')),
  cobertura_estimada numeric(5,2) not null,
  horas_restantes numeric(8,2) not null,
  risco_atraso numeric(5,4) not null,
  detalhes jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  unique(objetivo_id, semana_inicio, cenario)
);
alter table mentor_previsao enable row level security;

create table if not exists mentor_experimento (
  id uuid primary key default gen_random_uuid(),
  objetivo_id uuid references objetivo(id) on delete cascade,
  hipotese text not null,
  variavel text not null,
  criterio_sucesso text not null,
  carga_percentual numeric(5,2) not null check (carga_percentual between 0 and 10),
  status text not null default 'planejado' check (status in ('planejado','ativo','concluido','interrompido')),
  resultado jsonb not null default '{}'::jsonb,
  inicio date,
  fim date,
  criado_em timestamptz not null default now()
);
alter table mentor_experimento enable row level security;

create table if not exists acervo_meta (
  topico_id uuid primary key references topico(id) on delete cascade,
  questoes_alvo integer not null default 100 check (questoes_alvo > 0),
  cards_alvo integer not null default 50 check (cards_alvo > 0),
  expansao_bloqueada boolean not null default false,
  motivo_bloqueio text,
  atualizado_em timestamptz not null default now()
);
alter table acervo_meta enable row level security;

insert into acervo_meta (topico_id,expansao_bloqueada,motivo_bloqueio)
select t.id,
  case when o.tipo = 'concurso' then true else false end,
  case when o.tipo = 'concurso' then 'Aguardando validação do concurso, cargo, edital e data da prova.' else null end
from topico t
join materia m on m.id=t.materia_id
join objetivo o on o.id=m.objetivo_id
where lower(m.nome) not in ('análise e produção de texto','analise e producao de texto')
on conflict (topico_id) do update set
  expansao_bloqueada=excluded.expansao_bloqueada,
  motivo_bloqueio=excluded.motivo_bloqueio,
  atualizado_em=now();

alter table questao add column if not exists subtopico text;
alter table questao add column if not exists verificada_em timestamptz;
alter table question_card add column if not exists dificuldade smallint default 3 check (dificuldade between 1 and 5);
alter table question_card add column if not exists introduzido_em timestamptz;
alter table question_card add column if not exists ativo boolean not null default true;

update mentor_conhecimento set ativo = false;
insert into mentor_conhecimento (versao,titulo,descricao,politica,evidencias,ativo)
select '2026.08.2','Ecossistema adaptativo do mentor','Política com previsão, cenários, aprendizagem semanal, experimentação limitada e prioridade estrutural do BACEN.',
  politica || '{"prioridade_bacen":1.6,"experimento_maximo_percentual":10,"carga_inicial_minutos":180,"carga_maxima_minutos":480,"incremento_minutos":30,"conclusao_para_incremento":0.85,"cards_bacen_diarios":30,"cards_faculdade_dias":[4,5]}'::jsonb,
  evidencias || '[{"principio":"reaprendizagem_sucessiva","fonte":"Rawson et al., 2018","doi":"10.1037/xap0000146"},{"principio":"aprendizagem_por_dominio","fonte":"Kulik et al., 1990","doi":"10.3102/00346543060002265"},{"principio":"teoria_resposta_item","fonte":"Chen et al., 2021","url":"https://arxiv.org/abs/2108.08604"},{"principio":"experimentacao_adaptativa","fonte":"Clement et al., 2015","url":"https://jedm.educationaldatamining.org/index.php/JEDM/article/view/JEDM111"}]'::jsonb,
  true from mentor_conhecimento where versao='2026.08.1'
on conflict (versao) do update set politica=excluded.politica,evidencias=excluded.evidencias,ativo=true;
