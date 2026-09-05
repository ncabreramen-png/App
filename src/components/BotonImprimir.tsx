"use client";

export default function BotonImprimir() {
  return (
    <button onClick={() => window.print()} className="boton no-imprimir">
      Imprimir / Guardar PDF
    </button>
  );
}
