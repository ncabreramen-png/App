export const dynamic = "force-dynamic";

export default function Desactivado() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-xl font-bold text-slate-900">Acceso desactivado</h1>
      <p className="max-w-sm text-slate-600">
        Tu cuenta fue desactivada por la gerencia. Los reportes que cargaste
        siguen en el sistema a tu nombre.
      </p>
      <form action="/auth/salir" method="post">
        <button type="submit" className="boton">
          Cerrar sesión
        </button>
      </form>
    </main>
  );
}
