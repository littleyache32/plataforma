alter table question_card
  add column if not exists intervalo_dias numeric not null default 0 check (intervalo_dias >= 0),
  add column if not exists fator_facilidade numeric not null default 2.5 check (fator_facilidade between 1.3 and 4),
  add column if not exists lapsos integer not null default 0 check (lapsos >= 0);

alter table question_card_registro drop constraint if exists question_card_registro_resultado_check;
alter table question_card_registro add constraint question_card_registro_resultado_check
  check (resultado in ('novamente', 'dificil', 'bom', 'facil', 'lembrei', 'revisar'));

alter table sessao alter column duracao_estimada set default 30;

create index if not exists idx_questao_topico_estado
  on questao(topico_id, estado, marcada_errada, proxima_revisao);

