create table if not exists acervo_ciclo_expansao (
  id uuid primary key default gen_random_uuid(),
  inicio date not null unique,
  fim date not null,
  meta_minima integer not null default 2000 check (meta_minima >= 1),
  meta_maxima integer not null default 2500 check (meta_maxima >= meta_minima),
  alvo integer not null check (alvo between 2000 and 2500),
  planejadas integer not null default 0,
  inseridas integer not null default 0,
  arquivadas integer not null default 0,
  status text not null default 'planejado' check (status in ('planejado','em_producao','concluido','falhou')),
  criterios jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists acervo_ciclo_item (
  ciclo_id uuid not null references acervo_ciclo_expansao(id) on delete cascade,
  materia_id uuid not null references materia(id) on delete cascade,
  topico_id uuid not null references topico(id) on delete cascade,
  estoque_inicial integer not null check (estoque_inicial >= 0),
  quantidade_planejada integer not null check (quantidade_planejada >= 0),
  quantidade_inserida integer not null default 0 check (quantidade_inserida >= 0),
  peso_calculado numeric not null check (peso_calculado > 0),
  sinais jsonb not null default '{}'::jsonb,
  primary key (ciclo_id, topico_id)
);

alter table acervo_ciclo_expansao enable row level security;
alter table acervo_ciclo_item enable row level security;

create or replace function planejar_expansao_questoes_bacen(
  p_inicio date,
  p_alvo integer default 2250
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ciclo uuid;
  v_planejadas integer;
begin
  if p_alvo < 2000 or p_alvo > 2500 then
    raise exception 'O alvo quinzenal deve ficar entre 2000 e 2500 questoes.';
  end if;

  select id into v_ciclo from acervo_ciclo_expansao where inicio = p_inicio;
  if v_ciclo is not null then return v_ciclo; end if;

  if exists (select 1 from acervo_ciclo_expansao where status in ('planejado','em_producao')) then
    select id into v_ciclo from acervo_ciclo_expansao where status in ('planejado','em_producao') order by inicio desc limit 1;
    return v_ciclo;
  end if;

  insert into acervo_ciclo_expansao (inicio,fim,alvo,criterios)
  values (
    p_inicio,
    p_inicio + 13,
    p_alvo,
    jsonb_build_object(
      'frequencia_dias', 14,
      'entrada', 'disciplinas_bacen',
      'distribuicao', jsonb_build_array('incidencia_quando_disponivel','peso_da_disciplina','cobertura_atual','desempenho_com_amostra_minima','consumo_do_acervo'),
      'quantidades_iguais_obrigatorias', false,
      'arredondamento_em_0_ou_5', false,
      'proporcao_dificuldade', jsonb_build_object('facil',0.60,'media',0.30,'dificil',0.10),
      'gemini_autorizado', false,
      'insercao_atomica', true,
      'nao_preencher_com_item_sem_fonte', true
    )
  ) returning id into v_ciclo;

  with qstats as (
    select t.id topico_id,
           count(q.id) filter (where q.ativa and not q.marcada_errada and q.estado <> 'arquivada')::integer estoque,
           coalesce(sum(q.quantidade_tentativas) filter (where q.ativa and q.estado <> 'arquivada'),0)::integer tentativas
    from topico t
    left join questao q on q.topico_id=t.id
    group by t.id
  ), rstats as (
    select q.topico_id,
           count(r.id)::integer respostas,
           count(r.id) filter (where r.resultado='erro')::integer erros,
           count(r.id) filter (where r.resultado='erro' and r.classificacao='certeza')::integer falsas_certezas
    from registro r join questao q on q.id=r.questao_id
    group by q.topico_id
  ), eligible as (
    select m.id materia_id,t.id topico_id,coalesce(qs.estoque,0) estoque,
           coalesce(rs.respostas,0) respostas,coalesce(rs.erros,0) erros,coalesce(rs.falsas_certezas,0) falsas_certezas,
           coalesce(qs.tentativas,0) tentativas,
           greatest(0.01,
             coalesce(m.peso_prova,1)
             * (0.25 + coalesce(t.incidencia,0))
             * (1 + 0.70 * greatest(0, 75 - coalesce(qs.estoque,0)) / 75.0)
             * (1 + case when coalesce(rs.respostas,0) >= 10 then
                 0.70 * rs.erros::numeric / greatest(rs.respostas,1)
                 + rs.falsas_certezas::numeric / greatest(rs.respostas,1)
               else 0 end)
             * (1 + least(0.50, coalesce(qs.tentativas,0)::numeric / greatest(coalesce(qs.estoque,0) * 2,1)))
           ) peso
    from topico t
    join materia m on m.id=t.materia_id
    join objetivo o on o.id=m.objetivo_id
    left join acervo_meta am on am.topico_id=t.id
    left join qstats qs on qs.topico_id=t.id
    left join rstats rs on rs.topico_id=t.id
    where o.tipo='concurso' and o.ativo=true and coalesce(am.expansao_bloqueada,false)=false
  ), raw as (
    select *, p_alvo * peso / sum(peso) over () quota from eligible
  ), base as (
    select *, floor(quota)::integer quantidade_base, quota-floor(quota) fracao from raw
  ), ranked as (
    select *, row_number() over (order by fracao desc,topico_id) ordem,
           p_alvo-sum(quantidade_base) over () restante
    from base
  )
  insert into acervo_ciclo_item (ciclo_id,materia_id,topico_id,estoque_inicial,quantidade_planejada,peso_calculado,sinais)
  select v_ciclo,materia_id,topico_id,estoque,
         quantidade_base + case when ordem <= restante then 1 else 0 end,
         peso,
         jsonb_build_object('respostas',respostas,'erros',erros,'falsas_certezas',falsas_certezas,'tentativas',tentativas)
  from ranked;

  select coalesce(sum(quantidade_planejada),0) into v_planejadas from acervo_ciclo_item where ciclo_id=v_ciclo;
  if v_planejadas <> p_alvo then raise exception 'Plano quinzenal divergente: % de %.', v_planejadas,p_alvo; end if;

  update acervo_meta am
  set questoes_alvo = i.estoque_inicial + i.quantidade_planejada,
      atualizado_em = now()
  from acervo_ciclo_item i
  where i.ciclo_id=v_ciclo and i.topico_id=am.topico_id;

  update acervo_ciclo_expansao set planejadas=v_planejadas,atualizado_em=now() where id=v_ciclo;
  return v_ciclo;
end;
$$;

update conhecimento_modulo set ativo=false where modulo='mentor';

insert into conhecimento_modulo (modulo,versao,titulo,descricao,conteudo,evidencias,ativo)
select modulo,'2026.08.6',titulo,
       'Conhecimento operacional com expansao quinzenal auditada e distribuicao variavel do acervo BACEN.',
       jsonb_set(conteudo,'{politica,expansao_questoes}',jsonb_build_object(
         'frequencia_dias',14,
         'meta_minima',2000,
         'meta_maxima',2500,
         'alvo_inicial',2250,
         'distribuicao_por_topico_igual',false,
         'exigir_final_0_ou_5',false,
         'criterios',jsonb_build_array('incidencia_quando_disponivel','peso_da_disciplina','cobertura_atual','desempenho','consumo','repeticao','densidade_da_fonte'),
         'preservar_validas',true,
         'arquivar_apenas_falha_objetiva',true,
         'insercao_atomica',true,
         'gemini_desautorizado',true
       ),true),
       evidencias,true
from conhecimento_modulo where modulo='mentor' and versao='2026.08.5'
on conflict (modulo,versao) do update
set descricao=excluded.descricao,conteudo=excluded.conteudo,evidencias=excluded.evidencias,ativo=true,atualizado_em=now();

update mentor_conhecimento
set versao='2026.08.6',
    politica=politica || jsonb_build_object('expansao_questoes',jsonb_build_object(
      'frequencia_dias',14,'meta_minima',2000,'meta_maxima',2500,'alvo_inicial',2250,
      'distribuicao_por_topico_igual',false,'exigir_final_0_ou_5',false,
      'criterios',jsonb_build_array('incidencia_quando_disponivel','peso_da_disciplina','cobertura_atual','desempenho','consumo','repeticao','densidade_da_fonte'),
      'preservar_validas',true,'arquivar_apenas_falha_objetiva',true,'insercao_atomica',true,'gemini_desautorizado',true
    ))
where ativo=true;

select planejar_expansao_questoes_bacen('2026-08-16'::date,2250);
