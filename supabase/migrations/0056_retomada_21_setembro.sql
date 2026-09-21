begin;

-- A retomada começa limpa. O histórico concluído e os tempos já estudados são preservados.
delete from sessao where status <> 'feita';

insert into compromisso (objetivo_id, materia_id, titulo, tipo, data, peso, duracao_minutos, concluido)
select o.id, m.id, dados.titulo, dados.tipo, dados.data, dados.peso, dados.duracao, false
from objetivo o
join materia m on m.objetivo_id = o.id
join (values
  ('%teoria do crime%', 'Prova de Teoria do Crime', 'prova', date '2026-09-22', 5, 90),
  ('%teoria da constitui%', 'Prova de Teoria da Constituição e Direitos Fundamentais', 'prova', date '2026-10-01', 5, 90),
  ('%teoria%justi%', 'Prova de Teorias da Justiça', 'prova', date '2026-10-14', 5, 90),
  ('%pessoas%neg%jur%', 'Trabalho em grupo de Pessoas e Negócios Jurídicos', 'entrega', date '2026-10-19', 4, 50)
) as dados(padrao, titulo, tipo, data, peso, duracao) on lower(m.nome) like dados.padrao
where o.tipo = 'faculdade'
  and not exists (
    select 1 from compromisso c
    where c.materia_id = m.id and c.data = dados.data and lower(c.titulo) = lower(dados.titulo)
  );

update conhecimento_modulo set ativo = false, atualizado_em = now() where modulo = 'mentor';

insert into conhecimento_modulo (modulo, versao, titulo, descricao, conteudo, evidencias, ativo)
select 'mentor', '2026.09.20', titulo, descricao,
  jsonb_set(
    conteudo,
    '{politica}',
    coalesce(conteudo->'politica', '{}'::jsonb) || '{
      "retomada": {
        "inicio":"2026-09-21",
        "fim_semana_especial":"2026-09-27",
        "zerar_pendencias_anteriores":true,
        "bloquear_questoes_e_cards_ate_autorizacao":true,
        "segunda_especial":{"faculdade":7,"concurso":2},
        "terca_pos_prova_sem_demanda":true,
        "rotina_restante":{"faculdade":1,"concurso":2},
        "avaliacoes":[
          {"data":"2026-09-22","tipo":"prova","materia":"Teoria do Crime"},
          {"data":"2026-10-01","tipo":"prova","materia":"Teoria da Constituição e Direitos Fundamentais"},
          {"data":"2026-10-14","tipo":"prova","materia":"Teorias da Justiça"},
          {"data":"2026-10-19","tipo":"trabalho_em_grupo","materia":"Direito das Pessoas e dos Negócios Jurídicos"}
        ]
      },
      "decisao_semanal": {
        "preservar_historico_concluido":true,
        "nao_carregar_pendencias_do_periodo_interrompido":true,
        "prioridade_concurso":true,
        "progressao_gradual_sem_salto":true
      },
      "didatica": {
        "gabarito_comentado_apos_toda_resposta":true,
        "comentar_todas_as_alternativas_me":true,
        "nunca_exibir_gabarito_antes_da_resposta":true
      }
    }'::jsonb,
    true
  ),
  evidencias || jsonb_build_array(jsonb_build_object(
    'tipo','preferencia_confirmada',
    'fonte','mentorado',
    'data','2026-09-20',
    'descricao','Retomada em 21/09, prova de Teoria do Crime em 22/09, pendências antigas descartadas e prática bloqueada até autorização.'
  )), true
from conhecimento_modulo
where modulo = 'mentor'
order by criado_em desc
limit 1
on conflict (modulo, versao) do update
set conteudo = excluded.conteudo, evidencias = excluded.evidencias, ativo = true, atualizado_em = now();

insert into mentor_conhecimento (versao,titulo,descricao,politica,evidencias,ativo)
select '2026.09.20', titulo, descricao, conteudo->'politica', evidencias, true
from conhecimento_modulo
where modulo = 'mentor' and versao = '2026.09.20'
on conflict (versao) do update
set politica = excluded.politica, evidencias = excluded.evidencias, ativo = true;

update mentor_conhecimento set ativo = false where versao <> '2026.09.20';

commit;
