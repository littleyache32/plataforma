-- Consolida a fase inicial e o ciclo de aprendizagem do mentor sem uso de IA externa.

update conhecimento_modulo set ativo = false where modulo = 'mentor';

insert into conhecimento_modulo (modulo, versao, titulo, descricao, conteudo, evidencias, ativo)
values (
  'mentor',
  '2026.08.2',
  'Mentor de aprendizagem e preparação para prova',
  'Política interna para aquisição de base, recuperação ativa, aplicação, correção, revisão espaçada e transferência para a prova.',
  jsonb_build_object(
    'politica', jsonb_build_object(
      'inicio_mentoria', '2026-08-17',
      'criacao_semanal', jsonb_build_object('dia', 'domingo', 'horario_brasilia', '23:30', 'fallback', 'abertura_do_aplicativo_na_segunda'),
      'fase_inicial', jsonb_build_object(
        'inicio', '2026-08-17',
        'fim', '2026-08-30',
        'bacen_minutos_diarios', 180,
        'faculdade_minutos_segunda_quinta', 60,
        'question_cards_faculdade_dias', jsonb_build_array(5, 6),
        'question_cards_faculdade_minutos', 30,
        'questoes_bacen', false,
        'question_cards_bacen', false,
        'simulados', false
      ),
      'aprendizagem', jsonb_build_object(
        'sequencia', jsonb_build_array('aquisicao', 'recuperacao', 'aplicacao', 'correcao', 'reteste', 'transferencia_para_prova'),
        'desbloqueio_pratica', 'topico_estudado',
        'inicio_pratica_bacen', '2026-08-31',
        'preservar_revisoes_anteriores', true,
        'evitar_topico_avancado_nao_estudado', true,
        'revisao', 'priorizar itens vencidos, erros, duvida, sem conhecimento e falsa certeza',
        'aplicacao_prova', 'aumentar mistura de topicos e dificuldade depois da base; simulados somente a partir de 2026-09-07'
      ),
      'decisao_semanal', jsonb_build_object(
        'variaveis', jsonb_build_array('aderencia', 'acerto', 'confianca', 'falsa_certeza', 'recencia', 'revisoes_vencidas', 'provas_faculdade', 'conteudo_estudado'),
        'limite_prioridades', 3,
        'aumentar_carga_somente_apos_duas_semanas_sustentaveis', true,
        'reduzir_acumulo_antes_de_adicionar_carga', true
      ),
      'prioridade_bacen', 1.6,
      'especialistas', jsonb_build_object(
        'planejamento', jsonb_build_object('funcao', 'distribuir carga e manter a progressão sustentável'),
        'conteudo', jsonb_build_object('funcao', 'respeitar a ordem do curso e liberar prática apenas do tópico estudado'),
        'revisao', jsonb_build_object('funcao', 'programar recuperação ativa e revisões espaçadas'),
        'desempenho', jsonb_build_object('funcao', 'usar confiança, recência, aderência e falsa certeza'),
        'auditoria', jsonb_build_object('funcao', 'impedir demanda para tópico bloqueado e prática avançada prematura'),
        'simulados', jsonb_build_object('ativo_a_partir_de', '2026-09-07')
      )
    )
  ),
  jsonb_build_array(
    jsonb_build_object('titulo', 'Organizing Instruction and Study to Improve Student Learning', 'url', 'https://ies.ed.gov/ncee/wwc/PracticeGuide/1'),
    jsonb_build_object('titulo', 'Retrieval practice enhances new learning', 'url', 'https://pubmed.ncbi.nlm.nih.gov/24772101/'),
    jsonb_build_object('titulo', 'The pretesting effect', 'url', 'https://pubmed.ncbi.nlm.nih.gov/19751074/'),
    jsonb_build_object('titulo', 'Repeated retrieval practice and repeated study', 'url', 'https://pubmed.ncbi.nlm.nih.gov/37874486/'),
    jsonb_build_object('titulo', 'Retrieval practice and complex inference caveat', 'url', 'https://pubmed.ncbi.nlm.nih.gov/36760059/'),
    jsonb_build_object('titulo', 'Retrieval success and feedback', 'url', 'https://pubmed.ncbi.nlm.nih.gov/32418183/')
  ),
  true
)
on conflict (modulo, versao) do update
set titulo = excluded.titulo,
    descricao = excluded.descricao,
    conteudo = excluded.conteudo,
    evidencias = excluded.evidencias,
    ativo = true,
    atualizado_em = now();

update mentor_conhecimento
set versao = '2026.08.2',
    politica = politica || jsonb_build_object(
      'fase_inicial', jsonb_build_object(
        'inicio', '2026-08-17', 'fim', '2026-08-30',
        'bacen_minutos_diarios', 180,
        'faculdade_minutos_segunda_quinta', 60,
        'question_cards_faculdade_dias', jsonb_build_array(5, 6),
        'question_cards_faculdade_minutos', 30,
        'questoes_bacen', false, 'question_cards_bacen', false, 'simulados', false
      ),
      'aprendizagem', jsonb_build_object(
        'desbloqueio_pratica', 'topico_estudado',
        'inicio_pratica_bacen', '2026-08-31',
        'preservar_revisoes_anteriores', true,
        'evitar_topico_avancado_nao_estudado', true
      )
    )
where ativo = true;
