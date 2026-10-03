"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import SelectorArchivos from "@/components/SelectorArchivos";
import { crearClienteNavegador } from "@/lib/supabase/cliente";
import { subirArchivos } from "@/lib/subir";
import { BUCKET_ANALISIS, LIMITE_ANALISIS, type Archivo } from "@/lib/archivos";
import { FRENTES_PRINCIPALES, type Frente } from "@/lib/tipos";
import { crearAnalisis } from "../acciones";

export default function FormularioAnalisis({
  frentes,
  usuarioId,
}: {
  frentes: Frente[];
  usuarioId: string;
}) {
  const router = useRouter();

  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [frenteId, setFrenteId] = useState("");
  const [archivos, setArchivos] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [paso, setPaso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const porGrupo = useMemo(
    () =>
      FRENTES_PRINCIPALES.map((grupo) => ({
        grupo,
        items: frentes.filter((f) => f.frente_principal === grupo),
      })).filter((g) => g.items.length > 0),
    [frentes],
  );

  const sinTitulo = titulo.trim().length === 0;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (sinTitulo) {
      setError("El título no puede estar vacío.");
      return;
    }

    setEnviando(true);

    try {
      // El id se genera antes de subir: la ruta en Storage lo necesita para
      // que luego el permiso de lectura se resuelva por carpeta.
      const id = crypto.randomUUID();
      let adjuntos: Archivo[] = [];

      if (archivos.length > 0) {
        const supabase = crearClienteNavegador();
        adjuntos = await subirArchivos(
          supabase,
          BUCKET_ANALISIS,
          `${usuarioId}/${id}`,
          archivos,
          setPaso,
        );
      }

      setPaso("Guardando el análisis…");
      const r = await crearAnalisis({
        id,
        titulo,
        descripcion,
        frenteId: frenteId || null,
        archivos: adjuntos,
      });

      if (!r.ok) {
        setError(r.error);
        setEnviando(false);
        setPaso(null);
        return;
      }

      router.replace(`/analisis/${r.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocurrió un error inesperado.");
      setEnviando(false);
      setPaso(null);
    }
  }

  return (
    <form onSubmit={enviar} className="tarjeta space-y-5 p-4">
      <div>
        <label htmlFor="titulo" className="etiqueta">
          Título
        </label>
        <input
          id="titulo"
          className="campo"
          required
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Ej: Revisión de planos estructurales PTAR"
        />
      </div>

      <div>
        <label htmlFor="frente" className="etiqueta">
          Frente de trabajo — opcional
        </label>
        <select
          id="frente"
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
        <label htmlFor="descripcion" className="etiqueta">
          Análisis
        </label>
        <textarea
          id="descripcion"
          className="campo min-h-32"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder="Observaciones, conclusiones, qué hay que revisar."
        />
      </div>

      <SelectorArchivos
        archivos={archivos}
        onCambio={setArchivos}
        limiteBytes={LIMITE_ANALISIS}
        deshabilitado={enviando}
      />

      <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
        Se guarda como <b>privado</b>. Solo vos lo vas a ver hasta que elijas con
        quién compartirlo, desde la pantalla del análisis.
      </p>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <button type="submit" className="boton w-full" disabled={enviando || sinTitulo}>
        {enviando ? (paso ?? "Guardando…") : "Guardar análisis"}
      </button>
    </form>
  );
}
