"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import SelectorArchivos from "@/components/SelectorArchivos";
import { crearClienteNavegador } from "@/lib/supabase/cliente";
import { subirArchivos } from "@/lib/subir";
import { BUCKET_NC, LIMITE_REPORTE, type Archivo } from "@/lib/archivos";
import { FRENTES_PRINCIPALES, type Frente } from "@/lib/tipos";
import { crearNoConformidad } from "./acciones";

export default function FormularioNC({
  frentes,
  usuarioId,
}: {
  frentes: Frente[];
  usuarioId: string;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [frenteId, setFrenteId] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [detectadaEn, setDetectadaEn] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [archivos, setArchivos] = useState<File[]>([]);
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

  const incompleto = descripcion.trim().length === 0 || !frenteId;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOcupado(true);

    try {
      let adjuntos: Archivo[] = [];
      if (archivos.length > 0) {
        const supabase = crearClienteNavegador();
        adjuntos = await subirArchivos(
          supabase,
          BUCKET_NC,
          `${usuarioId}/${crypto.randomUUID()}`,
          archivos,
          setPaso,
        );
      }

      setPaso("Guardando…");
      const r = await crearNoConformidad({
        frenteId,
        descripcion,
        detectadaEn,
        archivos: adjuntos,
      });

      if (!r.ok) {
        setError(r.error);
        setOcupado(false);
        setPaso(null);
        return;
      }

      setAbierto(false);
      setFrenteId("");
      setDescripcion("");
      setArchivos([]);
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
      <button onClick={() => setAbierto(true)} className="boton">
        + Levantar no conformidad
      </button>
    );
  }

  return (
    <form onSubmit={enviar} className="tarjeta space-y-5 p-4">
      <h2 className="font-semibold text-slate-900">Nueva no conformidad</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="etiqueta">Frente de trabajo</span>
          <select
            className="campo"
            required
            value={frenteId}
            onChange={(e) => setFrenteId(e.target.value)}
          >
            <option value="">Seleccioná un frente…</option>
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

        <label className="block">
          <span className="etiqueta">Fecha de detección</span>
          <input
            type="date"
            className="campo"
            required
            value={detectadaEn}
            onChange={(e) => setDetectadaEn(e.target.value)}
          />
        </label>
      </div>

      <div>
        <label htmlFor="nc-desc" className="etiqueta">
          Descripción
        </label>
        <textarea
          id="nc-desc"
          className="campo min-h-32"
          required
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder="Qué se incumple, respecto de qué especificación y dónde."
        />
      </div>

      <SelectorArchivos
        archivos={archivos}
        onCambio={setArchivos}
        limiteBytes={LIMITE_REPORTE}
        deshabilitado={ocupado}
      />

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div className="flex gap-2">
        <button type="submit" disabled={ocupado || incompleto} className="boton flex-1">
          {ocupado ? (paso ?? "Guardando…") : "Registrar"}
        </button>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="boton-secundario"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
