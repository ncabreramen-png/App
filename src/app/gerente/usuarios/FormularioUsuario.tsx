"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { DISCIPLINAS, ROLES } from "@/lib/tipos";

export default function FormularioUsuario() {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setEnviando(true);

    const datos = Object.fromEntries(new FormData(e.currentTarget));

    const respuesta = await fetch("/api/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(datos),
    });
    const cuerpo = await respuesta.json();

    setEnviando(false);

    if (!respuesta.ok) {
      setError(cuerpo.error ?? "No se pudo crear el usuario.");
      return;
    }

    e.currentTarget.reset();
    setAbierto(false);
    router.refresh();
  }

  if (!abierto) {
    return (
      <button onClick={() => setAbierto(true)} className="boton">
        + Nuevo usuario
      </button>
    );
  }

  return (
    <form onSubmit={enviar} className="tarjeta space-y-4 p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="etiqueta">Nombre</span>
          <input name="nombre" required className="campo py-2" />
        </label>
        <label className="block">
          <span className="etiqueta">Correo</span>
          <input name="correo" type="email" required className="campo py-2" />
        </label>
        <label className="block">
          <span className="etiqueta">Contraseña (mínimo 8 caracteres)</span>
          <input
            name="contrasena"
            type="text"
            minLength={8}
            required
            className="campo py-2"
          />
        </label>
        <label className="block">
          <span className="etiqueta">Disciplina</span>
          <select name="disciplina" required defaultValue="" className="campo py-2">
            <option value="" disabled>
              Seleccioná…
            </option>
            {DISCIPLINAS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="etiqueta">Rol</span>
          <select name="rol" required defaultValue="Campo" className="campo py-2">
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div className="flex gap-2">
        <button type="submit" disabled={enviando} className="boton">
          {enviando ? "Creando…" : "Crear usuario"}
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
