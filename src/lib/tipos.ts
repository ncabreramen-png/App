import type { Archivo } from "@/lib/archivos";

export const DISCIPLINAS = [
  // Disciplinas de ingenieria, por frente de obra.
  "Hidráulico",
  "Estructural",
  "Civil",
  "Mecánico",
  "Eléctrico",
  "Geotecnia",
  // Transversales: reportan sobre cualquier frente.
  "Medio ambiente",
  "Seguridad y salud ocupacional",
  "Gestión social",
  "Aseguramiento de calidad",
  // Administracion: no reporta por frente, informa el corte mensual del contrato.
  "Administración",
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

export const ESTADOS_NC = ["Pendiente", "Atendida"] as const;
export type EstadoNC = (typeof ESTADOS_NC)[number];

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
  /** false = se le corto el acceso, pero su historial sigue firmado por el. */
  activo: boolean;
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
  /** Si es > 0, el avance fisico sale del cronograma y no se edita a mano. */
  tareas: number;
};

/** No conformidad: la levanta y la cierra aseguramiento de calidad. */
export type NoConformidad = {
  id: string;
  numero: number;
  frente_de_trabajo_id: string;
  descripcion: string;
  archivos: Archivo[];
  estado: EstadoNC;
  detectada_en: string;
  atendida_en: string | null;
  comentario_cierre: string | null;
  creado_por: string;
  creado_en: string;
  actualizado_en: string;
};

export type NoConformidadExpandida = NoConformidad & {
  frente: Pick<Frente, "id" | "nombre" | "frente_principal"> | null;
  autor: Pick<Usuario, "id" | "nombre" | "disciplina"> | null;
};

/** Codigo para citarla en correspondencia: NC-001. */
export function codigoNC(numero: number): string {
  return `NC-${String(numero).padStart(3, "0")}`;
}

/** Relevo de un profesional por otro en la misma disciplina. */
export type Sustitucion = {
  id: string;
  predecesor_id: string;
  sucesor_id: string;
  disciplina: Disciplina;
  motivo: string | null;
  creado_en: string;
};

/** Una tarea del cronograma. Pertenece a un frente. */
export type Tarea = {
  id: string;
  frente_de_trabajo_id: string;
  nombre: string;
  inicio: string;
  fin: string;
  avance: number;
  /** null = ponderar por la duracion en dias. */
  peso: number | null;
  orden: number;
  creado_en: string;
  actualizado_en: string;
};

export type TareaExpandida = Tarea & {
  frente: Pick<Frente, "id" | "nombre" | "frente_principal"> | null;
};

/** Analisis de gerencia: contenido privado que se comparte eligiendo usuarios. */
export type Analisis = {
  id: string;
  titulo: string;
  descripcion: string;
  archivos: Archivo[];
  frente_de_trabajo_id: string | null;
  creado_por: string;
  creado_en: string;
  actualizado_en: string;
};

export type AnalisisExpandido = Analisis & {
  frente: Pick<Frente, "id" | "nombre" | "frente_principal"> | null;
  autor: Pick<Usuario, "id" | "nombre" | "disciplina"> | null;
  /** Usuarios con los que se compartio. Vacio = privado. */
  compartido_con: Pick<Usuario, "id" | "nombre" | "disciplina" | "rol">[];
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

/**
 * Corte mensual de administracion: como va el contrato en plata y en papeles.
 *
 * Los importes y las cantidades son ACUMULADOS al cierre del mes, igual que el
 * avance. Asi la serie se lee sola y no hay que sumar meses para saber donde
 * va el contrato.
 */
export type ReporteAdministracion = {
  id: string;
  /** Primer dia del mes informado. Hay uno solo por mes. */
  periodo: string;
  avance_programado: number;
  avance_real: number;
  monto_financiero: number;
  avance_financiero: number;
  estimaciones_autorizadas: number;
  importe_autorizado: number;
  estimaciones_pagadas: number;
  importe_pagado: number;
  comentario: string;
  archivos: Archivo[];
  creado_por: string;
  creado_en: string;
  actualizado_en: string;
};

export type ReporteAdministracionExpandido = ReporteAdministracion & {
  autor: Pick<Usuario, "id" | "nombre" | "disciplina"> | null;
};

export type Reporte = {
  id: string;
  frente_de_trabajo_id: string;
  disciplina: Disciplina;
  tipo_de_reporte: TipoDeReporte;
  descripcion: string;
  /** OBSOLETO: se conserva en la base, la aplicacion lee "archivos". */
  fotos: string[];
  archivos: Archivo[];
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

/**
 * Dolares con separador de miles: $1,234.56. El Salvador usa USD, coma para
 * los miles y punto decimal.
 */
export function formatearMoneda(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(n) || 0);
}
