-- Vincula o estudo posterior à aula presencial realmente registrada.
-- Sessões anteriores permanecem intactas e sem vínculo inferido.
alter table sessao add column if not exists aula_origem_id uuid references sessao(id) on delete set null;
create index if not exists idx_sessao_aula_origem on sessao(aula_origem_id) where aula_origem_id is not null;
