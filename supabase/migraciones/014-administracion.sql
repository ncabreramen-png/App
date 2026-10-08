-- Perfil de Administracion: avance programado y real, avance financiero y
-- estimaciones, un corte por mes para todo el proyecto.
--
-- Decisiones que conviene tener a la vista:
--
-- 1) Es una disciplina mas, no un rol nuevo. El modelo de permisos ya
--    distingue por disciplina (asi se resolvio aseguramiento de calidad) y
--    agregar un tercer rol obligaria a revisar es_gerente() y todas las
--    policies que cuelgan de el.
-- 2) Las cifras NO tocan la curva del proyecto. Hoy la curva se carga a mano
--    y ademas el Gantt puede recalcularla; una tercera fuente escribiendo los
--    mismos meses terminaria pisando datos sin que nadie sepa cual mando.
-- 3) Los montos son acumulados al cierre del mes, igual que el avance. Asi la
--    serie se lee sola y no hay que sumar meses para saber donde va el
--    contrato.
--
-- Ejecutar en Supabase -> SQL Editor. Idempotente.

-- ----------------------------------------------------------------------------
-- 1. La disciplina
-- ----------------------------------------------------------------------------

alter type public.disciplina add value if not exists 'Administración';

-- ----------------------------------------------------------------------------
-- 2. El corte mensual
-- ----------------------------------------------------------------------------

create table if not exists public.reportes_administracion (
  id                        uuid primary key default gen_random_uuid(),
  -- Primer dia del mes informado. Uno por mes: el mes se corrige, no se duplica.
  periodo                   date not null unique,

  avance_programado         numeric(5,2)  not null check (avance_programado between 0 and 100),
  avance_real               numeric(5,2)  not null check (avance_real between 0 and 100),

  -- Avance financiero: el monto ejecutado y su porcentaje. Se cargan los dos
  -- a mano a proposito; calcular el porcentaje exigiria tener el monto del
  -- contrato al dia, y una orden de cambio lo mueve.
  monto_financiero          numeric(14,2) not null default 0 check (monto_financiero >= 0),
  avance_financiero         numeric(5,2)  not null default 0 check (avance_financiero between 0 and 100),

  estimaciones_autorizadas  integer       not null default 0 check (estimaciones_autorizadas >= 0),
  importe_autorizado        numeric(14,2) not null default 0 check (importe_autorizado >= 0),
  estimaciones_pagadas      integer       not null default 0 check (estimaciones_pagadas >= 0),
  importe_pagado            numeric(14,2) not null default 0 check (importe_pagado >= 0),

  comentario                text          not null default '',
  archivos                  jsonb         not null default '[]'::jsonb,

  creado_por                uuid not null references public.usuarios (id) on delete restrict,
  creado_en                 timestamptz not null default now(),
  actualizado_en            timestamptz not null default now()
);

create index if not exists reportes_administracion_periodo_idx
  on public.reportes_administracion (periodo desc);

create or replace function public.administracion_tocar_actualizado()
returns trigger language plpgsql as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$;

drop trigger if exists administracion_before_update on public.reportes_administracion;
create trigger administracion_before_update
  before update on public.reportes_administracion
  for each row execute function public.administracion_tocar_actualizado();

-- ----------------------------------------------------------------------------
-- 3. Quien es administracion
-- ----------------------------------------------------------------------------
--
-- La comparacion va por texto a proposito: un literal de enum se resuelve al
-- crear la funcion, y si este script corre completo justo despues de agregar
-- el valor al tipo, Postgres lo rechaza. Comparando como texto el script
-- queda corriendo de una sola pasada.
--
-- El rol Gerente queda fuera aunque tenga la disciplina: para la gerencia
-- estas cifras son de solo lectura, igual que las no conformidades.

create or replace function public.es_administracion()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.usuarios u
    where u.id = auth.uid()
      and u.disciplina::text = 'Administración'
      and u.rol <> 'Gerente'
      and u.activo
  );
$$;

grant execute on function public.es_administracion() to authenticated;

-- ----------------------------------------------------------------------------
-- 4. RLS
-- ----------------------------------------------------------------------------

alter table public.reportes_administracion enable row level security;

drop policy if exists administracion_select on public.reportes_administracion;
create policy administracion_select on public.reportes_administracion
  for select to authenticated
  using (public.es_gerente() or public.es_administracion());

drop policy if exists administracion_insert on public.reportes_administracion;
create policy administracion_insert on public.reportes_administracion
  for insert to authenticated
  with check (public.es_administracion() and creado_por = auth.uid());

drop policy if exists administracion_update on public.reportes_administracion;
create policy administracion_update on public.reportes_administracion
  for update to authenticated
  using (public.es_administracion())
  with check (public.es_administracion());

drop policy if exists administracion_delete on public.reportes_administracion;
create policy administracion_delete on public.reportes_administracion
  for delete to authenticated
  using (public.es_administracion());

-- ----------------------------------------------------------------------------
-- 5. Storage
-- ----------------------------------------------------------------------------
--
-- Bucket propio: en el de reportes la lectura esta atada a la carpeta del
-- autor, y aca la gerencia tiene que poder abrir lo que suba administracion.

insert into storage.buckets (id, name, public, file_size_limit)
values ('admin-archivos', 'admin-archivos', false, 26214400)
on conflict (id) do update set file_size_limit = excluded.file_size_limit;

drop policy if exists admin_subir on storage.objects;
create policy admin_subir on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'admin-archivos'
    and public.es_administracion()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists admin_leer on storage.objects;
create policy admin_leer on storage.objects
  for select to authenticated
  using (
    bucket_id = 'admin-archivos'
    and (public.es_gerente() or public.es_administracion())
  );

drop policy if exists admin_borrar on storage.objects;
create policy admin_borrar on storage.objects
  for delete to authenticated
  using (bucket_id = 'admin-archivos' and public.es_administracion());
