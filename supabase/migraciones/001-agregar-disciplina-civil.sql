-- Agrega la disciplina "Civil" a las 7 originales.
-- Ejecutar en Supabase -> SQL Editor. Se puede correr mas de una vez sin dano.
--
-- Nota: en Postgres los valores de un enum solo se agregan, no se reordenan.
-- El orden interno no importa porque la app nunca ordena por disciplina; el
-- orden que ve el usuario lo define DISCIPLINAS en src/lib/tipos.ts.

alter type public.disciplina add value if not exists 'Civil';
