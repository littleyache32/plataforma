insert into objetivo (tipo, nome, situacao, config)
select 'faculdade', 'Faculdade', 'ativo', '{"descricao":"Contexto acadêmico pessoal"}'::jsonb
where not exists (
  select 1 from objetivo where tipo = 'faculdade' and ativo = true
);
