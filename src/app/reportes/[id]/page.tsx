import Link from "next/link";
import { notFound } from "next/navigation";
import Encabezado from "@/components/Encabezado";
import TarjetaReporte from "@/components/TarjetaReporte";
import PanelAprobacion from "@/app/gerente/aprobaciones/PanelAprobacion";
import EditorReporte from "./EditorReporte";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { exigirUsuario } from "@/lib/sesion";
import { SELECCION_REPORTE } from "@/lib/consultas";
import { firmarArchivos } from "@/lib/adjuntos.servidor";
import { BUCKET_REPORTES } from "@/lib/archivos";
import { formatearFecha, type Frente, type ReporteExpandido } from "@/lib/tipos";

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

  // Solo se cargan los frentes si hay algo que editar con ellos.
  let frentes: Frente[] = [];
  if (esGerente) {
    const { data } = await supabase
      .from("frentes_de_trabajo")
      .select("id, nombre, frente_principal, avance_fisico, avance_financiero, orden")
      .order("orden");
    frentes = (data ?? []) as Frente[];
  }

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

        {esGerente && (
          <EditorReporte
            reporte={reporte}
            adjuntos={adjuntos}
            frentes={frentes}
            usuarioId={usuario.id}
          />
        )}

        {reporte.revisado_en && (
          <p className="text-xs text-slate-500">
            Revisado el {formatearFecha(reporte.revisado_en)}.
          </p>
        )}
      </main>
    </div>
  );
}
