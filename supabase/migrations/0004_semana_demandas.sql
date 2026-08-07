alter table sessao
  add column if not exists prioridade smallint not null default 2 check (prioridade between 1 and 4),
  add column if not exists movida_em timestamptz;

alter table sessao drop constraint if exists sessao_tipo_check;
alter table sessao add constraint sessao_tipo_check
  check (tipo in ('estudo', 'revisao', 'exercicio', 'especial', 'questoes', 'simulado', 'aula', 'prova', 'trabalho'));

create index if not exists idx_sessao_semana on sessao(data, status, prioridade);
