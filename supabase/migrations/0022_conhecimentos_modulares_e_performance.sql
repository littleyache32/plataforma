create table if not exists conhecimento_modulo (
  id uuid primary key default gen_random_uuid(),
  modulo text not null check (modulo in ('questoes', 'question_cards', 'simulados', 'mentor')),
  versao text not null,
  titulo text not null,
  descricao text,
  conteudo jsonb not null default '{}'::jsonb,
  evidencias jsonb not null default '[]'::jsonb,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (modulo, versao)
);

alter table conhecimento_modulo enable row level security;

insert into conhecimento_modulo (modulo, versao, titulo, descricao, conteudo)
values (
  'questoes', '2026.08.10', 'Conhecimento de questões',
  'Regras conjuntas para questões objetivas e discursivas.',
  jsonb_build_object(
    'objetivas', jsonb_build_object(
      'status', 'ativo', 'formatos', jsonb_build_array('CE', 'ME'),
      'meta_por_topico', 30, 'dificuldade', jsonb_build_object('facil', 60, 'media', 30, 'dificil', 10),
      'fonte_obrigatoria', true, 'revisao_espacada', true,
      'classificacoes', jsonb_build_array('certeza', 'duvida', 'eliminacao', 'sem_conhecimento'),
      'mostrar_explicacao', jsonb_build_array('erro', 'acerto_com_duvida', 'acerto_sem_conhecimento')
    ),
    'discursivas', jsonb_build_object('status', 'bloqueado', 'banco_criado', false, 'fonte_obrigatoria', true, 'padrao_resposta_obrigatorio', true)
  )
)
on conflict (modulo, versao) do update set conteudo = excluded.conteudo, atualizado_em = now();

insert into conhecimento_modulo (modulo, versao, titulo, descricao, conteudo)
values (
  'question_cards', '2026.08.10', 'Conhecimento de Question Cards',
  'Regras próprias de construção e revisão dos Question Cards.',
  jsonb_build_object(
    'status', 'ativo', 'meta_por_topico', 50, 'revisao_espacada', true,
    'principios', jsonb_build_array('recuperacao_ativa', 'uma_ideia_por_card', 'pergunta_especifica', 'resposta_curta', 'fonte_verificavel', 'sem_duplicidade'),
    'tipos', jsonb_build_array('conceito', 'cloze', 'distincao', 'caso_curto', 'erro_frequente'),
    'exclusoes', jsonb_build_array('Analise e Producao de Texto')
  )
)
on conflict (modulo, versao) do update set conteudo = excluded.conteudo, atualizado_em = now();

insert into conhecimento_modulo (modulo, versao, titulo, descricao, conteudo, evidencias)
select 'mentor', '2026.08.10', 'Conhecimento do mentor adaptativo',
  'Política de maximização do estudo para Faculdade e BACEN.',
  jsonb_build_object(
    'politica', coalesce(politica, '{}'::jsonb),
    'rotina', jsonb_build_object(
      'fase_inicial', jsonb_build_object('inicio', '2026-08-10', 'fim', '2026-08-23', 'minutos_dia', 180, 'faculdade_minutos', 60, 'bacen_minutos', 120, 'somente_estudo', true),
      'faculdade', jsonb_build_object('segunda', 'Pessoas e Negocios Juridicos', 'terca', 'Teoria do Crime', 'quarta', 'Teoria da Justica', 'quinta', 'Teoria da Constituicao'),
      'prioridade_real', 'BACEN', 'atividade_maxima_minutos', 90, 'simulados_liberados_em', '2026-09-07'
    ),
    'demandas', jsonb_build_object('planejamento_semanal', true, 'remanejar_pendencias', true, 'reordenacao_apenas_no_mesmo_dia', true, 'revisoes_como_demanda', true),
    'decisao', jsonb_build_object('usar_desempenho_recente', true, 'falsa_certeza_pesa_mais', true, 'reduzir_carga_quando_melhora', true, 'manter_revisao_espacada', true, 'maximo_prioridades', 3),
    'especialistas', jsonb_build_object(
      'planejamento_semanal', jsonb_build_object('status', 'ativo', 'responsabilidade', 'distribuir carga, prioridades e pendencias'),
      'revisao_espacada', jsonb_build_object('status', 'ativo', 'responsabilidade', 'programar revisoes de questoes e Question Cards'),
      'diagnostico_desempenho', jsonb_build_object('status', 'ativo', 'responsabilidade', 'medir dominio, falsa certeza, recencia e risco'),
      'auditoria_acervo', jsonb_build_object('status', 'ativo', 'responsabilidade', 'monitorar cobertura, qualidade e duplicidade'),
      'preparacao_simulados', jsonb_build_object('status', 'inativo', 'responsabilidade', 'liberar e montar simulados quando autorizado')
    )
  ),
  coalesce(evidencias, '[]'::jsonb)
from mentor_conhecimento
where ativo = true
order by criado_em desc
limit 1
on conflict (modulo, versao) do update set conteudo = excluded.conteudo, evidencias = excluded.evidencias, atualizado_em = now();

create or replace view mentor_acervo_topico as
with questoes as (
  select topico_id,
    count(*) filter (where ativa and not marcada_errada and estado <> 'arquivada') as total_questoes,
    count(*) filter (where ativa and not marcada_errada and estado <> 'arquivada' and not usada) as questoes_ineditas,
    count(*) filter (where ativa and not marcada_errada and estado <> 'arquivada' and proxima_revisao <= now()) as questoes_vencidas
  from questao group by topico_id
), cards as (
  select topico_id,
    count(*) filter (where ativa) as total_cards,
    count(*) filter (where ativa and proxima_revisao <= now()) as cards_vencidos
  from question_card group by topico_id
)
select t.id as topico_id,
  coalesce(q.total_questoes, 0)::integer as total_questoes,
  coalesce(q.questoes_ineditas, 0)::integer as questoes_ineditas,
  coalesce(q.questoes_vencidas, 0)::integer as questoes_vencidas,
  coalesce(c.total_cards, 0)::integer as total_cards,
  coalesce(c.cards_vencidos, 0)::integer as cards_vencidos
from topico t
left join questoes q on q.topico_id = t.id
left join cards c on c.topico_id = t.id;

create index if not exists questao_fila_pratica_idx on questao (topico_id, ativa, marcada_errada, estado, proxima_revisao, quantidade_tentativas, ultima_resolucao);
create index if not exists question_card_fila_revisao_idx on question_card (objetivo_id, materia_id, topico_id, ativa, proxima_revisao);
