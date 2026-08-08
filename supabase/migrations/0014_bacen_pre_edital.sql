update acervo_meta
set expansao_bloqueada=false,
    motivo_bloqueio=null,
    atualizado_em=now()
where topico_id in (
  select t.id from topico t
  join materia m on m.id=t.materia_id
  join objetivo o on o.id=m.objetivo_id
  where o.tipo='concurso'
);

update objetivo
set situacao='pre_edital',
    config=config || '{"estrategia":"pre_edital","referencial_provisorio":true,"adaptar_quando_novo_edital":true}'::jsonb
where tipo='concurso' and ativo=true;

update mentor_conhecimento
set politica=politica || '{"bacen_pre_edital":true,"adaptacao_novo_edital":true,"preservar_conteudo_compativel":true}'::jsonb
where versao='2026.08.2';
