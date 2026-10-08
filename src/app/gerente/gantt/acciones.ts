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

function validar(e: { nombre: string; inicio: string; fin: string }): string | null {
  if (!e.nombre.trim()) return "La tarea necesita un nombre.";
  if (!e.inicio || !e.fin) return "Faltan las fechas de inicio y fin.";
  if (e.fin < e.inicio) return "La fecha de fin no puede ser anterior al inicio.";
  return null;
}

function porcentajeValido(n: number): boolean {
  return Number.isFinite(n) && n >= 0 && n <= 100;
}

/** Primer dia del mes corriente, en formato AAAA-MM-01. */
function mesCorriente(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export async function guardarTarea(entrada: {
  id?: string;
  frenteId: string;
  nombre: string;
  inicio: string;
  fin: string;
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
  // El avance no viaja aca: lo determina la medicion del mes.
  const fila = {
    frente_de_trabajo_id: entrada.frenteId,
    nombre: entrada.nombre.trim(),
    inicio: entrada.inicio,
    fin: entrada.fin,
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

  const filas: {
    frente_de_trabajo_id: string;
    nombre: string;
    inicio: string;
    fin: string;
    orden: number;
    avanceInicial: number;
  }[] = [];
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
    if (!porcentajeValido(avance)) {
      return { ok: false, error: `Línea ${i + 1}: el avance debe estar entre 0 y 100.` };
    }
    const err = validar({ nombre: partes[1], inicio: partes[2], fin: partes[3] });
    if (err) return { ok: false, error: `Línea ${i + 1}: ${err}` };

    filas.push({
      frente_de_trabajo_id: frenteId,
      nombre: partes[1],
      inicio: partes[2],
      fin: partes[3],
      orden: i,
      avanceInicial: avance,
    });
  }

  const { data: creadas, error } = await supabase
    .from("tareas")
    .insert(filas.map(({ avanceInicial: _ignorado, ...t }) => t))
    .select("id");

  if (error) return { ok: false, error: error.message };

  // El avance que venia en la planilla se registra como la medicion del mes
  // corriente. Es la lectura natural de "esta tarea hoy va al 60%".
  const mediciones = (creadas ?? [])
    .map((t: { id: string }, k: number) => ({
      tarea_id: t.id,
      periodo: mesCorriente(),
      avance: filas[k].avanceInicial,
    }))
    .filter((m) => m.avance > 0);

  if (mediciones.length > 0) {
    const { error: e2 } = await supabase.from("mediciones").insert(mediciones);
    if (e2) return { ok: false, error: `Las tareas se crearon, pero el avance no: ${e2.message}` };
  }

  revalidar();
  return { ok: true, filas: filas.length };
}

/** Guarda el cierre de un mes: la medicion acumulada de cada tarea. */
export async function guardarCierreMensual(entrada: {
  periodo: string;
  valores: { tareaId: string; avance: number }[];
}): Promise<Resultado & { guardadas?: number }> {
  await exigirGerente();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(entrada.periodo)) {
    return { ok: false, error: "El mes no es válido." };
  }

  for (const v of entrada.valores) {
    if (!porcentajeValido(v.avance)) {
      return { ok: false, error: "Todos los avances deben estar entre 0 y 100." };
    }
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("mediciones").upsert(
    entrada.valores.map((v) => ({
      tarea_id: v.tareaId,
      periodo: entrada.periodo,
      avance: v.avance,
    })),
    { onConflict: "tarea_id,periodo" },
  );

  if (error) return { ok: false, error: error.message };

  revalidar();
  return { ok: true, guardadas: entrada.valores.length };
}

/**
 * Vuelca el cronograma a la curva del proyecto.
 *
 * El programado sale de las fechas de las tareas; el real, de las mediciones
 * mensuales. Como las mediciones guardan la historia mes a mes, la serie real
 * se reconstruye completa y no solo el mes corriente.
 */
export async function recalcularCurva(): Promise<
  Resultado & { meses?: number; real?: number }
> {
  await exigirGerente();

  const supabase = await crearClienteServidor();

  const [programada, real, actual] = await Promise.all([
    supabase.rpc("curva_programada"),
    supabase.rpc("curva_real"),
    supabase.rpc("avance_real_actual"),
  ]);

  const fallo = programada.error ?? real.error ?? actual.error;
  if (fallo) return { ok: false, error: fallo.message };

  const prog = (programada.data ?? []) as { periodo: string; avance_programado: number }[];
  if (prog.length === 0) {
    return { ok: false, error: "No hay tareas cargadas: el cronograma está vacío." };
  }

  const reales = new Map(
    ((real.data ?? []) as { periodo: string; avance_real: number }[]).map((r) => [
      r.periodo,
      r.avance_real,
    ]),
  );

  const filas = prog.map((p) => ({
    periodo: p.periodo,
    avance_programado: p.avance_programado,
    avance_real: reales.has(p.periodo) ? reales.get(p.periodo)! : null,
  }));

  const { error } = await supabase
    .from("curva_avance")
    .upsert(filas, { onConflict: "periodo" });

  if (error) return { ok: false, error: error.message };

  revalidar();
  return { ok: true, meses: filas.length, real: Number(actual.data ?? 0) };
}
