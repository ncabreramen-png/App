import Link from "next/link";
import TarjetaReporte from "@/components/TarjetaReporte";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { exigirUsuario } from "@/lib/sesion";
import { firmarPorEntidad } from "@/lib/adjuntos.servidor";
import { BUCKET_REPORTES } from "@/lib/archivos";
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

  // Sin filtro por autor a proposito: el RLS ya limita a lo propio mas lo
  // heredado de quien uno sustituyo. Filtrar aca ocultaria justamente eso.
  const { data, error } = await supabase
    .from("reportes")
    .select(SELECCION)
    .order("fecha", { ascending: false });

  const reportes = (data ?? []) as unknown as ReporteExpandido[];
  const heredados = reportes.filter((r) => r.reportado_por !== usuario.id).length;
  const adjuntos = await firmarPorEntidad(BUCKET_REPORTES, reportes);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Mis reportes</h1>
          {heredados > 0 && (
            <p className="mt-0.5 text-xs text-slate-500">
              Incluye {heredados} que viene{heredados === 1 ? "" : "n"} de quien
              te precedió en la disciplina.
            </p>
          )}
        </div>
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
          <TarjetaReporte
            key={r.id}
            reporte={r}
            archivos={adjuntos[r.id] ?? []}
            mostrarAutor={r.reportado_por !== usuario.id}
          />
        ))}
      </div>
    </div>
  );
}
