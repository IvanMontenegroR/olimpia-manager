"use client";

import { useState } from "react";
import visual from "@/data/clubes_visual.json";

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

  if (!sinArchivo) {
    return (
      <img src={`escudos/${id}.png`} alt={nombre} width={tam} height={tam}
           onError={() => setSinArchivo(true)}
           style={{ width: tam, height: tam, objectFit: "contain" }} />
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
