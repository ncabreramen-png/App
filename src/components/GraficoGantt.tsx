"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FrentePrincipal, TareaExpandida } from "@/lib/tipos";
import { FRENTES_PRINCIPALES, formatearPorcentaje } from "@/lib/tipos";

/**
 * Gantt del proyecto. Cada tarea es una barra sobre el eje de tiempo, y la
 * parte rellena es su avance: el patron de medidor de la guia de
 * visualizacion, con la pista en un paso claro del mismo azul que el relleno.
 *
 * Se dibuja con divs posicionados en vez de SVG porque el eje horizontal
 * necesita desplazarse de forma independiente de la columna de nombres, que
 * queda fija. En un celular de 390 px un cronograma de un ano no entra, y
 * comprimirlo lo volveria ilegible.
 */

const PISTA = "#d6e4f5"; // azul paso 150: la parte no ejecutada
const RELLENO = "#2a78d6"; // azul ranura 1: lo ejecutado
const ATRASADA = "#e34948"; // estado: vencida y sin terminar
const ANCHO_MES = 88;
const ANCHO_NOMBRES = 136;

type Mes = { clave: string; etiqueta: string; inicio: Date; dias: number };

function aUTC(iso: string): Date {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d));
}

function mesesEntre(desde: Date, hasta: Date): Mes[] {
  const salida: Mes[] = [];
  const cursor = new Date(Date.UTC(desde.getUTCFullYear(), desde.getUTCMonth(), 1));
  while (cursor <= hasta) {
    const a = cursor.getUTCFullYear();
    const m = cursor.getUTCMonth();
    salida.push({
      clave: `${a}-${String(m + 1).padStart(2, "0")}`,
      etiqueta: new Date(Date.UTC(a, m, 1)).toLocaleDateString("es-SV", {
        month: "short",
        year: "2-digit",
        timeZone: "UTC",
      }),
      inicio: new Date(Date.UTC(a, m, 1)),
      dias: new Date(Date.UTC(a, m + 1, 0)).getUTCDate(),
    });
    cursor.setUTCMonth(m + 1);
  }
  return salida;
}

export default function GraficoGantt({ tareas }: { tareas: TareaExpandida[] }) {
  const [verTabla, setVerTabla] = useState(false);
  const carril = useRef<HTMLDivElement>(null);
  const hoy = useMemo(() => {
    const d = new Date();
    return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  }, []);

  const geo = useMemo(() => {
    if (tareas.length === 0) return null;
    const inicios = tareas.map((t) => aUTC(t.inicio).getTime());
    const fines = tareas.map((t) => aUTC(t.fin).getTime());
    const meses = mesesEntre(new Date(Math.min(...inicios)), new Date(Math.max(...fines)));
    const origen = meses[0].inicio;
    const totalDias = meses.reduce((s, m) => s + m.dias, 0);
    const ancho = meses.length * ANCHO_MES;
    const porDia = ancho / totalDias;

    const x = (d: Date) => ((d.getTime() - origen.getTime()) / 86400000) * porDia;
    return { meses, ancho, x };
  }, [tareas]);

  // Al abrir, encuadrar el presente: en un cronograma largo, arrancar en el
  // primer mes deja la vista en una zona que ya paso.
  useEffect(() => {
    if (!geo || !carril.current) return;
    const px = ANCHO_NOMBRES + geo.x(hoy);
    if (px > 0 && px < ANCHO_NOMBRES + geo.ancho) {
      carril.current.scrollLeft = Math.max(0, px - 120);
    }
  }, [geo, hoy]);

  if (tareas.length === 0) {
    return (
      <p className="tarjeta p-6 text-center text-sm text-slate-600">
        Todavía no hay tareas cargadas. Agregá las del cronograma y el Gantt
        aparece acá.
      </p>
    );
  }

  const porFrente = FRENTES_PRINCIPALES.map((grupo) => ({
    grupo,
    frentes: Array.from(
      new Map(
        tareas
          .filter((t) => t.frente?.frente_principal === grupo)
          .map((t) => [t.frente_de_trabajo_id, t.frente?.nombre ?? "—"]),
      ),
    ).map(([id, nombre]) => ({
      id,
      nombre,
      items: tareas.filter((t) => t.frente_de_trabajo_id === id),
    })),
  })).filter((g) => g.frentes.length > 0);

  return (
    <div className="tarjeta p-4">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-slate-900">Cronograma</h3>
          <p className="text-xs text-slate-500">
            {tareas.length} tarea{tareas.length === 1 ? "" : "s"} · la barra llena es el avance
          </p>
        </div>
        <button
          onClick={() => setVerTabla((v) => !v)}
          className="no-imprimir rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          {verTabla ? "Ver Gantt" : "Ver tabla"}
        </button>
      </div>

      <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-2.5 w-4 rounded" style={{ background: RELLENO }} />
          Ejecutado
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-2.5 w-4 rounded" style={{ background: PISTA }} />
          Pendiente
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-2.5 w-4 rounded" style={{ background: ATRASADA }} />
          Atrasada
        </li>
      </ul>

      {verTabla ? (
        <TablaTareas tareas={tareas} hoy={hoy} />
      ) : (
        // Un solo contenedor con desplazamiento horizontal. Cada fila lleva su
        // nombre y su barra juntos, con la celda del nombre fija por sticky:
        // asi no hay dos columnas con alturas paralelas que puedan
        // desincronizarse cuando un texto envuelve.
        <div ref={carril} className="overflow-x-auto">
          <div className="relative" style={{ width: ANCHO_NOMBRES + geo!.ancho }}>
            {geo!.x(hoy) >= 0 && geo!.x(hoy) <= geo!.ancho && (
              <div
                className="pointer-events-none absolute top-8 z-10 h-[calc(100%-2rem)] border-l border-slate-400"
                style={{ left: ANCHO_NOMBRES + geo!.x(hoy) }}
                aria-hidden
              />
            )}

            <div className="flex h-8 border-b border-slate-200">
              <div
                className="sticky left-0 z-20 shrink-0 bg-white"
                style={{ width: ANCHO_NOMBRES }}
              />
              {geo!.meses.map((m) => (
                <div
                  key={m.clave}
                  className="shrink-0 border-l border-slate-100 pl-1 text-[10px] text-slate-500"
                  style={{ width: ANCHO_MES }}
                >
                  {m.etiqueta}
                </div>
              ))}
            </div>

            {porFrente.map(({ grupo, frentes }) => (
              <div key={grupo}>
                <div className="flex">
                  <div
                    className="sticky left-0 z-20 shrink-0 bg-white py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400"
                    style={{ width: ANCHO_NOMBRES }}
                  >
                    {grupo}
                  </div>
                </div>

                {frentes.map((f) => (
                  <div key={f.id}>
                    <div className="flex">
                      <div
                        className="sticky left-0 z-20 shrink-0 bg-white py-1 pr-2 text-xs font-semibold leading-tight text-slate-700"
                        style={{ width: ANCHO_NOMBRES }}
                      >
                        {f.nombre}
                      </div>
                    </div>

                    {f.items.map((t) => {
                      const ini = aUTC(t.inicio);
                      const fin = aUTC(t.fin);
                      // La barra cubre hasta el final del dia de fin, por eso
                      // se extiende un dia mas alla de su fecha.
                      const finInclusivo = new Date(fin.getTime() + 86400000);
                      const izq = geo!.x(ini);
                      const ancho = Math.max(6, geo!.x(finInclusivo) - izq);
                      const atrasada = fin < hoy && t.avance < 100;

                      return (
                        <div key={t.id} className="flex h-8 items-center">
                          <div
                            className="sticky left-0 z-20 shrink-0 truncate bg-white pr-2 text-xs text-slate-600"
                            style={{ width: ANCHO_NOMBRES }}
                            title={t.nombre}
                          >
                            {t.nombre}
                          </div>
                          <div className="relative h-full shrink-0" style={{ width: geo!.ancho }}>
                            <div
                              className="absolute top-1/2 h-3.5 -translate-y-1/2 overflow-hidden rounded"
                              style={{ left: izq, width: ancho, background: PISTA }}
                              title={`${t.nombre}: ${formatearPorcentaje(t.avance)}`}
                            >
                              <div
                                className="h-full rounded-l"
                                style={{
                                  width: `${Math.max(0, Math.min(100, t.avance))}%`,
                                  background: atrasada ? ATRASADA : RELLENO,
                                }}
                              />
                            </div>
                            <span
                              className="absolute top-1/2 -translate-y-1/2 whitespace-nowrap text-[10px] font-semibold text-slate-600"
                              style={{ left: izq + ancho + 6 }}
                            >
                              {formatearPorcentaje(t.avance)}
                              {atrasada && " · Atrasada"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TablaTareas({ tareas, hoy }: { tareas: TareaExpandida[]; hoy: Date }) {
  return (
    <div className="max-h-96 overflow-auto">
      <table className="w-full text-left text-sm">
        <thead className="sticky top-0 bg-white text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="py-2 pr-3 font-medium">Tarea</th>
            <th className="py-2 pr-3 font-medium">Frente</th>
            <th className="py-2 pr-3 font-medium">Inicio</th>
            <th className="py-2 pr-3 font-medium">Fin</th>
            <th className="py-2 text-right font-medium">Avance</th>
          </tr>
        </thead>
        <tbody style={{ fontVariantNumeric: "tabular-nums" }}>
          {tareas.map((t) => {
            const atrasada = aUTC(t.fin) < hoy && t.avance < 100;
            return (
              <tr key={t.id} className="border-t border-slate-100">
                <td className="py-2 pr-3 text-slate-800">
                  {t.nombre}
                  {atrasada && (
                    <span className="ml-1.5 text-xs font-semibold text-red-700">Atrasada</span>
                  )}
                </td>
                <td className="py-2 pr-3 text-slate-600">{t.frente?.nombre ?? "—"}</td>
                <td className="py-2 pr-3 text-slate-600">{t.inicio}</td>
                <td className="py-2 pr-3 text-slate-600">{t.fin}</td>
                <td className="py-2 text-right text-slate-700">
                  {formatearPorcentaje(t.avance)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export type { FrentePrincipal };
