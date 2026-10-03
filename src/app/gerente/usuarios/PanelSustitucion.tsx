"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Usuario } from "@/lib/tipos";
import { sustituirUsuario } from "./acciones";

/**
 * Relevo en una sola operacion: registra la sucesion, le pasa el historial al
 * sucesor y corta el acceso del anterior.
 */
export default function PanelSustitucion({
  predecesor,
  candidatos,
  onCerrar,
}: {
  predecesor: Usuario;
  /** Usuarios activos de la misma disciplina. */
  candidatos: Usuario[];
  onCerrar: () => void;
}) {
  const router = useRouter();
  const [modo, setModo] = useState<"nuevo" | "existente">(
    candidatos.length > 0 ? "existente" : "nuevo",
  );
  const [sucesorId, setSucesorId] = useState(candidatos[0]?.id ?? "");
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function confirmar() {
    setError(null);
    setOcupado(true);

    const r = await sustituirUsuario({
      predecesorId: predecesor.id,
      motivo,
      sucesor:
        modo === "existente"
          ? { modo: "existente", id: sucesorId }
          : { modo: "nuevo", nombre, correo, contrasena },
    });

    setOcupado(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    if (r.aviso) window.alert(r.aviso);
    onCerrar();
    router.refresh();
  }

  const listoParaNuevo =
    nombre.trim().length > 0 && correo.includes("@") && contrasena.length >= 8;

  return (
    <div className="space-y-4 rounded-lg border border-marca-100 bg-marca-50 p-4">
      <div>
        <h3 className="font-semibold text-slate-900">
          Sustituir a {predecesor.nombre}
        </h3>
        <p className="mt-0.5 text-sm text-slate-600">
          El sucesor tiene que ser de la misma disciplina:{" "}
          <b>{predecesor.disciplina}</b>.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setModo("existente")}
          disabled={candidatos.length === 0}
          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-40 ${
            modo === "existente"
              ? "border-marca-600 bg-white text-marca-700"
              : "border-slate-300 bg-white text-slate-600"
          }`}
        >
          Alguien que ya está
          {candidatos.length === 0 && " (no hay)"}
        </button>
        <button
          type="button"
          onClick={() => setModo("nuevo")}
          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
            modo === "nuevo"
              ? "border-marca-600 bg-white text-marca-700"
              : "border-slate-300 bg-white text-slate-600"
          }`}
        >
          Dar de alta al sucesor
        </button>
      </div>

      {modo === "existente" ? (
        <label className="block">
          <span className="etiqueta">Sucesor</span>
          <select
            className="campo py-2"
            value={sucesorId}
            onChange={(e) => setSucesorId(e.target.value)}
          >
            {candidatos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre} — {c.correo}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="etiqueta">Nombre</span>
            <input
              className="campo py-2"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="etiqueta">Correo</span>
            <input
              type="email"
              className="campo py-2"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="etiqueta">Contraseña (8+)</span>
            <input
              type="text"
              className="campo py-2"
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
            />
          </label>
        </div>
      )}

      <label className="block">
        <span className="etiqueta">Motivo — opcional</span>
        <input
          className="campo py-2"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Ej: fin de contrato, traslado a otro proyecto"
        />
      </label>

      <p className="rounded-lg bg-white px-3 py-2 text-xs text-slate-600">
        Al confirmar: el sucesor pasa a ver y continuar todo el historial de{" "}
        {predecesor.nombre}, y a {predecesor.nombre} se le corta el acceso.{" "}
        <b>Los reportes siguen firmados por quien los levantó</b> — no se
        reasignan.
      </p>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div className="flex gap-2">
        <button
          onClick={confirmar}
          disabled={
            ocupado || (modo === "existente" ? !sucesorId : !listoParaNuevo)
          }
          className="boton py-2 text-sm"
        >
          {ocupado ? "Registrando…" : "Confirmar sustitución"}
        </button>
        <button onClick={onCerrar} className="boton-secundario py-2 text-sm">
          Cancelar
        </button>
      </div>
    </div>
  );
}
