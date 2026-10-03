"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ArchivoFirmado } from "@/lib/adjuntos.servidor";
import ListaArchivos from "@/components/ListaArchivos";
import {
  codigoNC,
  formatearFecha,
  type NoConformidadExpandida,
} from "@/lib/tipos";
import { borrarNoConformidad, cambiarEstadoNC } from "./acciones";

/**
 * Una no conformidad en la lista. La gerencia la ve; aseguramiento de calidad
 * ademas la cierra o la reabre.
 */
export default function PanelNC({
  nc,
  adjuntos,
  puedeEditar,
}: {
  nc: NoConformidadExpandida;
  adjuntos: ArchivoFirmado[];
  puedeEditar: boolean;
}) {
  const router = useRouter();
  const [cerrando, setCerrando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [comentario, setComentario] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const atendida = nc.estado === "Atendida";

  async function correr(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    setOcupado(true);
    const r = await fn();
    setOcupado(false);
    if (!r.ok) {
      setError(r.error ?? "No se pudo completar la operación.");
      return false;
    }
    router.refresh();
    return true;
  }

  return (
    <article className="tarjeta evitar-corte p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold text-slate-900">
            {codigoNC(nc.numero)} · {nc.frente?.nombre ?? "—"}
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Detectada el {nc.detectada_en}
            {nc.autor ? ` · ${nc.autor.nombre}` : ""}
          </p>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
            atendida
              ? "border-green-300 bg-green-100 text-green-800"
              : "border-amber-300 bg-amber-100 text-amber-800"
          }`}
        >
          <span
            aria-hidden
            className={`h-2 w-2 rounded-full ${atendida ? "bg-green-500" : "bg-amber-500"}`}
          />
          {nc.estado}
        </span>
      </div>

      <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{nc.descripcion}</p>

      {atendida && nc.comentario_cierre && (
        <p className="mt-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">
          <span className="font-semibold">Cómo se atendió: </span>
          {nc.comentario_cierre}
          {nc.atendida_en && (
            <span className="block text-xs text-green-700">
              Cerrada el {nc.atendida_en}
            </span>
          )}
        </p>
      )}

      <ListaArchivos archivos={adjuntos} />

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {puedeEditar && (
        <div className="no-imprimir mt-4 border-t border-slate-100 pt-4">
          {cerrando ? (
            <div className="space-y-2">
              <label htmlFor={`cierre-${nc.id}`} className="etiqueta">
                ¿Cómo se atendió?
              </label>
              <textarea
                id={`cierre-${nc.id}`}
                className="campo min-h-24"
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                placeholder="Acción correctiva aplicada, verificación realizada."
              />
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    const ok = await correr(() =>
                      cambiarEstadoNC({ id: nc.id, estado: "Atendida", comentario }),
                    );
                    if (ok) {
                      setCerrando(false);
                      setComentario("");
                    }
                  }}
                  disabled={ocupado || comentario.trim().length === 0}
                  className="boton flex-1 bg-green-600 py-2.5 hover:bg-green-700"
                >
                  {ocupado ? "Guardando…" : "Marcar como atendida"}
                </button>
                <button
                  onClick={() => {
                    setCerrando(false);
                    setError(null);
                  }}
                  className="boton-secundario py-2.5"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : confirmando ? (
            <div className="space-y-2">
              <p className="text-sm text-slate-700">
                Se va a borrar {codigoNC(nc.numero)} con sus adjuntos. No se puede
                deshacer.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => correr(() => borrarNoConformidad(nc.id))}
                  disabled={ocupado}
                  className="boton bg-red-600 py-2 hover:bg-red-700"
                >
                  {ocupado ? "Borrando…" : "Confirmar borrado"}
                </button>
                <button
                  onClick={() => setConfirmando(false)}
                  className="boton-secundario py-2"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              {atendida ? (
                <button
                  onClick={() =>
                    correr(() =>
                      cambiarEstadoNC({ id: nc.id, estado: "Pendiente", comentario: "" }),
                    )
                  }
                  disabled={ocupado}
                  className="boton-secundario py-2 text-sm"
                >
                  Reabrir
                </button>
              ) : (
                <button
                  onClick={() => setCerrando(true)}
                  className="boton bg-green-600 py-2 text-sm hover:bg-green-700"
                >
                  Marcar como atendida
                </button>
              )}
              <button
                onClick={() => setConfirmando(true)}
                className="text-xs font-medium text-slate-500 hover:text-red-700"
              >
                Borrar
              </button>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
