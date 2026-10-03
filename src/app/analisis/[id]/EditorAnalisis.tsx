"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import AdjuntosExistentes from "@/components/AdjuntosExistentes";
import SelectorArchivos from "@/components/SelectorArchivos";
import type { ArchivoFirmado } from "@/lib/adjuntos.servidor";
import { BUCKET_ANALISIS, LIMITE_ANALISIS, type Archivo } from "@/lib/archivos";
import { crearClienteNavegador } from "@/lib/supabase/cliente";
import { subirArchivos } from "@/lib/subir";
import { FRENTES_PRINCIPALES, type AnalisisExpandido, type Frente } from "@/lib/tipos";
import { actualizarAnalisis } from "../acciones";

export default function EditorAnalisis({
  analisis,
  adjuntos,
  frentes,
  usuarioId,
}: {
  analisis: AnalisisExpandido;
  adjuntos: ArchivoFirmado[];
  frentes: Frente[];
  usuarioId: string;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [titulo, setTitulo] = useState(analisis.titulo);
  const [descripcion, setDescripcion] = useState(analisis.descripcion);
  const [frenteId, setFrenteId] = useState(analisis.frente_de_trabajo_id ?? "");
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

  const sinTitulo = titulo.trim().length === 0;

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
          BUCKET_ANALISIS,
          `${usuarioId}/${analisis.id}`,
          nuevos,
          setPaso,
        );
      }

      setPaso("Guardando…");
      const r = await actualizarAnalisis({
        id: analisis.id,
        titulo,
        descripcion,
        frenteId: frenteId || null,
        archivos: [
          ...conservados.map(({ ruta, nombre, tipo, tamano }) => ({
            ruta,
            nombre,
            tipo,
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

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="boton-secundario no-imprimir py-2 text-sm"
      >
        Editar análisis
      </button>
    );
  }

  return (
    <form onSubmit={guardar} className="tarjeta no-imprimir space-y-5 p-4">
      <h2 className="font-semibold text-slate-900">Editar análisis</h2>

      <div>
        <label htmlFor="a-titulo" className="etiqueta">
          Título
        </label>
        <input
          id="a-titulo"
          className="campo"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
        />
      </div>

      <div>
        <label htmlFor="a-frente" className="etiqueta">
          Frente de trabajo — opcional
        </label>
        <select
          id="a-frente"
          className="campo"
          value={frenteId}
          onChange={(e) => setFrenteId(e.target.value)}
        >
          <option value="">Proyecto completo</option>
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
        <label htmlFor="a-descripcion" className="etiqueta">
          Análisis
        </label>
        <textarea
          id="a-descripcion"
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
        limiteBytes={LIMITE_ANALISIS}
        deshabilitado={ocupado}
      />

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div className="flex gap-2">
        <button type="submit" disabled={ocupado || sinTitulo} className="boton flex-1">
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
