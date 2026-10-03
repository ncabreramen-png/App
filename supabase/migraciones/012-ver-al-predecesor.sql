-- Correccion: el sucesor debe poder leer el nombre de su predecesor.
--
-- La policy de usuarios solo permitia ver la fila propia o, si se es gerencia,
-- todas. Resultado: el sucesor veia el reporte heredado pero sin firma, porque
-- la union con usuarios le devolvia nulo. Conservar la autoria no sirve de
-- nada si quien la hereda no puede leerla.
--
-- Ejecutar en Supabase -> SQL Editor. Idempotente.

drop policy if exists usuarios_select on public.usuarios;
create policy usuarios_select on public.usuarios
  for select to authenticated
  using (
    id = auth.uid()
    or public.es_gerente()
    or id in (select usuario_id from public.predecesores(auth.uid()))
  );
