"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { exigirGerente, exigirUsuario } from "@/lib/sesion";
import { BUCKET_ANALISIS, type Archivo } from "@/lib/archivos";

export type Resultado = { ok: true } | { ok: false; error: string };

function revalidar(id?: string) {
  revalidatePath("/analisis");
  if (id) revalidatePath(`/analisis/${id}`);
}

/**
 * Crea un analisis. El id lo genera el cliente antes de subir los archivos,
 * para que la ruta en Storage sea <usuario>/<analisis>/... y el permiso de
 * lectura de quienes lo reciban se resuelva mirando esa carpeta.
 */
export async function crearAnalisis(entrada: {
  id: string;
  titulo: string;
  descripcion: string;
  frenteId: string | null;
  archivos: Archivo[];
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const usuario = await exigirGerente();

  const titulo = entrada.titulo.trim();
  if (!titulo) return { ok: false, error: "El título no puede estar vacío." };

  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("analisis").insert({
    id: entrada.id,
    titulo,
    descripcion: entrada.descripcion.trim(),
    frente_de_trabajo_id: entrada.frenteId || null,
    archivos: entrada.archivos,
    creado_por: usuario.id,
  });

  if (error) return { ok: false, error: error.message };

  revalidar(entrada.id);
  return { ok: true, id: entrada.id };
}

export async function actualizarAnalisis(entrada: {
  id: string;
  titulo: string;
  descripcion: string;
  frenteId: string | null;
}): Promise<Resultado> {
  await exigirGerente();

  const titulo = entrada.titulo.trim();
  if (!titulo) return { ok: false, error: "El título no puede estar vacío." };

  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from("analisis")
    .update({
      titulo,
      descripcion: entrada.descripcion.trim(),
      frente_de_trabajo_id: entrada.frenteId || null,
    })
    .eq("id", entrada.id);

  if (error) return { ok: false, error: error.message };
  revalidar(entrada.id);
  return { ok: true };
}

export async function borrarAnalisis(id: string): Promise<Resultado> {
  await exigirGerente();

  const supabase = await crearClienteServidor();

  // Los archivos del bucket no se borran solos al borrar la fila.
  const { data } = await supabase.from("analisis").select("archivos").eq("id", id).maybeSingle();
  const rutas = ((data?.archivos ?? []) as Archivo[]).map((a) => a.ruta);
  if (rutas.length > 0) {
    await supabase.storage.from(BUCKET_ANALISIS).remove(rutas);
  }

  const { error } = await supabase.from("analisis").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidar();
  return { ok: true };
}

/**
 * Comparte o deja de compartir con un usuario. El RLS verifica que quien
 * llama sea el autor del analisis, asi que no alcanza con pasar un id ajeno.
 */
export async function cambiarAcceso(entrada: {
  analisisId: string;
  usuarioId: string;
  conceder: boolean;
}): Promise<Resultado> {
  await exigirUsuario();

  const supabase = await crearClienteServidor();

  const { error } = entrada.conceder
    ? await supabase
        .from("analisis_accesos")
        .upsert(
          { analisis_id: entrada.analisisId, usuario_id: entrada.usuarioId },
          { onConflict: "analisis_id,usuario_id" },
        )
    : await supabase
        .from("analisis_accesos")
        .delete()
        .eq("analisis_id", entrada.analisisId)
        .eq("usuario_id", entrada.usuarioId);

  if (error) return { ok: false, error: error.message };
  revalidar(entrada.analisisId);
  return { ok: true };
}
