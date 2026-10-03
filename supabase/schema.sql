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
    'Hidráulico', 'Estructural', 'Civil', 'Mecánico', 'Eléctrico',
    'Geotecnia', 'Medio ambiente', 'Seguridad y salud ocupacional',
    'Gestión social', 'Aseguramiento de calidad'
  );
exception when duplicate_object then null; end $$;

-- Para bases ya creadas: el bloque de arriba no se ejecuta si el tipo existe,
-- asi que los valores agregados despues se suman aca uno por uno.
alter type public.disciplina add value if not exists 'Civil';
alter type public.disciplina add value if not exists 'Seguridad y salud ocupacional';
alter type public.disciplina add value if not exists 'Gestión social';

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
  -- false = no puede entrar. Se usa en vez de borrar cuando el usuario ya
  -- tiene historial, para no perder la autoria de sus reportes.
  activo      boolean not null default true,
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
  -- OBSOLETA: se conserva por compatibilidad, la aplicacion lee "archivos".
  fotos                     text[] not null default '{}',
  -- Adjuntos con metadatos: [{ruta, nombre, tipo, tamano}].
  archivos                  jsonb not null default '[]'::jsonb,
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

-- curva_avance: la curva S del proyecto. Un registro por mes, cargado por la
-- gerencia desde el cronograma contractual.
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

create index if not exists curva_avance_periodo_idx on public.curva_avance (periodo);

-- analisis: contenido que crea la gerencia. Privado por defecto; se comparte
-- eligiendo usuarios uno por uno en analisis_accesos.
create table if not exists public.analisis (
  id                    uuid primary key default gen_random_uuid(),
  titulo                text not null check (length(btrim(titulo)) > 0),
  descripcion           text not null default '',
  archivos              jsonb not null default '[]'::jsonb,
  frente_de_trabajo_id  uuid references public.frentes_de_trabajo (id) on delete set null,
  creado_por            uuid not null references public.usuarios (id) on delete restrict,
  creado_en             timestamptz not null default now(),
  actualizado_en        timestamptz not null default now()
);

create index if not exists analisis_autor_idx on public.analisis (creado_por);
create index if not exists analisis_fecha_idx on public.analisis (creado_en desc);

create table if not exists public.analisis_accesos (
  analisis_id   uuid not null references public.analisis (id) on delete cascade,
  usuario_id    uuid not null references public.usuarios (id) on delete cascade,
  otorgado_en   timestamptz not null default now(),
  primary key (analisis_id, usuario_id)
);

create index if not exists analisis_accesos_usuario_idx
  on public.analisis_accesos (usuario_id);

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
    coalesce(nullif(new.raw_user_meta_data ->> 'disciplina', ''), 'Aseguramiento de calidad')::public.disciplina,
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

-- SECURITY DEFINER para que las policies de analisis puedan consultar analisis
-- sin recursion de RLS, y para poder reusarlas desde storage.
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
-- un uuid valido; sin el guardia, el cast lanzaria dentro de la policy.
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
-- 4. Vista del semaforo (regla de negocio 3)
--    Cuenta reportes de tipo 'Problemática' O con estatus 'Rechazado'.
--    0 -> A tiempo | 1 -> Atraso leve | 2 o mas -> Crítico
--    security_invoker: la vista respeta el RLS de quien la consulta, por eso
--    solo el gerente (que ve todos los reportes) obtiene el conteo completo.
-- ----------------------------------------------------------------------------
-- La vista del semaforo se define en la seccion del cronograma, porque
-- el avance fisico sale de las tareas.

-- ----------------------------------------------------------------------------
-- 5. Row Level Security
-- ----------------------------------------------------------------------------
alter table public.curva_avance       enable row level security;
alter table public.analisis           enable row level security;
alter table public.analisis_accesos   enable row level security;
alter table public.usuarios            enable row level security;
alter table public.frentes_de_trabajo  enable row level security;
alter table public.reportes            enable row level security;

-- usuarios --------------------------------------------------------------
drop policy if exists usuarios_select on public.usuarios;
-- El sucesor tambien lee la fila de su predecesor: sin eso veria el reporte
-- heredado sin firma, y conservar la autoria no serviria de nada.
create policy usuarios_select on public.usuarios
  for select to authenticated
  using (
    id = auth.uid()
    or public.es_gerente()
    or id in (select usuario_id from public.predecesores(auth.uid()))
  );

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

-- La gerencia resuelve las aprobaciones y ademas corrige o elimina un reporte
-- mal cargado. El equipo de campo no puede modificar lo que ya envio.
drop policy if exists reportes_update_gerente on public.reportes;
create policy reportes_update_gerente on public.reportes
  for update to authenticated
  using (public.es_gerente())
  with check (public.es_gerente());

drop policy if exists reportes_delete_gerente on public.reportes;
create policy reportes_delete_gerente on public.reportes
  for delete to authenticated
  using (public.es_gerente());

-- curva_avance ----------------------------------------------------------
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

-- analisis --------------------------------------------------------------
drop policy if exists analisis_select on public.analisis;
create policy analisis_select on public.analisis
  for select to authenticated
  using (creado_por = auth.uid() or public.puede_ver_analisis(id));

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
-- 6. Storage: bucket privado para las fotos
--    Convencion de ruta: <user_id>/<carpeta-reporte>/<archivo>
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('reportes-fotos', 'reportes-fotos', false, 26214400)
on conflict (id) do update set file_size_limit = excluded.file_size_limit;

insert into storage.buckets (id, name, public, file_size_limit)
values ('analisis-archivos', 'analisis-archivos', false, 52428800)
on conflict (id) do update set file_size_limit = excluded.file_size_limit;

-- Ruta: <usuario>/<analisis>/<archivo>. El autor sube a su propia carpeta; la
-- lectura de terceros se resuelve mirando la carpeta del analisis.
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

drop policy if exists fotos_insert_propio on storage.objects;
create policy fotos_insert_propio on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'reportes-fotos'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.es_gerente())
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


-- ----------------------------------------------------------------------------
-- 8. Cronograma (Gantt): fuente del avance fisico y de la curva
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- 1. Tareas
-- ----------------------------------------------------------------------------

create table if not exists public.tareas (
  id                    uuid primary key default gen_random_uuid(),
  frente_de_trabajo_id  uuid not null references public.frentes_de_trabajo (id) on delete cascade,
  nombre                text not null check (length(btrim(nombre)) > 0),
  inicio                date not null,
  fin                   date not null,
  avance                numeric(5,2) not null default 0 check (avance between 0 and 100),
  -- Peso de la tarea dentro del frente. Si queda en null se usa la duracion
  -- en dias, que es el mejor sustituto disponible: no tenemos los montos de
  -- cada actividad, y promediar todas por igual haria que una tarea de un dia
  -- pese lo mismo que una de tres meses.
  peso                  numeric(10,2) check (peso is null or peso > 0),
  orden                 integer not null default 0,
  creado_en             timestamptz not null default now(),
  actualizado_en        timestamptz not null default now(),
  constraint tareas_fechas_coherentes check (fin >= inicio)
);

create index if not exists tareas_frente_idx on public.tareas (frente_de_trabajo_id, orden);
create index if not exists tareas_inicio_idx on public.tareas (inicio);

create or replace function public.tareas_tocar_actualizado()
returns trigger language plpgsql as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$;

drop trigger if exists tareas_before_update on public.tareas;
create trigger tareas_before_update
  before update on public.tareas
  for each row execute function public.tareas_tocar_actualizado();

alter table public.tareas enable row level security;

drop policy if exists tareas_select on public.tareas;
create policy tareas_select on public.tareas
  for select to authenticated
  using (true);

drop policy if exists tareas_escritura_gerente on public.tareas;
create policy tareas_escritura_gerente on public.tareas
  for all to authenticated
  using (public.es_gerente())
  with check (public.es_gerente());

-- ----------------------------------------------------------------------------
-- 2. El avance fisico del frente pasa a salir de sus tareas
-- ----------------------------------------------------------------------------
--
-- Promedio ponderado por peso, usando la duracion en dias cuando no se cargo
-- un peso explicito. Si el frente no tiene tareas, se cae al valor que haya
-- quedado cargado a mano en la tabla, para que nada se rompa mientras se
-- termina de volcar el cronograma.

drop view if exists public.frentes_semaforo;
create view public.frentes_semaforo
with (security_invoker = on) as
select
  f.id,
  f.nombre,
  f.frente_principal,
  coalesce(t.avance_calculado, f.avance_fisico) as avance_fisico,
  f.avance_financiero,
  f.orden,
  coalesce(t.cantidad, 0)::int as tareas,
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
left join lateral (
  select
    count(*) as cantidad,
    sum(ta.avance * coalesce(ta.peso, greatest((ta.fin - ta.inicio) + 1, 1)))
      / nullif(sum(coalesce(ta.peso, greatest((ta.fin - ta.inicio) + 1, 1))), 0)
      as avance_calculado
  from public.tareas ta
  where ta.frente_de_trabajo_id = f.id
) t on true
group by
  f.id, f.nombre, f.frente_principal, f.avance_fisico, f.avance_financiero,
  f.orden, t.avance_calculado, t.cantidad;

grant select on public.frentes_semaforo to authenticated;

-- ----------------------------------------------------------------------------
-- 3. Curva del proyecto calculada desde el cronograma
-- ----------------------------------------------------------------------------
--
-- Programado: cuanto deberia llevarse al cierre de cada mes, suponiendo avance
-- lineal de cada tarea entre su inicio y su fin, ponderado igual que arriba.
-- Es calculable para todos los meses del cronograma.
--
-- Real: solo se conoce el valor de hoy, porque las tareas guardan su avance
-- actual y no su historia. Por eso el real no se calcula aca: se toma el
-- avance de hoy y se sella en el mes corriente desde la aplicacion, y asi la
-- serie historica se va armando mes a mes.

create or replace function public.curva_programada()
returns table (periodo date, avance_programado numeric)
language sql stable as $$
  with pesos as (
    select
      t.inicio,
      t.fin,
      coalesce(t.peso, greatest((t.fin - t.inicio) + 1, 1))::numeric as peso
    from public.tareas t
  ),
  total as (select nullif(sum(peso), 0) as peso_total from pesos),
  meses as (
    select generate_series(
      date_trunc('month', (select min(inicio) from pesos))::date,
      date_trunc('month', (select max(fin) from pesos))::date,
      interval '1 month'
    )::date as periodo
  )
  select
    m.periodo,
    round(coalesce(sum(
      p.peso * least(
        1.0,
        greatest(
          0.0,
          ((m.periodo + interval '1 month - 1 day')::date - p.inicio + 1)::numeric
            / greatest((p.fin - p.inicio) + 1, 1)::numeric
        )
      )
    ) / (select peso_total from total), 0) * 100, 2) as avance_programado
  from meses m
  cross join pesos p
  group by m.periodo
  order by m.periodo;
$$;

grant execute on function public.curva_programada() to authenticated;

-- El avance real de hoy, ponderado sobre todas las tareas del proyecto.
create or replace function public.avance_real_actual()
returns numeric
language sql stable as $$
  select round(coalesce(
    sum(t.avance * coalesce(t.peso, greatest((t.fin - t.inicio) + 1, 1)))
      / nullif(sum(coalesce(t.peso, greatest((t.fin - t.inicio) + 1, 1))), 0),
    0), 2)
  from public.tareas t;
$$;

grant execute on function public.avance_real_actual() to authenticated;


-- ----------------------------------------------------------------------------
-- 1. Mediciones
-- ----------------------------------------------------------------------------

create table if not exists public.mediciones (
  id              uuid primary key default gen_random_uuid(),
  tarea_id        uuid not null references public.tareas (id) on delete cascade,
  -- Primer dia del mes medido.
  periodo         date not null,
  -- Avance ACUMULADO de la tarea al cierre de ese mes, no el del mes.
  avance          numeric(5,2) not null check (avance between 0 and 100),
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now(),
  unique (tarea_id, periodo)
);

create index if not exists mediciones_periodo_idx on public.mediciones (periodo);
create index if not exists mediciones_tarea_idx   on public.mediciones (tarea_id, periodo desc);

create or replace function public.mediciones_tocar_actualizado()
returns trigger language plpgsql as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$;

drop trigger if exists mediciones_before_update on public.mediciones;
create trigger mediciones_before_update
  before update on public.mediciones
  for each row execute function public.mediciones_tocar_actualizado();

alter table public.mediciones enable row level security;

drop policy if exists mediciones_select on public.mediciones;
create policy mediciones_select on public.mediciones
  for select to authenticated
  using (true);

drop policy if exists mediciones_escritura_gerente on public.mediciones;
create policy mediciones_escritura_gerente on public.mediciones
  for all to authenticated
  using (public.es_gerente())
  with check (public.es_gerente());

-- ----------------------------------------------------------------------------
-- 2. Sincronizacion entre tareas.avance y las mediciones
-- ----------------------------------------------------------------------------
--
-- tareas.avance sigue existiendo como "lo que lleva hoy", que es lo que dibuja
-- la barra del Gantt. Es el espejo de la medicion mas reciente.
--
-- Los dos triggers se llaman entre si, por eso cada uno solo escribe cuando el
-- valor cambia de verdad: la segunda vuelta no encuentra filas que tocar y la
-- cadena se corta sola.

-- La sincronizacion va en un solo sentido: las mediciones se cargan de
-- forma explicita desde el cierre mensual, y tareas.avance es su espejo.

-- Al cargar o corregir una medicion, la tarea refleja la mas reciente.
create or replace function public.medicion_sincronizar_tarea()
returns trigger language plpgsql as $$
declare
  v_tarea uuid := coalesce(new.tarea_id, old.tarea_id);
  v_ultimo numeric;
begin
  select m.avance into v_ultimo
  from public.mediciones m
  where m.tarea_id = v_tarea
  order by m.periodo desc
  limit 1;

  update public.tareas t
  set avance = coalesce(v_ultimo, 0)
  where t.id = v_tarea
    and t.avance is distinct from coalesce(v_ultimo, 0);

  return null;
end;
$$;

drop trigger if exists medicion_after_cambio on public.mediciones;
create trigger medicion_after_cambio
  after insert or update or delete on public.mediciones
  for each row execute function public.medicion_sincronizar_tarea();

-- ----------------------------------------------------------------------------
-- 3. Semilla: lo que hoy tiene cada tarea pasa a ser su medicion del mes
-- ----------------------------------------------------------------------------

insert into public.mediciones (tarea_id, periodo, avance)
select t.id, date_trunc('month', current_date)::date, t.avance
from public.tareas t
on conflict (tarea_id, periodo) do nothing;

-- ----------------------------------------------------------------------------
-- 4. La curva real sale de las mediciones
-- ----------------------------------------------------------------------------
--
-- Para cada mes se toma, de cada tarea, la medicion mas reciente que sea igual
-- o anterior a ese mes: una tarea que no se midio en noviembre conserva lo que
-- llevaba en octubre, que es justamente lo que significa un avance acumulado.
--
-- La serie corta en el ultimo mes con alguna medicion. Mas alla de eso no hay
-- dato, y rellenarlo seria inventar que la obra sigue avanzando.

create or replace function public.curva_real()
returns table (periodo date, avance_real numeric)
language sql stable as $$
  with pesos as (
    select
      t.id,
      coalesce(t.peso, greatest((t.fin - t.inicio) + 1, 1))::numeric as peso
    from public.tareas t
  ),
  total as (select nullif(sum(peso), 0) as peso_total from pesos),
  limite as (select max(m.periodo) as hasta from public.mediciones m),
  meses as (
    select generate_series(
      (select min(m.periodo) from public.mediciones m),
      (select hasta from limite),
      interval '1 month'
    )::date as periodo
  )
  select
    ms.periodo,
    round(
      coalesce(sum(
        p.peso * coalesce((
          select md.avance
          from public.mediciones md
          where md.tarea_id = p.id and md.periodo <= ms.periodo
          order by md.periodo desc
          limit 1
        ), 0)
      ) / (select peso_total from total), 0),
      2
    ) as avance_real
  from meses ms
  cross join pesos p
  group by ms.periodo
  order by ms.periodo;
$$;

grant execute on function public.curva_real() to authenticated;


create or replace function public.mediciones_del_mes(p_periodo date)
returns table (
  tarea_id   uuid,
  avance     numeric,
  medido     boolean,
  arrastrado numeric
)
language sql stable as $$
  select
    t.id as tarea_id,
    coalesce(
      (select m.avance from public.mediciones m
        where m.tarea_id = t.id and m.periodo = date_trunc('month', p_periodo)::date),
      (select m.avance from public.mediciones m
        where m.tarea_id = t.id and m.periodo < date_trunc('month', p_periodo)::date
        order by m.periodo desc limit 1),
      0
    ) as avance,
    exists (
      select 1 from public.mediciones m
      where m.tarea_id = t.id and m.periodo = date_trunc('month', p_periodo)::date
    ) as medido,
    coalesce(
      (select m.avance from public.mediciones m
        where m.tarea_id = t.id and m.periodo < date_trunc('month', p_periodo)::date
        order by m.periodo desc limit 1),
      0
    ) as arrastrado
  from public.tareas t;
$$;

grant execute on function public.mediciones_del_mes(date) to authenticated;

-- Meses que ya tienen alguna medicion, para el selector de la pantalla.
create or replace function public.meses_medidos()
returns table (periodo date, tareas bigint)
language sql stable as $$
  select m.periodo, count(*) as tareas
  from public.mediciones m
  group by m.periodo
  order by m.periodo desc;
$$;

grant execute on function public.meses_medidos() to authenticated;


-- Solo la gerencia borra usuarios. La fila de public.usuarios se va sola por
-- cascada al borrar la cuenta de Auth; esta policy cubre el borrado directo.
drop policy if exists usuarios_delete_gerente on public.usuarios;
create policy usuarios_delete_gerente on public.usuarios
  for delete to authenticated
  using (public.es_gerente() and id <> auth.uid());

-- Un usuario puede editar su propia fila, pero no ascenderse ni reactivarse:
-- eso queda reservado a la gerencia.
drop policy if exists usuarios_update_propio on public.usuarios;
create policy usuarios_update_propio on public.usuarios
  for update to authenticated
  using (id = auth.uid() or public.es_gerente())
  with check (id = auth.uid() or public.es_gerente());

-- Cuantos registros dependen de un usuario. Lo consulta la aplicacion antes de
-- ofrecer el borrado, para decir por que no se puede en vez de mostrar el
-- error crudo de la base.
create or replace function public.dependencias_usuario(p_usuario uuid)
returns table (reportes bigint, analisis bigint, revisiones bigint)
language sql stable security definer set search_path = public as $$
  select
    (select count(*) from public.reportes r where r.reportado_por = p_usuario),
    (select count(*) from public.analisis a where a.creado_por = p_usuario),
    (select count(*) from public.reportes r where r.revisado_por = p_usuario);
$$;

grant execute on function public.dependencias_usuario(uuid) to authenticated;


-- ----------------------------------------------------------------------------
-- 1. La cadena de sustituciones
-- ----------------------------------------------------------------------------

create table if not exists public.sustituciones (
  id             uuid primary key default gen_random_uuid(),
  predecesor_id  uuid not null references public.usuarios (id) on delete cascade,
  sucesor_id     uuid not null references public.usuarios (id) on delete cascade,
  -- Se guarda la disciplina del momento: si mas adelante alguien cambia de
  -- disciplina, el registro de por que hubo relevo sigue siendo legible.
  disciplina     public.disciplina not null,
  motivo         text,
  creado_por     uuid not null references public.usuarios (id) on delete restrict,
  creado_en      timestamptz not null default now(),
  unique (predecesor_id, sucesor_id),
  constraint sustitucion_personas_distintas check (predecesor_id <> sucesor_id)
);

create index if not exists sustituciones_sucesor_idx
  on public.sustituciones (sucesor_id);

-- Un profesional se releva una sola vez: sin esto, dos sucesores distintos
-- heredarian el mismo historial y nadie sabria quien es el responsable.
create unique index if not exists sustituciones_predecesor_unico
  on public.sustituciones (predecesor_id);

-- ----------------------------------------------------------------------------
-- 2. Cadena de predecesores
-- ----------------------------------------------------------------------------
--
-- Recursiva a proposito: si A fue sustituido por B y B por C, entonces C tiene
-- que ver tambien lo de A. El relevo se encadena como se encadena la obra.
--
-- SECURITY DEFINER para poder leerse desde las policies sin recursion de RLS.

create or replace function public.predecesores(p_usuario uuid)
returns table (usuario_id uuid)
language sql stable security definer set search_path = public as $$
  with recursive cadena as (
    select s.predecesor_id
    from public.sustituciones s
    where s.sucesor_id = p_usuario

    union

    select s.predecesor_id
    from public.sustituciones s
    join cadena c on s.sucesor_id = c.predecesor_id
  )
  select predecesor_id from cadena;
$$;

grant execute on function public.predecesores(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 3. El sucesor ve el historial que heredo
-- ----------------------------------------------------------------------------

drop policy if exists reportes_select on public.reportes;
create policy reportes_select on public.reportes
  for select to authenticated
  using (
    reportado_por = auth.uid()
    or public.es_gerente()
    or reportado_por in (select usuario_id from public.predecesores(auth.uid()))
  );

-- Version tolerante: la carpeta llega como texto y un nombre mal formado
-- haria fallar el cast dentro de la policy en vez de denegar.
create or replace function public.es_predecesor_txt(p text)
returns boolean
language plpgsql stable security definer set search_path = public as $$
declare v uuid;
begin
  begin
    v := p::uuid;
  exception when others then
    return false;
  end;
  return exists (select 1 from public.predecesores(auth.uid()) x where x.usuario_id = v);
end;
$$;

grant execute on function public.es_predecesor_txt(text) to authenticated;

-- El sucesor tambien necesita abrir las fotos y documentos de esos reportes.
drop policy if exists fotos_select on storage.objects;
create policy fotos_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'reportes-fotos'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.es_gerente()
      or public.es_predecesor_txt((storage.foldername(name))[1])
    )
  );

-- ----------------------------------------------------------------------------
-- 4. RLS de la propia tabla
-- ----------------------------------------------------------------------------

alter table public.sustituciones enable row level security;

drop policy if exists sustituciones_select on public.sustituciones;
create policy sustituciones_select on public.sustituciones
  for select to authenticated
  using (
    public.es_gerente()
    or sucesor_id = auth.uid()
    or predecesor_id = auth.uid()
  );

drop policy if exists sustituciones_escritura_gerente on public.sustituciones;
create policy sustituciones_escritura_gerente on public.sustituciones
  for all to authenticated
  using (public.es_gerente())
  with check (public.es_gerente());


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
