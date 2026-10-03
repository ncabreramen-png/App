import { crearClienteServidor } from "@/lib/supabase/servidor";
import { exigirGerente } from "@/lib/sesion";
import type { Usuario } from "@/lib/tipos";
import FilaUsuario from "./FilaUsuario";
import FormularioUsuario from "./FormularioUsuario";

export const dynamic = "force-dynamic";

export default async function Usuarios() {
  const actual = await exigirGerente();
  const supabase = await crearClienteServidor();

  const [{ data }, { data: reportes }, { data: analisis }, { data: relevos }] =
    await Promise.all([
      supabase.from("usuarios").select("*").order("nombre"),
      supabase.from("reportes").select("reportado_por"),
      supabase.from("analisis").select("creado_por"),
      supabase.from("sustituciones").select("predecesor_id, sucesor_id"),
    ]);

  const usuarios = (data ?? []) as Usuario[];

  // Cuantos registros tiene cada uno a su nombre: con historial no se borra,
  // se desactiva. Se calcula una vez para no consultar por fila.
  const dependencias = new Map<string, number>();
  for (const r of (reportes ?? []) as { reportado_por: string }[]) {
    dependencias.set(r.reportado_por, (dependencias.get(r.reportado_por) ?? 0) + 1);
  }
  for (const a of (analisis ?? []) as { creado_por: string }[]) {
    dependencias.set(a.creado_por, (dependencias.get(a.creado_por) ?? 0) + 1);
  }

  const porId = new Map(usuarios.map((u) => [u.id, u.nombre]));
  const sustituidoPor = new Map<string, string>();
  const sustituyeA = new Map<string, string>();
  for (const r of (relevos ?? []) as { predecesor_id: string; sucesor_id: string }[]) {
    sustituidoPor.set(r.predecesor_id, porId.get(r.sucesor_id) ?? "—");
    sustituyeA.set(r.sucesor_id, porId.get(r.predecesor_id) ?? "—");
  }

  const hayServiceRole = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Usuarios</h1>
        <p className="mt-0.5 text-sm text-slate-600">
          Altas del equipo de supervisión. El correo es el usuario de ingreso.
        </p>
      </div>

      {hayServiceRole ? (
        <FormularioUsuario />
      ) : (
        <p className="tarjeta p-4 text-sm text-amber-800">
          Para dar de alta usuarios desde acá hay que configurar{" "}
          <code>SUPABASE_SERVICE_ROLE_KEY</code> en el servidor. Mientras tanto se
          pueden crear desde Supabase → Authentication → Users.
        </p>
      )}

      <div className="tarjeta overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Correo</th>
              <th className="px-4 py-3">Disciplina</th>
              <th className="px-4 py-3">Rol</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <FilaUsuario
                key={u.id}
                usuario={u}
                esUnoMismo={u.id === actual.id}
                dependencias={dependencias.get(u.id) ?? 0}
                candidatos={usuarios.filter(
                  (c) => c.activo && c.id !== u.id && c.disciplina === u.disciplina,
                )}
                relevo={{
                  sustituidoPor: sustituidoPor.get(u.id),
                  sustituyeA: sustituyeA.get(u.id),
                }}
              />
            ))}
            {usuarios.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                  Sin usuarios registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-500">
        <b>Sustituir</b> entrega el historial de esa persona a su reemplazo en
        la misma disciplina, sin cambiar quién firmó cada reporte.{" "}
        <b>Desactivar</b> corta el acceso y conserva los reportes a nombre de esa
        persona. <b>Borrar</b> solo está disponible para quien no dejó historial:
        eliminar a alguien con reportes los dejaría sin autor.
      </p>
    </div>
  );
}
