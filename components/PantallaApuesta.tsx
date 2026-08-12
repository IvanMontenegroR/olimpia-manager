"use client";

import { useState } from "react";
import Sorteo from "./Sorteo.tsx";

/**
 * Cómo salió la apuesta.
 *
 * Primero se sortea a la vista: el cartel alterna entre las dos caras y frena
 * en la que salió. Recién después aparece qué pasó. Antes se entraba con el
 * resultado ya puesto y el azar quedaba escondido adentro, así que no había
 * forma de saber si te fue mal por elegir mal o por mala suerte.
 */
export default function PantallaApuesta({ resultado, onSeguir }: {
  resultado: { salioBien: boolean; texto: string; chance: number };
  onSeguir: () => void;
}) {
  const { salioBien, texto, chance } = resultado;
  const [listo, setListo] = useState(false);
  const color = salioBien ? "#3fa76a" : "#c0392b";

  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center px-6"
         style={{
           background: !listo
             ? "radial-gradient(120% 90% at 50% 40%, #1c2028, #0a120d 72%)"
             : salioBien
               ? "radial-gradient(120% 90% at 50% 40%, #1b3a28, #0a120d 72%)"
               : "radial-gradient(120% 90% at 50% 40%, #3a1a1a, #0a120d 72%)",
           transition: "background 420ms ease-out",
         }}>

      <div className="flex w-full max-w-xs flex-col items-center text-center">
        <Sorteo
          chance={chance}
          exito={salioBien}
          riesgo={null}
          grande
          caras={{ pregunta: "se juega", bien: "SALIÓ BIEN", mal: "SALIÓ MAL" }}
          onTermina={() => setListo(true)} />

        {/* Lo que pasó no se lee hasta que el cartel frenó. */}
        <div style={{ opacity: listo ? 1 : 0, transition: "opacity 320ms ease-out" }}>
          <p className="mt-5 text-[14px] leading-relaxed" style={{ color: "var(--tenue)" }}>
            {texto}
          </p>

          <button onClick={onSeguir} disabled={!listo}
            className="mt-7 w-full rounded-lg py-3 text-[12px] font-extrabold uppercase tracking-[0.16em]"
            style={{ background: color, color: "#0a120d" }}>
            Seguir
          </button>
        </div>
      </div>
    </div>
  );
}
