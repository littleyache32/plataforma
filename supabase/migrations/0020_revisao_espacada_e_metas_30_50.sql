alter table questao
  add column if not exists intervalo_dias numeric not null default 0 check (intervalo_dias >= 0),
  add column if not exists fator_facilidade numeric not null default 2.5 check (fator_facilidade between 1.3 and 4),
  add column if not exists lapsos integer not null default 0 check (lapsos >= 0),
  add column if not exists acertos_seguidos integer not null default 0 check (acertos_seguidos >= 0);

alter table question_card
  add column if not exists tipo_card text not null default 'recordacao'
    check (tipo_card in ('recordacao','distincao','aplicacao','excecao','correcao'));

create table if not exists questao_auditoria (
  id uuid primary key default gen_random_uuid(),
  questao_id uuid not null unique references questao(id) on delete cascade,
  status text not null check (status in ('aprovada','arquivada')),
  criterios jsonb not null default '{}'::jsonb,
  motivos text[] not null default '{}',
  auditado_em timestamptz not null default now()
);
alter table questao_auditoria enable row level security;
create index if not exists idx_questao_auditoria_status on questao_auditoria(status, auditado_em desc);

create table if not exists question_card_auditoria (
  id uuid primary key default gen_random_uuid(),
  question_card_id uuid not null unique references question_card(id) on delete cascade,
  status text not null check (status in ('aprovado','arquivado')),
  criterios jsonb not null default '{}'::jsonb,
  motivos text[] not null default '{}',
  auditado_em timestamptz not null default now()
);
alter table question_card_auditoria enable row level security;
create index if not exists idx_question_card_auditoria_status on question_card_auditoria(status, auditado_em desc);

update acervo_meta
set questoes_alvo = 30,
    cards_alvo = 50,
    atualizado_em = now();

create index if not exists idx_questao_revisao_espacada
  on questao(ativa, marcada_errada, proxima_revisao, topico_id);

update mentor_conhecimento
set politica = politica || '{
  "revisao_espacada": {
    "retencao_desejada": 0.90,
    "priorizar_vencidas": true,
    "questoes_como_recuperacao_ativa": true,
    "incluir_demanda_semanal": true,
    "duracao_demanda_minutos": 30,
    "maximo_uma_demanda_por_dia": true
  },
  "qualidade_flashcards": {
    "principio_informacao_minima": true,
    "recuperacao_ativa": true,
    "uma_pergunta_por_card": true,
    "misturar_recordacao_distincao_aplicacao_excecao_correcao": true
  },
  "acervo": {"questoes_por_topico":30,"cards_por_topico":50}
}'::jsonb,
evidencias = evidencias || '[
  {"principio":"pratica_de_recuperacao","fonte":"Karpicke e Blunt, Science, 2011","doi":"10.1126/science.1199327"},
  {"principio":"espacamento_em_flashcards","fonte":"Kornell, Applied Cognitive Psychology, 2009","doi":"10.1002/acp.1537"},
  {"principio":"intercalacao_de_recuperacao","fonte":"Sana e Yan, Psychological Science, 2022","doi":"10.1177/09567976211057507"},
  {"principio":"retencao_alvo_equilibrada","fonte":"Anki Manual, FSRS","url":"https://docs.ankiweb.net/deck-options.html#fsrs"}
]'::jsonb
where ativo = true;
