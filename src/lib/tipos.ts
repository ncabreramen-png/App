export const DISCIPLINAS = [
  "Hidráulico",
  "Estructural",
  "Civil",
  "Mecánico",
  "Geotecnia",
  "Calidad",
  "Ambiental",
  "Eléctrico",
] as const;

export const ROLES = ["Campo", "Gerente"] as const;

export const FRENTES_PRINCIPALES = [
  "Colectores",
  "Estaciones de bombeo",
  "PTAR",
] as const;

export const TIPOS_DE_REPORTE = [
  "Avance",
  "Problemática",
  "Cambio de proyecto",
  "Orden de cambio",
] as const;

export const ESTATUS_REPORTE = [
  "Registrado",
  "Pendiente",
  "Aprobado",
  "Rechazado",
] as const;

export const SEMAFOROS = ["A tiempo", "Atraso leve", "Crítico"] as const;

export type Disciplina = (typeof DISCIPLINAS)[number];
export type Rol = (typeof ROLES)[number];
export type FrentePrincipal = (typeof FRENTES_PRINCIPALES)[number];
export type TipoDeReporte = (typeof TIPOS_DE_REPORTE)[number];
export type EstatusReporte = (typeof ESTATUS_REPORTE)[number];
export type Semaforo = (typeof SEMAFOROS)[number];

/** Tipos que exigen aviso inmediato al gerente (regla de negocio 4). */
export const TIPOS_QUE_NOTIFICAN: TipoDeReporte[] = [
  "Orden de cambio",
  "Problemática",
];

export type Usuario = {
  id: string;
  nombre: string;
  correo: string;
  disciplina: Disciplina;
  rol: Rol;
  creado_en: string;
};

export type Frente = {
  id: string;
  nombre: string;
  frente_principal: FrentePrincipal;
  avance_fisico: number;
  avance_financiero: number;
  orden: number;
};

export type FrenteConSemaforo = Frente & {
  alertas: number;
  total_reportes: number;
  semaforo: Semaforo;
};

/** Un mes de la curva S del proyecto. */
export type PuntoCurva = {
  id: string;
  periodo: string;
  avance_programado: number;
  /** null = mes todavia sin medir. No es cero. */
  avance_real: number | null;
  nota: string | null;
  actualizado_en: string;
};

export type Reporte = {
  id: string;
  frente_de_trabajo_id: string;
  disciplina: Disciplina;
  tipo_de_reporte: TipoDeReporte;
  descripcion: string;
  fotos: string[];
  estatus: EstatusReporte;
  comentario_de_aprobacion: string | null;
  reportado_por: string;
  revisado_por: string | null;
  revisado_en: string | null;
  fecha: string;
};

/** Reporte con las relaciones que devuelven las consultas del dashboard. */
export type ReporteExpandido = Reporte & {
  frente: Pick<Frente, "id" | "nombre" | "frente_principal"> | null;
  autor: Pick<Usuario, "id" | "nombre" | "disciplina"> | null;
};

/**
 * Regla de negocio 3. Se replica aca para poder calcular el semaforo en
 * memoria (informe, agrupaciones) sin volver a consultar la vista.
 */
export function calcularSemaforo(alertas: number): Semaforo {
  if (alertas <= 0) return "A tiempo";
  if (alertas === 1) return "Atraso leve";
  return "Crítico";
}

export function esAlerta(r: Pick<Reporte, "tipo_de_reporte" | "estatus">): boolean {
  return r.tipo_de_reporte === "Problemática" || r.estatus === "Rechazado";
}

export function formatearFecha(iso: string): string {
  return new Date(iso).toLocaleString("es-SV", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "2026-09-01" -> "sep 2026". Se arma en UTC para que no corra un dia. */
export function formatearPeriodo(iso: string): string {
  const [a, m] = iso.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, 1)).toLocaleDateString("es-SV", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Porcentaje con un decimal y signo explicito cuando se pide. */
export function formatearPorcentaje(n: number, conSigno = false): string {
  const v = Number(n) || 0;
  return `${conSigno && v > 0 ? "+" : ""}${v.toFixed(1)}%`;
}

/** El ultimo mes que tiene medicion real. Es el corte de la curva. */
export function ultimoMedido(puntos: PuntoCurva[]): PuntoCurva | null {
  for (let i = puntos.length - 1; i >= 0; i--) {
    if (puntos[i].avance_real !== null) return puntos[i];
  }
  return null;
}
