/**
 * Adjuntos. Los usan tanto los reportes de campo como los analisis de
 * gerencia, por eso vive aparte de ambos.
 */

export type Archivo = {
  ruta: string;
  nombre: string;
  tipo: string;
  tamano: number | null;
};

export const BUCKET_REPORTES = "reportes-fotos";
export const BUCKET_ANALISIS = "analisis-archivos";
export const BUCKET_NC = "nc-archivos";
export const BUCKET_ADMIN = "admin-archivos";

/** Tope por archivo. Debe coincidir con file_size_limit del bucket. */
export const LIMITE_REPORTE = 25 * 1024 * 1024;
export const LIMITE_ANALISIS = 50 * 1024 * 1024;

export const MAX_ADJUNTOS = 12;

const TIPOS_IMAGEN = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];

const TIPOS_DOCUMENTO = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // xlsx
  "application/vnd.ms-excel", // xls
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // docx
  "application/msword", // doc
  "application/vnd.openxmlformats-officedocument.presentationml.presentation", // pptx
  "application/vnd.ms-powerpoint", // ppt
  "text/csv",
  "text/plain",
];

/**
 * Para el atributo accept. Se listan extensiones ademas de los tipos MIME
 * porque varios navegadores de Android informan mal el tipo de los Office y
 * filtrarian archivos validos.
 */
export const ACEPTA_TODO = [
  ...TIPOS_IMAGEN,
  ...TIPOS_DOCUMENTO,
  ".pdf",
  ".xlsx",
  ".xls",
  ".docx",
  ".doc",
  ".pptx",
  ".ppt",
  ".csv",
  ".txt",
].join(",");

export const ACEPTA_IMAGEN = "image/*";

export function esImagen(tipo: string): boolean {
  return tipo.startsWith("image/");
}

/**
 * Se valida por extension ademas de por tipo MIME: en Android es comun que un
 * .xlsx llegue como application/octet-stream y seria rechazado sin motivo.
 */
export function tipoPermitido(archivo: File): boolean {
  if (TIPOS_IMAGEN.includes(archivo.type) || TIPOS_DOCUMENTO.includes(archivo.type)) {
    return true;
  }
  if (archivo.type.startsWith("image/")) return true;
  return /\.(pdf|xlsx?|docx?|pptx?|csv|txt)$/i.test(archivo.name);
}

/** Etiqueta corta para la tarjeta del archivo: XLSX, PDF, DOCX... */
export function etiquetaTipo(a: Archivo): string {
  const ext = a.nombre.match(/\.([a-z0-9]+)$/i)?.[1]?.toUpperCase();
  if (ext) return ext;
  if (esImagen(a.tipo)) return "IMG";
  return "ARCHIVO";
}

const COLORES: Record<string, string> = {
  PDF: "bg-red-100 text-red-800",
  XLSX: "bg-green-100 text-green-800",
  XLS: "bg-green-100 text-green-800",
  CSV: "bg-green-100 text-green-800",
  DOCX: "bg-blue-100 text-blue-800",
  DOC: "bg-blue-100 text-blue-800",
  PPTX: "bg-orange-100 text-orange-800",
  PPT: "bg-orange-100 text-orange-800",
};

export function colorTipo(etiqueta: string): string {
  return COLORES[etiqueta] ?? "bg-slate-100 text-slate-700";
}

export function formatearTamano(bytes: number | null): string {
  if (bytes === null || !Number.isFinite(bytes)) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Nombre seguro para Supabase Storage, conservando la extension. */
export function nombreSeguro(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(-80);
}
