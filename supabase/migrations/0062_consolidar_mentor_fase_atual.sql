-- Contexto mutável do mentorado, separado do conhecimento versionado do Mentor.
create table if not exists mentor_contexto (
  id smallint primary key check (id = 1),
  fase text not null,
  vigente_desde date not null,
  semana_inicio date not null,
  dados jsonb not null default '{}'::jsonb,
  atualizado_em timestamptz not null default now()
);

alter table mentor_contexto enable row level security;

-- O encontro coleta somente o que o mentorado quiser informar.
alter table mentor_encontro_semanal alter column carga_percebida drop not null;

insert into mentor_contexto (id, fase, vigente_desde, semana_inicio, dados)
values (1, 'construcao_habito_base_teorica', '2026-09-24', '2026-09-28', '{
  "prioridade_estrutural": "concurso",
  "carga_atual": {"blocos_dia": 3, "concurso": 2, "faculdade": 1, "minutos_bloco": 50, "progressao_por_constancia": true, "capacidade_adicional_primeiro": "concurso"},
  "faculdade": {"estudo_todos_dias": true, "aulas_presenciais": ["segunda", "terca", "quarta", "quinta"], "materias_ciclo": ["Direito das Pessoas e dos Negócios Jurídicos", "Teoria do Crime", "Teoria da Justiça", "Teoria da Constituição e Direitos Fundamentais"]},
  "concurso": {"etapa": "base_teorica", "fonte": "aulas e PDFs do Estratégia", "seguir_ordem_original": true},
  "rotina_pratica": {"questoes": false, "question_cards": false, "revisoes": false},
  "evidencia_dominio": "desconhecida"
}'::jsonb)
on conflict (id) do update set fase = excluded.fase, vigente_desde = excluded.vigente_desde,
  semana_inicio = excluded.semana_inicio, dados = excluded.dados, atualizado_em = now();

-- O histórico permanece acessível, mas só conhecimento_modulo/mentor fica ativo.
update conhecimento_modulo set ativo = false, atualizado_em = now() where modulo = 'mentor';

insert into conhecimento_modulo (modulo, versao, titulo, descricao, conteudo, evidencias, ativo)
select modulo, '2026.09.24.1', titulo,
  'Princípios e parâmetros permanentes. Contexto mutável em mentor_contexto; decisão final do Mentor principal.',
  jsonb_set(conteudo, '{politica}',
    coalesce(conteudo->'politica', '{}'::jsonb)
      - 'fase_inicial' - 'reinicio' - 'retomada' - 'adaptacao_estudo' - 'agenda_faculdade' - 'encontro_semanal',
    true),
  evidencias, true
from conhecimento_modulo where modulo = 'mentor'
order by criado_em desc limit 1
on conflict (modulo, versao) do update set conteudo = excluded.conteudo,
  descricao = excluded.descricao, evidencias = excluded.evidencias, ativo = true, atualizado_em = now();

update mentor_conhecimento set ativo = false where ativo = true;
