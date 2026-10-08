-- Prepared locally only. Preserve all historical dates and factual records.
alter table revisao_item alter column agendada_para drop not null;
alter table revisao_item alter column agendada_para drop default;
alter table registro add column if not exists revisao_item_id uuid references revisao_item(id);
alter table registro add column if not exists sessao_id uuid references sessao(id);
alter table registro add column if not exists erro_alvo_id uuid references registro(id);
create index if not exists registro_revisao_factual_idx on registro(revisao_item_id, criado_em);
-- Explicit optional curricular association. Never infer it from subject names.
alter table material_unidade_curricular add column if not exists topico_id uuid references topico(id);
