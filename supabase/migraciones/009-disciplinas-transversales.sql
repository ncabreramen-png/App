-- Disciplinas transversales: medio ambiente, seguridad y salud ocupacional,
-- gestion social y aseguramiento de calidad.
--
-- Dos de ellas ya existian con otro nombre ("Calidad" y "Ambiental"): se
-- renombran en vez de agregarse, para no dejar dos opciones que significan lo
-- mismo conviviendo en el desplegable. Renombrar un valor de enum conserva la
-- asignacion de los usuarios que ya lo tenian.
--
-- Ejecutar en Supabase -> SQL Editor. Idempotente.

do $$
begin
  if exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'disciplina' and e.enumlabel = 'Calidad'
  ) then
    alter type public.disciplina rename value 'Calidad' to 'Aseguramiento de calidad';
  end if;

  if exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'disciplina' and e.enumlabel = 'Ambiental'
  ) then
    alter type public.disciplina rename value 'Ambiental' to 'Medio ambiente';
  end if;
end $$;

alter type public.disciplina add value if not exists 'Seguridad y salud ocupacional';
alter type public.disciplina add value if not exists 'Gestión social';

-- El alta de usuarios cae a esta disciplina cuando el metadato viene vacio.
-- Tenia el nombre viejo cableado.
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
