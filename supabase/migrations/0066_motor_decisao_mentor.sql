-- Fase 4: parâmetros da decisão vigente em uma única policy modular.
-- Não altera progresso, sessões nem datas do ciclo.
alter table sessao add column if not exists reason_codes jsonb not null default '[]'::jsonb;

do $$
declare
  current_knowledge conhecimento_modulo%rowtype;
begin
  select * into current_knowledge
  from conhecimento_modulo
  where modulo = 'mentor' and ativo = true
  order by criado_em desc limit 1;
  if not found then
    raise exception 'Conhecimento modular ativo do Mentor ausente';
  end if;

  update conhecimento_modulo set ativo = false, atualizado_em = now()
  where modulo = 'mentor' and ativo = true;

  insert into conhecimento_modulo (modulo, versao, titulo, descricao, conteudo, evidencias, ativo)
  values (
    'mentor', '2026.10.02.2', current_knowledge.titulo,
    'Princípios permanentes e policy determinística. Contexto mutável permanece em mentor_contexto.',
    jsonb_set(current_knowledge.conteudo, '{politica,motor_decisao}', '{
      "minimo_demandas_janela": 5,
      "aderencia_reducao": 0.7,
      "aderencia_aumento": 0.85,
      "maximo_pendencias_aumento": 3,
      "minimo_bacen_blocos": 2
    }'::jsonb, true),
    current_knowledge.evidencias, true
  )
  on conflict (modulo, versao) do update set
    conteudo = excluded.conteudo,
    descricao = excluded.descricao,
    evidencias = excluded.evidencias,
    ativo = true,
    atualizado_em = now();
end $$;
