"use client";

import Link from "next/link";
import { useState } from "react";
import BarraAvance from "@/components/BarraAvance";
import { InsigniaSemaforo } from "@/components/Insignias";
import type { FrenteConSemaforo } from "@/lib/tipos";
import { actualizarAvances } from "./acciones";

export default function TarjetaFrente({ frente }: { frente: FrenteConSemaforo }) {
  const [editando, setEditando] = useState(false);
  const [fisico, setFisico] = useState(String(frente.avance_fisico));
  const [financiero, setFinanciero] = useState(String(frente.avance_financiero));
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    setGuardando(true);
    setError(null);
    const r = await actualizarAvances({
      frenteId: frente.id,
      avanceFisico: Number(fisico),
      avanceFinanciero: Number(financiero),
    });
    setGuardando(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setEditando(false);
  }

  return (
    <article className="tarjeta evitar-corte space-y-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold leading-tight text-slate-900">{frente.nombre}</h3>
        <InsigniaSemaforo valor={frente.semaforo} />
      </div>

      {editando ? (
        <div className="space-y-2">
          <label className="block text-xs text-slate-600">
            Avance físico (%)
            <input
              type="number"
              min={0}
              max={100}
              step="0.1"
              className="campo mt-1 py-2"
              value={fisico}
              onChange={(e) => setFisico(e.target.value)}
            />
          </label>
          <label className="block text-xs text-slate-600">
            Avance financiero (%)
            <input
              type="number"
              min={0}
              max={100}
              step="0.1"
              className="campo mt-1 py-2"
              value={financiero}
              onChange={(e) => setFinanciero(e.target.value)}
            />
          </label>
          {error && <p className="text-xs text-red-700">{error}</p>}
          <div className="flex gap-2">
            <button onClick={guardar} disabled={guardando} className="boton flex-1 py-2 text-sm">
              {guardando ? "Guardando…" : "Guardar"}
            </button>
            <button
              onClick={() => setEditando(false)}
              className="boton-secundario py-2 text-sm"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <BarraAvance etiqueta="Avance físico" valor={frente.avance_fisico} />
          <BarraAvance etiqueta="Avance financiero" valor={frente.avance_financiero} />
        </div>
      )}

      <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
        <Link
          href={`/gerente/reportes?frente=${frente.id}`}
          className="font-medium text-marca-600 hover:underline"
        >
          {frente.total_reportes} reporte{frente.total_reportes === 1 ? "" : "s"} ·{" "}
          {frente.alertas} alerta{frente.alertas === 1 ? "" : "s"}
        </Link>
        {!editando && (
          <button
            onClick={() => setEditando(true)}
            className="no-imprimir font-medium text-slate-500 hover:text-slate-800"
          >
            Editar avances
          </button>
        )}
      </div>
    </article>
  );
}
