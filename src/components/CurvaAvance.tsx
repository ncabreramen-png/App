"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  formatearPeriodo,
  formatearPorcentaje,
  type PuntoCurva,
} from "@/lib/tipos";

/**
 * Curva S del proyecto: avance programado contra avance real, mes a mes.
 *
 * Se dibuja con SVG en linea en vez de una libreria de graficos para no sumar
 * ~100 kB al bundle que se descarga desde el celular en obra.
 *
 * El ancho se mide con ResizeObserver y el SVG se renderiza a pixeles reales.
 * Escalar un viewBox seria mas corto, pero deforma el texto: a 390 px las
 * etiquetas quedarian ilegibles y en escritorio, enormes.
 *
 * No hay variante oscura a proposito: la aplicacion es de tema claro y un
 * grafico que responda a prefers-color-scheme quedaria oscuro dentro de una
 * tarjeta blanca.
 */

// Paleta categorica validada con el validador de la guia de visualizacion:
// separacion CVD deltaE 24.7 y vision normal 33.6 sobre superficie clara.
const COLOR_PROGRAMADO = "#2a78d6"; // ranura 1
const COLOR_REAL = "#eb6834"; // ranura 2
const SUPERFICIE = "#ffffff";
const GRILLA = "#e7e5e4";
const EJE_TEXTO = "#78716c";

const MARGEN = { arriba: 16, derecha: 62, abajo: 30, izquierda: 38 };
const ALTO = 250;
const NIVELES_Y = [0, 25, 50, 75, 100];

type Medida = { i: number; x: number; y: number; punto: PuntoCurva };

export default function CurvaAvance({ puntos }: { puntos: PuntoCurva[] }) {
  const contenedor = useRef<HTMLDivElement>(null);
  const [ancho, setAncho] = useState(0);
  const [activo, setActivo] = useState<number | null>(null);
  const [verTabla, setVerTabla] = useState(false);

  useEffect(() => {
    const el = contenedor.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setAncho(e.contentRect.width));
    ro.observe(el);
    setAncho(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);

  const geo = useMemo(() => {
    const anchoPlot = Math.max(0, ancho - MARGEN.izquierda - MARGEN.derecha);
    const altoPlot = ALTO - MARGEN.arriba - MARGEN.abajo;
    const n = puntos.length;

    const x = (i: number) =>
      MARGEN.izquierda + (n <= 1 ? anchoPlot / 2 : (i / (n - 1)) * anchoPlot);
    const y = (v: number) =>
      MARGEN.arriba + (1 - Math.max(0, Math.min(100, v)) / 100) * altoPlot;

    const programado: Medida[] = puntos.map((p, i) => ({
      i,
      x: x(i),
      y: y(p.avance_programado),
      punto: p,
    }));
    const real: Medida[] = puntos
      .map((p, i) => ({ i, x: x(i), y: y(p.avance_real ?? 0), punto: p }))
      .filter((m) => m.punto.avance_real !== null);

    // Una etiqueta cada tantos meses: con 24 periodos en 390 px se pisan.
    const paso = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(anchoPlot / 62))));
    // La ultima etiqueta se ancla a la derecha, asi que ocupa su ancho entero
    // hacia la izquierda; la anterior esta centrada y ocupa medio ancho hacia
    // la derecha. Con "sept 2026" (lo mas largo) en 10 px eso da ~48 + ~24.
    const SEPARACION_MINIMA = 80;
    // La ultima siempre va; las intermedias se descartan si quedarian encima,
    // porque apilarlas o dejarlas pisadas es peor que no mostrarlas.
    const etiquetasX = puntos
      .map((p, i) => ({ i, p }))
      .filter(
        ({ i }) =>
          i === n - 1 ||
          (i % paso === 0 && x(n - 1) - x(i) >= SEPARACION_MINIMA),
      );

    return { anchoPlot, altoPlot, x, y, programado, real, etiquetasX };
  }, [ancho, puntos]);

  if (puntos.length === 0) {
    return (
      <p className="tarjeta p-6 text-center text-sm text-slate-600">
        Todavía no hay curva cargada. Agregá los meses del cronograma desde
        &ldquo;Editar curva&rdquo;.
      </p>
    );
  }

  const linea = (ms: Medida[]) =>
    ms.map((m, k) => `${k === 0 ? "M" : "L"}${m.x.toFixed(1)},${m.y.toFixed(1)}`).join(" ");

  const finP = geo.programado.at(-1);
  const finR = geo.real.at(-1);
  // Con un solo mes no hay nada que unir: una linea necesita dos puntos. Se
  // avisa en vez de dejar un grafico que parece roto.
  const faltanMeses = puntos.length < 2;
  // Cuando las lineas convergen, las etiquetas de punta se pisan. En vez de
  // apilarlas (que las despega de su linea), se deja solo la de avance real y
  // la leyenda mas el tooltip cargan la otra.
  const colision = !!finP && !!finR && Math.abs(finP.y - finR.y) < 15;

  const activoPunto = activo === null ? null : puntos[activo];

  function alMover(e: React.PointerEvent<SVGSVGElement>) {
    const caja = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - caja.left;
    let mejor = 0;
    let dist = Infinity;
    geo.programado.forEach((m) => {
      const d = Math.abs(m.x - px);
      if (d < dist) {
        dist = d;
        mejor = m.i;
      }
    });
    setActivo(mejor);
  }

  return (
    <div className="tarjeta p-4">
      <div className="mb-1 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-slate-900">Curva de avance</h3>
          <p className="text-xs text-slate-500">
            Acumulado del proyecto, programado contra real
          </p>
        </div>
        <button
          onClick={() => setVerTabla((v) => !v)}
          className="no-imprimir rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          {verTabla ? "Ver gráfico" : "Ver tabla"}
        </button>
      </div>

      {/* Leyenda: identidad nunca depende solo del color. */}
      <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1">
        {[
          { c: COLOR_PROGRAMADO, t: "Programado" },
          { c: COLOR_REAL, t: "Real" },
        ].map((s) => (
          <li key={s.t} className="flex items-center gap-1.5 text-xs text-slate-600">
            <span
              aria-hidden
              className="inline-block h-0.5 w-4 rounded-full"
              style={{ background: s.c }}
            />
            {s.t}
          </li>
        ))}
      </ul>

      {faltanMeses && !verTabla && (
        <p className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Con un solo mes cargado se marcan los puntos pero no se dibuja la
          curva: una línea necesita al menos dos meses. Agregá el siguiente
          período y aparece.
        </p>
      )}

      {verTabla ? (
        <TablaCurva puntos={puntos} />
      ) : (
        <div ref={contenedor} className="relative">
          {ancho > 0 && (
            <svg
              width={ancho}
              height={ALTO}
              role="img"
              aria-label="Curva de avance del proyecto: programado contra real"
              className="touch-pan-y"
              onPointerMove={alMover}
              onPointerLeave={() => setActivo(null)}
            >
              {/* Grilla: linea solida de 1 px, un tono sobre la superficie. */}
              {NIVELES_Y.map((v) => (
                <g key={v}>
                  <line
                    x1={MARGEN.izquierda}
                    x2={MARGEN.izquierda + geo.anchoPlot}
                    y1={geo.y(v)}
                    y2={geo.y(v)}
                    stroke={GRILLA}
                    strokeWidth={1}
                  />
                  <text
                    x={MARGEN.izquierda - 8}
                    y={geo.y(v) + 3.5}
                    textAnchor="end"
                    fontSize={10}
                    fill={EJE_TEXTO}
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {v}%
                  </text>
                </g>
              ))}

              {geo.etiquetasX.map(({ i, p }) => (
                <text
                  key={p.id}
                  x={geo.x(i)}
                  y={ALTO - 10}
                  textAnchor={i === 0 ? "start" : i === puntos.length - 1 ? "end" : "middle"}
                  fontSize={10}
                  fill={EJE_TEXTO}
                >
                  {formatearPeriodo(p.periodo)}
                </text>
              ))}

              {activo !== null && (
                <line
                  x1={geo.x(activo)}
                  x2={geo.x(activo)}
                  y1={MARGEN.arriba}
                  y2={MARGEN.arriba + geo.altoPlot}
                  stroke={EJE_TEXTO}
                  strokeWidth={1}
                />
              )}

              <path
                d={linea(geo.programado)}
                fill="none"
                stroke={COLOR_PROGRAMADO}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {geo.real.length > 0 && (
                <path
                  d={linea(geo.real)}
                  fill="none"
                  stroke={COLOR_REAL}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              )}

              {/* Marcadores de punta: r>=4 con anillo de 2 px en la superficie. */}
              {[
                { m: finP, c: COLOR_PROGRAMADO },
                { m: finR, c: COLOR_REAL },
              ].map(({ m, c }) =>
                m ? (
                  <circle
                    key={c}
                    cx={m.x}
                    cy={m.y}
                    r={faltanMeses ? 6 : 4.5}
                    fill={c}
                    stroke={SUPERFICIE}
                    strokeWidth={2}
                  />
                ) : null,
              )}

              {/* Etiqueta directa selectiva: solo el valor de punta. */}
              {finR && (
                <text
                  x={finR.x + 8}
                  y={finR.y + 3.5}
                  fontSize={11}
                  fontWeight={600}
                  fill="#44403c"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {formatearPorcentaje(finR.punto.avance_real ?? 0)}
                </text>
              )}
              {finP && !colision && (
                <text
                  x={finP.x + 8}
                  y={finP.y + 3.5}
                  fontSize={11}
                  fontWeight={600}
                  fill="#44403c"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {formatearPorcentaje(finP.punto.avance_programado)}
                </text>
              )}

              {activo !== null && (
                <>
                  <circle
                    cx={geo.x(activo)}
                    cy={geo.y(puntos[activo].avance_programado)}
                    r={4.5}
                    fill={COLOR_PROGRAMADO}
                    stroke={SUPERFICIE}
                    strokeWidth={2}
                  />
                  {puntos[activo].avance_real !== null && (
                    <circle
                      cx={geo.x(activo)}
                      cy={geo.y(puntos[activo].avance_real!)}
                      r={4.5}
                      fill={COLOR_REAL}
                      stroke={SUPERFICIE}
                      strokeWidth={2}
                    />
                  )}
                </>
              )}
            </svg>
          )}

          {activoPunto && (
            <div
              className="pointer-events-none absolute top-1 z-10 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs shadow-lg"
              style={{
                left: Math.min(Math.max(geo.x(activo!) - 60, 0), Math.max(0, ancho - 130)),
              }}
            >
              <p className="font-semibold text-slate-900">
                {formatearPeriodo(activoPunto.periodo)}
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 text-slate-600">
                <span
                  aria-hidden
                  className="inline-block h-0.5 w-3 rounded-full"
                  style={{ background: COLOR_PROGRAMADO }}
                />
                Programado {formatearPorcentaje(activoPunto.avance_programado)}
              </p>
              <p className="flex items-center gap-1.5 text-slate-600">
                <span
                  aria-hidden
                  className="inline-block h-0.5 w-3 rounded-full"
                  style={{ background: COLOR_REAL }}
                />
                Real{" "}
                {activoPunto.avance_real === null
                  ? "sin medir"
                  : formatearPorcentaje(activoPunto.avance_real)}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TablaCurva({ puntos }: { puntos: PuntoCurva[] }) {
  return (
    <div className="max-h-80 overflow-auto">
      <table className="w-full text-left text-sm">
        <thead className="sticky top-0 bg-white text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="py-2 pr-3 font-medium">Mes</th>
            <th className="py-2 pr-3 text-right font-medium">Programado</th>
            <th className="py-2 pr-3 text-right font-medium">Real</th>
            <th className="py-2 text-right font-medium">Desvío</th>
          </tr>
        </thead>
        <tbody style={{ fontVariantNumeric: "tabular-nums" }}>
          {puntos.map((p) => {
            const d = p.avance_real === null ? null : p.avance_real - p.avance_programado;
            return (
              <tr key={p.id} className="border-t border-slate-100">
                <td className="py-2 pr-3 text-slate-700">{formatearPeriodo(p.periodo)}</td>
                <td className="py-2 pr-3 text-right text-slate-700">
                  {formatearPorcentaje(p.avance_programado)}
                </td>
                <td className="py-2 pr-3 text-right text-slate-700">
                  {p.avance_real === null ? "—" : formatearPorcentaje(p.avance_real)}
                </td>
                <td
                  className={`py-2 text-right font-medium ${
                    d === null ? "text-slate-400" : d < 0 ? "text-red-700" : "text-green-700"
                  }`}
                >
                  {d === null ? "—" : formatearPorcentaje(d, true)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
