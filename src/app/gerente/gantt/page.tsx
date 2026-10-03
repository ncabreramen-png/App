import GraficoGantt from "@/components/GraficoGantt";
import { obtenerTareas } from "@/lib/consultas";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import type { Frente } from "@/lib/tipos";
import EditorTareas from "./EditorTareas";

export const dynamic = "force-dynamic";

export default async function PaginaGantt() {
  const supabase = await crearClienteServidor();
  const [tareas, { data: frentes }] = await Promise.all([
    obtenerTareas(),
    supabase
      .from("frentes_de_trabajo")
      .select("id, nombre, frente_principal, avance_fisico, avance_financiero, orden")
      .order("orden"),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Cronograma</h1>
        <p className="mt-0.5 text-sm text-slate-600">
          Las tareas del Gantt son la fuente del avance: de ellas sale el avance
          físico de cada frente y la curva del proyecto.
        </p>
      </div>

      <GraficoGantt tareas={tareas} />
      <EditorTareas tareas={tareas} frentes={(frentes ?? []) as Frente[]} />
    </div>
  );
}
