"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  FRENTES_PRINCIPALES,
  formatearPeriodo,
  formatearPorcentaje,
  type TareaExpandida,
} from "@/lib/tipos";
import { guardarCierreMensual, recalcularCurva } from "../gantt/acciones";

export type FilaCierre = {
  tarea_id: string;
  avance: number;
  medido: boolean;
  arrastrado: number;
};

export default function FormularioCierre({
  periodo,
  tareas,
  filas,
  mesesMedidos,
}: {
  periodo: string;
  tareas: TareaExpandida[];
  filas: FilaCierre[];
  mesesMedidos: { periodo: string; tareas: number }[];
}) {
  const router = useRouter();

  const inicial = useMemo(
    () => Object.fromEntries(filas.map((f) => [f.tarea_id, String(f.avance)])),
    [filas],
  );
  const porTarea = useMemo(
    () => new Map(filas.map((f) => [f.tarea_id, f])),
    [filas],
  );

  const [valores, setValores] = useState<Record<string, string>>(inicial);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const porGrupo = useMemo(
    () =>
      FRENTES_PRINCIPALES.map((grupo) => ({
        grupo,
        frentes: Array.from(
          new Map(
            tareas
              .filter((t) => t.frente?.frente_principal === grupo)
              .map((t) => [t.frente_de_trabajo_id, t.frente?.nombre ?? "—"]),
          ),
        ).map(([id, nombre]) => ({
          id,
          nombre,
          items: tareas.filter((t) => t.frente_de_trabajo_id === id),
        })),
      })).filter((g) => g.frentes.length > 0),
    [tareas],
  );

  function irA(mes: string) {
    router.push(`/gerente/cierre?periodo=${mes}`);
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAviso(null);

    const entradas = Object.entries(valores).map(([tareaId, v]) => ({
      tareaId,
      avance: Number(v),
    }));

    const invalida = entradas.find(
      (v) => !Number.isFinite(v.avance) || v.avance < 0 || v.avance > 100,
    );
    if (invalida) {
      setError("Todos los avances deben ser números entre 0 y 100.");
      return;
    }

    // Un acumulado no puede bajar respecto de lo que ya se media antes: si
    // paso, casi siempre es un tipeo, y dejarlo pasar hunde la curva real.
    const retroceso = entradas.find((v) => {
      const f = porTarea.get(v.tareaId);
      return f && v.avance < f.arrastrado;
    });
    if (retroceso) {
      const t = tareas.find((x) => x.id === retroceso.tareaId);
      const f = porTarea.get(retroceso.tareaId)!;
      setError(
        `«${t?.nombre}» ya venía en ${formatearPorcentaje(f.arrastrado)}. ` +
          `El avance acumulado no puede retroceder a ${formatearPorcentaje(retroceso.avance)}.`,
      );
      return;
    }

    setOcupado(true);
    const r = await guardarCierreMensual({ periodo, valores: entradas });
    if (!r.ok) {
      setError(r.error);
      setOcupado(false);
      return;
    }

    const c = await recalcularCurva();
    setOcupado(false);

    if (!c.ok) {
      setAviso(`Mediciones guardadas, pero la curva no se actualizó: ${c.error}`);
    } else {
      setAviso(
        `Cierre de ${formatearPeriodo(periodo)} guardado. Curva actualizada: ` +
          `${c.meses} meses, avance real ${formatearPorcentaje(c.real ?? 0)}.`,
      );
    }
    router.refresh();
  }

  if (tareas.length === 0) {
    return (
      <p className="tarjeta p-6 text-center text-sm text-slate-600">
        No hay tareas en el cronograma. Cargalas primero desde Cronograma.
      </p>
    );
  }

  return (
    <form onSubmit={guardar} className="space-y-5">
      <div className="tarjeta space-y-3 p-4">
        <label className="block">
          <span className="etiqueta">Mes a cerrar</span>
          <input
            type="month"
            className="campo py-2"
            value={periodo.slice(0, 7)}
            onChange={(e) => e.target.value && irA(`${e.target.value}-01`)}
          />
        </label>

        {mesesMedidos.length > 0 && (
          <div>
            <span className="etiqueta">Meses ya medidos</span>
            <div className="flex flex-wrap gap-1.5">
              {mesesMedidos.map((m) => (
                <button
                  key={m.periodo}
                  type="button"
                  onClick={() => irA(m.periodo)}
                  className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${
                    m.periodo === periodo
                      ? "border-marca-600 bg-marca-50 text-marca-700"
                      : "border-slate-300 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {formatearPeriodo(m.periodo)} · {m.tareas}
                </button>
              ))}
            </div>
          </div>
        )}

        <p className="text-xs text-slate-600">
          Los valores arrancan con el <b>acumulado</b> que traía cada tarea del
          mes anterior. Tocá solo las que avanzaron: las demás se guardan igual
          y mantienen su valor.
        </p>
      </div>

      {porGrupo.map(({ grupo, frentes }) => (
        <div key={grupo} className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
            {grupo}
          </h2>
          {frentes.map((f) => (
            <div key={f.id} className="tarjeta overflow-hidden">
              <h3 className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-800">
                {f.nombre}
              </h3>
              <ul className="divide-y divide-slate-100">
                {f.items.map((t) => {
                  const fila = porTarea.get(t.id);
                  return (
                    <li key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-slate-800">
                          {t.nombre}
                        </span>
                        <span className="block text-xs text-slate-500">
                          {t.inicio} → {t.fin}
                          {fila && !fila.medido && fila.arrastrado > 0 && (
                            <> · viene de {formatearPorcentaje(fila.arrastrado)}</>
                          )}
                          {fila?.medido && <> · ya medido este mes</>}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1">
                        <input
                          type="number"
                          step="0.1"
                          min={0}
                          max={100}
                          aria-label={`Avance de ${t.nombre}`}
                          className="campo w-20 py-1.5 text-right"
                          value={valores[t.id] ?? "0"}
                          onChange={(e) =>
                            setValores((v) => ({ ...v, [t.id]: e.target.value }))
                          }
                        />
                        <span className="text-xs text-slate-500">%</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      ))}

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {aviso && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">{aviso}</p>}

      <button type="submit" disabled={ocupado} className="boton w-full">
        {ocupado ? "Guardando…" : `Guardar cierre de ${formatearPeriodo(periodo)}`}
      </button>
    </form>
  );
}
