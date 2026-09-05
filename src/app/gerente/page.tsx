import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { obtenerFrentesConSemaforo } from "@/lib/consultas";
import { FRENTES_PRINCIPALES, SEMAFOROS, type Semaforo } from "@/lib/tipos";
import TarjetaFrente from "./TarjetaFrente";

export const dynamic = "force-dynamic";

const ESTILO_RESUMEN: Record<Semaforo, string> = {
  "A tiempo": "border-green-300 bg-green-50 text-green-800",
  "Atraso leve": "border-amber-300 bg-amber-50 text-amber-800",
  "Crítico": "border-red-300 bg-red-50 text-red-800",
};

export default async function Dashboard() {
  const frentes = await obtenerFrentesConSemaforo();

  const supabase = await crearClienteServidor();
  const { count: pendientes } = await supabase
    .from("reportes")
    .select("id", { count: "exact", head: true })
    .eq("estatus", "Pendiente");

  const conteo = Object.fromEntries(
    SEMAFOROS.map((s) => [s, frentes.filter((f) => f.semaforo === s).length]),
  ) as Record<Semaforo, number>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Estatus de obra</h1>
          <p className="mt-0.5 text-sm text-slate-600">
            {frentes.length} frentes de trabajo
          </p>
        </div>
        <Link href="/gerente/informe" className="boton">
          Generar informe de estatus
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {SEMAFOROS.map((s) => (
          <div key={s} className={`rounded-xl border p-3 text-center ${ESTILO_RESUMEN[s]}`}>
            <p className="text-2xl font-bold">{conteo[s]}</p>
            <p className="text-xs font-medium">{s}</p>
          </div>
        ))}
      </div>

      {(pendientes ?? 0) > 0 && (
        <Link
          href="/gerente/aprobaciones"
          className="block rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 hover:bg-amber-100"
        >
          {pendientes} orden{pendientes === 1 ? "" : "es"} de cambio esperando aprobación →
        </Link>
      )}

      {frentes.length === 0 && (
        <p className="tarjeta p-6 text-center text-slate-600">
          No hay frentes cargados. Ejecutá <code>supabase/schema.sql</code> en el
          proyecto de Supabase.
        </p>
      )}

      {FRENTES_PRINCIPALES.map((grupo) => {
        const items = frentes.filter((f) => f.frente_principal === grupo);
        if (items.length === 0) return null;

        return (
          <section key={grupo} className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
              {grupo}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((f) => (
                <TarjetaFrente key={f.id} frente={f} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
