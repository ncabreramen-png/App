import Link from "next/link";
import type { Usuario } from "@/lib/tipos";

const ENLACES_GERENTE = [
  { href: "/gerente", texto: "Dashboard" },
  { href: "/gerente/aprobaciones", texto: "Aprobaciones" },
  { href: "/gerente/reportes", texto: "Reportes" },
  { href: "/gerente/informe", texto: "Informe" },
  { href: "/gerente/usuarios", texto: "Usuarios" },
];

const ENLACES_CAMPO = [
  { href: "/campo", texto: "Mis reportes" },
  { href: "/campo/nuevo", texto: "Nuevo reporte" },
];

export default function Encabezado({ usuario }: { usuario: Usuario }) {
  const enlaces = usuario.rol === "Gerente" ? ENLACES_GERENTE : ENLACES_CAMPO;

  return (
    <header className="no-imprimir sticky top-0 z-20 border-b border-marca-800 bg-marca-800 text-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{usuario.nombre}</p>
          <p className="truncate text-xs text-marca-100">
            {usuario.disciplina} · {usuario.rol}
          </p>
        </div>
        <form action="/auth/salir" method="post">
          <button
            type="submit"
            className="rounded-lg border border-white/30 px-3 py-1.5 text-sm font-medium hover:bg-white/10"
          >
            Salir
          </button>
        </form>
      </div>

      <nav className="mx-auto max-w-5xl overflow-x-auto px-2 pb-2">
        <ul className="flex gap-1 whitespace-nowrap">
          {enlaces.map((e) => (
            <li key={e.href}>
              <Link
                href={e.href}
                className="block rounded-lg px-3 py-2 text-sm font-medium text-marca-100 hover:bg-white/10 hover:text-white"
              >
                {e.texto}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
