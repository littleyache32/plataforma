alter table mentor_encontro_semanal
  add column if not exists classificacoes text[] not null default '{}';

alter table mentor_encontro_semanal drop constraint if exists mentor_encontro_classificacoes_check;
alter table mentor_encontro_semanal add constraint mentor_encontro_classificacoes_check check (
  classificacoes <@ array[
    'dificuldade_conteudo','dificuldade_volume','dificuldade_questoes',
    'dificuldade_revisao','problema_material','estrategia_funcionou','prioridade_percebida'
  ]::text[]
);

create table if not exists compromisso_topico (
  compromisso_id uuid not null references compromisso(id) on delete cascade,
  topico_id uuid not null references topico(id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (compromisso_id, topico_id)
);
create index if not exists idx_compromisso_topico_topico on compromisso_topico(topico_id);
alter table compromisso_topico enable row level security;

alter table mentor_experimento
  add column if not exists autorizado_em timestamptz,
  add column if not exists duracao_semanas smallint check (duracao_semanas is null or duracao_semanas between 1 and 8),
  add column if not exists retencao_posterior_dias smallint check (retencao_posterior_dias is null or retencao_posterior_dias between 1 and 90),
  add column if not exists carga_total_constante boolean not null default true,
  add column if not exists periodos_comparaveis boolean not null default true,
  add column if not exists semana_prova_importante boolean not null default false;

create unique index if not exists idx_mentor_experimento_unico_ativo
  on mentor_experimento ((status)) where status = 'ativo';

create or replace function validar_mentor_experimento() returns trigger
language plpgsql as $$
begin
  if new.status = 'ativo' and (
    new.autorizado_em is null or
    not new.carga_total_constante or
    not new.periodos_comparaveis or
    new.semana_prova_importante or
    new.inicio is null or new.fim is null or
    new.duracao_semanas is null
  ) then
    raise exception 'Experimento ativo exige autorizacao, uma variavel, carga constante, periodos comparaveis e ausencia de prova importante.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validar_mentor_experimento on mentor_experimento;
create trigger trg_validar_mentor_experimento
before insert or update on mentor_experimento
for each row execute function validar_mentor_experimento();

update conhecimento_modulo set ativo = false where modulo = 'mentor';

insert into conhecimento_modulo (modulo,versao,titulo,descricao,conteudo,evidencias,ativo)
select modulo,'2026.08.7',titulo,
  'Política canônica do mentor com amostra de dez respostas, retenção por cards, tempo agregado, compromissos por tópico e encontro estruturado.',
  jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(conteudo,'{politica,amostra_minima}','10'::jsonb,true),
        '{politica,decisao_semanal,amostra_minima_desempenho}','10'::jsonb,true
      ),
      '{politica,retencao_cards}',
      '{"amostra_minima":5,"janela_maxima":40,"uso":"complementar_questoes","card_sozinho_nao_estabelece_dominio":true,"nao_reagir_a_resultado_isolado":true}'::jsonb,true
    ),
    '{politica,evidencias_integradas}',
    '{"tempo":"agregado_por_objetivo_materia_topico_e_tipo","encontro":"somente_classificacoes_estruturadas_entram_no_planejamento","texto_livre":"contexto_humano","compromissos":"topicos_vinculados_com_texto_como_fallback","experimentos":"somente_com_autorizacao_explicita"}'::jsonb,true
  ),
  evidencias,true
from conhecimento_modulo
where modulo='mentor'
order by atualizado_em desc
limit 1
on conflict (modulo,versao) do update
set descricao=excluded.descricao,conteudo=excluded.conteudo,evidencias=excluded.evidencias,ativo=true,atualizado_em=now();

update mentor_conhecimento set ativo = false;

insert into mentor_conhecimento (versao,titulo,descricao,politica,evidencias,ativo)
select '2026.08.7',titulo,
  'Política canônica com limiar único de dez respostas e sinais integrados sem estado pessoal.',
  jsonb_set(
    jsonb_set(politica,'{amostra_minima}','10'::jsonb,true),
    '{decisao_semanal,amostra_minima_desempenho}','10'::jsonb,true
  ) || '{"retencao_cards":{"amostra_minima":5,"card_sozinho_nao_estabelece_dominio":true},"experimentos":{"ativacao_automatica":false,"maximo_ativos":1}}'::jsonb,
  evidencias,true
from mentor_conhecimento
order by criado_em desc
limit 1
on conflict (versao) do update
set descricao=excluded.descricao,politica=excluded.politica,evidencias=excluded.evidencias,ativo=true;

create unique index if not exists idx_conhecimento_modulo_mentor_ativo
  on conhecimento_modulo (modulo) where ativo = true;

