import { crearClienteServidor } from "@/lib/supabase/servidor";
import { exigirUsuario } from "@/lib/sesion";
import type { Frente } from "@/lib/tipos";
import FormularioReporte from "./FormularioReporte";

export const dynamic = "force-dynamic";

export default async function NuevoReporte() {
  const usuario = await exigirUsuario();
  const supabase = await crearClienteServidor();

  const { data } = await supabase
    .from("frentes_de_trabajo")
    .select("id, nombre, frente_principal, avance_fisico, avance_financiero, orden")
    .order("orden");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Nuevo reporte</h1>
        <p className="mt-0.5 text-sm text-slate-600">
          Se registra a nombre de {usuario.nombre} — disciplina {usuario.disciplina}.
        </p>
      </div>
      <FormularioReporte frentes={(data ?? []) as Frente[]} usuarioId={usuario.id} />
    </div>
  );
}
