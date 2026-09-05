import TarjetaReporte from "@/components/TarjetaReporte";
import { obtenerReportes } from "@/lib/consultas";
import { firmarFotosPorReporte } from "@/lib/fotos";
import PanelAprobacion from "./PanelAprobacion";

export const dynamic = "force-dynamic";

export default async function Aprobaciones() {
  const { reportes, error } = await obtenerReportes({ estatus: "Pendiente" });
  const fotos = await firmarFotosPorReporte(reportes);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Aprobaciones pendientes</h1>
        <p className="mt-0.5 text-sm text-slate-600">
          Órdenes de cambio a la espera de resolución.
        </p>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {!error && reportes.length === 0 && (
        <p className="tarjeta p-8 text-center text-slate-600">
          No hay órdenes de cambio pendientes.
        </p>
      )}

      <div className="space-y-3">
        {reportes.map((r) => (
          <TarjetaReporte
            key={r.id}
            reporte={r}
            fotos={fotos[r.id] ?? []}
            mostrarAutor
            pie={<PanelAprobacion reporteId={r.id} />}
          />
        ))}
      </div>
    </div>
  );
}
