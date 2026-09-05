import TarjetaReporte from "@/components/TarjetaReporte";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { obtenerReportes } from "@/lib/consultas";
import { firmarFotosPorReporte } from "@/lib/fotos";
import type { Frente } from "@/lib/tipos";
import Filtros from "./Filtros";

export const dynamic = "force-dynamic";

type Busqueda = Promise<Record<string, string | string[] | undefined>>;

function texto(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  return s && s.length > 0 ? s : undefined;
}

export default async function TodosLosReportes({
  searchParams,
}: {
  searchParams: Busqueda;
}) {
  const params = await searchParams;
  const filtros = {
    frente: texto(params.frente),
    disciplina: texto(params.disciplina),
    tipo: texto(params.tipo),
    estatus: texto(params.estatus),
  };

  const supabase = await crearClienteServidor();
  const [{ data: frentes }, { reportes, error }] = await Promise.all([
    supabase
      .from("frentes_de_trabajo")
      .select("id, nombre, frente_principal, avance_fisico, avance_financiero, orden")
      .order("orden"),
    obtenerReportes(filtros),
  ]);

  const fotos = await firmarFotosPorReporte(reportes);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Todos los reportes</h1>
        <p className="mt-0.5 text-sm text-slate-600">
          {reportes.length} resultado{reportes.length === 1 ? "" : "s"}
        </p>
      </div>

      <Filtros frentes={(frentes ?? []) as Frente[]} valores={filtros} />

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {!error && reportes.length === 0 && (
        <p className="tarjeta p-8 text-center text-slate-600">
          No hay reportes que coincidan con los filtros.
        </p>
      )}

      <div className="space-y-3">
        {reportes.map((r) => (
          <TarjetaReporte
            key={r.id}
            reporte={r}
            fotos={fotos[r.id] ?? []}
            mostrarAutor
          />
        ))}
      </div>
    </div>
  );
}
