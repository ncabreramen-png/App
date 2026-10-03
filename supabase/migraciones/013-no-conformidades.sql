-- No conformidades.
--
-- Las levanta y las cierra aseguramiento de calidad. La gerencia solo las ve,
-- en la pantalla y en el informe de estatus.
--
-- Nota sobre el permiso: la regla NO puede ser solo "disciplina = Aseguramiento
-- de calidad", porque la cuenta de gerencia puede tener esa disciplina y
-- quedaria con permiso de edicion. El rol Gerente es de solo lectura sea cual
-- sea su disciplina.
--
-- Ejecutar en Supabase -> SQL Editor. Idempotente.

do $$ begin
  create type public.estado_no_conformidad as enum ('Pendiente', 'Atendida');
exception when duplicate_object then null; end $$;

create sequence if not exists public.no_conformidades_numero_seq;

create table if not exists public.no_conformidades (
  id                    uuid primary key default gen_random_uuid(),
  -- Correlativo para citarla en correspondencia: NC-001, NC-002...
  numero                integer not null default nextval('public.no_conformidades_numero_seq'),
  frente_de_trabajo_id  uuid not null references public.frentes_de_trabajo (id) on delete restrict,
  descripcion           text not null check (length(btrim(descripcion)) > 0),
  archivos              jsonb not null default '[]'::jsonb,
  estado                public.estado_no_conformidad not null default 'Pendiente',
  detectada_en          date not null default current_date,
  atendida_en           date,
  -- Como se atendio. Obligatorio al cerrar: una no conformidad que se cierra
  -- sin decir que se hizo no sirve como registro.
  comentario_cierre     text,
  creado_por            uuid not null references public.usuarios (id) on delete restrict,
  creado_en             timestamptz not null default now(),
  actualizado_en        timestamptz not null default now()
);

create unique index if not exists no_conformidades_numero_unico
  on public.no_conformidades (numero);
create index if not exists no_conformidades_estado_idx
  on public.no_conformidades (estado);
create index if not exists no_conformidades_frente_idx
  on public.no_conformidades (frente_de_trabajo_id);

-- ----------------------------------------------------------------------------
-- Quien es aseguramiento de calidad
-- ----------------------------------------------------------------------------

create or replace function public.es_calidad()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.usuarios u
    where u.id = auth.uid()
      and u.disciplina = 'Aseguramiento de calidad'
      and u.rol <> 'Gerente'
      and u.activo
  );
$$;

grant execute on function public.es_calidad() to authenticated;

-- ----------------------------------------------------------------------------
-- Cierre: sella la fecha y exige decir como se atendio
-- ----------------------------------------------------------------------------

create or replace function public.nc_sellar_cierre()
returns trigger language plpgsql as $$
begin
  new.actualizado_en := now();

  if new.estado = 'Atendida' then
    if coalesce(btrim(new.comentario_cierre), '') = '' then
      raise exception 'Para cerrar una no conformidad hay que indicar cómo se atendió';
    end if;
    if new.atendida_en is null then
      new.atendida_en := current_date;
    end if;
  else
    -- Reabrirla limpia el cierre: dejar la fecha anterior mentiria.
    new.atendida_en := null;
    new.comentario_cierre := null;
  end if;

  return new;
end;
$$;

drop trigger if exists nc_antes_de_guardar on public.no_conformidades;
create trigger nc_antes_de_guardar
  before insert or update on public.no_conformidades
  for each row execute function public.nc_sellar_cierre();

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------

alter table public.no_conformidades enable row level security;

drop policy if exists nc_select on public.no_conformidades;
create policy nc_select on public.no_conformidades
  for select to authenticated
  using (public.es_gerente() or public.es_calidad());

drop policy if exists nc_insert on public.no_conformidades;
create policy nc_insert on public.no_conformidades
  for insert to authenticated
  with check (public.es_calidad() and creado_por = auth.uid());

drop policy if exists nc_update on public.no_conformidades;
create policy nc_update on public.no_conformidades
  for update to authenticated
  using (public.es_calidad())
  with check (public.es_calidad());

drop policy if exists nc_delete on public.no_conformidades;
create policy nc_delete on public.no_conformidades
  for delete to authenticated
  using (public.es_calidad());

-- ----------------------------------------------------------------------------
-- Storage: bucket propio
-- ----------------------------------------------------------------------------
--
-- No se reutiliza el de reportes porque alli la lectura esta atada a la carpeta
-- del autor, y dos personas de calidad tienen que ver los adjuntos de ambas.

insert into storage.buckets (id, name, public, file_size_limit)
values ('nc-archivos', 'nc-archivos', false, 26214400)
on conflict (id) do update set file_size_limit = excluded.file_size_limit;

drop policy if exists nc_subir on storage.objects;
create policy nc_subir on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'nc-archivos'
    and public.es_calidad()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists nc_leer on storage.objects;
create policy nc_leer on storage.objects
  for select to authenticated
  using (
    bucket_id = 'nc-archivos'
    and (public.es_gerente() or public.es_calidad())
  );

drop policy if exists nc_borrar on storage.objects;
create policy nc_borrar on storage.objects
  for delete to authenticated
  using (bucket_id = 'nc-archivos' and public.es_calidad());
