"use client";

/**
 * El trofeo de cada competición, dibujado a mano en SVG.
 *
 * Están en `public/trofeos` y son cuatro: la Intercontinental, la Sudamericana,
 * la Libertadores y el escudo del Mundial de Clubes. Se usan donde antes había
 * solo un color y un nombre: una copa se reconoce por su forma mucho antes que
 * por la palabra.
 */
export type Copa = "intercontinental" | "sudamericana" | "libertadores" | "mundial_clubes";

export default function Trofeo({ copa, alto = 40 }: { copa: Copa; alto?: number }) {
  return (
    <img src={`trofeos/${copa}.svg`} alt="" aria-hidden height={alto}
         style={{ height: alto, width: "auto", display: "block" }} />
  );
}
