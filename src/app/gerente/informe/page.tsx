import BotonImprimir from "@/components/BotonImprimir";
import CurvaAvance from "@/components/CurvaAvance";
import ResumenCurva from "@/components/ResumenCurva";
import ListaArchivos from "@/components/ListaArchivos";
import { InsigniaEstatus, InsigniaSemaforo, InsigniaTipo } from "@/components/Insignias";
import {
  obtenerCurva,
  obtenerFrentesConSemaforo,
  obtenerNoConformidades,
  obtenerReportes,
  obtenerReportesAdministracion,
} from "@/lib/consultas";
import { BUCKET_NC } from "@/lib/archivos";
import { codigoNC, formatearMoneda, formatearPeriodo, formatearPorcentaje } from "@/lib/tipos";
import { firmarPorEntidad } from "@/lib/adjuntos.servidor";
import { BUCKET_REPORTES } from "@/lib/archivos";
import {
  FRENTES_PRINCIPALES,
  esAlerta,
  formatearFecha,
  type ReporteExpandido,
} from "@/lib/tipos";

export const dynamic = "force-dynamic";

export default async function Informe() {
  const [frentes, { reportes }, curva, noConformidades, cortes] = await Promise.all([
    obtenerFrentesConSemaforo(),
    obtenerReportes(),
    obtenerCurva(),
    obtenerNoConformidades(),
    obtenerReportesAdministracion(),
  ]);
  // Vienen del mas reciente al mas viejo.
  const corte = cortes[0] ?? null;
  const adjuntos = await firmarPorEntidad(BUCKET_REPORTES, reportes);
  const adjuntosNC = await firmarPorEntidad(BUCKET_NC, noConformidades);
  const ncPendientes = noConformidades.filter((n) => n.estado === "Pendiente").length;

  const porFrente = new Map<string, ReporteExpandido[]>();
  for (const r of reportes) {
    const lista = porFrente.get(r.frente_de_trabajo_id) ?? [];
    lista.push(r);
    porFrente.set(r.frente_de_trabajo_id, lista);
  }

  const emitido = new Date();
  const alertasTotales = reportes.filter(esAlerta).length;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-300 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Informe de estatus de obra</h1>
          <p className="mt-1 text-sm text-slate-600">
            Proyecto Chilama — PTAR y alcantarillado sanitario
          </p>
          <p className="text-sm text-slate-600">
            Emitido el {formatearFecha(emitido.toISOString())}
          </p>
        </div>
        <BotonImprimir />
      </header>

      <ResumenCurva puntos={curva} />
      <CurvaAvance puntos={curva} />

      <section className="grid grid-cols-3 gap-3">
        <div className="tarjeta p-3 text-center">
          <p className="text-2xl font-bold text-slate-900">{frentes.length}</p>
          <p className="text-xs text-slate-600">Frentes</p>
        </div>
        <div className="tarjeta p-3 text-center">
          <p className="text-2xl font-bold text-slate-900">{reportes.length}</p>
          <p className="text-xs text-slate-600">Reportes</p>
        </div>
        <div className="tarjeta p-3 text-center">
          <p className="text-2xl font-bold text-red-700">{alertasTotales}</p>
          <p className="text-xs text-slate-600">Alertas</p>
        </div>
      </section>

      {corte && (
        <section className="evitar-corte space-y-3">
          <h2 className="border-b border-slate-300 pb-1 text-lg font-bold text-marca-800">
            Administración
          </h2>
          <p className="text-sm text-slate-600">
            Corte al cierre de{" "}
            <span className="capitalize">{formatearPeriodo(corte.periodo)}</span>. Las
            cantidades e importes son acumulados.
          </p>

          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <CasillaInforme
              etiqueta="Programado"
              valor={formatearPorcentaje(corte.avance_programado)}
            />
            <CasillaInforme
              etiqueta="Real"
              valor={formatearPorcentaje(corte.avance_real)}
            />
            <CasillaInforme
              etiqueta="Ejecutado"
              valor={formatearMoneda(corte.monto_financiero)}
              pie={formatearPorcentaje(corte.avance_financiero)}
            />
            <CasillaInforme
              etiqueta="Autorizado sin pagar"
              valor={formatearMoneda(
                Number(corte.importe_autorizado) - Number(corte.importe_pagado),
              )}
            />
          </dl>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-300 text-left text-xs uppercase text-slate-500">
                <th className="py-1.5 pr-2 font-semibold">Estimaciones</th>
                <th className="py-1.5 pr-2 text-right font-semibold">Cantidad</th>
                <th className="py-1.5 text-right font-semibold">Importe</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-200">
                <td className="py-1.5 pr-2 text-slate-700">Autorizadas</td>
                <td className="py-1.5 pr-2 text-right text-slate-900">
                  {corte.estimaciones_autorizadas}
                </td>
                <td className="py-1.5 text-right font-semibold text-slate-900">
                  {formatearMoneda(corte.importe_autorizado)}
                </td>
              </tr>
              <tr>
                <td className="py-1.5 pr-2 text-slate-700">Pagadas</td>
                <td className="py-1.5 pr-2 text-right text-slate-900">
                  {corte.estimaciones_pagadas}
                </td>
                <td className="py-1.5 text-right font-semibold text-slate-900">
                  {formatearMoneda(corte.importe_pagado)}
                </td>
              </tr>
            </tbody>
          </table>

          {corte.comentario && (
            <p className="whitespace-pre-wrap text-sm text-slate-700">
              {corte.comentario}
            </p>
          )}
        </section>
      )}

      {noConformidades.length > 0 && (
        <section className="space-y-3">
          <h2 className="border-b border-slate-300 pb-1 text-lg font-bold text-marca-800">
            No conformidades
          </h2>
          <p className="text-sm text-slate-600">
            {noConformidades.length} registrada
            {noConformidades.length === 1 ? "" : "s"}, {ncPendientes} pendiente
            {ncPendientes === 1 ? "" : "s"} de atender.
          </p>
          {noConformidades.map((nc) => (
            <div key={nc.id} className="evitar-corte tarjeta p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold text-slate-900">
                  {codigoNC(nc.numero)} · {nc.frente?.nombre ?? "—"}
                </h3>
                <span
                  className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                    nc.estado === "Atendida"
                      ? "border-green-300 bg-green-100 text-green-800"
                      : "border-amber-300 bg-amber-100 text-amber-800"
                  }`}
                >
                  {nc.estado}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Detectada el {nc.detectada_en}
                {nc.atendida_en ? ` · cerrada el ${nc.atendida_en}` : ""}
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                {nc.descripcion}
              </p>
              {nc.comentario_cierre && (
                <p className="mt-2 text-sm text-green-800">
                  <span className="font-semibold">Cómo se atendió: </span>
                  {nc.comentario_cierre}
                </p>
              )}
              <ListaArchivos archivos={adjuntosNC[nc.id] ?? []} />
            </div>
          ))}
        </section>
      )}

      {FRENTES_PRINCIPALES.map((grupo) => {
        const delGrupo = frentes.filter((f) => f.frente_principal === grupo);
        if (delGrupo.length === 0) return null;

        return (
          <section key={grupo} className="space-y-4">
            <h2 className="border-b border-slate-300 pb-1 text-lg font-bold text-marca-800">
              {grupo}
            </h2>

            {delGrupo.map((frente) => {
              const deEsteFrente = porFrente.get(frente.id) ?? [];

              return (
                <div key={frente.id} className="evitar-corte tarjeta p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-semibold text-slate-900">{frente.nombre}</h3>
                    <InsigniaSemaforo valor={frente.semaforo} />
                  </div>

                  <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-600">
                    <div className="flex gap-1">
                      <dt>Avance físico:</dt>
                      <dd className="font-semibold text-slate-800">
                        {Number(frente.avance_fisico).toFixed(1)}%
                      </dd>
                    </div>
                    <div className="flex gap-1">
                      <dt>Avance financiero:</dt>
                      <dd className="font-semibold text-slate-800">
                        {Number(frente.avance_financiero).toFixed(1)}%
                      </dd>
                    </div>
                    <div className="flex gap-1">
                      <dt>Reportes:</dt>
                      <dd className="font-semibold text-slate-800">{deEsteFrente.length}</dd>
                    </div>
                    <div className="flex gap-1">
                      <dt>Alertas:</dt>
                      <dd className="font-semibold text-slate-800">{frente.alertas}</dd>
                    </div>
                  </dl>

                  {deEsteFrente.length === 0 ? (
                    <p className="mt-3 text-sm italic text-slate-500">
                      Sin reportes registrados.
                    </p>
                  ) : (
                    <ul className="mt-3 space-y-3">
                      {deEsteFrente.map((r) => (
                        <li
                          key={r.id}
                          className="evitar-corte border-l-2 border-slate-200 pl-3"
                        >
                          <div className="flex flex-wrap items-center gap-1.5">
                            <InsigniaTipo valor={r.tipo_de_reporte} />
                            <InsigniaEstatus valor={r.estatus} />
                            <span className="text-xs text-slate-500">
                              {formatearFecha(r.fecha)} · {r.disciplina} ·{" "}
                              {r.autor?.nombre ?? "—"}
                            </span>
                          </div>
                          <p className="mt-1.5 whitespace-pre-wrap text-sm text-slate-700">
                            {r.descripcion}
                          </p>
                          {r.estatus === "Rechazado" && r.comentario_de_aprobacion && (
                            <p className="mt-1.5 text-sm text-red-700">
                              <span className="font-semibold">Motivo del rechazo: </span>
                              {r.comentario_de_aprobacion}
                            </p>
                          )}
                          <ListaArchivos archivos={adjuntos[r.id] ?? []} />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}


function CasillaInforme({
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
      <p className="text-base font-bold text-slate-900">{valor}</p>
      <p className="text-xs text-slate-600">{etiqueta}</p>
      {pie && <p className="mt-0.5 text-[11px] text-slate-500">{pie}</p>}
    </div>
  );
}
