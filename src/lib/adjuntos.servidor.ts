import { crearClienteServidor } from "@/lib/supabase/servidor";
import type { Archivo } from "@/lib/archivos";

export type ArchivoFirmado = Archivo & { url: string };

const VIGENCIA_SEGUNDOS = 60 * 60;

/**
 * Los buckets son privados: todo se sirve con URLs firmadas de vigencia corta,
 * generadas con la sesion del usuario para que el RLS decida que puede ver.
 */
export async function firmarArchivos(
  bucket: string,
  archivos: Archivo[],
): Promise<ArchivoFirmado[]> {
  if (archivos.length === 0) return [];

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrls(
      archivos.map((a) => a.ruta),
      VIGENCIA_SEGUNDOS,
    );

  if (error || !data) return [];

  return archivos
    .map((a, i) => ({ ...a, url: data[i]?.signedUrl ?? "" }))
    .filter((a) => a.url !== "");
}

/** Firma los adjuntos de varias entidades en una sola llamada a Storage. */
export async function firmarPorEntidad(
  bucket: string,
  entidades: { id: string; archivos: Archivo[] }[],
): Promise<Record<string, ArchivoFirmado[]>> {
  const todos = entidades.flatMap((e) => e.archivos);
  if (todos.length === 0) return {};

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrls(
      todos.map((a) => a.ruta),
      VIGENCIA_SEGUNDOS,
    );

  if (error || !data) return {};

  const porRuta = new Map<string, string>();
  data.forEach((d, i) => {
    if (d.signedUrl) porRuta.set(todos[i].ruta, d.signedUrl);
  });

  const salida: Record<string, ArchivoFirmado[]> = {};
  for (const e of entidades) {
    salida[e.id] = e.archivos
      .map((a) => ({ ...a, url: porRuta.get(a.ruta) ?? "" }))
      .filter((a) => a.url !== "");
  }
  return salida;
}
