"use client";

import type { ArchivoFirmado } from "@/lib/adjuntos.servidor";
import { colorTipo, esImagen, etiquetaTipo, formatearTamano } from "@/lib/archivos";

/**
 * Adjuntos que ya estan guardados, con la opcion de quitarlos. Se separa de
 * SelectorArchivos porque aquellos son File en memoria y estos ya viven en
 * Storage: no se pueden mezclar en una misma lista.
 */
export default function AdjuntosExistentes({
  archivos,
  onQuitar,
  deshabilitado = false,
}: {
  archivos: ArchivoFirmado[];
  onQuitar: (ruta: string) => void;
  deshabilitado?: boolean;
}) {
  if (archivos.length === 0) return null;

  return (
    <div>
      <span className="etiqueta">Adjuntos actuales ({archivos.length})</span>
      <ul className="space-y-2">
        {archivos.map((a) => {
          const etiqueta = etiquetaTipo(a);
          return (
            <li
              key={a.ruta}
              className="flex items-center gap-3 rounded-lg border border-slate-200 p-2"
            >
              {esImagen(a.tipo) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.url} alt="" className="h-12 w-12 shrink-0 rounded object-cover" />
              ) : (
                <span
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded text-[10px] font-bold ${colorTipo(etiqueta)}`}
                >
                  {etiqueta}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <a
                  href={a.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block truncate text-sm text-slate-800 hover:underline"
                >
                  {a.nombre}
                </a>
                <span className="block text-xs text-slate-500">
                  {formatearTamano(a.tamano)}
                </span>
              </span>
              <button
                type="button"
                onClick={() => onQuitar(a.ruta)}
                disabled={deshabilitado}
                aria-label={`Quitar ${a.nombre}`}
                className="shrink-0 rounded-lg px-2 py-1 text-sm font-semibold text-slate-500 hover:bg-slate-100 hover:text-red-700 disabled:opacity-50"
              >
                Quitar
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-1.5 text-xs text-slate-500">
        Los adjuntos que quites se borran definitivamente al guardar.
      </p>
    </div>
  );
}
