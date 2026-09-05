import type { EstatusReporte, Semaforo, TipoDeReporte } from "@/lib/tipos";

const ESTILO_SEMAFORO: Record<Semaforo, string> = {
  "A tiempo": "bg-green-100 text-green-800 border-green-300",
  "Atraso leve": "bg-amber-100 text-amber-800 border-amber-300",
  "Crítico": "bg-red-100 text-red-800 border-red-300",
};

const PUNTO_SEMAFORO: Record<Semaforo, string> = {
  "A tiempo": "bg-green-500",
  "Atraso leve": "bg-amber-500",
  "Crítico": "bg-red-500",
};

const ESTILO_ESTATUS: Record<EstatusReporte, string> = {
  Registrado: "bg-slate-100 text-slate-700 border-slate-300",
  Pendiente: "bg-amber-100 text-amber-800 border-amber-300",
  Aprobado: "bg-green-100 text-green-800 border-green-300",
  Rechazado: "bg-red-100 text-red-800 border-red-300",
};

const ESTILO_TIPO: Record<TipoDeReporte, string> = {
  Avance: "bg-marca-50 text-marca-700 border-marca-100",
  "Problemática": "bg-red-50 text-red-700 border-red-200",
  "Cambio de proyecto": "bg-violet-50 text-violet-700 border-violet-200",
  "Orden de cambio": "bg-amber-50 text-amber-800 border-amber-200",
};

const BASE = "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold";

export function InsigniaSemaforo({ valor }: { valor: Semaforo }) {
  return (
    <span className={`${BASE} ${ESTILO_SEMAFORO[valor]}`}>
      <span className={`h-2 w-2 rounded-full ${PUNTO_SEMAFORO[valor]}`} aria-hidden />
      {valor}
    </span>
  );
}

export function InsigniaEstatus({ valor }: { valor: EstatusReporte }) {
  return <span className={`${BASE} ${ESTILO_ESTATUS[valor]}`}>{valor}</span>;
}

export function InsigniaTipo({ valor }: { valor: TipoDeReporte }) {
  return <span className={`${BASE} ${ESTILO_TIPO[valor]}`}>{valor}</span>;
}
