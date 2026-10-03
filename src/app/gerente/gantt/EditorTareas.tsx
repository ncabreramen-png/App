"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  FRENTES_PRINCIPALES,
  formatearPorcentaje,
  type Frente,
  type TareaExpandida,
} from "@/lib/tipos";
import { borrarTarea, guardarTarea, importarTareas, recalcularCurva } from "./acciones";

export default function EditorTareas({
  tareas,
  frentes,
}: {
  tareas: TareaExpandida[];
  frentes: Frente[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [modoImportar, setModoImportar] = useState(false);
  const [editando, setEditando] = useState<TareaExpandida | null>(null);

  const porGrupo = useMemo(
    () =>
      FRENTES_PRINCIPALES.map((grupo) => ({
        grupo,
        items: frentes.filter((f) => f.frente_principal === grupo),
      })).filter((g) => g.items.length > 0),
    [frentes],
  );

  async function correr<T extends { ok: boolean; error?: string }>(
    fn: () => Promise<T>,
    exito?: (r: T) => string,
  ) {
    setError(null);
    setAviso(null);
    setOcupado(true);
    const r = await fn();
    setOcupado(false);
    if (!r.ok) {
      setError(r.error ?? "No se pudo completar la operación.");
      return false;
    }
    if (exito) setAviso(exito(r));
    router.refresh();
    return true;
  }

  async function guardar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const d = new FormData(form);
    const pesoCrudo = String(d.get("peso") ?? "").trim();
    const ok = await correr(() =>
      guardarTarea({
        id: editando?.id,
        frenteId: String(d.get("frente") ?? ""),
        nombre: String(d.get("nombre") ?? ""),
        inicio: String(d.get("inicio") ?? ""),
        fin: String(d.get("fin") ?? ""),
        peso: pesoCrudo === "" ? null : Number(pesoCrudo),
      }),
    );
    if (ok) {
      form.reset();
      setEditando(null);
    }
  }

  async function importar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const ok = await correr(
      () => importarTareas(String(d.get("texto") ?? "")),
      (r) => `Se cargaron ${(r as { filas?: number }).filas} tareas.`,
    );
    if (ok) setModoImportar(false);
  }

  return (
    <div className="space-y-5">
      <div className="tarjeta space-y-3 p-4">
        <h2 className="font-semibold text-slate-900">Volcar el cronograma a la curva</h2>
        <p className="text-sm text-slate-600">
          Recalcula el avance programado de todos los meses a partir de las
          fechas de las tareas, y sella el avance real de hoy en el mes
          corriente. Los meses anteriores conservan el valor que ya tenían.
        </p>
        <button
          onClick={() =>
            correr(
              () => recalcularCurva(),
              (r) => {
                const x = r as { meses?: number; real?: number };
                return `Curva actualizada: ${x.meses} meses. Avance real de hoy: ${formatearPorcentaje(x.real ?? 0)}.`;
              },
            )
          }
          disabled={ocupado || tareas.length === 0}
          className="boton"
        >
          {ocupado ? "Calculando…" : "Actualizar curva desde el Gantt"}
        </button>
      </div>

      <form onSubmit={guardar} className="tarjeta space-y-4 p-4">
        <h2 className="font-semibold text-slate-900">
          {editando ? `Editar «${editando.nombre}»` : "Agregar una tarea"}
        </h2>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="etiqueta">Frente de trabajo</span>
            <select
              name="frente"
              required
              defaultValue={editando?.frente_de_trabajo_id ?? ""}
              key={`f-${editando?.id ?? "nuevo"}`}
              className="campo py-2"
            >
              <option value="">Seleccioná…</option>
              {porGrupo.map(({ grupo, items }) => (
                <optgroup key={grupo} label={grupo}>
                  {items.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nombre}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>

          <label className="block sm:col-span-2">
            <span className="etiqueta">Tarea</span>
            <input
              name="nombre"
              required
              defaultValue={editando?.nombre ?? ""}
              key={`n-${editando?.id ?? "nuevo"}`}
              className="campo py-2"
              placeholder="Ej: Excavación tramo 5 al 6"
            />
          </label>

          <label className="block">
            <span className="etiqueta">Inicio</span>
            <input
              name="inicio"
              type="date"
              required
              defaultValue={editando?.inicio ?? ""}
              key={`i-${editando?.id ?? "nuevo"}`}
              className="campo py-2"
            />
          </label>

          <label className="block">
            <span className="etiqueta">Fin</span>
            <input
              name="fin"
              type="date"
              required
              defaultValue={editando?.fin ?? ""}
              key={`x-${editando?.id ?? "nuevo"}`}
              className="campo py-2"
            />
          </label>

          <label className="block">
            <span className="etiqueta">Peso — opcional</span>
            <input
              name="peso"
              type="number"
              step="0.01"
              min={0.01}
              defaultValue={editando?.peso ?? ""}
              key={`p-${editando?.id ?? "nuevo"}`}
              className="campo py-2"
              placeholder="por duración"
            />
          </label>
        </div>

        <p className="text-xs text-slate-500">
          Sin peso, la tarea pondera por su duración en días. Cargalo solo si
          una actividad corta pesa más que una larga dentro del frente.
          <br />
          El <b>avance no se carga acá</b>: se mide mes a mes desde{" "}
          <a href="/gerente/cierre" className="font-medium text-marca-600 hover:underline">
            Cierre mensual
          </a>
          .
        </p>

        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={ocupado} className="boton">
            {ocupado ? "Guardando…" : editando ? "Guardar cambios" : "Agregar tarea"}
          </button>
          {editando && (
            <button
              type="button"
              onClick={() => setEditando(null)}
              className="boton-secundario"
            >
              Cancelar
            </button>
          )}
          {!editando && (
            <button
              type="button"
              onClick={() => setModoImportar((v) => !v)}
              className="boton-secundario"
            >
              {modoImportar ? "Cerrar carga masiva" : "Carga masiva"}
            </button>
          )}
        </div>
      </form>

      {modoImportar && (
        <form onSubmit={importar} className="tarjeta space-y-3 p-4">
          <h2 className="font-semibold text-slate-900">Pegar el cronograma</h2>
          <p className="text-xs text-slate-600">
            Una línea por tarea, separando con barras:
            <br />
            <code>Frente | Tarea | Inicio | Fin | Avance</code>
            <br />
            El nombre del frente tiene que coincidir con uno de los 12. El
            avance es opcional y se asume 0.
          </p>
          <textarea
            name="texto"
            required
            className="campo min-h-40 font-mono text-xs"
            placeholder={
              "Frente 1 Conchalios | Replanteo | 2026-01-01 | 2026-01-31 | 100\n" +
              "Frente 1 Conchalios | Excavación | 2026-02-01 | 2026-04-30 | 60\n" +
              "Civil | Losa de fondo | 2026-03-01 | 2026-06-30"
            }
          />
          <button type="submit" disabled={ocupado} className="boton">
            Importar
          </button>
        </form>
      )}

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {aviso && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">{aviso}</p>}

      <div className="tarjeta overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Tarea</th>
              <th className="px-4 py-3 font-medium">Frente</th>
              <th className="px-4 py-3 font-medium">Fechas</th>
              <th className="px-4 py-3 text-right font-medium">Avance</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody style={{ fontVariantNumeric: "tabular-nums" }}>
            {tareas.map((t) => (
              <tr key={t.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2.5 text-slate-800">{t.nombre}</td>
                <td className="px-4 py-2.5 text-xs text-slate-600">{t.frente?.nombre ?? "—"}</td>
                <td className="px-4 py-2.5 text-xs text-slate-600">
                  {t.inicio} → {t.fin}
                </td>
                <td className="px-4 py-2.5 text-right text-slate-700">
                  {formatearPorcentaje(t.avance)}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    onClick={() => {
                      setEditando(t);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="mr-3 text-xs font-medium text-marca-600 hover:underline"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => correr(() => borrarTarea(t.id))}
                    disabled={ocupado}
                    className="text-xs font-medium text-slate-500 hover:text-red-700"
                  >
                    Borrar
                  </button>
                </td>
              </tr>
            ))}
            {tareas.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                  Todavía no hay tareas cargadas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
