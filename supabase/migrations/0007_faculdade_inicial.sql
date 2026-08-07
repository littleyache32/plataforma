with faculdade as (
  select id from objetivo where tipo = 'faculdade' and ativo = true order by criado_em limit 1
)
insert into materia (objetivo_id, nome)
select faculdade.id, item.nome
from faculdade
cross join (values
  ('Análise e Produção de Texto'),
  ('Direito das Pessoas e dos Negócios Jurídicos'),
  ('Teoria da Constituição e Direitos Fundamentais'),
  ('Teoria do Crime'),
  ('Teorias da Justiça')
) as item(nome)
on conflict (objetivo_id, nome) do nothing;

insert into topico (materia_id, nome)
select materia.id, 'Conteúdo inicial da disciplina'
from materia
join objetivo on objetivo.id = materia.objetivo_id
where objetivo.tipo = 'faculdade'
on conflict (materia_id, nome) do nothing;

update objetivo
set config = config || jsonb_build_object(
  'indisponibilidades', jsonb_build_array(
    jsonb_build_object('dias', jsonb_build_array('segunda', 'terca', 'quarta', 'quinta'), 'inicio', '08:00', 'fim', '10:50', 'motivo', 'faculdade')
  ),
  'planejamento', jsonb_build_object('modo', 'demanda', 'horarios_visiveis', false)
)
where tipo = 'faculdade' and ativo = true;
