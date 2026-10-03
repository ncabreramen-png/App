"use server";

import { revalidatePath } from "next/cache";
import { crearClienteAdmin, crearClienteServidor } from "@/lib/supabase/servidor";
import { exigirGerente } from "@/lib/sesion";
import { DISCIPLINAS, ROLES, type Disciplina, type Rol } from "@/lib/tipos";

export type Resultado = { ok: true; aviso?: string } | { ok: false; error: string };

function revalidar() {
  revalidatePath("/gerente/usuarios");
  revalidatePath("/gerente/reportes");
  revalidatePath("/analisis");
}

/** Evita quedarse sin ninguna gerencia que pueda administrar el sistema. */
async function quedanOtrosGerentes(exceptoId: string): Promise<boolean> {
  const supabase = await crearClienteServidor();
  const { count } = await supabase
    .from("usuarios")
    .select("id", { count: "exact", head: true })
    .eq("rol", "Gerente")
    .eq("activo", true)
    .neq("id", exceptoId);
  return (count ?? 0) > 0;
}

export async function editarUsuario(entrada: {
  id: string;
  nombre: string;
  disciplina: string;
  rol: string;
}): Promise<Resultado> {
  const actual = await exigirGerente();

  const nombre = entrada.nombre.trim();
  if (!nombre) return { ok: false, error: "El nombre no puede estar vacío." };
  if (!DISCIPLINAS.includes(entrada.disciplina as Disciplina)) {
    return { ok: false, error: "Disciplina no válida." };
  }
  if (!ROLES.includes(entrada.rol as Rol)) {
    return { ok: false, error: "Rol no válido." };
  }

  // Bajarse a uno mismo de rol deja el sistema sin quien administre.
  if (entrada.id === actual.id && entrada.rol !== "Gerente") {
    return {
      ok: false,
      error: "No podés quitarte a vos mismo el rol de Gerente.",
    };
  }
  if (
    entrada.rol !== "Gerente" &&
    !(await quedanOtrosGerentes(entrada.id))
  ) {
    return { ok: false, error: "Es el único Gerente activo: dejaría el sistema sin administración." };
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from("usuarios")
    .update({
      nombre,
      disciplina: entrada.disciplina as Disciplina,
      rol: entrada.rol as Rol,
    })
    .eq("id", entrada.id);

  if (error) return { ok: false, error: error.message };

  // Los metadatos de Auth se usan al dar de alta; se mantienen al dia para que
  // no queden contradiciendo a la fila de usuarios.
  const admin = crearClienteAdmin();
  if (admin) {
    await admin.auth.admin.updateUserById(entrada.id, {
      user_metadata: { nombre, disciplina: entrada.disciplina, rol: entrada.rol },
    });
  }

  revalidar();
  return { ok: true };
}

/**
 * Corta o restablece el acceso. Ademas de la bandera que mira la aplicacion,
 * se bloquea la cuenta en Auth: sin eso, alguien con su token todavia podria
 * consultar la API directamente.
 */
export async function cambiarActivo(entrada: {
  id: string;
  activo: boolean;
}): Promise<Resultado> {
  const actual = await exigirGerente();

  if (entrada.id === actual.id && !entrada.activo) {
    return { ok: false, error: "No podés desactivar tu propia cuenta." };
  }
  if (!entrada.activo && !(await quedanOtrosGerentes(entrada.id))) {
    const supabase = await crearClienteServidor();
    const { data } = await supabase
      .from("usuarios")
      .select("rol")
      .eq("id", entrada.id)
      .maybeSingle();
    if (data?.rol === "Gerente") {
      return { ok: false, error: "Es el único Gerente activo: no se puede desactivar." };
    }
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from("usuarios")
    .update({ activo: entrada.activo })
    .eq("id", entrada.id);

  if (error) return { ok: false, error: error.message };

  const admin = crearClienteAdmin();
  if (!admin) {
    revalidar();
    return {
      ok: true,
      aviso:
        "Se marcó en la aplicación, pero falta SUPABASE_SERVICE_ROLE_KEY para bloquear la cuenta en el sistema de autenticación.",
    };
  }

  const { error: errorAuth } = await admin.auth.admin.updateUserById(entrada.id, {
    ban_duration: entrada.activo ? "none" : "876000h",
  });

  revalidar();
  if (errorAuth) {
    return {
      ok: true,
      aviso: `Se marcó en la aplicación, pero no se pudo bloquear la cuenta: ${errorAuth.message}`,
    };
  }
  return { ok: true };
}

/**
 * Borrado definitivo. Solo procede si el usuario no dejo historial: reportes y
 * analisis lo referencian con "on delete restrict" para que nada quede sin
 * firma. Cuando hay historial, lo que corresponde es desactivar.
 */
export async function borrarUsuario(id: string): Promise<Resultado> {
  const actual = await exigirGerente();

  if (id === actual.id) {
    return { ok: false, error: "No podés borrar tu propia cuenta." };
  }

  const supabase = await crearClienteServidor();
  const { data: deps, error: errorDeps } = await supabase.rpc("dependencias_usuario", {
    p_usuario: id,
  });
  if (errorDeps) return { ok: false, error: errorDeps.message };

  const d = (Array.isArray(deps) ? deps[0] : deps) as
    | { reportes: number; analisis: number; revisiones: number }
    | undefined;

  const atados: string[] = [];
  if (d && Number(d.reportes) > 0) atados.push(`${d.reportes} reporte(s)`);
  if (d && Number(d.analisis) > 0) atados.push(`${d.analisis} análisis`);

  if (atados.length > 0) {
    return {
      ok: false,
      error:
        `No se puede borrar: tiene ${atados.join(" y ")} a su nombre. ` +
        `Borrarlo dejaría ese historial sin autor. Usá "Desactivar" para quitarle el acceso.`,
    };
  }

  const admin = crearClienteAdmin();
  if (!admin) {
    return {
      ok: false,
      error: "Falta SUPABASE_SERVICE_ROLE_KEY en el servidor para borrar la cuenta.",
    };
  }

  // Borrar la cuenta de Auth arrastra la fila de usuarios por cascada.
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return { ok: false, error: error.message };

  revalidar();
  return { ok: true };
}

/**
 * Relevo de un profesional por otro en la misma disciplina.
 *
 * En una sola operacion: se registra la sucesion, el sucesor pasa a ver y
 * continuar el historial del anterior, y al anterior se le corta el acceso.
 *
 * La firma de los reportes NO se toca. Un reporte dice quien observo que y
 * cuando; reasignarlo haria que el registro afirme que el sucesor vio cosas
 * que no vio.
 */
export async function sustituirUsuario(entrada: {
  predecesorId: string;
  motivo: string;
  sucesor:
    | { modo: "existente"; id: string }
    | { modo: "nuevo"; nombre: string; correo: string; contrasena: string };
}): Promise<Resultado & { sucesorId?: string }> {
  const actual = await exigirGerente();

  if (entrada.predecesorId === actual.id) {
    return { ok: false, error: "No podés registrarte a vos mismo como sustituido." };
  }

  const supabase = await crearClienteServidor();

  const { data: predecesor } = await supabase
    .from("usuarios")
    .select("id, nombre, disciplina")
    .eq("id", entrada.predecesorId)
    .maybeSingle();

  if (!predecesor) return { ok: false, error: "No se encontró el usuario a sustituir." };

  // Se verifica antes de crear nada: si ya fue relevado, crear al sucesor
  // dejaria una cuenta suelta que despues hay que limpiar a mano.
  const { data: yaRelevado } = await supabase
    .from("sustituciones")
    .select("id")
    .eq("predecesor_id", entrada.predecesorId)
    .maybeSingle();

  if (yaRelevado) {
    return {
      ok: false,
      error: `${predecesor.nombre} ya fue sustituido. Un profesional se releva una sola vez.`,
    };
  }

  let sucesorId: string;

  if (entrada.sucesor.modo === "existente") {
    sucesorId = entrada.sucesor.id;
    if (sucesorId === entrada.predecesorId) {
      return { ok: false, error: "El sucesor no puede ser la misma persona." };
    }

    const { data: sucesor } = await supabase
      .from("usuarios")
      .select("disciplina, activo")
      .eq("id", sucesorId)
      .maybeSingle();

    if (!sucesor) return { ok: false, error: "No se encontró el usuario sucesor." };
    if (sucesor.disciplina !== predecesor.disciplina) {
      return {
        ok: false,
        error: `La sustitución es dentro de la misma disciplina: ${predecesor.nombre} es ${predecesor.disciplina}.`,
      };
    }
    if (!sucesor.activo) {
      return { ok: false, error: "El sucesor está desactivado. Reactivalo antes de asignarle el relevo." };
    }
  } else {
    const nombre = entrada.sucesor.nombre.trim();
    const correo = entrada.sucesor.correo.trim().toLowerCase();

    if (!nombre) return { ok: false, error: "El nombre del sucesor es obligatorio." };
    if (!correo.includes("@")) return { ok: false, error: "El correo del sucesor no es válido." };
    if (entrada.sucesor.contrasena.length < 8) {
      return { ok: false, error: "La contraseña debe tener al menos 8 caracteres." };
    }

    const admin = crearClienteAdmin();
    if (!admin) {
      return { ok: false, error: "Falta SUPABASE_SERVICE_ROLE_KEY para crear al sucesor." };
    }

    const { data: creado, error: errorAlta } = await admin.auth.admin.createUser({
      email: correo,
      password: entrada.sucesor.contrasena,
      email_confirm: true,
      // Hereda la disciplina del predecesor: el relevo es dentro de la misma.
      user_metadata: { nombre, disciplina: predecesor.disciplina, rol: "Campo" },
    });

    if (errorAlta || !creado.user) {
      return { ok: false, error: errorAlta?.message ?? "No se pudo crear al sucesor." };
    }
    sucesorId = creado.user.id;
  }

  const { error: errorSucesion } = await supabase.from("sustituciones").insert({
    predecesor_id: entrada.predecesorId,
    sucesor_id: sucesorId,
    disciplina: predecesor.disciplina,
    motivo: entrada.motivo.trim() || null,
    creado_por: actual.id,
  });

  if (errorSucesion) {
    return {
      ok: false,
      error:
        entrada.sucesor.modo === "nuevo"
          ? `El sucesor se creó, pero el relevo no se registró: ${errorSucesion.message}`
          : errorSucesion.message,
    };
  }

  const corte = await cambiarActivo({ id: entrada.predecesorId, activo: false });

  revalidar();
  revalidatePath("/campo");

  if (!corte.ok) {
    return {
      ok: true,
      sucesorId,
      aviso: `Relevo registrado, pero no se pudo cortar el acceso de ${predecesor.nombre}: ${corte.error}`,
    };
  }
  return { ok: true, sucesorId, aviso: corte.aviso };
}

/**
 * Restablece la contrasena de otra persona. Solo la gerencia.
 *
 * No hay pantalla de recuperacion por correo, asi que este es el camino
 * cuando alguien la olvida: la gerencia le asigna una y se la entrega.
 */
export async function restablecerContrasena(entrada: {
  id: string;
  contrasena: string;
}): Promise<Resultado> {
  await exigirGerente();

  if (entrada.contrasena.length < 8) {
    return { ok: false, error: "La contraseña debe tener al menos 8 caracteres." };
  }

  const admin = crearClienteAdmin();
  if (!admin) {
    return {
      ok: false,
      error: "Falta SUPABASE_SERVICE_ROLE_KEY en el servidor para cambiar contraseñas.",
    };
  }

  const { error } = await admin.auth.admin.updateUserById(entrada.id, {
    password: entrada.contrasena,
  });

  if (error) return { ok: false, error: error.message };

  revalidar();
  return { ok: true };
}
