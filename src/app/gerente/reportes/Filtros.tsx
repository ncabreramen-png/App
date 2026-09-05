"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  DISCIPLINAS,
  ESTATUS_REPORTE,
  FRENTES_PRINCIPALES,
  TIPOS_DE_REPORTE,
  type Frente,
} from "@/lib/tipos";

type Valores = {
  frente?: string;
  disciplina?: string;
  tipo?: string;
  estatus?: string;
};

export default function Filtros({
  frentes,
  valores,
}: {
  frentes: Frente[];
  valores: Valores;
}) {
  const router = useRouter();
  const params = useSearchParams();

  function cambiar(clave: string, valor: string) {
    const nuevos = new URLSearchParams(params.toString());
    if (valor) nuevos.set(clave, valor);
    else nuevos.delete(clave);
    router.replace(`/gerente/reportes?${nuevos.toString()}`);
  }

  const hayFiltros = Object.values(valores).some(Boolean);

  return (
    <div className="no-imprimir tarjeta space-y-3 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="etiqueta">Frente de trabajo</span>
          <select
            className="campo py-2"
            value={valores.frente ?? ""}
            onChange={(e) => cambiar("frente", e.target.value)}
          >
            <option value="">Todos</option>
            {FRENTES_PRINCIPALES.map((grupo) => {
              const items = frentes.filter((f) => f.frente_principal === grupo);
              if (items.length === 0) return null;
              return (
                <optgroup key={grupo} label={grupo}>
                  {items.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nombre}
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </select>
        </label>

        <label className="block">
          <span className="etiqueta">Disciplina</span>
          <select
            className="campo py-2"
            value={valores.disciplina ?? ""}
            onChange={(e) => cambiar("disciplina", e.target.value)}
          >
            <option value="">Todas</option>
            {DISCIPLINAS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="etiqueta">Tipo</span>
          <select
            className="campo py-2"
            value={valores.tipo ?? ""}
            onChange={(e) => cambiar("tipo", e.target.value)}
          >
            <option value="">Todos</option>
            {TIPOS_DE_REPORTE.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="etiqueta">Estatus</span>
          <select
            className="campo py-2"
            value={valores.estatus ?? ""}
            onChange={(e) => cambiar("estatus", e.target.value)}
          >
            <option value="">Todos</option>
            {ESTATUS_REPORTE.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>

      {hayFiltros && (
        <button
          onClick={() => router.replace("/gerente/reportes")}
          className="text-sm font-medium text-marca-600 hover:underline"
        >
          Limpiar filtros
        </button>
      )}
    </div>
  );
}
