import { crearClienteServidor } from "@/lib/supabase/servidor";
import { exigirGerente } from "@/lib/sesion";
import type { Frente } from "@/lib/tipos";
import FormularioAnalisis from "./FormularioAnalisis";

export const dynamic = "force-dynamic";

export default async function NuevoAnalisis() {
  const usuario = await exigirGerente();
  const supabase = await crearClienteServidor();

  const { data } = await supabase
    .from("frentes_de_trabajo")
    .select("id, nombre, frente_principal, avance_fisico, avance_financiero, orden")
    .order("orden");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Nuevo análisis</h1>
        <p className="mt-0.5 text-sm text-slate-600">
          Subí fotos, planos, PDF o planillas y dejá tus observaciones.
        </p>
      </div>
      <FormularioAnalisis frentes={(data ?? []) as Frente[]} usuarioId={usuario.id} />
    </div>
  );
}
