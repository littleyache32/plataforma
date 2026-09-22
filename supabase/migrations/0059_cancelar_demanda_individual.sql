begin;

alter table sessao drop constraint if exists sessao_status_check;
alter table sessao add constraint sessao_status_check
  check (status in ('planejada', 'feita', 'parcial', 'remanejada', 'cancelada'));

commit;
