import { crearClienteAdmin } from "@/lib/supabase/servidor";
import { formatearFecha, type TipoDeReporte } from "@/lib/tipos";

type DatosCorreo = {
  reporteId: string;
  tipo: TipoDeReporte;
  frente: string;
  frentePrincipal: string;
  disciplina: string;
  autor: string;
  descripcion: string;
  fecha: string;
};

function urlBase(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  ).replace(/\/$/, "");
}

function escapar(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Correos de todos los usuarios con rol Gerente. */
async function destinatarios(): Promise<string[]> {
  const admin = crearClienteAdmin();
  if (!admin) return [];

  const { data, error } = await admin
    .from("usuarios")
    .select("correo")
    .eq("rol", "Gerente");

  if (error || !data) return [];
  return data.map((u: { correo: string }) => u.correo).filter(Boolean);
}

/**
 * Regla de negocio 4: aviso al gerente cuando entra una "Orden de cambio"
 * o una "Problemática". Si no hay RESEND_API_KEY configurada, no falla:
 * registra el motivo y deja seguir la creacion del reporte.
 */
export async function notificarAlGerente(datos: DatosCorreo): Promise<
  { enviado: boolean; motivo?: string }
> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { enviado: false, motivo: "RESEND_API_KEY no configurada" };
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    // Sin service role no se pueden leer los correos de los gerentes: el RLS
    // no deja que un usuario de campo consulte perfiles ajenos.
    return { enviado: false, motivo: "SUPABASE_SERVICE_ROLE_KEY no configurada" };
  }

  const para = await destinatarios();
  if (para.length === 0) {
    return { enviado: false, motivo: "No hay usuarios con rol Gerente" };
  }

  const link = `${urlBase()}/reportes/${datos.reporteId}`;
  const asunto = `[${datos.tipo}] ${datos.frente} — ${datos.disciplina}`;

  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a;line-height:1.5">
      <h2 style="margin:0 0 4px">Nuevo reporte: ${escapar(datos.tipo)}</h2>
      <p style="margin:0 0 16px;color:#475569">Proyecto Chilama — supervisión de obra</p>
      <table style="border-collapse:collapse;font-size:14px;margin-bottom:16px">
        <tr><td style="padding:4px 12px 4px 0;color:#64748b">Frente principal</td><td style="padding:4px 0"><b>${escapar(datos.frentePrincipal)}</b></td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#64748b">Frente de trabajo</td><td style="padding:4px 0"><b>${escapar(datos.frente)}</b></td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#64748b">Disciplina</td><td style="padding:4px 0">${escapar(datos.disciplina)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#64748b">Reportado por</td><td style="padding:4px 0">${escapar(datos.autor)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#64748b">Fecha</td><td style="padding:4px 0">${escapar(formatearFecha(datos.fecha))}</td></tr>
      </table>
      <p style="white-space:pre-wrap;background:#f1f5f9;padding:12px;border-radius:8px;font-size:14px;margin:0 0 20px">${escapar(datos.descripcion)}</p>
      <a href="${link}" style="display:inline-block;background:#1f5fa9;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">Ver el reporte</a>
    </div>`;

  try {
    const respuesta = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.CORREO_REMITENTE ?? "Reportes Chilama <onboarding@resend.dev>",
        to: para,
        subject: asunto,
        html,
      }),
    });

    if (!respuesta.ok) {
      return { enviado: false, motivo: `Resend respondió ${respuesta.status}` };
    }
    return { enviado: true };
  } catch (e) {
    return { enviado: false, motivo: e instanceof Error ? e.message : "Error de red" };
  }
}
