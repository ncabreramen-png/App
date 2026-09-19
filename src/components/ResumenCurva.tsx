import { formatearPeriodo, formatearPorcentaje, ultimoMedido, type PuntoCurva } from "@/lib/tipos";

/**
 * El titular de la curva: donde deberia estar el proyecto, donde esta, y la
 * brecha entre ambos. Se lee al mes medido mas reciente, no al ultimo mes
 * cargado, porque los meses futuros solo tienen programado.
 */
export default function ResumenCurva({ puntos }: { puntos: PuntoCurva[] }) {
  const corte = ultimoMedido(puntos);
  if (!corte || corte.avance_real === null) return null;

  const desvio = corte.avance_real - corte.avance_programado;
  const atrasado = desvio < 0;

  return (
    <section className="evitar-corte">
      <p className="mb-2 text-xs text-slate-500">
        Al cierre de {formatearPeriodo(corte.periodo)}
      </p>
      <div className="grid grid-cols-3 gap-3">
        <Casilla etiqueta="Programado" valor={formatearPorcentaje(corte.avance_programado)} />
        <Casilla etiqueta="Real" valor={formatearPorcentaje(corte.avance_real)} />
        <Casilla
          etiqueta={atrasado ? "Atraso" : "Adelanto"}
          valor={formatearPorcentaje(desvio, true)}
          estado={atrasado ? "malo" : "bueno"}
        />
      </div>
    </section>
  );
}

function Casilla({
  etiqueta,
  valor,
  estado,
}: {
  etiqueta: string;
  valor: string;
  estado?: "bueno" | "malo";
}) {
  // El estado viaja en la etiqueta ademas del color: "Atraso" / "Adelanto" ya
  // dicen el signo sin depender de que se distinga rojo de verde.
  const borde =
    estado === "malo"
      ? "border-red-300 bg-red-50"
      : estado === "bueno"
        ? "border-green-300 bg-green-50"
        : "border-slate-200 bg-white";
  const tinta =
    estado === "malo" ? "text-red-800" : estado === "bueno" ? "text-green-800" : "text-slate-900";

  return (
    <div className={`rounded-xl border p-3 text-center ${borde}`}>
      <p className={`text-xl font-bold ${tinta}`}>{valor}</p>
      <p className="mt-0.5 text-xs text-slate-600">{etiqueta}</p>
    </div>
  );
}
