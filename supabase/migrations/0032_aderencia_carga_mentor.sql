alter table sessao
  add column if not exists data_planejada_original date,
  add column if not exists concluida_em timestamptz;

update sessao set data_planejada_original = data where data_planejada_original is null;

create or replace function preencher_data_original_sessao()
returns trigger language plpgsql as $$
begin
  if new.data_planejada_original is null then new.data_planejada_original := new.data; end if;
  return new;
end;
$$;

drop trigger if exists trg_data_original_sessao on sessao;
create trigger trg_data_original_sessao
before insert on sessao
for each row execute function preencher_data_original_sessao();

alter table sessao alter column data_planejada_original set not null;
create index if not exists idx_sessao_aderencia on sessao(origem, data_planejada_original, status);

update mentor_conhecimento
set politica = politica || '{
  "adaptacao_carga": {
    "baseada_em_conclusao": true,
    "ignorar_tempo_excedente": true,
    "reduzir_abaixo_de": 0.70,
    "aumentar_acima_de": 0.85,
    "semanas_para_aumentar": 2,
    "duracao_estudo_bacen_reduzida": 30,
    "duracao_estudo_bacen_padrao": 60,
    "duracao_estudo_bacen_ampliada": 90,
    "preservar_faculdade_revisoes_questoes_e_cards": true
  }
}'::jsonb
where ativo = true;
