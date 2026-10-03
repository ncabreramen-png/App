import { redirect } from "next/navigation";
import Encabezado from "@/components/Encabezado";
import { exigirUsuario, veNoConformidades } from "@/lib/sesion";

export const dynamic = "force-dynamic";

export default async function LayoutNC({
  children,
}: {
  children: React.ReactNode;
}) {
  const usuario = await exigirUsuario();
  // Solo gerencia y calidad. El resto ni siquiera ve la pestaña.
  if (!veNoConformidades(usuario)) redirect("/");

  return (
    <div className="min-h-dvh">
      <Encabezado usuario={usuario} />
      <main className="mx-auto max-w-5xl px-4 py-5">{children}</main>
    </div>
  );
}
