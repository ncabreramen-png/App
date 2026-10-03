-- Analisis de gerencia + adjuntos de cualquier tipo.
--
-- 1) Los reportes pasan de guardar solo rutas de fotos a guardar adjuntos con
--    metadatos (nombre, tipo y tamano), para poder mostrar un PDF o un Excel
--    como archivo descargable en vez de intentar dibujarlo como miniatura.
-- 2) Se agrega "analisis": contenido que crea la gerencia, privado por
--    defecto, que se comparte eligiendo usuarios uno por uno.
--
-- Ejecutar en Supabase -> SQL Editor. Idempotente y no destructivo: la columna
-- "fotos" se conserva con su contenido original.

-- ----------------------------------------------------------------------------
-- 1. Adjuntos con metadatos en los reportes
-- ----------------------------------------------------------------------------

alter table public.reportes
  add column if not exists archivos jsonb not null default '[]'::jsonb;

comment on column public.reportes.archivos is
  'Adjuntos: [{ruta, nombre, tipo, tamano}]. Reemplaza a "fotos".';
comment on column public.reportes.fotos is
  'OBSOLETA. Se conserva por si hay que auditar; la aplicacion lee "archivos".';

-- Traspaso de las fotos ya cargadas. Solo toca las filas que todavia no
-- tienen adjuntos, asi que correr la migracion de nuevo no duplica nada.
update public.reportes r
set archivos = (
  select coalesce(jsonb_agg(jsonb_build_object(
    'ruta',   f,
    'nombre', regexp_replace(f, '^.*/', ''),
    'tipo',   case when lower(f) like '%.png'  then 'image/png'
                   when lower(f) like '%.webp' then 'image/webp'
                   else 'image/jpeg' end,
    'tamano', null
  )), '[]'::jsonb)
  from unnest(r.fotos) as f
)
where jsonb_array_length(r.archivos) = 0
  and coalesce(array_length(r.fotos, 1), 0) > 0;

-- ----------------------------------------------------------------------------
-- 2. Analisis de gerencia
-- ----------------------------------------------------------------------------

create table if not exists public.analisis (
  id                    uuid primary key default gen_random_uuid(),
  titulo                text not null check (length(btrim(titulo)) > 0),
  descripcion           text not null default '',
  archivos              jsonb not null default '[]'::jsonb,
  -- Opcional: un analisis puede referirse a un frente o al proyecto entero.
  frente_de_trabajo_id  uuid references public.frentes_de_trabajo (id) on delete set null,
  creado_por            uuid not null references public.usuarios (id) on delete restrict,
  creado_en             timestamptz not null default now(),
  actualizado_en        timestamptz not null default now()
);

create index if not exists analisis_autor_idx  on public.analisis (creado_por);
create index if not exists analisis_fecha_idx  on public.analisis (creado_en desc);

-- A quien se le comparte cada analisis. Sin fila aca, solo lo ve su autor.
create table if not exists public.analisis_accesos (
  analisis_id   uuid not null references public.analisis (id) on delete cascade,
  usuario_id    uuid not null references public.usuarios (id) on delete cascade,
  otorgado_en   timestamptz not null default now(),
  primary key (analisis_id, usuario_id)
);

create index if not exists analisis_accesos_usuario_idx
  on public.analisis_accesos (usuario_id);

create or replace function public.analisis_tocar_actualizado()
returns trigger language plpgsql as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$;

drop trigger if exists analisis_before_update on public.analisis;
create trigger analisis_before_update
  before update on public.analisis
  for each row execute function public.analisis_tocar_actualizado();

-- ----------------------------------------------------------------------------
-- 3. Funciones de visibilidad
--    SECURITY DEFINER para que las policies de analisis puedan consultar
--    analisis sin recursion de RLS, y para reusarlas en storage.
-- ----------------------------------------------------------------------------

create or replace function public.es_dueno_analisis(p_analisis uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.analisis a
    where a.id = p_analisis and a.creado_por = auth.uid()
  );
$$;

create or replace function public.puede_ver_analisis(p_analisis uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.analisis a
    where a.id = p_analisis
      and (
        a.creado_por = auth.uid()
        or exists (
          select 1 from public.analisis_accesos ac
          where ac.analisis_id = a.id and ac.usuario_id = auth.uid()
        )
      )
  );
$$;

-- Version tolerante para storage: la carpeta llega como texto y podria no ser
-- un uuid valido. Sin este guardia, el cast lanzaria una excepcion dentro de
-- la policy y la lectura fallaria en vez de denegarse.
create or replace function public.puede_ver_analisis_txt(p text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare v uuid;
begin
  begin
    v := p::uuid;
  exception when others then
    return false;
  end;
  return public.puede_ver_analisis(v);
end;
$$;

-- ----------------------------------------------------------------------------
-- 4. RLS
-- ----------------------------------------------------------------------------

alter table public.analisis          enable row level security;
alter table public.analisis_accesos  enable row level security;

-- Privado por defecto: lo ve su autor y los usuarios a los que se les compartio.
drop policy if exists analisis_select on public.analisis;
create policy analisis_select on public.analisis
  for select to authenticated
  using (creado_por = auth.uid() or public.puede_ver_analisis(id));

-- Solo la gerencia crea analisis, y siempre a nombre propio.
drop policy if exists analisis_insert on public.analisis;
create policy analisis_insert on public.analisis
  for insert to authenticated
  with check (creado_por = auth.uid() and public.es_gerente());

drop policy if exists analisis_update on public.analisis;
create policy analisis_update on public.analisis
  for update to authenticated
  using (creado_por = auth.uid())
  with check (creado_por = auth.uid());

drop policy if exists analisis_delete on public.analisis;
create policy analisis_delete on public.analisis
  for delete to authenticated
  using (creado_por = auth.uid());

-- Cada quien ve con quien se compartio lo suyo; el destinatario ve su propia fila.
drop policy if exists accesos_select on public.analisis_accesos;
create policy accesos_select on public.analisis_accesos
  for select to authenticated
  using (usuario_id = auth.uid() or public.es_dueno_analisis(analisis_id));

drop policy if exists accesos_insert on public.analisis_accesos;
create policy accesos_insert on public.analisis_accesos
  for insert to authenticated
  with check (public.es_dueno_analisis(analisis_id));

drop policy if exists accesos_delete on public.analisis_accesos;
create policy accesos_delete on public.analisis_accesos
  for delete to authenticated
  using (public.es_dueno_analisis(analisis_id));

-- ----------------------------------------------------------------------------
-- 5. Storage
-- ----------------------------------------------------------------------------

-- Bucket propio para los analisis. Ruta: <usuario>/<analisis>/<archivo>, para
-- que el autor pueda subir antes de que exista la fila y el permiso de lectura
-- se resuelva mirando la carpeta del analisis.
insert into storage.buckets (id, name, public, file_size_limit)
values ('analisis-archivos', 'analisis-archivos', false, 52428800)
on conflict (id) do update set file_size_limit = excluded.file_size_limit;

-- Tope por archivo en los adjuntos de reportes: 25 MB. Antes no habia ninguno.
update storage.buckets set file_size_limit = 26214400 where id = 'reportes-fotos';

drop policy if exists analisis_subir on storage.objects;
create policy analisis_subir on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'analisis-archivos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists analisis_leer on storage.objects;
create policy analisis_leer on storage.objects
  for select to authenticated
  using (
    bucket_id = 'analisis-archivos'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.puede_ver_analisis_txt((storage.foldername(name))[2])
    )
  );

drop policy if exists analisis_borrar on storage.objects;
create policy analisis_borrar on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'analisis-archivos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
