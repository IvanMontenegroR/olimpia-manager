"use client";

/**
 * Los iconos del tablero.
 *
 * Están dibujados acá y no bajados de ningún lado: los logos de la Sudamericana
 * y de la APF son marcas registradas y las versiones libres que hay dan viejas
 * (todavía dicen Bridgestone) o son ilegibles a 34 píxeles. Estos siguen el
 * trazo del resto del juego y se leen a cualquier tamaño.
 */

export type ClaveIcono = "plantel" | "copa" | "tabla" | "pases";

export default function IconoModulo({ clave, color, tam = 30 }: {
  clave: ClaveIcono; color: string; tam?: number;
}) {
  const comun = {
    width: tam, height: tam, viewBox: "0 0 24 24", fill: "none",
    stroke: color, strokeWidth: 1.6,
    strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
    style: { opacity: 0.9, flexShrink: 0 },
  };

  if (clave === "plantel") {
    // la camiseta
    return (
      <svg {...comun}>
        <path d="M9 3 L5 5 L3.4 8.6 L6 10 v10.5 h12 V10 l2.6 -1.4 L19 5 L15 3" />
        <path d="M9 3 a3 3 0 0 0 6 0" />
      </svg>
    );
  }

  if (clave === "copa") {
    // la copa internacional, con la estrella adentro
    return (
      <svg {...comun}>
        <path d="M7 3.5 h10 v5 a5 5 0 0 1 -10 0 z" />
        <path d="M7 4.6 H4.4 v1.7 a3 3 0 0 0 2.8 3" />
        <path d="M17 4.6 h2.6 v1.7 a3 3 0 0 1 -2.8 3" />
        <path d="M12 13.5 v3.4 M8.6 20.5 h6.8 M9.8 16.9 h4.4 v3.6 h-4.4 z" />
        <path d="M12 5.4 l0.85 1.75 1.9 0.27 -1.38 1.35 0.33 1.9 -1.7 -0.9 -1.7 0.9 0.33 -1.9 -1.38 -1.35 1.9 -0.27 z"
              fill={color} stroke="none" style={{ opacity: 0.85 }} />
      </svg>
    );
  }

  if (clave === "tabla") {
    // la tabla de posiciones
    return (
      <svg {...comun}>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M3 8.5 h18" />
        <path d="M7 12.4 h10 M7 16.2 h10" />
        <circle cx="5.2" cy="12.4" r="0.9" fill={color} stroke="none" />
        <circle cx="5.2" cy="16.2" r="0.9" fill={color} stroke="none" />
      </svg>
    );
  }

  // el pase: la flecha que entra y la que sale
  return (
    <svg {...comun}>
      <path d="M3.5 8 h13 M13 4.5 L16.8 8 L13 11.5" />
      <path d="M20.5 16 h-13 M11 12.5 L7.2 16 L11 19.5" />
    </svg>
  );
}
