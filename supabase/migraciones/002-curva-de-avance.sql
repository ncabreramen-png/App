-- Curva S del proyecto: avance programado contra avance real, mes a mes.
-- Un registro por periodo, cargado por la gerencia desde el cronograma.
-- Ejecutar en Supabase -> SQL Editor. Idempotente.

create table if not exists public.curva_avance (
  id                 uuid primary key default gen_random_uuid(),
  periodo            date not null unique,
  avance_programado  numeric(5,2) not null default 0
                       check (avance_programado between 0 and 100),
  -- Nullable a proposito: un mes que todavia no se midio no vale 0, vale
  -- "sin dato". Asi la linea de avance real corta donde termina la medicion
  -- en vez de desplomarse a cero sobre los meses futuros.
  avance_real        numeric(5,2)
                       check (avance_real between 0 and 100),
  nota               text,
  actualizado_en     timestamptz not null default now()
);

create index if not exists curva_avance_periodo_idx
  on public.curva_avance (periodo);

alter table public.curva_avance enable row level security;

-- La curva es informacion de proyecto, no de un reporte: la ve cualquier
-- usuario autenticado. Solo la gerencia la edita.
drop policy if exists curva_select on public.curva_avance;
create policy curva_select on public.curva_avance
  for select to authenticated
  using (true);

drop policy if exists curva_escritura_gerente on public.curva_avance;
create policy curva_escritura_gerente on public.curva_avance
  for all to authenticated
  using (public.es_gerente())
  with check (public.es_gerente());

create or replace function public.curva_tocar_actualizado()
returns trigger language plpgsql as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$;

drop trigger if exists curva_before_update on public.curva_avance;
create trigger curva_before_update
  before update on public.curva_avance
  for each row execute function public.curva_tocar_actualizado();
