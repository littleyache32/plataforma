-- Fase 5: os seis módulos existentes descrevem sinais, não políticas paralelas.
create table if not exists material_prioridade_evidencia (
  material_id uuid primary key references material(id) on delete cascade,
  incidencia text not null default 'UNKNOWN' check (incidencia in ('UNKNOWN', 'LOW', 'MEDIUM', 'HIGH')),
  dificuldade text not null default 'UNKNOWN' check (dificuldade in ('UNKNOWN', 'LOW', 'MEDIUM', 'HIGH')),
  fonte text not null check (length(trim(fonte)) > 0),
  evidencia text not null check (length(trim(evidencia)) > 0),
  atualizado_em timestamptz not null default now()
);
alter table material_prioridade_evidencia enable row level security;

update conhecimento_modulo set ativo = false, atualizado_em = now()
where modulo in ('mentor_planejamento','mentor_trilha','mentor_revisao','mentor_desempenho','mentor_academico','mentor_previsao') and ativo = true;

insert into conhecimento_modulo (modulo, versao, titulo, descricao, conteudo, ativo) values
('mentor_planejamento','2026.10.02.3','Especialista de planejamento','Calcula sinais de execução e sustentabilidade.',
 '{"tipo":"sinal_estruturado","saidas":["aderencia","carga_atual","capacidade_observada","demandas_perdidas","backlog","possibilidades"],"decisao_final":"mentor_principal"}',true),
('mentor_trilha','2026.10.02.3','Especialista da trilha','Calcula cobertura e sequência dos materiais reais.',
 '{"tipo":"sinal_estruturado","saidas":["cobertura_por_disciplina","material_atual","proxima_aula","nao_iniciados","percentual_coberto","prerequisitos","risco_cobertura"],"decisao_final":"mentor_principal"}',true),
('mentor_revisao','2026.10.02.3','Especialista de revisão','Calcula estado da fila sem ativar prática nesta fase.',
 '{"tipo":"sinal_estruturado","saidas":["vencidos","urgencia","retestes","modalidade_recomendada"],"decisao_final":"mentor_principal"}',true),
('mentor_desempenho','2026.10.02.3','Especialista de desempenho','Expõe ausência de evidência de domínio quando não há prática.',
 '{"tipo":"sinal_estruturado","saidas":["mastery","acerto","confianca","falsa_certeza","ineditas","retestes","tendencia","retencao"],"decisao_final":"mentor_principal"}',true),
('mentor_academico','2026.10.02.3','Especialista acadêmico','Calcula prazos e aulas reais pendentes.',
 '{"tipo":"sinal_estruturado","saidas":["proxima_prova","dias_ate_prova","disciplina","conteudos_pendentes","aula_dada_estudada","proxima_entrega"],"decisao_final":"mentor_principal"}',true),
('mentor_previsao','2026.10.02.3','Especialista de previsão','Projeta cobertura somente quando há ritmo medido.',
 '{"tipo":"sinal_estruturado","saidas":["ritmo_atual","cobertura_projetada","risco_nao_concluir","data_oficial_ou_provisoria","necessidade_acelerar"],"decisao_final":"mentor_principal"}',true)
on conflict (modulo, versao) do update set
  titulo = excluded.titulo, descricao = excluded.descricao, conteudo = excluded.conteudo,
  ativo = true, atualizado_em = now();
