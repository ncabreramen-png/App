"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { borrarAnalisis } from "../acciones";

export default function BotonBorrar({ id, titulo }: { id: string; titulo: string }) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [borrando, setBorrando] = useState(false);

  async function borrar() {
    setBorrando(true);
    setError(null);
    const r = await borrarAnalisis(id);
    if (!r.ok) {
      setError(r.error);
      setBorrando(false);
      return;
    }
    router.replace("/analisis");
    router.refresh();
  }

  if (!confirmando) {
    return (
      <button
        onClick={() => setConfirmando(true)}
        className="no-imprimir text-sm font-medium text-slate-500 hover:text-red-700"
      >
        Borrar este análisis
      </button>
    );
  }

  return (
    <div className="no-imprimir tarjeta space-y-3 border-red-200 p-4">
      <p className="text-sm text-slate-700">
        Se va a borrar <b>{titulo}</b> junto con sus archivos. No se puede deshacer.
      </p>
      {error && <p className="text-sm text-red-700">{error}</p>}
      <div className="flex gap-2">
        <button onClick={borrar} disabled={borrando} className="boton bg-red-600 py-2 hover:bg-red-700">
          {borrando ? "Borrando…" : "Confirmar borrado"}
        </button>
        <button onClick={() => setConfirmando(false)} className="boton-secundario py-2">
          Cancelar
        </button>
      </div>
    </div>
  );
}
