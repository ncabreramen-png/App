import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import type { Usuario } from "@/lib/tipos";

/** Usuario autenticado con su perfil, o null si no hay sesion. */
export async function obtenerUsuario(): Promise<Usuario | null> {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("usuarios")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return (data as Usuario | null) ?? null;
}

/**
 * Exige sesion con perfil. Sin sesion, va a /login. Con sesion en Auth pero
 * sin fila en public.usuarios, va a una pagina publica que lo explica: si
 * mandaramos a /login el middleware lo devolveria aca y se haria un bucle.
 */
export async function exigirUsuario(): Promise<Usuario> {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("usuarios")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!data) redirect("/auth/sin-perfil");

  const usuario = data as Usuario;
  // La cuenta tambien queda bloqueada en Auth, pero se corta aca ademas para
  // que el corte sea inmediato y no dependa de que expire el token.
  if (!usuario.activo) redirect("/auth/desactivado");

  return usuario;
}

/**
 * Aseguramiento de calidad: quien levanta y cierra no conformidades.
 * El rol Gerente queda fuera a proposito, aunque tenga esa disciplina: para la
 * gerencia las no conformidades son de solo lectura.
 */
export function esCalidad(usuario: Usuario): boolean {
  return usuario.disciplina === "Aseguramiento de calidad" && usuario.rol !== "Gerente";
}

/** Quien puede entrar a la pantalla de no conformidades. */
export function veNoConformidades(usuario: Usuario): boolean {
  return usuario.rol === "Gerente" || esCalidad(usuario);
}

/** Exige ser aseguramiento de calidad para poder escribir. */
export async function exigirCalidad(): Promise<Usuario> {
  const usuario = await exigirUsuario();
  if (!esCalidad(usuario)) redirect("/no-conformidad");
  return usuario;
}

/** Exige rol Gerente. Un usuario de campo termina en su propia vista. */
export async function exigirGerente(): Promise<Usuario> {
  const usuario = await exigirUsuario();
  if (usuario.rol !== "Gerente") redirect("/campo");
  return usuario;
}
