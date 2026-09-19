import Link from "next/link";
import TarjetaReporte from "@/components/TarjetaReporte";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { exigirUsuario } from "@/lib/sesion";
import { firmarFotosPorReporte } from "@/lib/fotos";
import type { ReporteExpandido } from "@/lib/tipos";

export const dynamic = "force-dynamic";

const SELECCION = `
  *,
  frente:frentes_de_trabajo (id, nombre, frente_principal),
  autor:usuarios!reportes_reportado_por_fkey (id, nombre, disciplina)
`;

export default async function MisReportes() {
  const usuario = await exigirUsuario();
  const supabase = await crearClienteServidor();

  // RLS ya limita al autor; el filtro explicito lo deja evidente en el codigo.
  const { data, error } = await supabase
    .from("reportes")
    .select(SELECCION)
    .eq("reportado_por", usuario.id)
    .order("fecha", { ascending: false });

  const reportes = (data ?? []) as unknown as ReporteExpandido[];
  const fotos = await firmarFotosPorReporte(reportes);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900">Mis reportes</h1>
        <Link href="/campo/nuevo" className="boton">
          + Nuevo
        </Link>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          No se pudieron cargar los reportes: {error.message}
        </p>
      )}

      {!error && reportes.length === 0 && (
        <div className="tarjeta p-8 text-center">
          <p className="text-slate-600">Todavía no tenés reportes.</p>
          <Link href="/campo/nuevo" className="boton mt-4">
            Crear el primero
          </Link>
        </div>
      )}

      <div className="space-y-3">
        {reportes.map((r) => (
          <TarjetaReporte key={r.id} reporte={r} fotos={fotos[r.id] ?? []} />
        ))}
      </div>
    </div>
  );
}
