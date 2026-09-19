export default function BarraAvance({
  etiqueta,
  valor,
}: {
  etiqueta: string;
  valor: number;
}) {
  const pct = Math.max(0, Math.min(100, Number(valor) || 0));

  return (
    <div>
      <div className="flex items-baseline justify-between text-xs text-slate-600">
        <span>{etiqueta}</span>
        <span className="font-semibold text-slate-800">{pct.toFixed(1)}%</span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-200">
        <div className="h-full rounded-full bg-marca-600" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
