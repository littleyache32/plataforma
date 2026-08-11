-- Reinicia o ciclo de estudo em 17/08/2026 e substitui o acervo didatico
-- anterior. O conhecimento operacional do mentor e preservado.

delete from conhecimento
where materia_id in (
  select m.id from materia m join objetivo o on o.id = m.objetivo_id
  where o.tipo in ('concurso', 'faculdade')
);

delete from material
where objetivo_id in (
  select id from objetivo where tipo in ('concurso', 'faculdade')
);

delete from sessao where data < date '2026-08-17';
delete from mentor_execucao where semana_inicio < date '2026-08-17';
delete from mentor_previsao where semana_inicio < date '2026-08-17';

update acervo_meta am
set expansao_bloqueada = true,
    motivo_bloqueio = 'Aguardando fonte validada do Estrategia para este topico.',
    atualizado_em = now()
where exists (
  select 1 from topico t join materia m on m.id = t.materia_id
  join objetivo o on o.id = m.objetivo_id
  where t.id = am.topico_id and o.tipo = 'concurso'
);

update conhecimento_modulo set ativo = false where modulo = 'mentor';
insert into conhecimento_modulo (modulo, versao, titulo, descricao, conteudo, evidencias, ativo)
values (
  'mentor',
  '2026.08.17',
  'Mentor principal e especialistas para o novo ciclo',
  'Politica do mentor principal e dos especialistas internos a partir do inicio real em 17 de agosto.',
  jsonb_build_object(
    'politica', jsonb_build_object(
      'inicio_mentoria', '2026-08-17',
      'criacao_semanal', jsonb_build_object('dia', 'domingo', 'horario_brasilia', '23:30', 'fallback', 'abertura_do_aplicativo_na_segunda'),
      'fase_inicial', jsonb_build_object('fim', '2026-08-30', 'minutos_diarios', 180, 'questoes', false, 'question_cards', false, 'simulados', false),
      'prioridade_bacen', 1.6,
      'especialistas', jsonb_build_object(
        'planejamento', jsonb_build_object('funcao', 'distribuir carga, variar disciplinas e remanejar pendencias sem exceder limites'),
        'conteudo', jsonb_build_object('funcao', 'liberar somente topicos sustentados por material validado e acompanhar cobertura'),
        'revisao', jsonb_build_object('funcao', 'programar revisoes espacadas quando a pratica for liberada'),
        'desempenho', jsonb_build_object('funcao', 'usar confianca, recencia, falsa certeza e tamanho da amostra'),
        'auditoria', jsonb_build_object('funcao', 'impedir demanda, questao ou card sem fonte suficiente'),
        'simulados', jsonb_build_object('ativo', false)
      )
    )
  ),
  '[]'::jsonb,
  true
)
on conflict (modulo, versao) do update
set titulo = excluded.titulo, descricao = excluded.descricao,
    conteudo = excluded.conteudo, evidencias = excluded.evidencias,
    ativo = true, atualizado_em = now();
