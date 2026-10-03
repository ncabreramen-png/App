import { crearClienteServidor } from "@/lib/supabase/servidor";
import type {
  AnalisisExpandido,
  FrenteConSemaforo,
  PuntoCurva,
  ReporteExpandido,
} from "@/lib/tipos";

export const SELECCION_REPORTE = `
  *,
  frente:frentes_de_trabajo (id, nombre, frente_principal),
  autor:usuarios!reportes_reportado_por_fkey (id, nombre, disciplina)
`;

/** Los 12 frentes con su semaforo ya calculado por la vista de Postgres. */
export async function obtenerFrentesConSemaforo(): Promise<FrenteConSemaforo[]> {
  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .from("frentes_semaforo")
    .select("*")
    .order("orden");

  return (data ?? []) as FrenteConSemaforo[];
}

export type FiltrosReporte = {
  frente?: string;
  disciplina?: string;
  tipo?: string;
  estatus?: string;
};

export async function obtenerReportes(
  filtros: FiltrosReporte = {},
): Promise<{ reportes: ReporteExpandido[]; error: string | null }> {
  const supabase = await crearClienteServidor();

  let consulta = supabase
    .from("reportes")
    .select(SELECCION_REPORTE)
    .order("fecha", { ascending: false });

  if (filtros.frente) consulta = consulta.eq("frente_de_trabajo_id", filtros.frente);
  if (filtros.disciplina) consulta = consulta.eq("disciplina", filtros.disciplina);
  if (filtros.tipo) consulta = consulta.eq("tipo_de_reporte", filtros.tipo);
  if (filtros.estatus) consulta = consulta.eq("estatus", filtros.estatus);

  const { data, error } = await consulta;

  return {
    reportes: (data ?? []) as unknown as ReporteExpandido[],
    error: error?.message ?? null,
  };
}

/** La curva S del proyecto, en orden cronologico. */
export async function obtenerCurva(): Promise<PuntoCurva[]> {
  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .from("curva_avance")
    .select("*")
    .order("periodo");

  return (data ?? []) as PuntoCurva[];
}

const SELECCION_ANALISIS = `
  *,
  frente:frentes_de_trabajo (id, nombre, frente_principal),
  autor:usuarios!analisis_creado_por_fkey (id, nombre, disciplina),
  accesos:analisis_accesos (usuario:usuarios (id, nombre, disciplina, rol))
`;

type FilaAcceso = { usuario: AnalisisExpandido["compartido_con"][number] | null };

function normalizar(fila: Record<string, unknown>): AnalisisExpandido {
  const accesos = (fila.accesos ?? []) as FilaAcceso[];
  return {
    ...(fila as unknown as AnalisisExpandido),
    compartido_con: accesos
      .map((a) => a.usuario)
      .filter((u): u is AnalisisExpandido["compartido_con"][number] => Boolean(u)),
  };
}

/**
 * El RLS ya limita a lo propio mas lo compartido: no hace falta filtrar aca,
 * y filtrar de mas ocultaria lo que a uno le compartieron.
 */
export async function obtenerAnalisis(): Promise<AnalisisExpandido[]> {
  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .from("analisis")
    .select(SELECCION_ANALISIS)
    .order("creado_en", { ascending: false });

  return ((data ?? []) as unknown as Record<string, unknown>[]).map(normalizar);
}

export async function obtenerUnAnalisis(id: string): Promise<AnalisisExpandido | null> {
  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .from("analisis")
    .select(SELECCION_ANALISIS)
    .eq("id", id)
    .maybeSingle();

  return data ? normalizar(data as unknown as Record<string, unknown>) : null;
}
