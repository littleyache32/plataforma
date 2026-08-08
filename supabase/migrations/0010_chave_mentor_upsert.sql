drop index if exists idx_sessao_chave_mentor;

create unique index idx_sessao_chave_mentor
  on sessao(chave_mentor);
