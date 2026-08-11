"use client";

import { useState } from "react";
import visual from "@/data/clubes_visual.json";
import archivos from "@/data/escudos.json";

type Estilo = {
  primario: string; secundario: string; sobrePrimario: string; escudo: boolean;
};

const NEUTRO: Estilo = {
  primario: "#3f3f46", secundario: "#a1a1aa", sobrePrimario: "#ffffff", escudo: false,
};

export const estiloClub = (id: string): Estilo =>
  ((visual as Record<string, unknown>)[id] as Estilo) ?? NEUTRO;

/**
 * Escudo del club. Basta con dejar el archivo en `public/escudos/<id>.png` y
 * aparece solo; si no está, cae a un monograma con los colores del club. El
 * fallback no es un parche provisorio: nueve de los doce clubes no van a tener
 * escudo cargado.
 */
export default function Escudo({
  id, nombre, tam = 28,
}: { id: string; nombre: string; tam?: number }) {
  const e = estiloClub(id);
  const [sinArchivo, setSinArchivo] = useState(false);
  const inicial = nombre.replace(/^(Club|Sportivo|Deportivo)\s+/i, "").charAt(0).toUpperCase();
  const ext = (archivos as Record<string, string>)[id];

  if (ext && !sinArchivo) {
    // Varios escudos paraguayos son negros sobre transparente y la interfaz es
    // oscura: sin un chip claro detrás, Olimpia y Libertad desaparecen.
    return (
      <span className="inline-flex shrink-0 items-center justify-center rounded-[5px]"
            style={{ width: tam, height: tam, background: "#f4f4f5", padding: tam * 0.07 }}>
        <img src={`escudos/${id}.${ext}`} alt={nombre}
             onError={() => setSinArchivo(true)}
             style={{ width: "100%", height: "100%", objectFit: "contain" }} />
      </span>
    );
  }

  return (
    <span aria-label={nombre}
      className="num inline-flex shrink-0 items-center justify-center rounded-[5px]"
      style={{
        width: tam, height: tam,
        fontSize: tam * 0.5,
        background: e.primario,
        color: e.sobrePrimario,
        boxShadow: `inset 0 -3px 0 ${e.secundario}`,
      }}>
      {inicial}
    </span>
  );
}
