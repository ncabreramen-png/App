import Link from "next/link";
import { notFound } from "next/navigation";
import Encabezado from "@/components/Encabezado";
import TarjetaReporte from "@/components/TarjetaReporte";
import PanelAprobacion from "@/app/gerente/aprobaciones/PanelAprobacion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { exigirUsuario } from "@/lib/sesion";
import { SELECCION_REPORTE } from "@/lib/consultas";
import { firmarArchivos } from "@/lib/adjuntos.servidor";
import { BUCKET_REPORTES } from "@/lib/archivos";
import { formatearFecha, type ReporteExpandido } from "@/lib/tipos";

export const dynamic = "force-dynamic";

export default async function DetalleReporte({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const usuario = await exigirUsuario();
  const supabase = await crearClienteServidor();

  // RLS decide la visibilidad: campo solo ve lo propio, gerente ve todo.
  const { data } = await supabase
    .from("reportes")
    .select(SELECCION_REPORTE)
    .eq("id", id)
    .maybeSingle();

  if (!data) notFound();

  const reporte = data as unknown as ReporteExpandido;
  const adjuntos = await firmarArchivos(BUCKET_REPORTES, reporte.archivos);
  const esGerente = usuario.rol === "Gerente";
  const puedeResolver = esGerente && reporte.estatus === "Pendiente";

  return (
    <div className="min-h-dvh">
      <Encabezado usuario={usuario} />
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-5">
        <Link
          href={esGerente ? "/gerente/reportes" : "/campo"}
          className="no-imprimir text-sm font-medium text-marca-600 hover:underline"
        >
          ← Volver
        </Link>

        <TarjetaReporte
          reporte={reporte}
          archivos={adjuntos}
          mostrarAutor={esGerente}
          enlazar={false}
          pie={puedeResolver ? <PanelAprobacion reporteId={reporte.id} /> : undefined}
        />

        {reporte.revisado_en && (
          <p className="text-xs text-slate-500">
            Revisado el {formatearFecha(reporte.revisado_en)}.
          </p>
        )}
      </main>
    </div>
  );
}
