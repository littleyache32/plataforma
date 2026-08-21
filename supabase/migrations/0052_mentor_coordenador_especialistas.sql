alter table conhecimento_modulo drop constraint if exists conhecimento_modulo_modulo_check;
alter table conhecimento_modulo add constraint conhecimento_modulo_modulo_check check (modulo in (
  'questoes','question_cards','simulados','mentor',
  'mentor_planejamento','mentor_trilha','mentor_revisao','mentor_desempenho','mentor_academico','mentor_previsao'
));

update conhecimento_modulo set ativo = false, atualizado_em = now() where modulo = 'mentor';

insert into conhecimento_modulo (modulo, versao, titulo, descricao, conteudo, evidencias, ativo)
select 'mentor', '2026.08.21', 'Mentor principal coordenador',
  'Coordena especialistas internos em sinergia sem expor complexidade ao aluno.',
  jsonb_set(
    conteudo,
    '{politica}',
    coalesce(conteudo->'politica', '{}'::jsonb) || '{
      "fase_inicial":{"faculdade_blocos_recuperacao":2,"faculdade_blocos_regular":1,"bacen_blocos_segunda_sexta":2,"bacen_blocos_fim_semana":2,"faculdade_blocos_fim_semana":1,"seguir_ordem_original_pdfs_bacen":true},
      "decisao_semanal":{"nao_emitir_alerta_de_aderencia_antes_do_fechamento":true,"reorganizar_pendencias_sem_descartar":true},
      "parametros_operacionais":{"data_prova_bacen_provisoria":"2027-03-31","revisar_previsao_ao_publicar_edital":true},
      "coordenacao":{"especialistas":["planejamento","trilha","revisao","desempenho","academico","previsao"],"decisao_final":"mentor_principal","compartilhar_sinais":true}
    }'::jsonb,
    true
  ),
  evidencias, true
from conhecimento_modulo
where modulo = 'mentor'
order by criado_em desc limit 1
on conflict (modulo, versao) do update set conteudo = excluded.conteudo, evidencias = excluded.evidencias, ativo = true, atualizado_em = now();

insert into conhecimento_modulo (modulo, versao, titulo, descricao, conteudo, ativo) values
('mentor_planejamento','2026.08.21','Especialista de planejamento','Distribui carga e remaneja pendências.', '{"responsabilidades":["montar_semana","kanban","reorganizar_pendencias","proteger_carga_bacen_e_faculdade"],"sinergia":["mentor_trilha","mentor_academico","mentor_previsao"]}',true),
('mentor_trilha','2026.08.21','Especialista da trilha','Preserva a ordem original dos PDFs e das aulas.', '{"responsabilidades":["seguir_ordem_numerica_dos_pdfs","iniciar_na_primeira_aula_nao_concluida","nunca_saltar_aula_por_rotacao"],"sem_reorganizacao_pedagogica":true}',true),
('mentor_revisao','2026.08.21','Especialista de revisão','Agenda recuperação ativa e revisão espaçada.', '{"responsabilidades":["revisoes_vencidas","erros","duvida","sem_conhecimento","falsa_certeza"],"inicio_pratica_respeita_base":true}',true),
('mentor_desempenho','2026.08.21','Especialista de desempenho','Interpreta retenção, confiança, recência e aderência.', '{"responsabilidades":["medir_retencao_tardia","separar_chute_de_dominio","evitar_mudanca_por_evento_isolado","fechar_semana_antes_de_alertar_aderencia"]}',true),
('mentor_academico','2026.08.21','Especialista acadêmico','Integra faculdade, atrasos, avaliações e continuidade do BACEN.', '{"responsabilidades":["recuperar_materias_atrasadas","aumentar_blocos_em_semana_de_prova","preservar_ao_menos_um_bloco_bacen"],"sem_estado_pessoal":true}',true),
('mentor_previsao','2026.08.21','Especialista de previsão','Projeta cenários até a prova e recalibra após o edital.', '{"responsabilidades":["usar_janela_provavel_pre_edital","estimar_risco_de_cobertura","recalibrar_com_edital_oficial"],"data_provisoria":"2027-03-31"}',true)
on conflict (modulo, versao) do update set titulo = excluded.titulo, descricao = excluded.descricao, conteudo = excluded.conteudo, ativo = true, atualizado_em = now();

insert into mentor_conhecimento (versao,titulo,descricao,politica,evidencias,ativo)
select '2026.08.21', titulo, descricao, conteudo->'politica', evidencias, true
from conhecimento_modulo where modulo = 'mentor' and versao = '2026.08.21'
on conflict (versao) do update set politica = excluded.politica, evidencias = excluded.evidencias, ativo = true;
update mentor_conhecimento set ativo = false where versao <> '2026.08.21';
