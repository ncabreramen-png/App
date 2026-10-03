/* eslint-disable @next/next/no-img-element */
import type { ArchivoFirmado } from "@/lib/adjuntos.servidor";
import { colorTipo, esImagen, etiquetaTipo, formatearTamano } from "@/lib/archivos";

/**
 * Muestra los adjuntos: las imagenes como miniatura, todo lo demas como
 * tarjeta descargable. Un PDF o un Excel no tienen miniatura que mostrar, y
 * fingir una seria peor que nombrar el archivo.
 */
export default function ListaArchivos({ archivos }: { archivos: ArchivoFirmado[] }) {
  if (archivos.length === 0) return null;

  const imagenes = archivos.filter((a) => esImagen(a.tipo));
  const documentos = archivos.filter((a) => !esImagen(a.tipo));

  return (
    <div className="mt-3 space-y-3">
      {imagenes.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {imagenes.map((a, i) => (
            <a
              key={a.ruta}
              href={a.url}
              target="_blank"
              rel="noreferrer"
              className="block overflow-hidden rounded-lg border border-slate-200"
            >
              <img
                src={a.url}
                alt={a.nombre || `Foto ${i + 1}`}
                loading="lazy"
                className="aspect-square w-full object-cover"
              />
            </a>
          ))}
        </div>
      )}

      {documentos.length > 0 && (
        <ul className="space-y-2">
          {documentos.map((a) => {
            const etiqueta = etiquetaTipo(a);
            return (
              <li key={a.ruta}>
                <a
                  href={a.url}
                  target="_blank"
                  rel="noreferrer"
                  download={a.nombre}
                  className="flex items-center gap-3 rounded-lg border border-slate-200 p-2 transition hover:bg-slate-50"
                >
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded text-[10px] font-bold ${colorTipo(etiqueta)}`}
                  >
                    {etiqueta}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-800">
                      {a.nombre}
                    </span>
                    <span className="block text-xs text-slate-500">
                      {formatearTamano(a.tamano) || "Abrir"}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-semibold text-marca-600">Abrir</span>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
