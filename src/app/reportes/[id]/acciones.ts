"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { exigirGerente } from "@/lib/sesion";
import { BUCKET_REPORTES, type Archivo } from "@/lib/archivos";
import { TIPOS_DE_REPORTE, type TipoDeReporte } from "@/lib/tipos";

export type Resultado = { ok: true } | { ok: false; error: string };

function revalidar(id: string) {
  revalidatePath(`/reportes/${id}`);
  revalidatePath("/campo");
  revalidatePath("/gerente");
  revalidatePath("/gerente/reportes");
  revalidatePath("/gerente/aprobaciones");
  revalidatePath("/gerente/informe");
}

/**
 * Correccion de un reporte por parte de la gerencia.
 *
 * No toca el estatus: eso se resuelve en la cola de aprobaciones. Cambiar el
 * tipo o el frente si mueve el semaforo, que es justamente el punto de poder
 * recategorizar un reporte mal cargado.
 */
export async function editarReporte(entrada: {
  id: string;
  frenteId: string;
  tipo: string;
  descripcion: string;
  archivos: Archivo[];
}): Promise<Resultado> {
  await exigirGerente();

  const descripcion = entrada.descripcion.trim();
  if (!descripcion) return { ok: false, error: "La descripción no puede estar vacía." };
  if (!entrada.frenteId) return { ok: false, error: "Seleccioná un frente de trabajo." };
  if (!TIPOS_DE_REPORTE.includes(entrada.tipo as TipoDeReporte)) {
    return { ok: false, error: "Tipo de reporte no válido." };
  }

  const supabase = await crearClienteServidor();

  // Los adjuntos que se quitaron hay que borrarlos del bucket: la fila deja de
  // referenciarlos y si no, quedan ocupando espacio para siempre.
  const { data: antes } = await supabase
    .from("reportes")
    .select("archivos")
    .eq("id", entrada.id)
    .maybeSingle();

  const previos = (antes?.archivos ?? []) as Archivo[];
  const quedan = new Set(entrada.archivos.map((a) => a.ruta));
  const sobran = previos.filter((a) => !quedan.has(a.ruta)).map((a) => a.ruta);

  const { error } = await supabase
    .from("reportes")
    .update({
      frente_de_trabajo_id: entrada.frenteId,
      tipo_de_reporte: entrada.tipo as TipoDeReporte,
      descripcion,
      archivos: entrada.archivos,
    })
    .eq("id", entrada.id);

  if (error) return { ok: false, error: error.message };

  if (sobran.length > 0) {
    await supabase.storage.from(BUCKET_REPORTES).remove(sobran);
  }

  revalidar(entrada.id);
  return { ok: true };
}

export async function borrarReporte(id: string): Promise<Resultado> {
  await exigirGerente();

  const supabase = await crearClienteServidor();

  const { data } = await supabase
    .from("reportes")
    .select("archivos")
    .eq("id", id)
    .maybeSingle();

  const rutas = ((data?.archivos ?? []) as Archivo[]).map((a) => a.ruta);

  const { error } = await supabase.from("reportes").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  if (rutas.length > 0) {
    await supabase.storage.from(BUCKET_REPORTES).remove(rutas);
  }

  revalidar(id);
  return { ok: true };
}
