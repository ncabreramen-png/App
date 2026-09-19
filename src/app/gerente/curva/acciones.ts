"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { exigirGerente } from "@/lib/sesion";

export type Resultado = { ok: true } | { ok: false; error: string };

function revalidar() {
  revalidatePath("/gerente");
  revalidatePath("/gerente/curva");
  revalidatePath("/gerente/informe");
}

/** "2026-09" -> "2026-09-01". Los periodos se guardan como el 1 del mes. */
function aPeriodo(mes: string): string | null {
  return /^\d{4}-\d{2}$/.test(mes) ? `${mes}-01` : null;
}

function validarPorcentaje(v: number | null, campo: string): string | null {
  if (v === null) return null;
  if (!Number.isFinite(v) || v < 0 || v > 100) return `${campo} debe estar entre 0 y 100.`;
  return null;
}

export async function guardarPeriodo(entrada: {
  mes: string;
  programado: number;
  real: number | null;
}): Promise<Resultado> {
  await exigirGerente();

  const periodo = aPeriodo(entrada.mes);
  if (!periodo) return { ok: false, error: "El mes no es válido." };

  const err =
    validarPorcentaje(entrada.programado, "El avance programado") ??
    validarPorcentaje(entrada.real, "El avance real");
  if (err) return { ok: false, error: err };

  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("curva_avance").upsert(
    {
      periodo,
      avance_programado: entrada.programado,
      avance_real: entrada.real,
    },
    { onConflict: "periodo" },
  );

  if (error) return { ok: false, error: error.message };
  revalidar();
  return { ok: true };
}

export async function borrarPeriodo(id: string): Promise<Resultado> {
  await exigirGerente();

  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("curva_avance").delete().eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidar();
  return { ok: true };
}

/**
 * Carga masiva. Se pega el cronograma completo en vez de tipear mes por mes:
 * una linea por periodo, "2026-01  12.5  10.2" (mes, programado, real).
 * El avance real es opcional; sin el, el mes queda como "sin medir".
 */
export async function importarCurva(texto: string): Promise<Resultado & { filas?: number }> {
  await exigirGerente();

  const lineas = texto
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  if (lineas.length === 0) return { ok: false, error: "No hay nada que importar." };

  const filas: { periodo: string; avance_programado: number; avance_real: number | null }[] = [];

  for (const [i, linea] of lineas.entries()) {
    const partes = linea.split(/[\s,;\t]+/).filter(Boolean);
    const periodo = aPeriodo(partes[0] ?? "");
    if (!periodo) {
      return { ok: false, error: `Línea ${i + 1}: "${partes[0] ?? ""}" no es un mes AAAA-MM.` };
    }

    const programado = Number(String(partes[1] ?? "").replace(",", "."));
    if (!Number.isFinite(programado) || programado < 0 || programado > 100) {
      return { ok: false, error: `Línea ${i + 1}: el avance programado debe ser un número de 0 a 100.` };
    }

    let real: number | null = null;
    if (partes[2] !== undefined && partes[2] !== "-") {
      real = Number(String(partes[2]).replace(",", "."));
      if (!Number.isFinite(real) || real < 0 || real > 100) {
        return { ok: false, error: `Línea ${i + 1}: el avance real debe ser un número de 0 a 100.` };
      }
    }

    filas.push({ periodo, avance_programado: programado, avance_real: real });
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("curva_avance").upsert(filas, { onConflict: "periodo" });

  if (error) return { ok: false, error: error.message };
  revalidar();
  return { ok: true, filas: filas.length };
}
