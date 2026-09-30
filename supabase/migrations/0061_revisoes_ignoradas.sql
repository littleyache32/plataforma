alter table revisao_item drop constraint if exists revisao_item_status_check;
alter table revisao_item add constraint revisao_item_status_check
  check (status in ('pendente', 'concluida', 'ignorada'));
