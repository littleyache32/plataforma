-- Additive factual links. No history rewrite, fixed calendar or FSRS for questions.
-- scripts/migrate.js owns the transaction, including schema_migration.
-- Do not execute standalone: apply through the canonical migration runner.
alter table public.revisao_item alter column agendada_para drop not null;
alter table public.revisao_item alter column agendada_para drop default;
alter table public.questao add column metadados_revisao jsonb not null default '{}'::jsonb;
alter table public.registro add column revisao_item_id uuid references public.revisao_item(id);
alter table public.registro add column sessao_id uuid references public.sessao(id);
alter table public.registro add column erro_alvo_id uuid references public.registro(id);
alter table public.registro add column topico_id uuid references public.topico(id);
alter table public.material_unidade_curricular add column topico_id uuid references public.topico(id);
alter table public.material_unidade_curricular add column conceito_id text;
create index registro_revisao_execucao_idx on public.registro(revisao_item_id, criado_em);
