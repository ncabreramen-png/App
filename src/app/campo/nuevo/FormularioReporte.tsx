"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { crearClienteNavegador } from "@/lib/supabase/cliente";
import { comprimirImagen, nombreSeguro } from "@/lib/imagenes";
import { BUCKET_FOTOS } from "@/lib/fotos.constantes";
import {
  FRENTES_PRINCIPALES,
  TIPOS_DE_REPORTE,
  TIPOS_QUE_NOTIFICAN,
  type Frente,
  type TipoDeReporte,
} from "@/lib/tipos";
import { crearReporte } from "./acciones";

const MAX_FOTOS = 8;

export default function FormularioReporte({
  frentes,
  usuarioId,
}: {
  frentes: Frente[];
  usuarioId: string;
}) {
  const router = useRouter();

  const [frenteId, setFrenteId] = useState("");
  const [tipo, setTipo] = useState<TipoDeReporte>("Avance");
  const [descripcion, setDescripcion] = useState("");
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

  // Se regeneran al cambiar la lista, asi que hay que liberar las anteriores
  // para no dejar objectURLs colgando en el navegador del celular.
  const vistasPrevias = useMemo(
    () => archivos.map((a) => ({ nombre: a.name, url: URL.createObjectURL(a) })),
    [archivos],
  );
  const previasAnteriores = useRef<string[]>([]);

  useEffect(() => {
    previasAnteriores.current.forEach((url) => URL.revokeObjectURL(url));
    previasAnteriores.current = vistasPrevias.map((v) => v.url);
  }, [vistasPrevias]);

  useEffect(
    () => () => previasAnteriores.current.forEach((url) => URL.revokeObjectURL(url)),
    [],
  );

  const descripcionVacia = descripcion.trim().length === 0;

  function agregarArchivos(lista: FileList | null) {
    if (!lista) return;
    const nuevos = Array.from(lista).filter((f) => f.type.startsWith("image/"));
    setArchivos((prev) => [...prev, ...nuevos].slice(0, MAX_FOTOS));
  }

  function quitarArchivo(indice: number) {
    setArchivos((prev) => prev.filter((_, i) => i !== indice));
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (descripcionVacia) {
      setError("La descripción no puede estar vacía.");
      return;
    }
    if (!frenteId) {
      setError("Seleccioná un frente de trabajo.");
      return;
    }

    setEnviando(true);

    try {
      const rutas: string[] = [];

      if (archivos.length > 0) {
        const supabase = crearClienteNavegador();
        const carpeta = `${usuarioId}/${crypto.randomUUID()}`;

        for (let i = 0; i < archivos.length; i++) {
          setPaso(`Subiendo foto ${i + 1} de ${archivos.length}…`);
          const comprimida = await comprimirImagen(archivos[i]);
          const ruta = `${carpeta}/${i + 1}-${nombreSeguro(comprimida.name)}`;

          const { error: errorSubida } = await supabase.storage
            .from(BUCKET_FOTOS)
            .upload(ruta, comprimida, {
              contentType: comprimida.type || "image/jpeg",
              upsert: false,
            });

          if (errorSubida) throw new Error(`No se pudo subir la foto ${i + 1}: ${errorSubida.message}`);
          rutas.push(ruta);
        }
      }

      setPaso("Guardando el reporte…");
      const resultado = await crearReporte({
        frenteId,
        tipo,
        descripcion,
        fotos: rutas,
      });

      if (!resultado.ok) {
        setError(resultado.error);
        setEnviando(false);
        setPaso(null);
        return;
      }

      if (resultado.avisoCorreo) {
        // El reporte quedo guardado: se avisa pero no se bloquea al usuario.
        window.alert(resultado.avisoCorreo);
      }

      router.replace("/campo");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ocurrió un error inesperado.");
      setEnviando(false);
      setPaso(null);
    }
  }

  return (
    <form onSubmit={enviar} className="tarjeta space-y-5 p-4">
      <div>
        <label htmlFor="frente" className="etiqueta">
          Frente de trabajo
        </label>
        <select
          id="frente"
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
      </div>

      <div>
        <label htmlFor="tipo" className="etiqueta">
          Tipo de reporte
        </label>
        <select
          id="tipo"
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
        {tipo === "Orden de cambio" && (
          <p className="mt-1.5 text-xs text-amber-700">
            Queda como <b>Pendiente</b> hasta que el gerente la apruebe o rechace.
          </p>
        )}
        {TIPOS_QUE_NOTIFICAN.includes(tipo) && (
          <p className="mt-1 text-xs text-slate-500">
            Se le envía un correo al gerente al guardar.
          </p>
        )}
      </div>

      <div>
        <label htmlFor="descripcion" className="etiqueta">
          Descripción
        </label>
        <textarea
          id="descripcion"
          className="campo min-h-32"
          required
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder="Qué se observó, dónde y qué se necesita."
        />
      </div>

      <div>
        <span className="etiqueta">Fotos ({archivos.length}/{MAX_FOTOS})</span>
        <div className="flex flex-wrap gap-2">
          <label className="boton-secundario cursor-pointer">
            Tomar foto
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={(e) => {
                agregarArchivos(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
          <label className="boton-secundario cursor-pointer">
            Galería
            <input
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={(e) => {
                agregarArchivos(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
        </div>

        {vistasPrevias.length > 0 && (
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {vistasPrevias.map((v, i) => (
              <div key={v.url} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={v.url}
                  alt={v.nombre}
                  className="aspect-square w-full rounded-lg border border-slate-200 object-cover"
                />
                <button
                  type="button"
                  onClick={() => quitarArchivo(i)}
                  aria-label={`Quitar ${v.nombre}`}
                  className="absolute -right-1.5 -top-1.5 h-6 w-6 rounded-full bg-slate-900 text-sm font-bold text-white"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          className="boton flex-1"
          disabled={enviando || descripcionVacia || !frenteId}
        >
          {enviando ? (paso ?? "Enviando…") : "Enviar reporte"}
        </button>
      </div>
    </form>
  );
}
