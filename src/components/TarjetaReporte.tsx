import Link from "next/link";
import GaleriaFotos from "@/components/GaleriaFotos";
import { InsigniaEstatus, InsigniaTipo } from "@/components/Insignias";
import { formatearFecha, type ReporteExpandido } from "@/lib/tipos";

type Props = {
  reporte: ReporteExpandido;
  fotos?: string[];
  /** El gerente ve quien reporto; el profesional de campo no lo necesita. */
  mostrarAutor?: boolean;
  enlazar?: boolean;
  /** Acciones al pie de la tarjeta (por ejemplo, aprobar / rechazar). */
  pie?: React.ReactNode;
};

export default function TarjetaReporte({
  reporte,
  fotos = [],
  mostrarAutor = false,
  enlazar = true,
  pie,
}: Props) {
  const titulo = reporte.frente?.nombre ?? "Frente no disponible";

  return (
    <article className="tarjeta evitar-corte p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold text-slate-900">
            {enlazar ? (
              <Link href={`/reportes/${reporte.id}`} className="hover:underline">
                {titulo}
              </Link>
            ) : (
              titulo
            )}
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            {reporte.frente?.frente_principal ?? "—"} · {reporte.disciplina} ·{" "}
            {formatearFecha(reporte.fecha)}
            {mostrarAutor && reporte.autor ? ` · ${reporte.autor.nombre}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <InsigniaTipo valor={reporte.tipo_de_reporte} />
          <InsigniaEstatus valor={reporte.estatus} />
        </div>
      </div>

      <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">
        {reporte.descripcion}
      </p>

      {reporte.estatus === "Rechazado" && reporte.comentario_de_aprobacion && (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          <span className="font-semibold">Motivo del rechazo: </span>
          {reporte.comentario_de_aprobacion}
        </p>
      )}

      <GaleriaFotos urls={fotos} />

      {pie}
    </article>
  );
}
