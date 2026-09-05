import { crearClienteServidor } from "@/lib/supabase/servidor";
import { BUCKET_FOTOS } from "@/lib/fotos.constantes";

export { BUCKET_FOTOS };
const VIGENCIA_SEGUNDOS = 60 * 60;

/**
 * El bucket es privado: las fotos se sirven con URLs firmadas de vigencia
 * corta, generadas con la sesion del usuario (RLS decide si puede verlas).
 */
export async function firmarFotos(rutas: string[]): Promise<string[]> {
  if (rutas.length === 0) return [];

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.storage
    .from(BUCKET_FOTOS)
    .createSignedUrls(rutas, VIGENCIA_SEGUNDOS);

  if (error || !data) return [];
  return data.map((d) => d.signedUrl).filter((u): u is string => Boolean(u));
}

/** Firma las fotos de varios reportes en una sola llamada. */
export async function firmarFotosPorReporte(
  reportes: { id: string; fotos: string[] }[],
): Promise<Record<string, string[]>> {
  const rutas = reportes.flatMap((r) => r.fotos);
  if (rutas.length === 0) return {};

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.storage
    .from(BUCKET_FOTOS)
    .createSignedUrls(rutas, VIGENCIA_SEGUNDOS);

  if (error || !data) return {};

  const porRuta = new Map<string, string>();
  data.forEach((d, i) => {
    const url = d.signedUrl;
    if (url) porRuta.set(rutas[i], url);
  });

  const resultado: Record<string, string[]> = {};
  for (const r of reportes) {
    resultado[r.id] = r.fotos
      .map((ruta) => porRuta.get(ruta))
      .filter((u): u is string => Boolean(u));
  }
  return resultado;
}
