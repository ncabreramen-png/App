"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { exigirAdministracion } from "@/lib/sesion";
import { BUCKET_ADMIN, type Archivo } from "@/lib/archivos";

export type Resultado = { ok: true } | { ok: false; error: string };

/** Las cifras del corte, tal como llegan del formulario. */
export type Cifras = {
  periodo: string;
  avanceProgramado: number;
  avanceReal: number;
  montoFinanciero: number;
  avanceFinanciero: number;
  estimacionesAutorizadas: number;
  importeAutorizado: number;
  estimacionesPagadas: number;
  importePagado: number;
  comentario: string;
};

function revalidar() {
  revalidatePath("/administracion");
  revalidatePath("/gerente/informe");
}

const porcentaje = (n: number) => Number.isFinite(n) && n >= 0 && n <= 100;
const monto = (n: number) => Number.isFinite(n) && n >= 0;
const entero = (n: number) => Number.isInteger(n) && n >= 0;

/**
 * Validacion comun a alta y edicion.
 *
 * Lo acumulado pagado no puede superar lo acumulado autorizado: no se paga una
 * estimacion que nadie autorizo. Se verifica aca y no con un check en la base
 * para poder explicarlo en castellano, y por si alguna vez aparece un caso
 * legitimo que haya que destrabar sin migrar la tabla.
 */
function validar(c: Cifras): string | null {
  if (!/^\d{4}-\d{2}$/.test(c.periodo)) return "Elegí el mes del corte.";
  if (!porcentaje(c.avanceProgramado)) return "El avance programado va de 0 a 100%.";
  if (!porcentaje(c.avanceReal)) return "El avance real va de 0 a 100%.";
  if (!porcentaje(c.avanceFinanciero)) return "El avance financiero va de 0 a 100%.";
  if (!monto(c.montoFinanciero)) return "El monto ejecutado no puede ser negativo.";
  if (!entero(c.estimacionesAutorizadas) || !entero(c.estimacionesPagadas)) {
    return "El número de estimaciones tiene que ser un entero de 0 en adelante.";
  }
  if (!monto(c.importeAutorizado) || !monto(c.importePagado)) {
    return "Los importes de las estimaciones no pueden ser negativos.";
  }
  if (c.estimacionesPagadas > c.estimacionesAutorizadas) {
    return "No puede haber más estimaciones pagadas que autorizadas.";
  }
  if (c.importePagado > c.importeAutorizado) {
    return "El importe pagado no puede superar al autorizado.";
  }
  return null;
}

function aFila(c: Cifras) {
  return {
    // La tabla guarda el primer dia del mes.
    periodo: `${c.periodo}-01`,
    avance_programado: c.avanceProgramado,
    avance_real: c.avanceReal,
    monto_financiero: c.montoFinanciero,
    avance_financiero: c.avanceFinanciero,
    estimaciones_autorizadas: c.estimacionesAutorizadas,
    importe_autorizado: c.importeAutorizado,
    estimaciones_pagadas: c.estimacionesPagadas,
    importe_pagado: c.importePagado,
    comentario: c.comentario.trim(),
  };
}

export async function crearCorte(entrada: {
  cifras: Cifras;
  archivos: Archivo[];
}): Promise<Resultado> {
  const usuario = await exigirAdministracion();

  const problema = validar(entrada.cifras);
  if (problema) return { ok: false, error: problema };

  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("reportes_administracion").insert({
    ...aFila(entrada.cifras),
    archivos: entrada.archivos,
    creado_por: usuario.id,
  });

  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        error: "Ese mes ya está cargado. Editalo en la lista en vez de duplicarlo.",
      };
    }
    return { ok: false, error: error.message };
  }

  revalidar();
  return { ok: true };
}

/**
 * Correccion de un corte ya cargado. Los adjuntos que se quitaron salen
 * tambien del bucket: la fila deja de referenciarlos y si no, quedan
 * ocupando espacio para siempre.
 */
export async function editarCorte(entrada: {
  id: string;
  cifras: Cifras;
  archivos: Archivo[];
}): Promise<Resultado> {
  await exigirAdministracion();

  const problema = validar(entrada.cifras);
  if (problema) return { ok: false, error: problema };

  const supabase = await crearClienteServidor();

  const { data: antes } = await supabase
    .from("reportes_administracion")
    .select("archivos")
    .eq("id", entrada.id)
    .maybeSingle();

  const previos = (antes?.archivos ?? []) as Archivo[];
  const quedan = new Set(entrada.archivos.map((a) => a.ruta));
  const sobran = previos.filter((a) => !quedan.has(a.ruta)).map((a) => a.ruta);

  const { error } = await supabase
    .from("reportes_administracion")
    .update({ ...aFila(entrada.cifras), archivos: entrada.archivos })
    .eq("id", entrada.id);

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "Ya hay otro corte cargado para ese mes." };
    }
    return { ok: false, error: error.message };
  }

  if (sobran.length > 0) await supabase.storage.from(BUCKET_ADMIN).remove(sobran);

  revalidar();
  return { ok: true };
}

export async function borrarCorte(id: string): Promise<Resultado> {
  await exigirAdministracion();

  const supabase = await crearClienteServidor();

  const { data } = await supabase
    .from("reportes_administracion")
    .select("archivos")
    .eq("id", id)
    .maybeSingle();

  const rutas = ((data?.archivos ?? []) as Archivo[]).map((a) => a.ruta);

  const { error } = await supabase.from("reportes_administracion").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  if (rutas.length > 0) await supabase.storage.from(BUCKET_ADMIN).remove(rutas);

  revalidar();
  return { ok: true };
}
