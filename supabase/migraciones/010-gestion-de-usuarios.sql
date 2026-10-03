-- Gestion de usuarios: editar, desactivar y borrar.
--
-- Borrar un usuario que ya reporto no es posible ni deseable: reportes y
-- analisis referencian a su autor con "on delete restrict" justamente para que
-- el historial no quede sin firma. Para esos casos esta "activo": el acceso se
-- corta pero la autoria se conserva.
--
-- Ejecutar en Supabase -> SQL Editor. Idempotente.

alter table public.usuarios
  add column if not exists activo boolean not null default true;

comment on column public.usuarios.activo is
  'false = no puede entrar. Se usa en vez de borrar cuando el usuario ya tiene '
  'historial, para no perder la autoria de sus reportes.';

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
