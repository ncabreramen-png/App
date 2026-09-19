"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { exigirGerente } from "@/lib/sesion";

export type Resultado = { ok: true } | { ok: false; error: string };

/** Aprobar o rechazar una orden de cambio pendiente (regla de negocio 2). */
export async function resolverOrdenDeCambio(entrada: {
  reporteId: string;
  decision: "Aprobado" | "Rechazado";
  comentario?: string;
}): Promise<Resultado> {
  await exigirGerente();

  const comentario = (entrada.comentario ?? "").trim();
  if (entrada.decision === "Rechazado" && !comentario) {
    return { ok: false, error: "Para rechazar hay que escribir el motivo." };
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from("reportes")
    .update({
      estatus: entrada.decision,
      comentario_de_aprobacion: entrada.decision === "Rechazado" ? comentario : null,
    })
    .eq("id", entrada.reporteId)
    .eq("estatus", "Pendiente");

  if (error) return { ok: false, error: error.message };

  revalidatePath("/gerente");
  revalidatePath("/gerente/aprobaciones");
  revalidatePath("/gerente/reportes");
  revalidatePath("/gerente/informe");
  revalidatePath(`/reportes/${entrada.reporteId}`);
  return { ok: true };
}

/** Avance fisico y financiero de un frente. Solo el gerente los edita. */
export async function actualizarAvances(entrada: {
  frenteId: string;
  avanceFisico: number;
  avanceFinanciero: number;
}): Promise<Resultado> {
  await exigirGerente();

  const dentroDeRango = (n: number) => Number.isFinite(n) && n >= 0 && n <= 100;
  if (!dentroDeRango(entrada.avanceFisico) || !dentroDeRango(entrada.avanceFinanciero)) {
    return { ok: false, error: "Los avances deben estar entre 0 y 100." };
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from("frentes_de_trabajo")
    .update({
      avance_fisico: entrada.avanceFisico,
      avance_financiero: entrada.avanceFinanciero,
    })
    .eq("id", entrada.frenteId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/gerente");
  revalidatePath("/gerente/informe");
  return { ok: true };
}
