"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { exigirCalidad } from "@/lib/sesion";
import { BUCKET_NC, type Archivo } from "@/lib/archivos";

export type Resultado = { ok: true } | { ok: false; error: string };

function revalidar() {
  revalidatePath("/no-conformidad");
  revalidatePath("/gerente/informe");
}

export async function crearNoConformidad(entrada: {
  frenteId: string;
  descripcion: string;
  detectadaEn: string;
  archivos: Archivo[];
}): Promise<Resultado> {
  const usuario = await exigirCalidad();

  const descripcion = entrada.descripcion.trim();
  if (!descripcion) return { ok: false, error: "La descripción no puede estar vacía." };
  if (!entrada.frenteId) return { ok: false, error: "Seleccioná un frente de trabajo." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entrada.detectadaEn)) {
    return { ok: false, error: "La fecha de detección no es válida." };
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("no_conformidades").insert({
    frente_de_trabajo_id: entrada.frenteId,
    descripcion,
    detectada_en: entrada.detectadaEn,
    archivos: entrada.archivos,
    creado_por: usuario.id,
  });

  if (error) return { ok: false, error: error.message };
  revalidar();
  return { ok: true };
}

/**
 * Cierre o reapertura. Cerrar exige decir como se atendio: una no conformidad
 * cerrada sin explicacion no sirve como registro, y el trigger de la base lo
 * vuelve a exigir aunque alguien llame a la API por fuera.
 */
export async function cambiarEstadoNC(entrada: {
  id: string;
  estado: "Pendiente" | "Atendida";
  comentario: string;
}): Promise<Resultado> {
  await exigirCalidad();

  const comentario = entrada.comentario.trim();
  if (entrada.estado === "Atendida" && !comentario) {
    return { ok: false, error: "Para cerrarla hay que indicar cómo se atendió." };
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from("no_conformidades")
    .update({
      estado: entrada.estado,
      comentario_cierre: entrada.estado === "Atendida" ? comentario : null,
    })
    .eq("id", entrada.id);

  if (error) return { ok: false, error: error.message };
  revalidar();
  return { ok: true };
}

export async function editarNoConformidad(entrada: {
  id: string;
  frenteId: string;
  descripcion: string;
  detectadaEn: string;
}): Promise<Resultado> {
  await exigirCalidad();

  const descripcion = entrada.descripcion.trim();
  if (!descripcion) return { ok: false, error: "La descripción no puede estar vacía." };

  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from("no_conformidades")
    .update({
      frente_de_trabajo_id: entrada.frenteId,
      descripcion,
      detectada_en: entrada.detectadaEn,
    })
    .eq("id", entrada.id);

  if (error) return { ok: false, error: error.message };
  revalidar();
  return { ok: true };
}

export async function borrarNoConformidad(id: string): Promise<Resultado> {
  await exigirCalidad();

  const supabase = await crearClienteServidor();

  const { data } = await supabase
    .from("no_conformidades")
    .select("archivos")
    .eq("id", id)
    .maybeSingle();

  const rutas = ((data?.archivos ?? []) as Archivo[]).map((a) => a.ruta);

  const { error } = await supabase.from("no_conformidades").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  if (rutas.length > 0) await supabase.storage.from(BUCKET_NC).remove(rutas);

  revalidar();
  return { ok: true };
}
