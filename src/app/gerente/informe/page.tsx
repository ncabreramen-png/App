import BotonImprimir from "@/components/BotonImprimir";
import GaleriaFotos from "@/components/GaleriaFotos";
import { InsigniaEstatus, InsigniaSemaforo, InsigniaTipo } from "@/components/Insignias";
import { obtenerFrentesConSemaforo, obtenerReportes } from "@/lib/consultas";
import { firmarFotosPorReporte } from "@/lib/fotos";
import {
  FRENTES_PRINCIPALES,
  esAlerta,
  formatearFecha,
  type ReporteExpandido,
} from "@/lib/tipos";

export const dynamic = "force-dynamic";

export default async function Informe() {
  const [frentes, { reportes }] = await Promise.all([
    obtenerFrentesConSemaforo(),
    obtenerReportes(),
  ]);
  const fotos = await firmarFotosPorReporte(reportes);

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
                          <GaleriaFotos urls={fotos[r.id] ?? []} />
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
