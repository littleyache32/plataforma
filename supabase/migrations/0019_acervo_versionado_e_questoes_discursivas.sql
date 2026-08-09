alter table questao add column if not exists ativa boolean not null default true;
alter table questao add column if not exists comentarios_alternativas jsonb;
alter table questao add column if not exists versao_conhecimento text;

alter table question_card add column if not exists ativa boolean not null default true;
alter table question_card add column if not exists versao_conhecimento text;

alter table conhecimento add column if not exists versao text;
alter table material add column if not exists versao text;

drop index if exists idx_questao_deduplicacao;
create unique index if not exists idx_questao_deduplicacao_ativa
  on questao(topico_id, md5(lower(enunciado)))
  where ativa = true;

create index if not exists idx_questao_ativa_baralho
  on questao(topico_id, ativa, marcada_errada, estado);
create index if not exists idx_question_card_ativa_fila
  on question_card(objetivo_id, ativa, proxima_revisao, criado_em);

comment on column questao.comentarios_alternativas is
  'Justificativa individual de A a E para exibição no gabarito comentado das questões ME.';
comment on column questao.versao_conhecimento is
  'Versão da apostila usada para gerar e validar a questão.';
comment on column question_card.versao_conhecimento is
  'Versão da apostila usada para gerar e validar o Question Card.';
