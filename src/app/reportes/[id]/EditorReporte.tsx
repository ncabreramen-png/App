"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import AdjuntosExistentes from "@/components/AdjuntosExistentes";
import SelectorArchivos from "@/components/SelectorArchivos";
import type { ArchivoFirmado } from "@/lib/adjuntos.servidor";
import { BUCKET_REPORTES, LIMITE_REPORTE, type Archivo } from "@/lib/archivos";
import { crearClienteNavegador } from "@/lib/supabase/cliente";
import { subirArchivos } from "@/lib/subir";
import {
  FRENTES_PRINCIPALES,
  TIPOS_DE_REPORTE,
  type Frente,
  type ReporteExpandido,
  type TipoDeReporte,
} from "@/lib/tipos";
import { borrarReporte, editarReporte } from "./acciones";

export default function EditorReporte({
  reporte,
  adjuntos,
  frentes,
  usuarioId,
}: {
  reporte: ReporteExpandido;
  adjuntos: ArchivoFirmado[];
  frentes: Frente[];
  usuarioId: string;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false);

  const [frenteId, setFrenteId] = useState(reporte.frente_de_trabajo_id);
  const [tipo, setTipo] = useState<TipoDeReporte>(reporte.tipo_de_reporte);
  const [descripcion, setDescripcion] = useState(reporte.descripcion);
  const [conservados, setConservados] = useState<ArchivoFirmado[]>(adjuntos);
  const [nuevos, setNuevos] = useState<File[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [paso, setPaso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const porGrupo = useMemo(
    () =>
      FRENTES_PRINCIPALES.map((grupo) => ({
        grupo,
        items: frentes.filter((f) => f.frente_principal === grupo),
      })).filter((g) => g.items.length > 0),
    [frentes],
  );

  const sinDescripcion = descripcion.trim().length === 0;

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOcupado(true);

    try {
      let agregados: Archivo[] = [];
      if (nuevos.length > 0) {
        const supabase = crearClienteNavegador();
        agregados = await subirArchivos(
          supabase,
          BUCKET_REPORTES,
          `${usuarioId}/${crypto.randomUUID()}`,
          nuevos,
          setPaso,
        );
      }

      setPaso("Guardando…");
      const r = await editarReporte({
        id: reporte.id,
        frenteId,
        tipo,
        descripcion,
        // Se vuelve a guardar solo lo que quedo, sin la URL firmada.
        archivos: [
          ...conservados.map(({ ruta, nombre, tipo: t, tamano }) => ({
            ruta,
            nombre,
            tipo: t,
            tamano,
          })),
          ...agregados,
        ],
      });

      if (!r.ok) {
        setError(r.error);
        setOcupado(false);
        setPaso(null);
        return;
      }

      setAbierto(false);
      setNuevos([]);
      setOcupado(false);
      setPaso(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocurrió un error inesperado.");
      setOcupado(false);
      setPaso(null);
    }
  }

  async function borrar() {
    setError(null);
    setOcupado(true);
    const r = await borrarReporte(reporte.id);
    if (!r.ok) {
      setError(r.error);
      setOcupado(false);
      return;
    }
    router.replace("/gerente/reportes");
    router.refresh();
  }

  if (!abierto) {
    return (
      <div className="no-imprimir space-y-3">
        <div className="flex flex-wrap gap-3">
          <button onClick={() => setAbierto(true)} className="boton-secundario py-2 text-sm">
            Editar reporte
          </button>
          {!confirmandoBorrado && (
            <button
              onClick={() => setConfirmandoBorrado(true)}
              className="py-2 text-sm font-medium text-slate-500 hover:text-red-700"
            >
              Borrar
            </button>
          )}
        </div>

        {confirmandoBorrado && (
          <div className="tarjeta space-y-3 border-red-200 p-4">
            <p className="text-sm text-slate-700">
              Se va a borrar este reporte junto con sus adjuntos. No se puede
              deshacer, y el semáforo del frente se recalcula.
            </p>
            {error && <p className="text-sm text-red-700">{error}</p>}
            <div className="flex gap-2">
              <button
                onClick={borrar}
                disabled={ocupado}
                className="boton bg-red-600 py-2 hover:bg-red-700"
              >
                {ocupado ? "Borrando…" : "Confirmar borrado"}
              </button>
              <button
                onClick={() => setConfirmandoBorrado(false)}
                className="boton-secundario py-2"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={guardar} className="tarjeta no-imprimir space-y-5 p-4">
      <h2 className="font-semibold text-slate-900">Editar reporte</h2>

      <div>
        <label htmlFor="e-frente" className="etiqueta">
          Frente de trabajo
        </label>
        <select
          id="e-frente"
          className="campo"
          value={frenteId}
          onChange={(e) => setFrenteId(e.target.value)}
        >
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
      </div>

      <div>
        <label htmlFor="e-tipo" className="etiqueta">
          Tipo de reporte
        </label>
        <select
          id="e-tipo"
          className="campo"
          value={tipo}
          onChange={(e) => setTipo(e.target.value as TipoDeReporte)}
        >
          {TIPOS_DE_REPORTE.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <p className="mt-1.5 text-xs text-slate-500">
          Cambiar el tipo o el frente recalcula el semáforo. El estatus se sigue
          resolviendo desde Aprobaciones.
        </p>
      </div>

      <div>
        <label htmlFor="e-descripcion" className="etiqueta">
          Descripción
        </label>
        <textarea
          id="e-descripcion"
          className="campo min-h-32"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
        />
      </div>

      <AdjuntosExistentes
        archivos={conservados}
        onQuitar={(ruta) => setConservados((xs) => xs.filter((a) => a.ruta !== ruta))}
        deshabilitado={ocupado}
      />

      <SelectorArchivos
        archivos={nuevos}
        onCambio={setNuevos}
        limiteBytes={LIMITE_REPORTE}
        deshabilitado={ocupado}
      />

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div className="flex gap-2">
        <button type="submit" disabled={ocupado || sinDescripcion} className="boton flex-1">
          {ocupado ? (paso ?? "Guardando…") : "Guardar cambios"}
        </button>
        <button
          type="button"
          onClick={() => {
            setAbierto(false);
            setConservados(adjuntos);
            setNuevos([]);
            setError(null);
          }}
          className="boton-secundario"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
