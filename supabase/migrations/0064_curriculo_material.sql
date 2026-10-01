-- O catálogo histórico de tópicos não determina a trilha do Estratégia.
alter table material add column if not exists disciplina_curso text;
alter table material add column if not exists arquivo_origem text;
alter table material add column if not exists fonte text;
alter table material add column if not exists paginas integer check (paginas > 0);
alter table material add column if not exists sha256 text check (sha256 is null or sha256 ~ '^[a-f0-9]{64}$');
alter table material add column if not exists ordem_curso integer check (ordem_curso > 0);
alter table material add column if not exists estado_extracao text not null default 'texto'
  check (estado_extracao in ('texto', 'pendente_ocr'));
update material set sha256 = lower((regexp_match(motivo, 'SHA-256:?\s*([a-f0-9]{64})', 'i'))[1])
where sha256 is null and motivo ~* 'SHA-256:?\s*[a-f0-9]{64}';
create unique index if not exists idx_material_sha256 on material (sha256) where sha256 is not null;
create unique index if not exists idx_material_curso_ordem on material (objetivo_id, disciplina_curso, ordem_curso)
  where disciplina_curso is not null and ordem_curso is not null and status = 'aceito';

-- Uma unidade corresponde, no mínimo, à aula/PDF real. Subunidades poderão ser
-- acrescentadas depois apenas quando houver identificação verificável no material.
create table if not exists material_unidade_curricular (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references material(id) on delete cascade,
  ordem integer not null check (ordem > 0),
  titulo text not null check (length(trim(titulo)) > 0),
  pagina_inicial integer check (pagina_inicial > 0),
  pagina_final integer check (pagina_final >= pagina_inicial),
  origem text not null check (origem in ('titulo_pdf', 'sumario_pdf', 'curadoria')),
  criado_em timestamptz not null default now(),
  unique (material_id, ordem)
);
create index if not exists idx_material_unidade_material on material_unidade_curricular(material_id, ordem);
alter table material_unidade_curricular enable row level security;

-- Ausência de linha significa não iniciado. Linhas antigas significavam concluído.
alter table material_progresso alter column concluido_em drop not null;
alter table material_progresso add column if not exists estado text not null default 'concluido'
  check (estado in ('em_andamento', 'concluido'));
alter table material_progresso add column if not exists iniciado_em timestamptz;
alter table material_progresso add column if not exists atualizado_em timestamptz not null default now();
update material_progresso set iniciado_em = coalesce(iniciado_em, concluido_em), estado = 'concluido'
where concluido_em is not null;
alter table material_progresso add constraint material_progresso_consistencia_check
  check ((estado = 'concluido' and concluido_em is not null)
      or (estado = 'em_andamento' and concluido_em is null));

create or replace function registrar_material_estudado() returns trigger language plpgsql as $$
declare was_feita boolean := false;
begin
  if new.material_id is null or new.tipo <> 'estudo' then return new; end if;
  if tg_op = 'UPDATE' then was_feita := old.status = 'feita'; end if;
  if new.status = 'feita' and not was_feita then
    insert into material_progresso(material_id, estado, iniciado_em, concluido_em)
    values (new.material_id, 'em_andamento', coalesce(new.concluida_em, now()), null)
    on conflict (material_id) do update set
      estado = case when material_progresso.estado = 'concluido' then 'concluido' else 'em_andamento' end,
      iniciado_em = coalesce(material_progresso.iniciado_em, excluded.iniciado_em),
      atualizado_em = now();
  elsif was_feita and new.status <> 'feita' then
    delete from material_progresso
    where material_id = new.material_id and estado = 'em_andamento'
      and not exists (select 1 from sessao where material_id = new.material_id and tipo = 'estudo' and status = 'feita');
  end if;
  return new;
end $$;
drop trigger if exists trg_registrar_material_estudado on sessao;
create trigger trg_registrar_material_estudado after insert or update of status on sessao
  for each row execute function registrar_material_estudado();

insert into material_progresso(material_id, estado, iniciado_em, concluido_em)
select material_id, 'em_andamento', min(coalesce(concluida_em, criado_em)), null
from sessao where material_id is not null and tipo = 'estudo' and status = 'feita'
group by material_id
on conflict (material_id) do nothing;
