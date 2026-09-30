-- Fase 1: contexto vigente a partir de 02/10; versões anteriores ficam históricas.
insert into mentor_contexto (id, fase, vigente_desde, semana_inicio, dados)
values (1, 'adaptacao_teorica_1', '2026-10-02', '2026-10-02', '{
  "prioridade_estrutural": "concurso",
  "inicio": "2026-10-02",
  "fim_etapa_1": "2026-10-08",
  "fim_etapa_2": "2026-10-15",
  "etapa_1": {"concurso": 2, "faculdade": 1, "duracao": 50, "modalidade": "estudo"},
  "etapa_2": {"concurso": 3, "faculdade": 1, "duracao": 50, "modalidade": "estudo"},
  "carga_atual": {"concurso": 3, "faculdade": 1, "minutos_bloco": 50, "progressao_por_constancia": true, "capacidade_adicional_primeiro": "concurso"},
  "rotina_pratica": {"questoes": false, "question_cards": false, "revisao_pratica": false, "simulados": false},
  "faculdade": {"estudo_todos_dias": true, "aulas_presenciais": ["segunda", "terca", "quarta", "quinta"]},
  "concurso": {"etapa": "base_teorica", "fonte": "conjunto vigente de aulas e PDFs do Estratégia", "seguir_ordem_original": true},
  "evidencia_dominio": "desconhecida"
}'::jsonb)
on conflict (id) do update set fase = excluded.fase, vigente_desde = excluded.vigente_desde,
  semana_inicio = excluded.semana_inicio, dados = excluded.dados, atualizado_em = now();

update conhecimento_modulo set ativo = false, atualizado_em = now() where modulo = 'mentor' and ativo;
insert into conhecimento_modulo (modulo, versao, titulo, descricao, conteudo, evidencias, ativo)
select modulo, '2026.10.02.1', titulo,
  'Princípios permanentes. Carga e liberação de prática pertencem a mentor_contexto.',
  jsonb_set(conteudo, '{politica}',
    coalesce(conteudo->'politica', '{}'::jsonb)
      - 'expansao_questoes' - 'progressao_carga' - 'fase_inicial' - 'reinicio'
      - 'retomada' - 'adaptacao_estudo' - 'agenda_faculdade' - 'encontro_semanal', true),
  evidencias, true
from conhecimento_modulo where modulo = 'mentor'
order by criado_em desc limit 1
on conflict (modulo, versao) do update set conteudo = excluded.conteudo,
  descricao = excluded.descricao, evidencias = excluded.evidencias, ativo = true, atualizado_em = now();

update mentor_conhecimento set ativo = false where ativo = true;

-- Pendências do ciclo anterior não viram dívida. Não tocar em sessões feitas nem em tempo.
update sessao set status = 'cancelada'
where status = 'planejada' and data < '2026-10-02' and data >= '2026-09-28';
