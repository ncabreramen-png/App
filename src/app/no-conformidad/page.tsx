import Link from "next/link";
import PanelNC from "./PanelNC";
import FormularioNC from "./FormularioNC";
import { firmarPorEntidad } from "@/lib/adjuntos.servidor";
import { BUCKET_NC } from "@/lib/archivos";
import { obtenerNoConformidades } from "@/lib/consultas";
import { esCalidad, exigirUsuario } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import type { Frente } from "@/lib/tipos";

export const dynamic = "force-dynamic";

type Busqueda = Promise<Record<string, string | string[] | undefined>>;

export default async function PaginaNC({ searchParams }: { searchParams: Busqueda }) {
  const usuario = await exigirUsuario();
  const params = await searchParams;
  const crudo = Array.isArray(params.estado) ? params.estado[0] : params.estado;
  const filtro = crudo === "Pendiente" || crudo === "Atendida" ? crudo : undefined;

  const puedeEditar = esCalidad(usuario);

  const supabase = await crearClienteServidor();
  const [todas, { data: frentes }] = await Promise.all([
    obtenerNoConformidades(),
    puedeEditar
      ? supabase
          .from("frentes_de_trabajo")
          .select("id, nombre, frente_principal, avance_fisico, avance_financiero, orden")
          .order("orden")
      : Promise.resolve({ data: [] }),
  ]);

  const pendientes = todas.filter((n) => n.estado === "Pendiente").length;
  const atendidas = todas.filter((n) => n.estado === "Atendida").length;
  const lista = filtro ? todas.filter((n) => n.estado === filtro) : todas;
  const adjuntos = await firmarPorEntidad(BUCKET_NC, lista);

  const pestanas = [
    { etiqueta: `Todas (${todas.length})`, valor: undefined },
    { etiqueta: `Pendiente (${pendientes})`, valor: "Pendiente" },
    { etiqueta: `Atendida (${atendidas})`, valor: "Atendida" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">No conformidades</h1>
          <p className="mt-0.5 text-sm text-slate-600">
            {puedeEditar
              ? "Registralas y marcalas como atendidas cuando se cierren."
              : "Vista de solo lectura: las gestiona aseguramiento de calidad."}
          </p>
        </div>
        {puedeEditar && (
          <FormularioNC frentes={(frentes ?? []) as Frente[]} usuarioId={usuario.id} />
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-center">
          <p className="text-2xl font-bold text-amber-800">{pendientes}</p>
          <p className="text-xs font-medium text-slate-600">Pendiente</p>
        </div>
        <div className="rounded-xl border border-green-300 bg-green-50 p-3 text-center">
          <p className="text-2xl font-bold text-green-800">{atendidas}</p>
          <p className="text-xs font-medium text-slate-600">Atendida</p>
        </div>
      </div>

      <nav className="no-imprimir flex flex-wrap gap-1.5">
        {pestanas.map((p) => {
          const activa = filtro === p.valor;
          return (
            <Link
              key={p.etiqueta}
              href={p.valor ? `/no-conformidad?estado=${p.valor}` : "/no-conformidad"}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
                activa
                  ? "border-marca-600 bg-marca-50 text-marca-700"
                  : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {p.etiqueta}
            </Link>
          );
        })}
      </nav>

      {lista.length === 0 && (
        <p className="tarjeta p-8 text-center text-slate-600">
          {todas.length === 0
            ? "No hay no conformidades registradas."
            : `No hay ninguna en estado ${filtro}.`}
        </p>
      )}

      <div className="space-y-3">
        {lista.map((nc) => (
          <PanelNC
            key={nc.id}
            nc={nc}
            adjuntos={adjuntos[nc.id] ?? []}
            puedeEditar={puedeEditar}
          />
        ))}
      </div>
    </div>
  );
}
