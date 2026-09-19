import { crearClienteServidor } from "@/lib/supabase/servidor";
import type { FrenteConSemaforo, ReporteExpandido } from "@/lib/tipos";

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
