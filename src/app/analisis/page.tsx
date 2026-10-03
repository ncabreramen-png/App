import Link from "next/link";
import { firmarPorEntidad } from "@/lib/adjuntos.servidor";
import { BUCKET_ANALISIS } from "@/lib/archivos";
import { obtenerAnalisis } from "@/lib/consultas";
import { exigirUsuario } from "@/lib/sesion";
import { formatearFecha } from "@/lib/tipos";
import ListaArchivos from "@/components/ListaArchivos";

export const dynamic = "force-dynamic";

export default async function PaginaAnalisis() {
  const usuario = await exigirUsuario();
  const analisis = await obtenerAnalisis();
  const adjuntos = await firmarPorEntidad(BUCKET_ANALISIS, analisis);
  const esGerente = usuario.rol === "Gerente";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Análisis</h1>
          <p className="mt-0.5 text-sm text-slate-600">
            {esGerente
              ? "Tus análisis son privados hasta que elijas con quién compartirlos."
              : "Análisis que la gerencia compartió con vos."}
          </p>
        </div>
        {esGerente && (
          <Link href="/analisis/nuevo" className="boton">
            + Nuevo
          </Link>
        )}
      </div>

      {analisis.length === 0 && (
        <div className="tarjeta p-8 text-center">
          <p className="text-slate-600">
            {esGerente
              ? "Todavía no creaste ningún análisis."
              : "No hay análisis compartidos con vos."}
          </p>
          {esGerente && (
            <Link href="/analisis/nuevo" className="boton mt-4">
              Crear el primero
            </Link>
          )}
        </div>
      )}

      <div className="space-y-3">
        {analisis.map((a) => {
          const propio = a.creado_por === usuario.id;
          const compartidos = a.compartido_con.length;

          return (
            <article key={a.id} className="tarjeta p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="font-semibold text-slate-900">
                    <Link href={`/analisis/${a.id}`} className="hover:underline">
                      {a.titulo}
                    </Link>
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {a.frente?.nombre ?? "Proyecto completo"} · {formatearFecha(a.creado_en)}
                    {!propio && a.autor ? ` · ${a.autor.nombre}` : ""}
                  </p>
                </div>
                {propio && (
                  <span
                    className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                      compartidos > 0
                        ? "border-marca-100 bg-marca-50 text-marca-700"
                        : "border-slate-300 bg-slate-100 text-slate-700"
                    }`}
                  >
                    {compartidos > 0
                      ? `Compartido con ${compartidos}`
                      : "Privado"}
                  </span>
                )}
              </div>

              {a.descripcion && (
                <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">
                  {a.descripcion}
                </p>
              )}

              <ListaArchivos archivos={adjuntos[a.id] ?? []} />
            </article>
          );
        })}
      </div>
    </div>
  );
}
