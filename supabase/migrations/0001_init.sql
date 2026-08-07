create extension if not exists pgcrypto;

create table if not exists materia (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  criado_em timestamptz not null default now()
);

create table if not exists topico (
  id uuid primary key default gen_random_uuid(),
  materia_id uuid not null references materia(id) on delete cascade,
  nome text not null,
  criado_em timestamptz not null default now(),
  unique (materia_id, nome)
);

create table if not exists questao (
  id uuid primary key default gen_random_uuid(),
  topico_id uuid not null references topico(id) on delete cascade,
  tipo text not null check (tipo in ('CE', 'ME')),
  enunciado text not null,
  alternativas jsonb,
  gabarito text not null,
  explicacao text not null,
  fonte text not null,
  trecho_fonte text not null,
  origem text not null check (origem in ('ia', 'material')),
  usada boolean not null default false,
  marcada_errada boolean not null default false,
  criado_em timestamptz not null default now(),
  constraint questao_formato_check check (
    (tipo = 'CE' and alternativas is null and gabarito in ('C', 'E'))
    or
    (tipo = 'ME' and jsonb_typeof(alternativas) = 'object' and gabarito in ('A', 'B', 'C', 'D', 'E'))
  )
);

create table if not exists registro (
  id uuid primary key default gen_random_uuid(),
  questao_id uuid not null references questao(id) on delete cascade,
  resultado text not null check (resultado in ('acerto', 'erro')),
  classificacao text not null check (classificacao in ('certeza', 'duvida', 'eliminacao', 'sem_conhecimento')),
  tempo integer not null check (tempo >= 0),
  criado_em timestamptz not null default now()
);

create table if not exists material (
  id uuid primary key default gen_random_uuid(),
  materia_id uuid not null references materia(id) on delete cascade,
  tipo text not null check (tipo in ('texto', 'pdf')),
  nome text,
  conteudo text not null,
  status text not null check (status in ('aceito', 'recusado')),
  motivo text not null,
  forcado boolean not null default false,
  criado_em timestamptz not null default now()
);

create table if not exists conhecimento (
  id uuid primary key default gen_random_uuid(),
  materia_id uuid not null references materia(id) on delete cascade,
  topico_id uuid references topico(id) on delete set null,
  trecho text not null,
  origem text not null,
  material_id uuid references material(id) on delete set null,
  criado_em timestamptz not null default now()
);

create table if not exists seeding_job (
  id uuid primary key default gen_random_uuid(),
  topico_id uuid not null references topico(id) on delete cascade,
  quantidade integer not null check (quantidade between 1 and 20),
  status text not null check (status in ('processando', 'concluido', 'erro')),
  geradas integer not null default 0,
  mensagem text,
  criado_em timestamptz not null default now(),
  concluido_em timestamptz
);

create index if not exists idx_topico_materia on topico(materia_id);
create index if not exists idx_questao_baralho on questao(topico_id, usada, marcada_errada);
create index if not exists idx_registro_questao_data on registro(questao_id, criado_em desc);
create index if not exists idx_material_materia_data on material(materia_id, criado_em desc);
create index if not exists idx_conhecimento_topico on conhecimento(topico_id);
create unique index if not exists idx_questao_deduplicacao on questao(topico_id, md5(lower(enunciado)));

alter table materia enable row level security;
alter table topico enable row level security;
alter table questao enable row level security;
alter table registro enable row level security;
alter table material enable row level security;
alter table conhecimento enable row level security;
alter table seeding_job enable row level security;

insert into materia (nome) values
  ('Português e Redação Oficial'),
  ('Raciocínio Lógico e Quantitativo'),
  ('Contabilidade'),
  ('Direito Constitucional'),
  ('Direito Administrativo e Lei 8.112'),
  ('Gestão de Pessoas'),
  ('Gestão de Materiais e Patrimônio'),
  ('Gestão Pública e Ética'),
  ('Informática')
on conflict (nome) do nothing;

insert into topico (materia_id, nome)
select m.id, v.nome
from materia m
join (values
  ('Português e Redação Oficial', 'Compreensão e interpretação de textos'),
  ('Português e Redação Oficial', 'Gramática e emprego da língua portuguesa'),
  ('Português e Redação Oficial', 'Redação oficial'),
  ('Raciocínio Lógico e Quantitativo', 'Lógica proposicional e argumentação'),
  ('Raciocínio Lógico e Quantitativo', 'Estatística'),
  ('Raciocínio Lógico e Quantitativo', 'Matemática financeira'),
  ('Contabilidade', 'Contabilidade geral'),
  ('Contabilidade', 'Demonstrações contábeis'),
  ('Contabilidade', 'Contabilidade pública'),
  ('Direito Constitucional', 'Princípios fundamentais e direitos fundamentais'),
  ('Direito Constitucional', 'Organização do Estado e dos Poderes'),
  ('Direito Constitucional', 'Administração pública na Constituição'),
  ('Direito Administrativo e Lei 8.112', 'Atos e poderes administrativos'),
  ('Direito Administrativo e Lei 8.112', 'Licitações e contratos'),
  ('Direito Administrativo e Lei 8.112', 'Regime jurídico dos servidores públicos federais'),
  ('Gestão de Pessoas', 'Gestão por competências e desempenho'),
  ('Gestão de Pessoas', 'Liderança, motivação e comportamento organizacional'),
  ('Gestão de Materiais e Patrimônio', 'Compras, estoques e armazenagem'),
  ('Gestão de Materiais e Patrimônio', 'Gestão patrimonial'),
  ('Gestão Pública e Ética', 'Modelos e processos de gestão pública'),
  ('Gestão Pública e Ética', 'Ética, integridade e governança pública'),
  ('Informática', 'Segurança da informação'),
  ('Informática', 'Redes, internet e computação em nuvem'),
  ('Informática', 'Sistemas operacionais e ferramentas de escritório')
) as v(materia, nome) on v.materia = m.nome
on conflict (materia_id, nome) do nothing;

