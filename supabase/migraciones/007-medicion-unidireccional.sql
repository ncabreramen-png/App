-- Correccion de 006: la sincronizacion entre tareas y mediciones va en un solo
-- sentido.
--
-- La version anterior hacia que crear o editar una tarea estampara una
-- medicion en el mes corriente. Eso rompia el acumulado: dar de alta una tarea
-- con avance 0 en octubre escribia una medicion de 0% que pisaba el 100% que
-- la tarea ya tenia en marzo, y la curva real se desplomaba a cero.
--
-- Ahora las mediciones se crean solo de forma explicita, desde el cierre
-- mensual, y tareas.avance es su espejo: el valor de la medicion mas reciente.
--
-- Ejecutar en Supabase -> SQL Editor. Idempotente.

drop trigger if exists tarea_after_avance on public.tareas;
drop function if exists public.tarea_registrar_medicion();

comment on column public.tareas.avance is
  'Derivado: refleja la medicion mas reciente. No se edita directo, se carga '
  'desde el cierre mensual.';
