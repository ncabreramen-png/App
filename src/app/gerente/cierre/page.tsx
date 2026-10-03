import { obtenerTareas } from "@/lib/consultas";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import FormularioCierre, { type FilaCierre } from "./FormularioCierre";

export const dynamic = "force-dynamic";

type Busqueda = Promise<Record<string, string | string[] | undefined>>;

function mesCorriente(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export default async function PaginaCierre({
  searchParams,
}: {
  searchParams: Busqueda;
}) {
  const params = await searchParams;
  const crudo = Array.isArray(params.periodo) ? params.periodo[0] : params.periodo;
  const periodo = crudo && /^\d{4}-\d{2}-\d{2}$/.test(crudo) ? crudo : mesCorriente();

  const supabase = await crearClienteServidor();
  const [tareas, filas, meses] = await Promise.all([
    obtenerTareas(),
    supabase.rpc("mediciones_del_mes", { p_periodo: periodo }),
    supabase.rpc("meses_medidos"),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Cierre mensual</h1>
        <p className="mt-0.5 text-sm text-slate-600">
          Registrá el avance acumulado de cada tarea al cierre del mes. De acá
          sale la curva real del proyecto.
        </p>
      </div>

      <FormularioCierre
        periodo={periodo}
        tareas={tareas}
        filas={(filas.data ?? []) as FilaCierre[]}
        mesesMedidos={(meses.data ?? []) as { periodo: string; tareas: number }[]}
      />
    </div>
  );
}
