-- Datos que necesita la pantalla de cierre mensual.
--
-- Para un mes dado devuelve, por cada tarea, el valor que corresponde mostrar:
-- su medicion de ese mes si existe, y si no, lo que arrastraba del mes
-- anterior. Asi el formulario arranca con el acumulado y solo se tocan las
-- tareas que de verdad avanzaron.
--
-- Ejecutar en Supabase -> SQL Editor. Idempotente.

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
