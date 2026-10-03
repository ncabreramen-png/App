-- Sustitucion de un profesional por otro en la misma disciplina.
--
-- El sucesor retoma el trabajo del anterior: ve y continua todo su historial.
-- Pero la firma de cada reporte NO cambia. Un reporte dice quien observo que y
-- cuando; reasignarlo haria que el registro afirme que el sucesor vio cosas que
-- no vio, y eso no resiste una revision del cliente.
--
-- Ejecutar en Supabase -> SQL Editor. Idempotente.

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
