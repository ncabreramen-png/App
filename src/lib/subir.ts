"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { comprimirImagen } from "@/lib/imagenes";
import { esImagen, nombreSeguro, type Archivo } from "@/lib/archivos";

/**
 * Sube una tanda de adjuntos y devuelve sus metadatos para guardar en la fila.
 *
 * Las imagenes se comprimen antes de salir; los documentos no se tocan, porque
 * recomprimir un PDF o un Excel lo romperia.
 */
export async function subirArchivos(
  supabase: SupabaseClient,
  bucket: string,
  carpeta: string,
  archivos: File[],
  onPaso?: (texto: string) => void,
): Promise<Archivo[]> {
  const subidos: Archivo[] = [];

  for (let i = 0; i < archivos.length; i++) {
    const original = archivos[i];
    onPaso?.(`Subiendo ${i + 1} de ${archivos.length}: ${original.name}`);

    const archivo = esImagen(original.type) ? await comprimirImagen(original) : original;
    const ruta = `${carpeta}/${i + 1}-${nombreSeguro(archivo.name)}`;

    const { error } = await supabase.storage.from(bucket).upload(ruta, archivo, {
      contentType: archivo.type || "application/octet-stream",
      upsert: false,
    });

    if (error) throw new Error(`No se pudo subir "${original.name}": ${error.message}`);

    subidos.push({
      ruta,
      nombre: original.name,
      tipo: archivo.type || "application/octet-stream",
      tamano: archivo.size,
    });
  }

  return subidos;
}
