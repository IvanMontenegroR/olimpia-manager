"use client";

/**
 * La cara de cada situación.
 *
 * Antes todas las decisiones se veían igual: la misma tarjeta con distinto
 * color de fondo, así que el asado del plantel y la reunión con la dirigencia
 * se leían como lo mismo. Cada escena tiene su fondo, su acento y su dibujo,
 * de modo que se reconozca de qué se trata antes de leer una palabra.
 *
 * Los dibujos son SVG a propósito: pesan nada y quedan nítidos en cualquier
 * pantalla.
 */

export type TipoEscena =
  | "vestuario" | "cancha" | "prensa" | "tribuna" | "ruta"
  | "clasico" | "mercado" | "dirigencia" | "sanidad" | "predio";

export interface Escena {
  acento: string;
  fondo: string;
  rotulo: string;
}

export const ESCENAS: Record<TipoEscena, Escena> = {
  vestuario:  { acento: "#3fa76a", rotulo: "Vestuario",
                fondo: "radial-gradient(130% 80% at 50% 0%, #1d3a2b, #0a120d 70%)" },
  cancha:     { acento: "#4fae74", rotulo: "En la cancha",
                fondo: "radial-gradient(130% 80% at 50% 0%, #14301f, #0a120d 70%)" },
  prensa:     { acento: "#d9a832", rotulo: "Prensa",
                fondo: "radial-gradient(130% 80% at 50% 0%, #3a3016, #0a120d 70%)" },
  tribuna:    { acento: "#e0902a", rotulo: "La gente",
                fondo: "radial-gradient(130% 80% at 50% 0%, #3a2a12, #0a120d 70%)" },
  ruta:       { acento: "#7f8fa0", rotulo: "El viaje",
                fondo: "radial-gradient(130% 80% at 50% 0%, #23303a, #0a120d 70%)" },
  clasico:    { acento: "#c0392b", rotulo: "Clásico",
                fondo: "radial-gradient(130% 80% at 50% 0%, #3a1620, #0a120d 68%)" },
  mercado:    { acento: "#5fb0e8", rotulo: "Mercado",
                fondo: "radial-gradient(130% 80% at 50% 0%, #14304a, #0a120d 70%)" },
  dirigencia: { acento: "#4a7fb5", rotulo: "Dirigencia",
                fondo: "radial-gradient(130% 80% at 50% 0%, #1b2c3e, #0a120d 70%)" },
  sanidad:    { acento: "#c96f6f", rotulo: "Sanidad",
                fondo: "radial-gradient(130% 80% at 50% 0%, #33222a, #0a120d 70%)" },
  predio:     { acento: "#8a9a5b", rotulo: "El predio",
                fondo: "radial-gradient(130% 80% at 50% 0%, #2a3020, #0a120d 70%)" },
};

/** El dibujo de fondo de cada escena. Va detrás del texto, tenue. */
export function DibujoEscena({ tipo, color }: { tipo: TipoEscena; color: string }) {
  const comun = { fill: "none", stroke: color, strokeWidth: 1.4,
                  strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

  return (
    <svg viewBox="0 0 120 70" preserveAspectRatio="xMidYMid slice"
         className="pointer-events-none absolute inset-0 h-full w-full"
         style={{ opacity: 0.13 }} aria-hidden>
      {tipo === "vestuario" && (
        <>
          {/* perchas con camisetas colgadas */}
          <line x1="14" y1="16" x2="106" y2="16" {...comun} />
          {[26, 46, 66, 86].map((x) => (
            <g key={x}>
              <line x1={x} y1="16" x2={x} y2="24" {...comun} />
              <path d={`M${x - 11} 26 l6 -4 h10 l6 4 v22 h-22 z`} {...comun} />
              <line x1={x - 2} y1="26" x2={x - 2} y2="48" {...comun} />
              <line x1={x + 2} y1="26" x2={x + 2} y2="48" {...comun} />
            </g>
          ))}
        </>
      )}

      {tipo === "cancha" && (
        <>
          <rect x="10" y="8" width="100" height="54" rx="2" {...comun} />
          <line x1="60" y1="8" x2="60" y2="62" {...comun} />
          <circle cx="60" cy="35" r="11" {...comun} />
          <rect x="10" y="22" width="14" height="26" {...comun} />
          <rect x="96" y="22" width="14" height="26" {...comun} />
        </>
      )}

      {tipo === "prensa" && (
        <>
          {/* micrófonos apuntando */}
          {[34, 52, 70, 88].map((x, i) => (
            <g key={x}>
              <rect x={x - 5} y={16 + i % 2 * 5} width="10" height="17" rx="5" {...comun} />
              <line x1={x} y1={33 + i % 2 * 5} x2={x} y2={58} {...comun} />
            </g>
          ))}
          <line x1="20" y1="60" x2="100" y2="60" {...comun} />
        </>
      )}

      {tipo === "tribuna" && (
        <>
          {/* escalones de la popular con banderas */}
          {[0, 1, 2, 3].map((i) => (
            <line key={i} x1={16 + i * 4} y1={56 - i * 11} x2={104 - i * 4} y2={56 - i * 11} {...comun} />
          ))}
          <path d="M40 24 l0 -14 l16 4 l-16 4" {...comun} />
          <path d="M78 24 l0 -14 l-16 4 l16 4" {...comun} />
        </>
      )}

      {tipo === "ruta" && (
        <>
          <path d="M8 62 L48 10 M112 62 L72 10" {...comun} />
          {[16, 30, 44].map((y, i) => (
            <line key={y} x1={60} y1={y} x2={60} y2={y + 7 - i} {...comun} />
          ))}
        </>
      )}

      {tipo === "clasico" && (
        <>
          {/* dos escudos enfrentados */}
          <path d="M38 12 h22 v20 c0 10 -11 16 -11 16 s-11 -6 -11 -16 z" {...comun} />
          <path d="M62 12 h22 v20 c0 10 -11 16 -11 16 s-11 -6 -11 -16 z" {...comun} />
          <line x1="61" y1="6" x2="61" y2="60" {...comun} strokeDasharray="3 4" />
        </>
      )}

      {tipo === "mercado" && (
        <>
          {[0, 1, 2].map((i) => (
            <rect key={i} x={30 + i * 7} y={16 + i * 8} width="52" height="26" rx="3" {...comun} />
          ))}
          <circle cx="60" cy="43" r="7" {...comun} />
        </>
      )}

      {tipo === "dirigencia" && (
        <>
          {/* mesa larga y sillas */}
          <rect x="22" y="30" width="76" height="7" rx="2" {...comun} />
          <line x1="30" y1="37" x2="30" y2="56" {...comun} />
          <line x1="90" y1="37" x2="90" y2="56" {...comun} />
          {[38, 52, 68, 82].map((x) => (
            <circle key={x} cx={x} cy="20" r="6" {...comun} />
          ))}
        </>
      )}

      {tipo === "sanidad" && (
        <>
          <rect x="30" y="26" width="60" height="20" rx="3" {...comun} />
          <line x1="36" y1="46" x2="36" y2="58" {...comun} />
          <line x1="84" y1="46" x2="84" y2="58" {...comun} />
          <path d="M56 14 h8 v6 h6 v8 h-6 v6 h-8 v-6 h-6 v-8 h6 z" {...comun} />
        </>
      )}

      {tipo === "predio" && (
        <>
          <path d="M12 58 h96" {...comun} />
          {[24, 44, 64, 84, 100].map((x, i) => (
            <path key={x} d={`M${x} 58 v-${10 + (i % 3) * 5} M${x - 4} ${52 - (i % 3) * 4} L${x} ${44 - (i % 3) * 5} L${x + 4} ${52 - (i % 3) * 4}`} {...comun} />
          ))}
          <circle cx="60" cy="18" r="6" {...comun} />
        </>
      )}
    </svg>
  );
}
