const LADO_MAXIMO = 1600;
const CALIDAD = 0.82;

/**
 * Reduce la foto antes de subirla. En campo la conexion suele ser mala y una
 * foto de celular pesa varios MB; a 1600 px el detalle sigue siendo suficiente.
 * Si algo falla, devuelve el archivo original.
 */
export async function comprimirImagen(archivo: File): Promise<File> {
  if (!archivo.type.startsWith("image/")) return archivo;

  try {
    const bitmap = await createImageBitmap(archivo);
    const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height));

    if (escala === 1 && archivo.size < 1_000_000) {
      bitmap.close();
      return archivo;
    }

    const lienzo = document.createElement("canvas");
    lienzo.width = Math.round(bitmap.width * escala);
    lienzo.height = Math.round(bitmap.height * escala);

    const ctx = lienzo.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return archivo;
    }
    ctx.drawImage(bitmap, 0, 0, lienzo.width, lienzo.height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      lienzo.toBlob(resolve, "image/jpeg", CALIDAD),
    );
    if (!blob || blob.size >= archivo.size) return archivo;

    const nombre = archivo.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], nombre, { type: "image/jpeg" });
  } catch {
    return archivo;
  }
}

/** Nombre de archivo seguro para Supabase Storage. */
export function nombreSeguro(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(-60);
}
