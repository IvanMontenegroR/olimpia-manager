"use client";

import { useEffect, useRef, useState } from "react";
import { repartirCancha } from "@/lib/formacion.ts";
import Dorsal from "./Dorsal.tsx";
import type { Jugador, Posicion } from "@/engine/tipos.ts";

/**
 * El once que va a salir, en la cancha, en la pantalla principal.
 *
 * Acá vivía el diario, que era texto para leer y nada para hacer. Esto es lo
 * contrario: es donde se ve el ánimo de cada uno, que es el dato que mueve el
 * OVR y que hasta ahora no aparecía en ninguna parte salvo entrando a la ficha
 * de a uno.
 */

/** El color del ánimo, que es lo que se muestra por jugador. */
export function colorAnimo(animo: number): string {
  if (animo >= 82) return "#3fa76a";
  if (animo >= 62) return "#8fa396";
  if (animo >= 45) return "#e0902a";
  return "#c0392b";
}

function useMedida() {
  const ref = useRef<HTMLDivElement>(null);
  const [caja, setCaja] = useState({ ancho: 0, alto: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect;
      setCaja({ ancho: width, alto: height });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return [ref, caja] as const;
}

export default function CanchaHome({
  once, puestos, formacion, animoDe, bajaDe, onTocar,
}: {
  once: Jugador[];
  puestos: Map<string, Posicion>;
  formacion: string;
  animoDe: (j: Jugador) => number;
  /** Por qué no está disponible, si no lo está. */
  bajaDe: (j: Jugador) => "lesionado" | "suspendido" | null;
  onTocar: (j: Jugador) => void;
}) {
  const [ref, caja] = useMedida();
  const { ubicados, escala } = repartirCancha(formacion, caja.ancho, caja.alto);
  const tam = Math.round(30 * escala);

  return (
    <div ref={ref} className="relieve relative min-h-0 flex-1 overflow-hidden rounded-lg"
         style={{ background: "#10231a", boxShadow: "inset 0 0 0 1px var(--linea)" }}>
      <div className="absolute inset-0"
           style={{ backgroundImage:
             "repeating-linear-gradient(0deg, rgba(255,255,255,0.03) 0 30px, transparent 30px 60px)" }} />

      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100"
           preserveAspectRatio="none" style={{ opacity: 0.22 }} aria-hidden>
        <rect x="2" y="1" width="96" height="98" fill="none" stroke="#fff" strokeWidth="0.35" />
        <line x1="2" y1="50" x2="98" y2="50" stroke="#fff" strokeWidth="0.35" />
        <rect x="26" y="1" width="48" height="11" fill="none" stroke="#fff" strokeWidth="0.35" />
        <rect x="26" y="88" width="48" height="11" fill="none" stroke="#fff" strokeWidth="0.35" />
      </svg>
      <div className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full"
           style={{ border: "1px solid rgba(255,255,255,0.22)" }} />

      {ubicados.map(({ slot, x, y }) => {
        const j = once[slot];
        if (!j) return null;
        const puesto = puestos.get(j.id) ?? j.posicion;
        const adaptado = puesto !== j.posicion;
        const animo = animoDe(j);
        const baja = bajaDe(j);
        const color = baja ? "#c0392b" : colorAnimo(animo);
        return (
          <button key={j.id} onClick={() => onTocar(j)}
            className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
            style={{ left: x, top: y, width: 62 * escala }}>
            <span style={{
                    borderRadius: 999,
                    boxShadow: `0 0 0 2px ${color}, 0 2px 6px rgba(0,0,0,0.55)`,
                    opacity: baja ? 0.5 : 1,
                  }}>
              <Dorsal numero={j.numero} tam={tam} />
            </span>
            <span className="apellido mt-0.5 max-w-full truncate leading-tight"
                  style={{ fontSize: 9 * escala, textShadow: "0 1px 3px rgba(0,0,0,0.9)",
                           opacity: baja ? 0.6 : 1 }}>
              {j.apellido}
            </span>
            <span className="flex items-center gap-1 leading-tight" style={{ fontSize: 8 * escala }}>
              {adaptado && !baja && (
                <span className="font-bold" style={{ color: "var(--medio)" }}>{puesto}</span>
              )}
              <span className="num font-bold"
                    style={{ color, textShadow: "0 1px 3px rgba(0,0,0,0.9)" }}>
                {baja === "lesionado" ? "LESIÓN" : baja === "suspendido" ? "SUSP" : animo}
              </span>
            </span>
          </button>
        );
      })}

      <span className="absolute bottom-1 left-2 text-[8px] uppercase tracking-[0.14em]"
            style={{ color: "#ffffff55" }}>
        el once · ánimo
      </span>
    </div>
  );
}
