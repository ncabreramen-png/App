import PanelCorte from "./PanelCorte";
import FormularioCorte from "./FormularioCorte";
import { firmarPorEntidad } from "@/lib/adjuntos.servidor";
import { BUCKET_ADMIN } from "@/lib/archivos";
import { obtenerReportesAdministracion } from "@/lib/consultas";
import { esAdministracion, exigirUsuario } from "@/lib/sesion";
import { formatearMoneda, formatearPeriodo, formatearPorcentaje } from "@/lib/tipos";

export const dynamic = "force-dynamic";

export default async function PaginaAdministracion() {
  const usuario = await exigirUsuario();
  const puedeEditar = esAdministracion(usuario);

  const cortes = await obtenerReportesAdministracion();
  const adjuntos = await firmarPorEntidad(BUCKET_ADMIN, cortes);
  // Vienen del mas reciente al mas viejo.
  const ultimo = cortes[0] ?? null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Administración</h1>
          <p className="mt-0.5 text-sm text-slate-600">
            {puedeEditar
              ? "Cargá un corte por mes: avance, avance financiero y estimaciones."
              : "Vista de solo lectura: los cortes los carga administración."}
          </p>
        </div>
        {puedeEditar && <FormularioCorte usuarioId={usuario.id} />}
      </div>

      {ultimo && (
        <section>
          <p className="mb-2 text-xs text-slate-500">
            Al cierre de{" "}
            <span className="capitalize">{formatearPeriodo(ultimo.periodo)}</span>
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Casilla
              etiqueta="Programado"
              valor={formatearPorcentaje(ultimo.avance_programado)}
            />
            <Casilla etiqueta="Real" valor={formatearPorcentaje(ultimo.avance_real)} />
            <Casilla
              etiqueta="Ejecutado"
              valor={formatearMoneda(ultimo.monto_financiero)}
              pie={formatearPorcentaje(ultimo.avance_financiero)}
            />
            <Casilla
              etiqueta="Pagado"
              valor={formatearMoneda(ultimo.importe_pagado)}
              pie={`${ultimo.estimaciones_pagadas} de ${ultimo.estimaciones_autorizadas} estimaciones`}
            />
          </div>
        </section>
      )}

      {cortes.length === 0 ? (
        <p className="tarjeta p-8 text-center text-slate-600">
          Todavía no hay cortes cargados.
        </p>
      ) : (
        <div className="space-y-3">
          {cortes.map((corte) => (
            <PanelCorte
              key={corte.id}
              corte={corte}
              adjuntos={adjuntos[corte.id] ?? []}
              puedeEditar={puedeEditar}
              usuarioId={usuario.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Casilla({
  etiqueta,
  valor,
  pie,
}: {
  etiqueta: string;
  valor: string;
  pie?: string;
}) {
  return (
    <div className="tarjeta p-3 text-center">
      <p className="text-lg font-bold text-slate-900">{valor}</p>
      <p className="text-xs font-medium text-slate-600">{etiqueta}</p>
      {pie && <p className="mt-0.5 text-[11px] text-slate-500">{pie}</p>}
    </div>
  );
}
