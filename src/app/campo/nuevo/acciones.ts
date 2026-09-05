"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { exigirUsuario } from "@/lib/sesion";
import { notificarAlGerente } from "@/lib/correo";
import {
  TIPOS_DE_REPORTE,
  TIPOS_QUE_NOTIFICAN,
  type TipoDeReporte,
} from "@/lib/tipos";

export type ResultadoCreacion =
  | { ok: true; reporteId: string; estatus: string; avisoCorreo?: string }
  | { ok: false; error: string };

export async function crearReporte(entrada: {
  frenteId: string;
  tipo: string;
  descripcion: string;
  fotos: string[];
}): Promise<ResultadoCreacion> {
  const usuario = await exigirUsuario();

  const descripcion = entrada.descripcion.trim();
  if (!descripcion) {
    return { ok: false, error: "La descripción no puede estar vacía." };
  }
  if (!entrada.frenteId) {
    return { ok: false, error: "Seleccioná un frente de trabajo." };
  }
  if (!TIPOS_DE_REPORTE.includes(entrada.tipo as TipoDeReporte)) {
    return { ok: false, error: "Tipo de reporte no válido." };
  }

  const supabase = await crearClienteServidor();

  // El estatus inicial lo fija un trigger en la base, no el cliente.
  const { data, error } = await supabase
    .from("reportes")
    .insert({
      frente_de_trabajo_id: entrada.frenteId,
      disciplina: usuario.disciplina,
      tipo_de_reporte: entrada.tipo as TipoDeReporte,
      descripcion,
      fotos: entrada.fotos,
      reportado_por: usuario.id,
    })
    .select("id, estatus, fecha, frente:frentes_de_trabajo(nombre, frente_principal)")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "No se pudo guardar el reporte." };
  }

  let avisoCorreo: string | undefined;

  if (TIPOS_QUE_NOTIFICAN.includes(entrada.tipo as TipoDeReporte)) {
    const frente = Array.isArray(data.frente) ? data.frente[0] : data.frente;
    const resultado = await notificarAlGerente({
      reporteId: data.id,
      tipo: entrada.tipo as TipoDeReporte,
      frente: frente?.nombre ?? "—",
      frentePrincipal: frente?.frente_principal ?? "—",
      disciplina: usuario.disciplina,
      autor: usuario.nombre,
      descripcion,
      fecha: data.fecha,
    });
    if (!resultado.enviado) {
      avisoCorreo = `El reporte se guardó, pero no se envió el correo al gerente (${resultado.motivo}).`;
    }
  }

  revalidatePath("/campo");
  revalidatePath("/gerente");
  revalidatePath("/gerente/aprobaciones");
  revalidatePath("/gerente/reportes");

  return { ok: true, reporteId: data.id, estatus: data.estatus, avisoCorreo };
}
