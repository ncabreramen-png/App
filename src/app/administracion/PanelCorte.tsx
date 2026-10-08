"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import ListaArchivos from "@/components/ListaArchivos";
import type { ArchivoFirmado } from "@/lib/adjuntos.servidor";
import {
  formatearMoneda,
  formatearPeriodo,
  formatearPorcentaje,
  type ReporteAdministracionExpandido,
} from "@/lib/tipos";
import FormularioCorte from "./FormularioCorte";
import { borrarCorte } from "./acciones";

/** "1 estimación" / "3 estimaciones": el plural pierde la tilde. */
function contar(n: number): string {
  return `${n} ${n === 1 ? "estimación" : "estimaciones"}`;
}

export default function PanelCorte({
  corte,
  adjuntos,
  puedeEditar,
  usuarioId,
}: {
  corte: ReporteAdministracionExpandido;
  adjuntos: ArchivoFirmado[];
  puedeEditar: boolean;
  usuarioId: string;
}) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (editando) {
    return (
      <FormularioCorte
        usuarioId={usuarioId}
        corte={corte}
        adjuntos={adjuntos}
        onCerrar={() => setEditando(false)}
      />
    );
  }

  const desvio = Number(corte.avance_real) - Number(corte.avance_programado);
  const porCobrar = Number(corte.importe_autorizado) - Number(corte.importe_pagado);

  async function borrar() {
    setOcupado(true);
    setError(null);
    const r = await borrarCorte(corte.id);
    if (!r.ok) {
      setError(r.error);
      setOcupado(false);
      return;
    }
    setOcupado(false);
    router.refresh();
  }

  return (
    <article className="evitar-corte tarjeta p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-semibold capitalize text-slate-900">
          {formatearPeriodo(corte.periodo)}
        </h3>
        <span className="text-xs text-slate-500">
          Cargado por {corte.autor?.nombre ?? "—"}
        </span>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        <Dato etiqueta="Programado" valor={formatearPorcentaje(corte.avance_programado)} />
        <Dato etiqueta="Real" valor={formatearPorcentaje(corte.avance_real)} />
        <Dato
          etiqueta={desvio < 0 ? "Atraso" : "Adelanto"}
          valor={formatearPorcentaje(desvio, true)}
          tono={desvio < 0 ? "malo" : "bueno"}
        />
        <Dato
          etiqueta="Avance financiero"
          valor={`${formatearMoneda(corte.monto_financiero)} · ${formatearPorcentaje(corte.avance_financiero)}`}
        />
      </dl>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Bloque
          titulo="Estimaciones autorizadas"
          cantidad={corte.estimaciones_autorizadas}
          importe={corte.importe_autorizado}
        />
        <Bloque
          titulo="Estimaciones pagadas"
          cantidad={corte.estimaciones_pagadas}
          importe={corte.importe_pagado}
        />
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-medium text-slate-600">Autorizado sin pagar</p>
          <p className="mt-1 text-lg font-bold text-slate-900">
            {formatearMoneda(porCobrar)}
          </p>
          <p className="text-xs text-slate-500">
            {contar(corte.estimaciones_autorizadas - corte.estimaciones_pagadas)}
          </p>
        </div>
      </div>

      {corte.comentario && (
        <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">
          {corte.comentario}
        </p>
      )}

      <ListaArchivos archivos={adjuntos} />

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {puedeEditar && (
        <div className="no-imprimir mt-4 border-t border-slate-200 pt-3">
          {confirmando ? (
            <div className="space-y-2">
              <p className="text-sm text-slate-700">
                Se va a borrar el corte de {formatearPeriodo(corte.periodo)} con sus
                adjuntos. No se puede deshacer.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={borrar}
                  disabled={ocupado}
                  className="boton bg-red-600 py-2 hover:bg-red-700"
                >
                  {ocupado ? "Borrando…" : "Confirmar borrado"}
                </button>
                <button
                  onClick={() => setConfirmando(false)}
                  className="boton-secundario py-2"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => setEditando(true)}
                className="boton-secundario py-2 text-sm"
              >
                Editar
              </button>
              <button
                onClick={() => setConfirmando(true)}
                className="text-xs font-medium text-slate-500 hover:text-red-700"
              >
                Borrar
              </button>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function Dato({
  etiqueta,
  valor,
  tono,
}: {
  etiqueta: string;
  valor: string;
  tono?: "bueno" | "malo";
}) {
  const color =
    tono === "malo" ? "text-red-700" : tono === "bueno" ? "text-green-700" : "text-slate-900";
  return (
    <div>
      <dt className="text-xs font-medium text-slate-600">{etiqueta}</dt>
      <dd className={`text-base font-bold ${color}`}>{valor}</dd>
    </div>
  );
}

function Bloque({
  titulo,
  cantidad,
  importe,
}: {
  titulo: string;
  cantidad: number;
  importe: number;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-medium text-slate-600">{titulo}</p>
      <p className="mt-1 text-lg font-bold text-slate-900">{formatearMoneda(importe)}</p>
      <p className="text-xs text-slate-500">{contar(cantidad)}</p>
    </div>
  );
}
