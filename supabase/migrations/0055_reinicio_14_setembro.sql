begin;

-- O reinicio preserva integralmente as sessoes concluidas e remove somente o
-- planejamento pendente que se acumulou antes da semana de 14/09/2026.
delete from sessao
where status <> 'feita';

-- A prova fica registrada como contexto do mentor. Durante a fase de reinicio,
-- a preparacao diaria ja ocupa o bloco academico e o evento nao vira uma demanda extra.
insert into compromisso (objetivo_id, materia_id, titulo, tipo, data, peso, duracao_minutos, concluido)
select o.id, m.id, 'Prova de Teoria do Crime', 'prova', date '2026-09-22', 5, 90, false
from objetivo o
join materia m on m.objetivo_id = o.id
where o.tipo = 'faculdade'
  and lower(m.nome) like '%teoria do crime%'
  and not exists (
    select 1 from compromisso c
    where c.data = date '2026-09-22'
      and c.materia_id = m.id
      and lower(c.titulo) like '%teoria do crime%'
  )
limit 1;

update conhecimento_modulo set ativo = false, atualizado_em = now() where modulo = 'mentor';

insert into conhecimento_modulo (modulo, versao, titulo, descricao, conteudo, evidencias, ativo)
select 'mentor', '2026.09.12', titulo, descricao,
  jsonb_set(
    conteudo,
    '{politica}',
    coalesce(conteudo->'politica', '{}'::jsonb) || '{
      "reinicio": {
        "inicio":"2026-09-14",
        "fim":"2026-09-27",
        "inicio_exercicios":"2026-09-28",
        "prova_teoria_crime":"2026-09-22",
        "somente_estudo":true,
        "demandas_dias_uteis":4,
        "demandas_fim_semana":2,
        "faculdade_segunda_quinta":2,
        "faculdade_sexta":1,
        "faculdade_fim_semana":1,
        "bacen_segunda_quinta":2,
        "bacen_sexta":3,
        "bacen_fim_semana":1,
        "descartar_pendencias_anteriores":true
      },
      "decisao_semanal": {
        "reorganizar_pendencias_sem_descartar":true,
        "maximo_pendencias_transferidas":3,
        "nao_transformar_acumulo_em_sobrecarga":true
      }
    }'::jsonb,
    true
  ),
  evidencias, true
from conhecimento_modulo
where modulo = 'mentor'
order by criado_em desc
limit 1
on conflict (modulo, versao) do update
set conteudo = excluded.conteudo, evidencias = excluded.evidencias, ativo = true, atualizado_em = now();

insert into mentor_conhecimento (versao,titulo,descricao,politica,evidencias,ativo)
select '2026.09.12', titulo, descricao, conteudo->'politica', evidencias, true
from conhecimento_modulo
where modulo = 'mentor' and versao = '2026.09.12'
on conflict (versao) do update
set politica = excluded.politica, evidencias = excluded.evidencias, ativo = true;

update mentor_conhecimento set ativo = false where versao <> '2026.09.12';

commit;
