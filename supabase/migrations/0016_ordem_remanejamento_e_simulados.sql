alter table sessao
  add column if not exists ordem integer not null default 0,
  add column if not exists ordenada_em timestamptz;

with ordenadas as (
  select id, row_number() over (partition by data order by prioridade, criado_em, id) - 1 as nova_ordem
  from sessao
)
update sessao
set ordem = ordenadas.nova_ordem
from ordenadas
where sessao.id = ordenadas.id;

update mentor_conhecimento
set politica = politica || '{
  "organizacao_demandas": {
    "movimento_manual": "somente_ordem_no_mesmo_dia",
    "movimento_entre_dias": "exclusivo_do_mentor_para_pendencias",
    "reprogramar_incompletas": true,
    "preservar_pendencias_entre_semanas": true
  },
  "simulados": {
    "proibidos_ate": "2026-09-06",
    "elegiveis_a_partir_de": "2026-09-07",
    "agendamento_automatico": false,
    "decisao": "mentor",
    "criterios": {
      "adesao_minima": 0.75,
      "amostra_minima_questoes": 40,
      "maximo_pendencias": 3,
      "considerar_cobertura": true,
      "considerar_fadiga_e_carga": true
    }
  }
}'::jsonb,
evidencias = evidencias || '[
  {"principio":"avaliacao_formativa_para_ajustar_o_ensino","fonte":"Institute of Education Sciences","url":"https://ies.ed.gov/use-work/resource-library/report/descriptive-study/formative-assessment-and-elementary-school-student-academic-achievement-review-evidence"},
  {"principio":"pratica_de_recuperacao_com_feedback","fonte":"Roediger e Karpicke","pmid":"19350834"}
]'::jsonb
where ativo = true;
