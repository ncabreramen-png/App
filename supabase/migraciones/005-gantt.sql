-- Cronograma (Gantt) como fuente del avance.
--
-- Cada frente se abre en tareas con fecha de inicio, fin y porcentaje de
-- avance. A partir de ahi se calcula el avance fisico del frente, y de la
-- suma de los frentes sale la curva del proyecto.
--
-- El avance financiero sigue siendo manual: el cronograma no sabe de dinero.
--
-- Ejecutar en Supabase -> SQL Editor. Idempotente.

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
