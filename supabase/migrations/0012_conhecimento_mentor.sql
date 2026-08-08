create table if not exists mentor_conhecimento (
  id uuid primary key default gen_random_uuid(),
  versao text not null unique,
  titulo text not null,
  descricao text not null,
  politica jsonb not null,
  evidencias jsonb not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

alter table mentor_conhecimento enable row level security;

insert into mentor_conhecimento (versao, titulo, descricao, politica, evidencias, ativo)
values (
  '2026.08.1',
  'Política adaptativa do mentor',
  'Regras determinísticas e probabilísticas para planejar estudo, revisão e exercícios sem depender de um modelo de IA.',
  '{
    "amostra_minima": 20,
    "janela_maxima": 60,
    "meia_vida_recencia_dias": 21,
    "prior_beta": {"acertos": 2, "erros": 2},
    "limiares": {"dominio": 0.68, "falsa_certeza": 0.12, "melhora_recente": 0.2},
    "pesos_confianca": {
      "certeza": {"acerto": 1.35, "erro": 2.2},
      "duvida": {"acerto": 0.9, "erro": 1.1},
      "eliminacao": {"acerto": 1.05, "erro": 1.2},
      "sem_conhecimento": {"acerto": 0.65, "erro": 1.4}
    },
    "agenda_faculdade": [
      {"dia": 0, "duracao": 60, "aliases": ["direito das pessoas e dos negocios juridicos", "pessoas e negocios juridicos"]},
      {"dia": 1, "duracao": 60, "aliases": ["teoria do crime"]},
      {"dia": 2, "duracao": 60, "aliases": ["teorias da justica", "teoria da justica"]},
      {"dia": 3, "duracao": 60, "aliases": ["teoria da constituicao e direitos fundamentais", "teorias da constituicao", "teoria da constituicao"]}
    ]
  }'::jsonb,
  '[
    {"principio":"pratica_de_recuperacao","fonte":"Roediger e Karpicke, 2006","doi":"10.1111/j.1467-9280.2006.01693.x"},
    {"principio":"pratica_distribuida","fonte":"Cepeda et al., 2006","doi":"10.1037/0033-2909.132.3.354"},
    {"principio":"intercalacao","fonte":"Rohrer e Taylor, 2007","doi":"10.1007/s11251-007-9015-8"},
    {"principio":"feedback_corretivo","fonte":"Butler e Roediger, 2008","doi":"10.3758/MC.36.3.604"},
    {"principio":"erros_de_alta_confianca","fonte":"Butterfield e Metcalfe, 2001","doi":"10.1037/0278-7393.27.6.1491"},
    {"principio":"agendamento_adaptativo","fonte":"Settles e Meeder, 2016","doi":"10.18653/v1/P16-1174"}
  ]'::jsonb,
  true
)
on conflict (versao) do update set
  titulo = excluded.titulo,
  descricao = excluded.descricao,
  politica = excluded.politica,
  evidencias = excluded.evidencias,
  ativo = true;

update mentor_conhecimento set ativo = (versao = '2026.08.1');
