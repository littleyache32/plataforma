-- Limpeza integral solicitada em 11/08/2026.
-- Mantem objetivos, materias, topicos, materiais, conhecimento e planejamento.

delete from simulado
where objetivo_id in (
  select id from objetivo where tipo in ('concurso', 'faculdade')
);

delete from question_card
where objetivo_id in (
  select id from objetivo where tipo in ('concurso', 'faculdade')
);

delete from questao
where topico_id in (
  select t.id
  from topico t
  join materia m on m.id = t.materia_id
  join objetivo o on o.id = m.objetivo_id
  where o.tipo in ('concurso', 'faculdade')
);
