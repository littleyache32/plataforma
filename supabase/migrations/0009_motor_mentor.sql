alter table sessao
  add column if not exists origem text not null default 'manual' check (origem in ('manual', 'mentor')),
  add column if not exists chave_mentor text;

create unique index if not exists idx_sessao_chave_mentor
  on sessao(chave_mentor)
  where chave_mentor is not null;

alter table sessao drop constraint if exists sessao_duracao_estimada_check;
alter table sessao add constraint sessao_duracao_estimada_check
  check (
    duracao_estimada > 0
    and (
      tipo in ('simulado', 'prova')
      or duracao_estimada <= 90
    )
  ) not valid;
