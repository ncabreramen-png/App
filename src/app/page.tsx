import { redirect } from "next/navigation";
import { exigirUsuario } from "@/lib/sesion";

export const dynamic = "force-dynamic";

export default async function Inicio() {
  const usuario = await exigirUsuario();
  redirect(usuario.rol === "Gerente" ? "/gerente" : "/campo");
}
