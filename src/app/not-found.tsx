import Link from "next/link";

export default function NoEncontrado() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-xl font-bold text-slate-900">No encontrado</h1>
      <p className="text-slate-600">
        El reporte no existe o no tenés permiso para verlo.
      </p>
      <Link href="/" className="boton">
        Ir al inicio
      </Link>
    </main>
  );
}
