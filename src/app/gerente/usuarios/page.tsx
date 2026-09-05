import { crearClienteServidor } from "@/lib/supabase/servidor";
import type { Usuario } from "@/lib/tipos";
import FormularioUsuario from "./FormularioUsuario";

export const dynamic = "force-dynamic";

export default async function Usuarios() {
  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .from("usuarios")
    .select("*")
    .order("nombre");

  const usuarios = (data ?? []) as Usuario[];
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
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-3 font-medium text-slate-900">{u.nombre}</td>
                <td className="px-4 py-3 text-slate-600">{u.correo}</td>
                <td className="px-4 py-3 text-slate-600">{u.disciplina}</td>
                <td className="px-4 py-3 text-slate-600">{u.rol}</td>
              </tr>
            ))}
            {usuarios.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                  Sin usuarios registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
