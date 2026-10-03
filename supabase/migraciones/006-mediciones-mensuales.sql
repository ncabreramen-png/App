-- Medicion mensual por tarea: el avance real deja de ser una foto del presente
-- y pasa a tener historia, de modo que la curva real se acumula mes a mes.
--
-- Antes, cada tarea guardaba un unico porcentaje. Si en octubre una excavacion
-- iba 60% y en noviembre 75%, el 60 se perdia y la curva real no se podia
-- reconstruir hacia atras.
--
-- Ejecutar en Supabase -> SQL Editor. Idempotente.

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

-- Al mover el avance de una tarea, queda registrado en el mes corriente.
create or replace function public.tarea_registrar_medicion()
returns trigger language plpgsql as $$
begin
  insert into public.mediciones (tarea_id, periodo, avance)
  values (new.id, date_trunc('month', current_date)::date, new.avance)
  on conflict (tarea_id, periodo) do update
    set avance = excluded.avance
    where mediciones.avance is distinct from excluded.avance;
  return null;
end;
$$;

drop trigger if exists tarea_after_avance on public.tareas;
create trigger tarea_after_avance
  after insert or update of avance on public.tareas
  for each row execute function public.tarea_registrar_medicion();

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
