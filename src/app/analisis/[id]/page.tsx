import Link from "next/link";
import { notFound } from "next/navigation";
import ListaArchivos from "@/components/ListaArchivos";
import { firmarArchivos } from "@/lib/adjuntos.servidor";
import { BUCKET_ANALISIS } from "@/lib/archivos";
import { obtenerUnAnalisis } from "@/lib/consultas";
import { exigirUsuario } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { formatearFecha, type Usuario } from "@/lib/tipos";
import PanelCompartir from "./PanelCompartir";
import BotonBorrar from "./BotonBorrar";

export const dynamic = "force-dynamic";

export default async function DetalleAnalisis({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const usuario = await exigirUsuario();

  // El RLS decide la visibilidad: si no es propio ni compartido, no llega nada.
  const analisis = await obtenerUnAnalisis(id);
  if (!analisis) notFound();

  const adjuntos = await firmarArchivos(BUCKET_ANALISIS, analisis.archivos);
  const propio = analisis.creado_por === usuario.id;

  let candidatos: Usuario[] = [];
  if (propio) {
    const supabase = await crearClienteServidor();
    const { data } = await supabase
      .from("usuarios")
      .select("*")
      .neq("id", usuario.id)
      .order("nombre");
    candidatos = (data ?? []) as Usuario[];
  }

  return (
    <div className="space-y-4">
      <Link
        href="/analisis"
        className="no-imprimir block text-sm font-medium text-marca-600 hover:underline"
      >
        ← Volver a análisis
      </Link>

      <article className="tarjeta p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-slate-900">{analisis.titulo}</h1>
            <p className="mt-0.5 text-xs text-slate-500">
              {analisis.frente?.nombre ?? "Proyecto completo"} ·{" "}
              {formatearFecha(analisis.creado_en)}
              {!propio && analisis.autor ? ` · ${analisis.autor.nombre}` : ""}
            </p>
          </div>
          {propio && (
            <span
              className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                analisis.compartido_con.length > 0
                  ? "border-marca-100 bg-marca-50 text-marca-700"
                  : "border-slate-300 bg-slate-100 text-slate-700"
              }`}
            >
              {analisis.compartido_con.length > 0
                ? `Compartido con ${analisis.compartido_con.length}`
                : "Privado"}
            </span>
          )}
        </div>

        {analisis.descripcion && (
          <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">
            {analisis.descripcion}
          </p>
        )}

        <ListaArchivos archivos={adjuntos} />
      </article>

      {propio && (
        <>
          <PanelCompartir
            analisisId={analisis.id}
            candidatos={candidatos}
            conAcceso={analisis.compartido_con.map((u) => u.id)}
          />
          <BotonBorrar id={analisis.id} titulo={analisis.titulo} />
        </>
      )}
    </div>
  );
}
