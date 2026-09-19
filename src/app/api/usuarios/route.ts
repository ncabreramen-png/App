import { NextResponse } from "next/server";
import { crearClienteAdmin } from "@/lib/supabase/servidor";
import { obtenerUsuario } from "@/lib/sesion";
import { DISCIPLINAS, ROLES, type Disciplina, type Rol } from "@/lib/tipos";

/**
 * Alta de usuarios. Requiere la clave service role porque Supabase Auth no
 * permite crear cuentas de terceros desde el cliente. Solo el gerente puede
 * llamarla, y la verificacion se hace contra la sesion, no contra el body.
 */
export async function POST(request: Request) {
  const solicitante = await obtenerUsuario();
  if (!solicitante || solicitante.rol !== "Gerente") {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const admin = crearClienteAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: "Falta SUPABASE_SERVICE_ROLE_KEY en el servidor." },
      { status: 500 },
    );
  }

  let cuerpo: Record<string, unknown>;
  try {
    cuerpo = await request.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  const nombre = String(cuerpo.nombre ?? "").trim();
  const correo = String(cuerpo.correo ?? "").trim().toLowerCase();
  const contrasena = String(cuerpo.contrasena ?? "");
  const disciplina = String(cuerpo.disciplina ?? "") as Disciplina;
  const rol = String(cuerpo.rol ?? "") as Rol;

  if (!nombre) return NextResponse.json({ error: "El nombre es obligatorio." }, { status: 400 });
  if (!correo.includes("@")) return NextResponse.json({ error: "Correo no válido." }, { status: 400 });
  if (contrasena.length < 8) {
    return NextResponse.json(
      { error: "La contraseña debe tener al menos 8 caracteres." },
      { status: 400 },
    );
  }
  if (!DISCIPLINAS.includes(disciplina)) {
    return NextResponse.json({ error: "Disciplina no válida." }, { status: 400 });
  }
  if (!ROLES.includes(rol)) {
    return NextResponse.json({ error: "Rol no válido." }, { status: 400 });
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: correo,
    password: contrasena,
    email_confirm: true,
    user_metadata: { nombre, disciplina, rol },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, id: data.user?.id });
}
