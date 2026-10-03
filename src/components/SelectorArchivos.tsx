"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  ACEPTA_IMAGEN,
  ACEPTA_TODO,
  MAX_ADJUNTOS,
  colorTipo,
  esImagen,
  formatearTamano,
  tipoPermitido,
} from "@/lib/archivos";

/**
 * Selector de adjuntos compartido por el reporte de campo y el analisis de
 * gerencia. Solo administra la seleccion: la subida la hace quien lo usa,
 * porque cada uno escribe en un bucket distinto.
 */
export default function SelectorArchivos({
  archivos,
  onCambio,
  limiteBytes,
  deshabilitado = false,
}: {
  archivos: File[];
  onCambio: (archivos: File[]) => void;
  limiteBytes: number;
  deshabilitado?: boolean;
}) {
  const previas = useMemo(
    () =>
      archivos.map((a) => ({
        nombre: a.name,
        tipo: a.type,
        tamano: a.size,
        url: esImagen(a.type) ? URL.createObjectURL(a) : null,
      })),
    [archivos],
  );

  // Los objectURL se regeneran en cada cambio de lista; hay que liberar los
  // anteriores o quedan colgando en el navegador del celular.
  const anteriores = useRef<string[]>([]);
  useEffect(() => {
    anteriores.current.forEach((u) => URL.revokeObjectURL(u));
    anteriores.current = previas.map((p) => p.url).filter((u): u is string => !!u);
  }, [previas]);
  useEffect(
    () => () => anteriores.current.forEach((u) => URL.revokeObjectURL(u)),
    [],
  );

  const rechazados = useRef<string[]>([]);

  function agregar(lista: FileList | null) {
    if (!lista) return;
    const malos: string[] = [];
    const buenos = Array.from(lista).filter((f) => {
      if (!tipoPermitido(f)) {
        malos.push(`${f.name}: tipo no admitido`);
        return false;
      }
      if (f.size > limiteBytes) {
        malos.push(`${f.name}: pesa ${formatearTamano(f.size)}, el máximo es ${formatearTamano(limiteBytes)}`);
        return false;
      }
      return true;
    });
    rechazados.current = malos;
    if (malos.length > 0) window.alert(`No se agregaron:\n\n${malos.join("\n")}`);
    onCambio([...archivos, ...buenos].slice(0, MAX_ADJUNTOS));
  }

  function quitar(i: number) {
    onCambio(archivos.filter((_, k) => k !== i));
  }

  return (
    <div>
      <span className="etiqueta">
        Adjuntos ({archivos.length}/{MAX_ADJUNTOS})
      </span>

      <div className="flex flex-wrap gap-2">
        <label className={`boton-secundario ${deshabilitado ? "opacity-50" : "cursor-pointer"}`}>
          Tomar foto
          <input
            type="file"
            accept={ACEPTA_IMAGEN}
            capture="environment"
            className="sr-only"
            disabled={deshabilitado}
            onChange={(e) => {
              agregar(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
        <label className={`boton-secundario ${deshabilitado ? "opacity-50" : "cursor-pointer"}`}>
          Galería
          <input
            type="file"
            accept={ACEPTA_IMAGEN}
            multiple
            className="sr-only"
            disabled={deshabilitado}
            onChange={(e) => {
              agregar(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
        <label className={`boton-secundario ${deshabilitado ? "opacity-50" : "cursor-pointer"}`}>
          Archivo
          <input
            type="file"
            accept={ACEPTA_TODO}
            multiple
            className="sr-only"
            disabled={deshabilitado}
            onChange={(e) => {
              agregar(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
      </div>

      <p className="mt-1.5 text-xs text-slate-500">
        Fotos, PDF, Excel, Word y PowerPoint. Hasta {formatearTamano(limiteBytes)} por archivo.
      </p>

      {previas.length > 0 && (
        <ul className="mt-3 space-y-2">
          {previas.map((p, i) => {
            const etiqueta =
              p.nombre.match(/\.([a-z0-9]+)$/i)?.[1]?.toUpperCase() ??
              (esImagen(p.tipo) ? "IMG" : "ARCHIVO");
            return (
              <li
                key={`${p.nombre}-${i}`}
                className="flex items-center gap-3 rounded-lg border border-slate-200 p-2"
              >
                {p.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.url}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded object-cover"
                  />
                ) : (
                  <span
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded text-[10px] font-bold ${colorTipo(etiqueta)}`}
                  >
                    {etiqueta}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-slate-800">{p.nombre}</span>
                  <span className="block text-xs text-slate-500">
                    {formatearTamano(p.tamano)}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => quitar(i)}
                  aria-label={`Quitar ${p.nombre}`}
                  className="shrink-0 rounded-lg px-2 py-1 text-sm font-semibold text-slate-500 hover:bg-slate-100 hover:text-red-700"
                >
                  Quitar
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
