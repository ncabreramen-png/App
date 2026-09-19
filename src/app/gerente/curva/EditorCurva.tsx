"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatearPeriodo, formatearPorcentaje, type PuntoCurva } from "@/lib/tipos";
import { borrarPeriodo, guardarPeriodo, importarCurva } from "./acciones";

export default function EditorCurva({ puntos }: { puntos: PuntoCurva[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [modoImportar, setModoImportar] = useState(false);

  async function correr(fn: () => Promise<{ ok: boolean; error?: string }>, exito?: string) {
    setError(null);
    setAviso(null);
    setOcupado(true);
    const r = await fn();
    setOcupado(false);
    if (!r.ok) {
      setError(r.error ?? "No se pudo guardar.");
      return false;
    }
    if (exito) setAviso(exito);
    router.refresh();
    return true;
  }

  async function agregar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const d = new FormData(form);
    const realCrudo = String(d.get("real") ?? "").trim();
    const ok = await correr(() =>
      guardarPeriodo({
        mes: String(d.get("mes") ?? ""),
        programado: Number(d.get("programado")),
        real: realCrudo === "" ? null : Number(realCrudo),
      }),
    );
    if (ok) form.reset();
  }

  async function importar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const r = await importarCurva(String(d.get("texto") ?? ""));
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setAviso(`Se cargaron ${r.filas} meses.`);
    setModoImportar(false);
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <form onSubmit={agregar} className="tarjeta space-y-4 p-4">
        <h2 className="font-semibold text-slate-900">Agregar o actualizar un mes</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="etiqueta">Mes</span>
            <input name="mes" type="month" required className="campo py-2" />
          </label>
          <label className="block">
            <span className="etiqueta">Programado (%)</span>
            <input
              name="programado"
              type="number"
              step="0.1"
              min={0}
              max={100}
              required
              className="campo py-2"
            />
          </label>
          <label className="block">
            <span className="etiqueta">Real (%) — opcional</span>
            <input
              name="real"
              type="number"
              step="0.1"
              min={0}
              max={100}
              placeholder="sin medir"
              className="campo py-2"
            />
          </label>
        </div>
        <p className="text-xs text-slate-500">
          Dejá el avance real vacío en los meses que todavía no se midieron. Si
          cargás 0, la curva va a dibujar una caída a cero en vez de cortarse.
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={ocupado} className="boton">
            {ocupado ? "Guardando…" : "Guardar mes"}
          </button>
          <button
            type="button"
            onClick={() => setModoImportar((v) => !v)}
            className="boton-secundario"
          >
            {modoImportar ? "Cerrar carga masiva" : "Carga masiva"}
          </button>
        </div>
      </form>

      {modoImportar && (
        <form onSubmit={importar} className="tarjeta space-y-3 p-4">
          <h2 className="font-semibold text-slate-900">Pegar el cronograma</h2>
          <p className="text-xs text-slate-600">
            Una línea por mes: <code>AAAA-MM programado real</code>. El avance
            real es opcional; poné <code>-</code> o dejalo afuera si ese mes no
            se midió. Los meses que ya existan se actualizan.
          </p>
          <textarea
            name="texto"
            required
            className="campo min-h-40 font-mono text-sm"
            placeholder={"2026-01  2.5   2.1\n2026-02  6.0   5.4\n2026-03  11.5  -"}
          />
          <button type="submit" disabled={ocupado} className="boton">
            Importar
          </button>
        </form>
      )}

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      {aviso && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">{aviso}</p>
      )}

      <div className="tarjeta overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Mes</th>
              <th className="px-4 py-3 text-right font-medium">Programado</th>
              <th className="px-4 py-3 text-right font-medium">Real</th>
              <th className="px-4 py-3 text-right font-medium">Desvío</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody style={{ fontVariantNumeric: "tabular-nums" }}>
            {puntos.map((p) => {
              const d = p.avance_real === null ? null : p.avance_real - p.avance_programado;
              return (
                <tr key={p.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2.5 text-slate-800">{formatearPeriodo(p.periodo)}</td>
                  <td className="px-4 py-2.5 text-right text-slate-700">
                    {formatearPorcentaje(p.avance_programado)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-slate-700">
                    {p.avance_real === null ? (
                      <span className="text-slate-400">sin medir</span>
                    ) : (
                      formatearPorcentaje(p.avance_real)
                    )}
                  </td>
                  <td
                    className={`px-4 py-2.5 text-right font-medium ${
                      d === null ? "text-slate-400" : d < 0 ? "text-red-700" : "text-green-700"
                    }`}
                  >
                    {d === null ? "—" : formatearPorcentaje(d, true)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={() => correr(() => borrarPeriodo(p.id))}
                      disabled={ocupado}
                      className="text-xs font-medium text-slate-500 hover:text-red-700"
                    >
                      Borrar
                    </button>
                  </td>
                </tr>
              );
            })}
            {puntos.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                  Todavía no hay meses cargados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
