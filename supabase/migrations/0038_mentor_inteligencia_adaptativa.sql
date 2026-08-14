-- Versao 2026.08.3: conhecimento operacional do mentor, sem uso de IA externa.

update conhecimento_modulo set ativo = false where modulo = 'mentor';

insert into conhecimento_modulo (modulo, versao, titulo, descricao, conteudo, evidencias, ativo)
values (
  'mentor',
  '2026.08.3',
  'Mentor adaptativo orientado por evidencias',
  'Conhecimento operacional para progredir carga, construir base, recuperar memoria, calibrar confianca e preparar para provas sem sobrecarga prematura.',
  jsonb_build_object(
    'politica', jsonb_build_object(
      'inicio_mentoria', '2026-08-17',
      'criacao_semanal', jsonb_build_object('dia', 'domingo', 'horario_brasilia', '00:00', 'fallback', 'abertura_do_aplicativo_no_domingo_ou_segunda'),
      'fase_inicial', jsonb_build_object(
        'inicio', '2026-08-17', 'fim', '2026-08-30',
        'faculdade_minutos_segunda_quinta', 60,
        'semanas', jsonb_build_array(
          jsonb_build_object('inicio', '2026-08-17', 'fim', '2026-08-23', 'segunda_sexta', 120, 'sabado', 120, 'domingo', 120),
          jsonb_build_object('inicio', '2026-08-24', 'fim', '2026-08-30', 'segunda_sexta', 180, 'sabado', 180, 'domingo', 120)
        ),
        'question_cards_faculdade_dias', jsonb_build_array(),
        'question_cards_faculdade_minutos', 0,
        'questoes_bacen', false, 'question_cards_bacen', false, 'simulados', false
      ),
      'progressao_carga', jsonb_build_object(
        'incremento_minutos', 60,
        'minimo_segunda_sexta', 120,
        'maximo_segunda_sexta', 420,
        'maximo_sabado', 240,
        'maximo_domingo', 180,
        'reduzir_abaixo_de', 0.70,
        'aumentar_acima_de', 0.85,
        'semanas_para_aumentar', 2,
        'maximo_pendencias_para_aumentar', 3,
        'ignorar_tempo_excedente_quando_concluida', true
      ),
      'decisao_semanal', jsonb_build_object(
        'fontes', jsonb_build_array('aderencia_ponderada', 'pendencias', 'revisoes_vencidas', 'dominio', 'falsa_certeza', 'recencia', 'provas_faculdade', 'conteudo_estudado'),
        'amostra_minima_desempenho', 20,
        'maximo_prioridades', 3,
        'alterar_uma_variavel_estrutural_por_semana', true,
        'fallback_sem_dados', 'manter_carga'
      ),
      'didatica', jsonb_build_object(
        'iniciante', 'aquisicao_guiada_antes_da_pratica_intensiva',
        'recuperacao', 'tentar_responder_antes_de_ver_feedback',
        'feedback', 'imediato_apos_resposta_quando_houver_erro_duvida_ou_sem_conhecimento',
        'espacamento', 'intervalo_cresce_com_sucesso_e_encurta_com_erro',
        'intercalacao', 'misturar_topicos_somente_depois_de_base_minima_em_cada_um',
        'metacognicao', 'confrontar_confianca_com_resultado_real',
        'prioridade', 'revisoes_vencidas_e_falsa_certeza_antes_de_conteudo_novo'
      ),
      'guardrails', jsonb_build_object(
        'nao_inferir_dominio_com_menos_de_20_respostas', true,
        'nao_aumentar_com_acumulo', true,
        'nao_criar_pratica_para_topico_nao_estudado', true,
        'nao_inventar_risco_sem_data_de_prova', true,
        'nao_usar_estado_pessoal_inferido', true,
        'preservar_ordem_do_curso', true
      ),
      'especialistas', jsonb_build_object(
        'planejamento', jsonb_build_object('funcao', 'definir carga sustentavel, distribuir disciplinas e remanejar no maximo tres pendencias'),
        'aprendizagem', jsonb_build_object('funcao', 'coordenar aquisicao, recuperacao, feedback, espacamento e intercalacao'),
        'revisao', jsonb_build_object('funcao', 'priorizar vencimentos, erros, duvida, sem conhecimento e falsa certeza'),
        'calibracao', jsonb_build_object('funcao', 'comparar confianca declarada com resultado para detectar ilusao de dominio'),
        'desempenho', jsonb_build_object('funcao', 'usar amostra, recencia, tendencia e incerteza antes de recomendar prioridade'),
        'trajetoria', jsonb_build_object('funcao', 'projetar cobertura e risco apenas quando houver data-alvo'),
        'auditoria', jsonb_build_object('funcao', 'bloquear duplicidade, sobrecarga, pratica prematura e decisao sem evidencia'),
        'simulados', jsonb_build_object('ativo_a_partir_de', '2026-09-07')
      )
    )
  ),
  jsonb_build_array(
    jsonb_build_object('principio', 'pratica_distribuida_recuperacao_perguntas_profundas', 'titulo', 'Organizing Instruction and Study to Improve Student Learning', 'url', 'https://ies.ed.gov/ncee/wwc/PracticeGuide/1'),
    jsonb_build_object('principio', 'ciclo_continuo_de_decisao_por_dados', 'titulo', 'Using Student Achievement Data to Support Instructional Decision Making', 'url', 'https://ies.ed.gov/ncee/wwc/practiceguide/12'),
    jsonb_build_object('principio', 'espacamento_depende_do_horizonte_de_retencao', 'titulo', 'The spacing effect stands up to big data', 'url', 'https://pubmed.ncbi.nlm.nih.gov/30623389/'),
    jsonb_build_object('principio', 'recuperacao_expandida_mantem_recordacao_ao_longo_do_tempo', 'titulo', 'Retrieval practice over the long term', 'url', 'https://pubmed.ncbi.nlm.nih.gov/24744260/'),
    jsonb_build_object('principio', 'confianca_e_fluencia_ajudam_a_calibrar_aprendizagem', 'titulo', 'Retrieval Practice Facilitates Judgments of Learning', 'url', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6509741/'),
    jsonb_build_object('principio', 'intercalacao_favorece_discriminacao_e_retencao', 'titulo', 'Why does interleaving improve math learning?', 'url', 'https://pubmed.ncbi.nlm.nih.gov/30877483/'),
    jsonb_build_object('principio', 'avaliacao_pessoal_pode_permanecer_descalibrada', 'titulo', 'Persistent Miscalibration for Low and High Achievers', 'url', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC8442020/')
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
set versao = '2026.08.3',
    politica = politica || jsonb_build_object(
      'fase_inicial', jsonb_build_object(
        'inicio', '2026-08-17', 'fim', '2026-08-30',
        'faculdade_minutos_segunda_quinta', 60,
        'semanas', jsonb_build_array(
          jsonb_build_object('inicio', '2026-08-17', 'fim', '2026-08-23', 'segunda_sexta', 120, 'sabado', 120, 'domingo', 120),
          jsonb_build_object('inicio', '2026-08-24', 'fim', '2026-08-30', 'segunda_sexta', 180, 'sabado', 180, 'domingo', 120)
        ),
        'question_cards_faculdade_dias', jsonb_build_array(), 'question_cards_faculdade_minutos', 0,
        'questoes_bacen', false, 'question_cards_bacen', false, 'simulados', false
      ),
      'progressao_carga', jsonb_build_object(
        'incremento_minutos', 60, 'minimo_segunda_sexta', 120, 'maximo_segunda_sexta', 420,
        'maximo_sabado', 240, 'maximo_domingo', 180, 'reduzir_abaixo_de', 0.70,
        'aumentar_acima_de', 0.85, 'semanas_para_aumentar', 2, 'maximo_pendencias_para_aumentar', 3
      )
    )
where ativo = true;
