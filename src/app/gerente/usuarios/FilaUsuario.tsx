"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { DISCIPLINAS, ROLES, type Usuario } from "@/lib/tipos";
import PanelSustitucion from "./PanelSustitucion";
import {
  borrarUsuario,
  cambiarActivo,
  editarUsuario,
  restablecerContrasena,
} from "./acciones";

/**
 * Una fila de la lista de usuarios, con sus acciones.
 *
 * Borrar y desactivar no son lo mismo: desactivar corta el acceso y conserva
 * la autoria del historial; borrar solo procede cuando no hay historial que
 * perder, y la accion del servidor lo verifica.
 */
export default function FilaUsuario({
  usuario,
  esUnoMismo,
  dependencias,
  candidatos,
  relevo,
}: {
  usuario: Usuario;
  esUnoMismo: boolean;
  dependencias: number;
  /** Activos de la misma disciplina, posibles sucesores. */
  candidatos: Usuario[];
  relevo?: { sustituyeA?: string; sustituidoPor?: string };
}) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [sustituyendo, setSustituyendo] = useState(false);
  const [cambiandoClave, setCambiandoClave] = useState(false);
  const [clave, setClave] = useState("");
  const [nombre, setNombre] = useState(usuario.nombre);
  const [disciplina, setDisciplina] = useState<string>(usuario.disciplina);
  const [rol, setRol] = useState<string>(usuario.rol);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function correr(fn: () => Promise<{ ok: boolean; error?: string; aviso?: string }>) {
    setError(null);
    setAviso(null);
    setOcupado(true);
    const r = await fn();
    setOcupado(false);
    if (!r.ok) {
      setError(r.error ?? "No se pudo completar la operación.");
      return false;
    }
    if (r.aviso) setAviso(r.aviso);
    router.refresh();
    return true;
  }

  if (sustituyendo) {
    return (
      <tr className="border-b border-slate-100 last:border-0">
        <td colSpan={5} className="px-4 py-3">
          <PanelSustitucion
            predecesor={usuario}
            candidatos={candidatos}
            onCerrar={() => setSustituyendo(false)}
          />
        </td>
      </tr>
    );
  }

  if (cambiandoClave) {
    return (
      <tr className="border-b border-slate-100 last:border-0">
        <td colSpan={5} className="px-4 py-3">
          <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <h3 className="font-semibold text-slate-900">
              Nueva contraseña para {usuario.nombre}
            </h3>
            <p className="text-sm text-slate-600">
              Se la tenés que entregar vos: la app no envía ningún correo. Y
              esa persona todavía no puede cambiarla por su cuenta, así que
              elegí una que puedas comunicarle de forma segura.
            </p>
            <input
              type="text"
              className="campo py-2"
              value={clave}
              onChange={(e) => setClave(e.target.value)}
              placeholder="Mínimo 8 caracteres"
            />
            {error && <p className="text-sm text-red-700">{error}</p>}
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  const ok = await correr(() =>
                    restablecerContrasena({ id: usuario.id, contrasena: clave }),
                  );
                  if (ok) {
                    window.alert(`Contraseña de ${usuario.nombre} actualizada.`);
                    setCambiandoClave(false);
                    setClave("");
                  }
                }}
                disabled={ocupado || clave.length < 8}
                className="boton py-2 text-sm"
              >
                {ocupado ? "Guardando…" : "Establecer contraseña"}
              </button>
              <button
                onClick={() => {
                  setCambiandoClave(false);
                  setClave("");
                  setError(null);
                }}
                className="boton-secundario py-2 text-sm"
              >
                Cancelar
              </button>
            </div>
          </div>
        </td>
      </tr>
    );
  }

  if (editando) {
    return (
      <tr className="border-b border-slate-100 last:border-0">
        <td colSpan={5} className="px-4 py-3">
          <div className="space-y-3">
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
                <span className="etiqueta">Disciplina</span>
                <select
                  className="campo py-2"
                  value={disciplina}
                  onChange={(e) => setDisciplina(e.target.value)}
                >
                  {DISCIPLINAS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="etiqueta">Rol</span>
                <select
                  className="campo py-2"
                  value={rol}
                  onChange={(e) => setRol(e.target.value)}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <p className="text-xs text-slate-500">
              El correo de ingreso no se puede cambiar desde acá: es la
              identidad de la cuenta. {usuario.correo}
            </p>

            {error && <p className="text-sm text-red-700">{error}</p>}

            <div className="flex gap-2">
              <button
                onClick={async () => {
                  const ok = await correr(() =>
                    editarUsuario({ id: usuario.id, nombre, disciplina, rol }),
                  );
                  if (ok) setEditando(false);
                }}
                disabled={ocupado || nombre.trim().length === 0}
                className="boton py-2 text-sm"
              >
                {ocupado ? "Guardando…" : "Guardar"}
              </button>
              <button
                onClick={() => {
                  setEditando(false);
                  setNombre(usuario.nombre);
                  setDisciplina(usuario.disciplina);
                  setRol(usuario.rol);
                  setError(null);
                }}
                className="boton-secundario py-2 text-sm"
              >
                Cancelar
              </button>
            </div>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="px-4 py-3 font-medium text-slate-900">
        {usuario.nombre}
        {esUnoMismo && <span className="ml-1.5 text-xs text-slate-400">(vos)</span>}
        {!usuario.activo && (
          <span className="ml-1.5 rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
            Desactivado
          </span>
        )}
        {relevo?.sustituidoPor && (
          <p className="mt-0.5 text-xs text-slate-500">
            Sustituido por {relevo.sustituidoPor}
          </p>
        )}
        {relevo?.sustituyeA && (
          <p className="mt-0.5 text-xs text-slate-500">
            Retoma el trabajo de {relevo.sustituyeA}
          </p>
        )}
        {(error || aviso) && (
          <p
            className={`mt-1 text-xs ${error ? "text-red-700" : "text-amber-700"}`}
          >
            {error ?? aviso}
          </p>
        )}
      </td>
      <td className="px-4 py-3 text-slate-600">{usuario.correo}</td>
      <td className="px-4 py-3 text-slate-600">{usuario.disciplina}</td>
      <td className="px-4 py-3 text-slate-600">{usuario.rol}</td>
      <td className="px-4 py-3 text-right">
        {confirmando ? (
          <span className="inline-flex flex-wrap justify-end gap-2">
            <button
              onClick={async () => {
                const ok = await correr(() => borrarUsuario(usuario.id));
                if (!ok) setConfirmando(false);
              }}
              disabled={ocupado}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              {ocupado ? "Borrando…" : "Confirmar borrado"}
            </button>
            <button
              onClick={() => setConfirmando(false)}
              className="text-xs font-medium text-slate-500 hover:text-slate-800"
            >
              Cancelar
            </button>
          </span>
        ) : (
          <span className="inline-flex flex-wrap justify-end gap-3">
            <button
              onClick={() => setEditando(true)}
              className="text-xs font-medium text-marca-600 hover:underline"
            >
              Editar
            </button>
            <button
              onClick={() => setCambiandoClave(true)}
              className="text-xs font-medium text-marca-600 hover:underline"
            >
              Contraseña
            </button>
            {!esUnoMismo && (
              <>
                <button
                  onClick={() =>
                    correr(() => cambiarActivo({ id: usuario.id, activo: !usuario.activo }))
                  }
                  disabled={ocupado}
                  className="text-xs font-medium text-slate-500 hover:text-slate-800"
                >
                  {usuario.activo ? "Desactivar" : "Reactivar"}
                </button>
                {!relevo?.sustituidoPor && usuario.activo && (
                  <button
                    onClick={() => setSustituyendo(true)}
                    className="text-xs font-medium text-marca-600 hover:underline"
                  >
                    Sustituir
                  </button>
                )}
                <button
                  onClick={() => setConfirmando(true)}
                  disabled={ocupado || dependencias > 0}
                  title={
                    dependencias > 0
                      ? `Tiene ${dependencias} registro(s) a su nombre. Usá Desactivar.`
                      : undefined
                  }
                  className="text-xs font-medium text-slate-500 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-slate-500"
                >
                  Borrar
                </button>
              </>
            )}
          </span>
        )}
      </td>
    </tr>
  );
}
