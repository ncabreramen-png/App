"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { crearClienteNavegador } from "@/lib/supabase/cliente";

export default function FormularioLogin() {
  const router = useRouter();
  const params = useSearchParams();
  const siguiente = params.get("siguiente") ?? "/";

  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);

    const supabase = crearClienteNavegador();
    const { error } = await supabase.auth.signInWithPassword({
      email: correo.trim(),
      password: contrasena,
    });

    if (error) {
      setError(
        error.message === "Invalid login credentials"
          ? "Correo o contraseña incorrectos."
          : error.message,
      );
      setEnviando(false);
      return;
    }

    router.replace(siguiente);
    router.refresh();
  }

  return (
    <form onSubmit={enviar} className="tarjeta space-y-4 p-6">
      <div>
        <label htmlFor="correo" className="etiqueta">
          Correo
        </label>
        <input
          id="correo"
          type="email"
          autoComplete="email"
          required
          className="campo"
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
          placeholder="nombre@empresa.com"
        />
      </div>

      <div>
        <label htmlFor="contrasena" className="etiqueta">
          Contraseña
        </label>
        <input
          id="contrasena"
          type="password"
          autoComplete="current-password"
          required
          className="campo"
          value={contrasena}
          onChange={(e) => setContrasena(e.target.value)}
        />
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <button type="submit" className="boton w-full" disabled={enviando}>
        {enviando ? "Ingresando…" : "Ingresar"}
      </button>
    </form>
  );
}
