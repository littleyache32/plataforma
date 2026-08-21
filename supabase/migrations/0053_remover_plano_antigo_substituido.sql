delete from sessao
where origem = 'mentor'
  and status = 'planejada'
  and data_planejada_original between '2026-08-17' and '2026-08-23';
