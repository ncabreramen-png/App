export const dynamic = "force-dynamic";

export default function SinPerfil() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-xl font-bold text-slate-900">Cuenta sin perfil</h1>
      <p className="max-w-sm text-slate-600">
        Tu cuenta existe en el sistema de autenticación pero no tiene un perfil
        asociado (nombre, disciplina y rol). Pedile al gerente que la dé de alta
        desde la pantalla de Usuarios.
      </p>
      <form action="/auth/salir" method="post">
        <button type="submit" className="boton">
          Cerrar sesión
        </button>
      </form>
    </main>
  );
}
