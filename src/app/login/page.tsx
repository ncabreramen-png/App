import { Suspense } from "react";
import FormularioLogin from "./FormularioLogin";

export const dynamic = "force-dynamic";

export default function PaginaLogin() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-marca-800">Reportes de obra</h1>
          <p className="mt-1 text-sm text-slate-600">
            Proyecto Chilama — PTAR y alcantarillado sanitario
          </p>
        </div>
        <Suspense fallback={<div className="tarjeta h-64 animate-pulse" />}>
          <FormularioLogin />
        </Suspense>
      </div>
    </main>
  );
}
