"use client";

import { LINEA_DE, type Posicion } from "@/engine/tipos.ts";

/**
 * El número de camiseta de un jugador de Olimpia: círculo blanco, franja negra
 * al medio y el número en rojo con la línea clara por dentro. Es la identidad
 * visual del jugador, porque no hay caras.
 */
export default function Dorsal({
  numero, tam = 26, fuente,
}: { numero: number; tam?: number; fuente?: number }) {
  const cuerpo = fuente ?? tam * 0.74;
  return (
    <span className="dorsal relieve" style={{ width: tam, height: tam, background: "#ffffff" }}>
      <span className="dorsal-franja" />
      <span className={`dorsal-numero ${tam < 26 ? "chico" : ""}`} style={{ fontSize: cuerpo }}>
        {numero}
      </span>
    </span>
  );
}

/** El del rival lleva el color de su club, para distinguirlos de un vistazo. */
export function DorsalRival({
  numero, color, tam = 24,
}: { numero: number; color: string; tam?: number }) {
  return (
    <span className="dorsal" style={{ width: tam, height: tam, background: color }}>
      <span className="dorsal-numero chico"
            style={{ fontSize: tam * 0.6, color: "#0d0d0d", WebkitTextStroke: "0px" }}>
        {numero}
      </span>
    </span>
  );
}

const COLOR_LINEA = {
  ARQ: "#d9a832",
  DEF: "#4a7fb5",
  MED: "#3fa76a",
  DEL: "#c0392b",
} as const;

export const colorDe = (pos: Posicion) => COLOR_LINEA[LINEA_DE[pos]];
