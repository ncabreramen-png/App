import Encabezado from "@/components/Encabezado";
import { exigirGerente } from "@/lib/sesion";

export const dynamic = "force-dynamic";

export default async function LayoutGerente({
  children,
}: {
  children: React.ReactNode;
}) {
  const usuario = await exigirGerente();

  return (
    <div className="min-h-dvh">
      <Encabezado usuario={usuario} />
      <main className="mx-auto max-w-5xl px-4 py-5">{children}</main>
    </div>
  );
}
