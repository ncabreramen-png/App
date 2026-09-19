"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { resolverOrdenDeCambio } from "../acciones";

export default function PanelAprobacion({ reporteId }: { reporteId: string }) {
  const router = useRouter();
  const [modoRechazo, setModoRechazo] = useState(false);
  const [comentario, setComentario] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [procesando, setProcesando] = useState(false);

  async function resolver(decision: "Aprobado" | "Rechazado") {
    setError(null);
    setProcesando(true);

    const r = await resolverOrdenDeCambio({ reporteId, decision, comentario });

    if (!r.ok) {
      setError(r.error);
      setProcesando(false);
      return;
    }
    router.refresh();
  }

  return (
    <div className="no-imprimir mt-4 border-t border-slate-100 pt-4">
      {!modoRechazo ? (
        <div className="flex gap-2">
          <button
            onClick={() => resolver("Aprobado")}
            disabled={procesando}
            className="boton flex-1 bg-green-600 py-2.5 hover:bg-green-700"
          >
            Aprobar
          </button>
          <button
            onClick={() => setModoRechazo(true)}
            disabled={procesando}
            className="boton-secundario flex-1 border-red-300 py-2.5 text-red-700 hover:bg-red-50"
          >
            Rechazar
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <label htmlFor={`motivo-${reporteId}`} className="etiqueta">
            Motivo del rechazo
          </label>
          <textarea
            id={`motivo-${reporteId}`}
            className="campo min-h-24"
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            placeholder="Explicá por qué se rechaza la orden de cambio."
          />
          <div className="flex gap-2">
            <button
              onClick={() => resolver("Rechazado")}
              disabled={procesando || comentario.trim().length === 0}
              className="boton flex-1 bg-red-600 py-2.5 hover:bg-red-700"
            >
              {procesando ? "Enviando…" : "Confirmar rechazo"}
            </button>
            <button
              onClick={() => {
                setModoRechazo(false);
                setError(null);
              }}
              className="boton-secundario py-2.5"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
    </div>
  );
}
