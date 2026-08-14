alter table materia
  add column if not exists peso_prova numeric not null default 1.0
  check (peso_prova >= 0 and peso_prova <= 5);

alter table topico
  add column if not exists incidencia numeric not null default 0
  check (incidencia >= 0 and incidencia <= 1);

alter table topico add column if not exists questoes_contadas integer not null default 0;
alter table topico add column if not exists provas_analisadas integer not null default 0;

alter table seeding_job add column if not exists materia_id uuid references materia(id) on delete cascade;
alter table seeding_job alter column topico_id drop not null;

create table if not exists mentor_encontro_semanal (
  id uuid primary key default gen_random_uuid(),
  semana_inicio date not null unique,
  carga_percebida text not null check (carga_percebida in ('leve', 'adequada', 'pesada')),
  observacoes text,
  realizado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

alter table mentor_encontro_semanal enable row level security;

update conhecimento_modulo set ativo = false where modulo = 'mentor';

insert into conhecimento_modulo (modulo, versao, titulo, descricao, conteudo, evidencias, ativo)
select
  modulo,
  '2026.08.4',
  titulo,
  'Conhecimento operacional com encontro semanal declarado e distribuição estratégica de questões por disciplina.',
  jsonb_set(
    jsonb_set(
      jsonb_set(conteudo, '{politica,decisao_semanal,fontes}', (conteudo #> '{politica,decisao_semanal,fontes}') || '"encontro_semanal_declarado"'::jsonb),
      '{politica,encontro_semanal}',
      jsonb_build_object(
        'frequencia', 'semanal',
        'sinais', jsonb_build_array('carga_percebida', 'observacoes'),
        'nao_inferir_estado_pessoal', true,
        'nao_usar_sono_energia_humor', true,
        'nao_aumentar_carga_apenas_por_sinal_subjetivo', true,
        'sobrecarga_declarada_pode_reduzir_carga', true
      ),
      true
    ),
    '{politica,distribuicao_questoes}',
    jsonb_build_object(
      'entrada', 'disciplina',
      'selecao_manual_de_topico', false,
      'criterios', jsonb_build_array('incidencia', 'cobertura_atual', 'equilibrio_do_acervo'),
      'insercao_atomica', true
    ),
    true
  ),
  evidencias,
  true
from conhecimento_modulo
where modulo = 'mentor' and versao = '2026.08.3'
on conflict (modulo, versao) do update
set descricao = excluded.descricao,
    conteudo = excluded.conteudo,
    evidencias = excluded.evidencias,
    ativo = true,
    atualizado_em = now();
