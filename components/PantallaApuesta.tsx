"use client";

/**
 * Cómo salió la apuesta.
 *
 * Cuando una decisión depende del azar hay que verlo: elegís sabiendo la
 * chance y después el juego te muestra si salió. Sin esto el azar existía pero
 * quedaba escondido dentro del resultado, y no había forma de saber si te fue
 * mal por elegir mal o por mala suerte.
 */
export default function PantallaApuesta({ resultado, onSeguir }: {
  resultado: { salioBien: boolean; texto: string; chance: number };
  onSeguir: () => void;
}) {
  const { salioBien, texto, chance } = resultado;
  const color = salioBien ? "#3fa76a" : "#c0392b";
  const porcentaje = Math.round(chance * 100);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center px-6"
         style={{
           background: salioBien
             ? "radial-gradient(120% 90% at 50% 40%, #1b3a28, #0a120d 72%)"
             : "radial-gradient(120% 90% at 50% 40%, #3a1a1a, #0a120d 72%)",
         }}>

      <div className="flex w-full max-w-xs flex-col items-center text-center">
        {/* La barra muestra dónde cayó: el tramo verde es la chance que tenías. */}
        <div className="mb-6 w-full">
          <div className="mb-1.5 flex justify-between text-[9px] uppercase tracking-[0.16em]"
               style={{ color: "var(--apagado)" }}>
            <span>tenías {porcentaje}%</span>
            <span>{100 - porcentaje}%</span>
          </div>
          <div className="relative h-2.5 overflow-hidden rounded-full" style={{ background: "#c0392b55" }}>
            <div className="h-full rounded-full" style={{ width: `${porcentaje}%`, background: "#3fa76a88" }} />
            {/* la aguja cae donde salió */}
            <span className="aguja-apuesta absolute top-0 h-full"
                  style={{
                    left: salioBien ? `${porcentaje * 0.55}%` : `${porcentaje + (100 - porcentaje) * 0.5}%`,
                    width: 3, background: "#fff", boxShadow: "0 0 8px #fff",
                  }} />
          </div>
        </div>

        <div className="golpea-hito">
          <span className="flex h-16 w-16 items-center justify-center rounded-full text-[30px] font-extrabold"
                style={{ background: color, color: "#0a120d" }}>
            {salioBien ? "✓" : "✕"}
          </span>
        </div>

        <h1 className="apellido mt-4 text-[24px] leading-tight" style={{ color }}>
          {salioBien ? "Salió bien" : "Salió mal"}
        </h1>

        <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "var(--tenue)" }}>
          {texto}
        </p>

        <button onClick={onSeguir}
          className="mt-8 w-full rounded-lg py-3 text-[12px] font-extrabold uppercase tracking-[0.16em]"
          style={{ background: color, color: "#0a120d" }}>
          Seguir
        </button>
      </div>
    </div>
  );
}
