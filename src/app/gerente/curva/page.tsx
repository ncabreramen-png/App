import CurvaAvance from "@/components/CurvaAvance";
import ResumenCurva from "@/components/ResumenCurva";
import { obtenerCurva } from "@/lib/consultas";
import EditorCurva from "./EditorCurva";

export const dynamic = "force-dynamic";

export default async function PaginaCurva() {
  const puntos = await obtenerCurva();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Curva de avance</h1>
        <p className="mt-0.5 text-sm text-slate-600">
          Avance acumulado del proyecto, programado contra real. Los valores se
          cargan a mano desde el cronograma contractual.
        </p>
      </div>

      <ResumenCurva puntos={puntos} />
      <CurvaAvance puntos={puntos} />
      <EditorCurva puntos={puntos} />
    </div>
  );
}
