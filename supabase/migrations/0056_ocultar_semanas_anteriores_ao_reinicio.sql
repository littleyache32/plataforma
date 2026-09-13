begin;

-- As conclusoes anteriores continuam como memoria da trilha. Somente demandas
-- ainda pendentes e anteriores ao novo inicio deixam de existir na Semana.
delete from sessao
where status <> 'feita'
  and data < date '2026-09-14';

commit;
