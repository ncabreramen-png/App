-- ============================================================================
-- App de reportes de obra - Proyecto Chilama
-- Esquema completo: tipos, tablas, RLS, triggers, vistas, storage y semilla.
-- Ejecutar en Supabase -> SQL Editor. Es idempotente: se puede correr de nuevo.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. Tipos enumerados
-- ----------------------------------------------------------------------------
do $$ begin
  create type public.disciplina as enum (
    'Hidráulico', 'Estructural', 'Mecánico', 'Geotecnia',
    'Calidad', 'Ambiental', 'Eléctrico'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.rol_usuario as enum ('Campo', 'Gerente');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.frente_principal as enum (
    'Colectores', 'Estaciones de bombeo', 'PTAR'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.tipo_reporte as enum (
    'Avance', 'Problemática', 'Cambio de proyecto', 'Orden de cambio'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.estatus_reporte as enum (
    'Registrado', 'Pendiente', 'Aprobado', 'Rechazado'
  );
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------------
-- 2. Tablas
-- ----------------------------------------------------------------------------

-- usuarios: extiende auth.users. El id es el mismo de Supabase Auth.
create table if not exists public.usuarios (
  id          uuid primary key references auth.users (id) on delete cascade,
  nombre      text not null,
  correo      text not null unique,
  disciplina  public.disciplina not null,
  rol         public.rol_usuario not null default 'Campo',
  creado_en   timestamptz not null default now()
);

-- frentes_de_trabajo: los 12 frentes del proyecto.
create table if not exists public.frentes_de_trabajo (
  id                 uuid primary key default gen_random_uuid(),
  nombre             text not null unique,
  frente_principal   public.frente_principal not null,
  avance_fisico      numeric(5,2) not null default 0 check (avance_fisico between 0 and 100),
  avance_financiero  numeric(5,2) not null default 0 check (avance_financiero between 0 and 100),
  orden              integer not null default 0,
  creado_en          timestamptz not null default now()
);

-- reportes: el registro de campo.
create table if not exists public.reportes (
  id                        uuid primary key default gen_random_uuid(),
  frente_de_trabajo_id      uuid not null references public.frentes_de_trabajo (id) on delete restrict,
  disciplina                public.disciplina not null,
  tipo_de_reporte           public.tipo_reporte not null,
  descripcion               text not null check (length(btrim(descripcion)) > 0),
  fotos                     text[] not null default '{}',
  estatus                   public.estatus_reporte not null default 'Registrado',
  comentario_de_aprobacion  text,
  reportado_por             uuid not null references public.usuarios (id) on delete restrict,
  revisado_por              uuid references public.usuarios (id) on delete set null,
  revisado_en               timestamptz,
  fecha                     timestamptz not null default now()
);

create index if not exists reportes_frente_idx     on public.reportes (frente_de_trabajo_id);
create index if not exists reportes_autor_idx      on public.reportes (reportado_por);
create index if not exists reportes_estatus_idx    on public.reportes (estatus);
create index if not exists reportes_fecha_idx      on public.reportes (fecha desc);

-- ----------------------------------------------------------------------------
-- 3. Funciones auxiliares
-- ----------------------------------------------------------------------------

-- Se usa dentro de las policies. SECURITY DEFINER para evitar recursion de RLS
-- al consultar public.usuarios desde una policy de public.usuarios.
create or replace function public.es_gerente()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.usuarios u
    where u.id = auth.uid() and u.rol = 'Gerente'
  );
$$;

-- Crea la fila en public.usuarios cuando se da de alta un usuario en Auth.
-- Lee nombre / disciplina / rol de raw_user_meta_data.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.usuarios (id, nombre, correo, disciplina, rol)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'nombre', ''), split_part(new.email, '@', 1)),
    new.email,
    coalesce(nullif(new.raw_user_meta_data ->> 'disciplina', ''), 'Calidad')::public.disciplina,
    coalesce(nullif(new.raw_user_meta_data ->> 'rol', ''), 'Campo')::public.rol_usuario
  )
  on conflict (id) do update
    set nombre     = excluded.nombre,
        correo     = excluded.correo,
        disciplina = excluded.disciplina,
        rol        = excluded.rol;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Regla de negocio 1: el estatus inicial lo decide el servidor, no el cliente.
-- "Orden de cambio" nace Pendiente; todo lo demas nace Registrado.
-- Ademas fuerza que el reporte se guarde a nombre del usuario autenticado.
create or replace function public.reportes_estatus_inicial()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null then
    new.reportado_por := auth.uid();
  end if;

  if new.tipo_de_reporte = 'Orden de cambio' then
    new.estatus := 'Pendiente';
  else
    new.estatus := 'Registrado';
  end if;

  new.comentario_de_aprobacion := null;
  new.revisado_por := null;
  new.revisado_en := null;
  return new;
end;
$$;

drop trigger if exists reportes_before_insert on public.reportes;
create trigger reportes_before_insert
  before insert on public.reportes
  for each row execute function public.reportes_estatus_inicial();

-- Regla de negocio 2: al revisar una orden de cambio se sella quien y cuando.
-- Un rechazo exige comentario.
create or replace function public.reportes_sellar_revision()
returns trigger
language plpgsql
as $$
begin
  if new.estatus is distinct from old.estatus then
    if new.estatus = 'Rechazado'
       and coalesce(btrim(new.comentario_de_aprobacion), '') = '' then
      raise exception 'Un reporte rechazado requiere comentario de aprobación';
    end if;
    new.revisado_por := auth.uid();
    new.revisado_en := now();
  end if;
  return new;
end;
$$;

drop trigger if exists reportes_before_update on public.reportes;
create trigger reportes_before_update
  before update on public.reportes
  for each row execute function public.reportes_sellar_revision();

-- ----------------------------------------------------------------------------
-- 4. Vista del semaforo (regla de negocio 3)
--    Cuenta reportes de tipo 'Problemática' O con estatus 'Rechazado'.
--    0 -> A tiempo | 1 -> Atraso leve | 2 o mas -> Crítico
--    security_invoker: la vista respeta el RLS de quien la consulta, por eso
--    solo el gerente (que ve todos los reportes) obtiene el conteo completo.
-- ----------------------------------------------------------------------------
drop view if exists public.frentes_semaforo;
create view public.frentes_semaforo
with (security_invoker = on) as
select
  f.id,
  f.nombre,
  f.frente_principal,
  f.avance_fisico,
  f.avance_financiero,
  f.orden,
  count(r.id) filter (
    where r.tipo_de_reporte = 'Problemática' or r.estatus = 'Rechazado'
  )::int as alertas,
  count(r.id)::int as total_reportes,
  case
    when count(r.id) filter (
      where r.tipo_de_reporte = 'Problemática' or r.estatus = 'Rechazado'
    ) = 0 then 'A tiempo'
    when count(r.id) filter (
      where r.tipo_de_reporte = 'Problemática' or r.estatus = 'Rechazado'
    ) = 1 then 'Atraso leve'
    else 'Crítico'
  end as semaforo
from public.frentes_de_trabajo f
left join public.reportes r on r.frente_de_trabajo_id = f.id
group by f.id, f.nombre, f.frente_principal, f.avance_fisico, f.avance_financiero, f.orden;

grant select on public.frentes_semaforo to authenticated;

-- ----------------------------------------------------------------------------
-- 5. Row Level Security
-- ----------------------------------------------------------------------------
alter table public.usuarios            enable row level security;
alter table public.frentes_de_trabajo  enable row level security;
alter table public.reportes            enable row level security;

-- usuarios --------------------------------------------------------------
drop policy if exists usuarios_select on public.usuarios;
create policy usuarios_select on public.usuarios
  for select to authenticated
  using (id = auth.uid() or public.es_gerente());

drop policy if exists usuarios_update_propio on public.usuarios;
create policy usuarios_update_propio on public.usuarios
  for update to authenticated
  using (id = auth.uid() or public.es_gerente())
  with check (id = auth.uid() or public.es_gerente());

-- frentes_de_trabajo ----------------------------------------------------
drop policy if exists frentes_select on public.frentes_de_trabajo;
create policy frentes_select on public.frentes_de_trabajo
  for select to authenticated
  using (true);

drop policy if exists frentes_update_gerente on public.frentes_de_trabajo;
create policy frentes_update_gerente on public.frentes_de_trabajo
  for update to authenticated
  using (public.es_gerente())
  with check (public.es_gerente());

-- reportes --------------------------------------------------------------
-- Regla de negocio 5: campo solo ve lo propio; gerente ve todo.
drop policy if exists reportes_select on public.reportes;
create policy reportes_select on public.reportes
  for select to authenticated
  using (reportado_por = auth.uid() or public.es_gerente());

drop policy if exists reportes_insert_propio on public.reportes;
create policy reportes_insert_propio on public.reportes
  for insert to authenticated
  with check (reportado_por = auth.uid());

-- Solo el gerente modifica un reporte ya creado (aprobar / rechazar).
drop policy if exists reportes_update_gerente on public.reportes;
create policy reportes_update_gerente on public.reportes
  for update to authenticated
  using (public.es_gerente())
  with check (public.es_gerente());

-- ----------------------------------------------------------------------------
-- 6. Storage: bucket privado para las fotos
--    Convencion de ruta: <user_id>/<carpeta-reporte>/<archivo>
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('reportes-fotos', 'reportes-fotos', false)
on conflict (id) do nothing;

drop policy if exists fotos_insert_propio on storage.objects;
create policy fotos_insert_propio on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'reportes-fotos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists fotos_select on storage.objects;
create policy fotos_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'reportes-fotos'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.es_gerente())
  );

drop policy if exists fotos_delete_propio on storage.objects;
create policy fotos_delete_propio on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'reportes-fotos'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.es_gerente())
  );

-- ----------------------------------------------------------------------------
-- 7. Semilla: los 12 frentes de trabajo
-- ----------------------------------------------------------------------------
insert into public.frentes_de_trabajo (nombre, frente_principal, orden) values
  ('Frente 1 Conchalios',                      'Colectores',           1),
  ('Frente 2 Chilama oeste',                   'Colectores',           2),
  ('Frente 3 Chilama norte la danta-el obispo','Colectores',           3),
  ('Frente 1 Planta el obispo',                'Estaciones de bombeo', 4),
  ('Frente 2 El cementerio',                   'Estaciones de bombeo', 5),
  ('Frente 3 Chilama 2 norte',                 'Estaciones de bombeo', 6),
  ('Frente 4 Chilama oeste',                   'Estaciones de bombeo', 7),
  ('Frente 5 Conchalio',                       'Estaciones de bombeo', 8),
  ('Electromecánico',                          'PTAR',                 9),
  ('Eléctrico',                                'PTAR',                10),
  ('Civil',                                    'PTAR',                11),
  ('Hidráulico',                               'PTAR',                12)
on conflict (nombre) do update
  set frente_principal = excluded.frente_principal,
      orden = excluded.orden;
