"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import AdjuntosExistentes from "@/components/AdjuntosExistentes";
import SelectorArchivos from "@/components/SelectorArchivos";
import type { ArchivoFirmado } from "@/lib/adjuntos.servidor";
import { crearClienteNavegador } from "@/lib/supabase/cliente";
import { subirArchivos } from "@/lib/subir";
import { BUCKET_ADMIN, LIMITE_REPORTE, type Archivo } from "@/lib/archivos";
import type { ReporteAdministracion } from "@/lib/tipos";
import { crearCorte, editarCorte } from "./acciones";

/** Los campos viven como texto para no pelear con el input vacio. */
type Campos = {
  periodo: string;
  avanceProgramado: string;
  avanceReal: string;
  montoFinanciero: string;
  avanceFinanciero: string;
  estimacionesAutorizadas: string;
  importeAutorizado: string;
  estimacionesPagadas: string;
  importePagado: string;
  comentario: string;
};

const VACIO: Campos = {
  periodo: new Date().toISOString().slice(0, 7),
  avanceProgramado: "",
  avanceReal: "",
  montoFinanciero: "",
  avanceFinanciero: "",
  estimacionesAutorizadas: "",
  importeAutorizado: "",
  estimacionesPagadas: "",
  importePagado: "",
  comentario: "",
};

function desde(corte: ReporteAdministracion): Campos {
  return {
    periodo: corte.periodo.slice(0, 7),
    avanceProgramado: String(corte.avance_programado),
    avanceReal: String(corte.avance_real),
    montoFinanciero: String(corte.monto_financiero),
    avanceFinanciero: String(corte.avance_financiero),
    estimacionesAutorizadas: String(corte.estimaciones_autorizadas),
    importeAutorizado: String(corte.importe_autorizado),
    estimacionesPagadas: String(corte.estimaciones_pagadas),
    importePagado: String(corte.importe_pagado),
    comentario: corte.comentario,
  };
}

const num = (s: string) => Number(s === "" ? 0 : s);

export default function FormularioCorte({
  usuarioId,
  corte,
  adjuntos = [],
  onCerrar,
}: {
  usuarioId: string;
  /** Presente = edicion de un corte ya cargado. */
  corte?: ReporteAdministracion;
  adjuntos?: ArchivoFirmado[];
  onCerrar?: () => void;
}) {
  const router = useRouter();
  const editando = corte !== undefined;

  const [abierto, setAbierto] = useState(editando);
  const [campos, setCampos] = useState<Campos>(corte ? desde(corte) : VACIO);
  const [existentes, setExistentes] = useState<ArchivoFirmado[]>(adjuntos);
  const [nuevos, setNuevos] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [paso, setPaso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  function set<K extends keyof Campos>(clave: K, valor: string) {
    setCampos((c) => ({ ...c, [clave]: valor }));
  }

  function cerrar() {
    setAbierto(false);
    onCerrar?.();
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOcupado(true);

    try {
      let subidos: Archivo[] = [];
      if (nuevos.length > 0) {
        const supabase = crearClienteNavegador();
        subidos = await subirArchivos(
          supabase,
          BUCKET_ADMIN,
          `${usuarioId}/${crypto.randomUUID()}`,
          nuevos,
          setPaso,
        );
      }

      const archivos: Archivo[] = [
        ...existentes.map(({ ruta, nombre, tipo, tamano }) => ({
          ruta,
          nombre,
          tipo,
          tamano,
        })),
        ...subidos,
      ];

      const cifras = {
        periodo: campos.periodo,
        avanceProgramado: num(campos.avanceProgramado),
        avanceReal: num(campos.avanceReal),
        montoFinanciero: num(campos.montoFinanciero),
        avanceFinanciero: num(campos.avanceFinanciero),
        estimacionesAutorizadas: num(campos.estimacionesAutorizadas),
        importeAutorizado: num(campos.importeAutorizado),
        estimacionesPagadas: num(campos.estimacionesPagadas),
        importePagado: num(campos.importePagado),
        comentario: campos.comentario,
      };

      setPaso("Guardando…");
      const r = editando
        ? await editarCorte({ id: corte.id, cifras, archivos })
        : await crearCorte({ cifras, archivos });

      if (!r.ok) {
        setError(r.error);
        setOcupado(false);
        setPaso(null);
        return;
      }

      if (!editando) setCampos(VACIO);
      setNuevos([]);
      setOcupado(false);
      setPaso(null);
      cerrar();
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
        + Nuevo corte mensual
      </button>
    );
  }

  return (
    <form onSubmit={enviar} className="tarjeta space-y-5 p-4">
      <div>
        <h2 className="font-semibold text-slate-900">
          {editando ? "Corregir el corte" : "Nuevo corte mensual"}
        </h2>
        <p className="mt-0.5 text-sm text-slate-600">
          Las cantidades y los importes son acumulados al cierre del mes, no lo del
          mes solo.
        </p>
      </div>

      <label className="block sm:max-w-xs">
        <span className="etiqueta">Mes del corte</span>
        <input
          type="month"
          className="campo"
          required
          disabled={ocupado}
          value={campos.periodo}
          onChange={(e) => set("periodo", e.target.value)}
        />
      </label>

      <fieldset className="space-y-3">
        <legend className="etiqueta">Avance de obra</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Numero
            etiqueta="Avance programado (%)"
            valor={campos.avanceProgramado}
            onCambio={(v) => set("avanceProgramado", v)}
            paso="0.1"
            max={100}
            requerido
            deshabilitado={ocupado}
          />
          <Numero
            etiqueta="Avance real (%)"
            valor={campos.avanceReal}
            onCambio={(v) => set("avanceReal", v)}
            paso="0.1"
            max={100}
            requerido
            deshabilitado={ocupado}
          />
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="etiqueta">Avance financiero</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Numero
            etiqueta="Monto ejecutado ($)"
            valor={campos.montoFinanciero}
            onCambio={(v) => set("montoFinanciero", v)}
            paso="0.01"
            deshabilitado={ocupado}
          />
          <Numero
            etiqueta="Avance financiero (%)"
            valor={campos.avanceFinanciero}
            onCambio={(v) => set("avanceFinanciero", v)}
            paso="0.1"
            max={100}
            deshabilitado={ocupado}
          />
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="etiqueta">Estimaciones autorizadas</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Numero
            etiqueta="Cantidad"
            valor={campos.estimacionesAutorizadas}
            onCambio={(v) => set("estimacionesAutorizadas", v)}
            paso="1"
            deshabilitado={ocupado}
          />
          <Numero
            etiqueta="Importe ($)"
            valor={campos.importeAutorizado}
            onCambio={(v) => set("importeAutorizado", v)}
            paso="0.01"
            deshabilitado={ocupado}
          />
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="etiqueta">Estimaciones pagadas</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Numero
            etiqueta="Cantidad"
            valor={campos.estimacionesPagadas}
            onCambio={(v) => set("estimacionesPagadas", v)}
            paso="1"
            deshabilitado={ocupado}
          />
          <Numero
            etiqueta="Importe ($)"
            valor={campos.importePagado}
            onCambio={(v) => set("importePagado", v)}
            paso="0.01"
            deshabilitado={ocupado}
          />
        </div>
      </fieldset>

      <div>
        <label htmlFor="admin-comentario" className="etiqueta">
          Comentario
        </label>
        <textarea
          id="admin-comentario"
          className="campo min-h-28"
          disabled={ocupado}
          value={campos.comentario}
          onChange={(e) => set("comentario", e.target.value)}
          placeholder="Trámites en curso, retenciones, observaciones del período."
        />
      </div>

      {editando && (
        <AdjuntosExistentes
          archivos={existentes}
          onQuitar={(ruta) => setExistentes((a) => a.filter((x) => x.ruta !== ruta))}
          deshabilitado={ocupado}
        />
      )}

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
        <button type="submit" disabled={ocupado} className="boton flex-1">
          {ocupado ? (paso ?? "Guardando…") : editando ? "Guardar cambios" : "Registrar"}
        </button>
        <button
          type="button"
          onClick={cerrar}
          disabled={ocupado}
          className="boton-secundario"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

function Numero({
  etiqueta,
  valor,
  onCambio,
  paso,
  max,
  requerido = false,
  deshabilitado = false,
}: {
  etiqueta: string;
  valor: string;
  onCambio: (v: string) => void;
  paso: string;
  max?: number;
  requerido?: boolean;
  deshabilitado?: boolean;
}) {
  return (
    <label className="block">
      <span className="etiqueta">{etiqueta}</span>
      <input
        type="number"
        className="campo"
        inputMode="decimal"
        min={0}
        max={max}
        step={paso}
        required={requerido}
        disabled={deshabilitado}
        value={valor}
        onChange={(e) => onCambio(e.target.value)}
        placeholder="0"
      />
    </label>
  );
}
