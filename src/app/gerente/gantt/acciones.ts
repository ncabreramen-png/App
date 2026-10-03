"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { exigirGerente } from "@/lib/sesion";

export type Resultado = { ok: true } | { ok: false; error: string };

function revalidar() {
  revalidatePath("/gerente");
  revalidatePath("/gerente/gantt");
  revalidatePath("/gerente/curva");
  revalidatePath("/gerente/informe");
}

function validar(e: { nombre: string; inicio: string; fin: string; avance: number }): string | null {
  if (!e.nombre.trim()) return "La tarea necesita un nombre.";
  if (!e.inicio || !e.fin) return "Faltan las fechas de inicio y fin.";
  if (e.fin < e.inicio) return "La fecha de fin no puede ser anterior al inicio.";
  if (!Number.isFinite(e.avance) || e.avance < 0 || e.avance > 100) {
    return "El avance debe estar entre 0 y 100.";
  }
  return null;
}

export async function guardarTarea(entrada: {
  id?: string;
  frenteId: string;
  nombre: string;
  inicio: string;
  fin: string;
  avance: number;
  peso: number | null;
}): Promise<Resultado> {
  await exigirGerente();

  const err = validar(entrada);
  if (err) return { ok: false, error: err };
  if (!entrada.frenteId) return { ok: false, error: "Seleccioná un frente de trabajo." };
  if (entrada.peso !== null && (!Number.isFinite(entrada.peso) || entrada.peso <= 0)) {
    return { ok: false, error: "El peso debe ser un número mayor que cero." };
  }

  const supabase = await crearClienteServidor();
  const fila = {
    frente_de_trabajo_id: entrada.frenteId,
    nombre: entrada.nombre.trim(),
    inicio: entrada.inicio,
    fin: entrada.fin,
    avance: entrada.avance,
    peso: entrada.peso,
  };

  const { error } = entrada.id
    ? await supabase.from("tareas").update(fila).eq("id", entrada.id)
    : await supabase.from("tareas").insert(fila);

  if (error) return { ok: false, error: error.message };
  revalidar();
  return { ok: true };
}

export async function borrarTarea(id: string): Promise<Resultado> {
  await exigirGerente();

  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("tareas").delete().eq("id", id);

  if (error) return { ok: false, error: error.message };
  revalidar();
  return { ok: true };
}

/**
 * Carga masiva del cronograma. Una linea por tarea:
 *   Frente | Tarea | AAAA-MM-DD | AAAA-MM-DD | avance
 * El avance es opcional y se asume 0.
 */
export async function importarTareas(
  texto: string,
): Promise<(Resultado & { filas?: number })> {
  await exigirGerente();

  const lineas = texto
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (lineas.length === 0) return { ok: false, error: "No hay nada que importar." };

  const supabase = await crearClienteServidor();
  const { data: frentes } = await supabase
    .from("frentes_de_trabajo")
    .select("id, nombre");

  const porNombre = new Map(
    ((frentes ?? []) as { id: string; nombre: string }[]).map((f) => [
      f.nombre.toLowerCase(),
      f.id,
    ]),
  );

  const filas = [];
  for (const [i, linea] of lineas.entries()) {
    const partes = linea.split("|").map((p) => p.trim());
    if (partes.length < 4) {
      return {
        ok: false,
        error: `Línea ${i + 1}: faltan columnas. Se esperan Frente | Tarea | Inicio | Fin | Avance.`,
      };
    }

    const frenteId = porNombre.get(partes[0].toLowerCase());
    if (!frenteId) {
      return { ok: false, error: `Línea ${i + 1}: no existe el frente "${partes[0]}".` };
    }

    const avance = partes[4] ? Number(partes[4].replace(",", ".")) : 0;
    const err = validar({
      nombre: partes[1],
      inicio: partes[2],
      fin: partes[3],
      avance,
    });
    if (err) return { ok: false, error: `Línea ${i + 1}: ${err}` };

    filas.push({
      frente_de_trabajo_id: frenteId,
      nombre: partes[1],
      inicio: partes[2],
      fin: partes[3],
      avance,
      orden: i,
    });
  }

  const { error } = await supabase.from("tareas").insert(filas);
  if (error) return { ok: false, error: error.message };

  revalidar();
  return { ok: true, filas: filas.length };
}

/**
 * Vuelca el cronograma a la curva del proyecto.
 *
 * El programado se recalcula para todos los meses, porque sale entero de las
 * fechas de las tareas. El real solo se puede sellar en el mes corriente: las
 * tareas guardan el avance de hoy, no su historia, asi que los meses
 * anteriores conservan el valor que se sello cuando correspondia.
 */
export async function recalcularCurva(): Promise<
  Resultado & { meses?: number; real?: number }
> {
  await exigirGerente();

  const supabase = await crearClienteServidor();

  const [{ data: programada, error: e1 }, { data: real, error: e2 }] = await Promise.all([
    supabase.rpc("curva_programada"),
    supabase.rpc("avance_real_actual"),
  ]);

  if (e1 || e2) return { ok: false, error: (e1 ?? e2)!.message };

  const puntos = (programada ?? []) as { periodo: string; avance_programado: number }[];
  if (puntos.length === 0) {
    return { ok: false, error: "No hay tareas cargadas: el cronograma está vacío." };
  }

  const hoy = new Date();
  const mesActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-01`;

  const { data: existentes } = await supabase.from("curva_avance").select("periodo, avance_real");
  const realPrevio = new Map(
    ((existentes ?? []) as { periodo: string; avance_real: number | null }[]).map((r) => [
      r.periodo,
      r.avance_real,
    ]),
  );

  const filas = puntos.map((p) => ({
    periodo: p.periodo,
    avance_programado: p.avance_programado,
    avance_real:
      p.periodo === mesActual
        ? Number(real ?? 0)
        : (realPrevio.get(p.periodo) ?? null),
  }));

  const { error } = await supabase
    .from("curva_avance")
    .upsert(filas, { onConflict: "periodo" });

  if (error) return { ok: false, error: error.message };

  revalidar();
  return { ok: true, meses: filas.length, real: Number(real ?? 0) };
}
