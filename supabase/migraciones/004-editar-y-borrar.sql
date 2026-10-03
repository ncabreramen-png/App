-- La gerencia puede corregir o eliminar reportes y analisis.
--
-- Antes: un reporte mal cargado quedaba para siempre y nadie podia borrarlo,
-- ni siquiera la gerencia. Solo existia el update para aprobar o rechazar.
--
-- Ejecutar en Supabase -> SQL Editor. Idempotente.

-- ----------------------------------------------------------------------------
-- Reportes: la gerencia edita y borra cualquiera
-- ----------------------------------------------------------------------------

-- La policy de update ya existia y cubre tanto la aprobacion como la
-- correccion de contenido; se redeclara para dejarlo explicito.
drop policy if exists reportes_update_gerente on public.reportes;
create policy reportes_update_gerente on public.reportes
  for update to authenticated
  using (public.es_gerente())
  with check (public.es_gerente());

drop policy if exists reportes_delete_gerente on public.reportes;
create policy reportes_delete_gerente on public.reportes
  for delete to authenticated
  using (public.es_gerente());

-- ----------------------------------------------------------------------------
-- El sello de revision solo debe dispararse al aprobar o rechazar
-- ----------------------------------------------------------------------------
--
-- El trigger exigia comentario cada vez que el estatus terminaba en
-- "Rechazado". Al editar la descripcion de un reporte ya rechazado, el
-- estatus no cambia, asi que no se dispara. Se deja la condicion explicita
-- para que una edicion futura no reescriba quien reviso.

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

-- ----------------------------------------------------------------------------
-- Storage: la gerencia tambien borra los adjuntos de reportes ajenos
-- ----------------------------------------------------------------------------
--
-- Ya estaba contemplado en fotos_delete_propio, que acepta al gerente; se
-- redeclara por claridad y para que el esquema quede autoexplicativo.

drop policy if exists fotos_delete_propio on storage.objects;
create policy fotos_delete_propio on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'reportes-fotos'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.es_gerente())
  );

-- La gerencia puede subir adjuntos a un reporte ajeno al corregirlo. Sin
-- esto, editar un reporte de otro y agregarle un archivo fallaria.
drop policy if exists fotos_insert_propio on storage.objects;
create policy fotos_insert_propio on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'reportes-fotos'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.es_gerente())
  );
