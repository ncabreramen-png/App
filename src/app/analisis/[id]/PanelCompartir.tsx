"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Usuario } from "@/lib/tipos";
import { cambiarAcceso } from "../acciones";

/**
 * Control de acceso por usuario. Privado es el estado por defecto: sin ninguna
 * persona marcada, el analisis solo lo ve su autor.
 */
export default function PanelCompartir({
  analisisId,
  candidatos,
  conAcceso,
}: {
  analisisId: string;
  candidatos: Usuario[];
  conAcceso: string[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [enCurso, setEnCurso] = useState<string | null>(null);
  const acceso = new Set(conAcceso);

  async function alternar(usuarioId: string, conceder: boolean) {
    setError(null);
    setEnCurso(usuarioId);
    const r = await cambiarAcceso({ analisisId, usuarioId, conceder });
    setEnCurso(null);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    router.refresh();
  }

  return (
    <section className="tarjeta no-imprimir p-4">
      <h2 className="font-semibold text-slate-900">Quién puede verlo</h2>
      <p className="mt-0.5 text-sm text-slate-600">
        {acceso.size === 0
          ? "Privado: por ahora solo vos."
          : `Compartido con ${acceso.size} ${acceso.size === 1 ? "persona" : "personas"}.`}
      </p>

      {candidatos.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">
          No hay otros usuarios en el sistema todavía.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100">
          {candidatos.map((u) => {
            const tiene = acceso.has(u.id);
            return (
              <li key={u.id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-slate-800">
                    {u.nombre}
                  </span>
                  <span className="block truncate text-xs text-slate-500">
                    {u.disciplina} · {u.rol}
                  </span>
                </span>
                <button
                  onClick={() => alternar(u.id, !tiene)}
                  disabled={enCurso === u.id}
                  className={
                    tiene
                      ? "shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      : "shrink-0 rounded-lg bg-marca-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-marca-700 disabled:opacity-50"
                  }
                >
                  {enCurso === u.id ? "…" : tiene ? "Quitar acceso" : "Compartir"}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
    </section>
  );
}
