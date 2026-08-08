insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('materiais', 'materiais', false, 20971520, array['application/pdf'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

update mentor_conhecimento
set politica = politica || '{
  "faculdade": {
    "metodo": "aula_dada_aula_estudada",
    "dias_de_estudo": ["segunda", "terca", "quarta", "quinta"],
    "sexta_a_domingo": "sem_estudo_regular_de_faculdade_salvo_avaliacao_ou_reprogramacao_do_mentor",
    "adaptar_por_avaliacoes": true
  }
}'::jsonb
where ativo = true;
