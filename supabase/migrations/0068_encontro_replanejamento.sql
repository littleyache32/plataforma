alter table mentor_encontro_semanal
  add column if not exists fatos jsonb not null default '{}'::jsonb;

alter table sessao
  add column if not exists cancelamento_origem text
  check (cancelamento_origem in ('usuario', 'mentor'));

alter table sessao drop constraint if exists sessao_status_check;
alter table sessao add constraint sessao_status_check
  check (status in ('planejada', 'feita', 'parcial', 'remanejada', 'cancelada', 'nao_concluida'));

-- Cancelamentos anteriores sem origem foram feitos pelo usuario ou pelo planner.
-- Mantemos todos protegidos; somente os novos cancelamentos do Mentor sao reversiveis.
update sessao set cancelamento_origem = 'usuario'
where status = 'cancelada' and cancelamento_origem is null;

alter table mentor_decisao add column if not exists chave_operacao text;
create unique index if not exists mentor_decisao_chave_operacao_idx
  on mentor_decisao(chave_operacao);
