alter table tempo_estudo
  add column if not exists duracao_alvo_segundos integer
  check (duracao_alvo_segundos is null or duracao_alvo_segundos between 60 and 43200);
