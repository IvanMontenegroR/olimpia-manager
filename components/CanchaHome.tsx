"use client";

import { useEffect, useRef, useState } from "react";
import { repartirCancha } from "@/lib/formacion.ts";
import Dorsal from "./Dorsal.tsx";
import { nivelEf } from "@/lib/juego.ts";
import type { ContextoPartido, Jugador, Posicion } from "@/engine/tipos.ts";

/**
 * El once que va a salir, en la cancha, en la pantalla principal.
 *
 * El número debajo de cada uno es lo que vale hoy, que es lo que cualquiera
 * espera leer ahí: el nivel con el ánimo, las piernas y el puesto ya metidos
 * adentro. Promediarlos da el OVR de la card, así que los dos números hablan
 * el mismo idioma.
 *
 * El ánimo va en el color del aro, no en el número. Poner el ánimo como cifra
 * se confundía con el nivel del jugador, que es lo que ese lugar significa en
 * cualquier juego de fútbol.
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
  once, puestos, formacion, ctx, animoDe, bajaDe, onTocar, onModificar,
}: {
  once: Jugador[];
  puestos: Map<string, Posicion>;
  formacion: string;
  ctx: ContextoPartido;
  animoDe: (j: Jugador) => number;
  /** Por qué no está disponible, si no lo está. */
  bajaDe: (j: Jugador) => "lesionado" | "suspendido" | null;
  onTocar: (j: Jugador) => void;
  onModificar: () => void;
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
            {/*
              * El anillo alrededor del dorsal se llena con la confianza: lleno
              * es 100, y lo que falta se ve como hueco. Un color solo decía si
              * estaba bien o mal; el anillo dice además cuánto falta, que es lo
              * que hace querer subirlo.
              */}
            <span className="relative flex items-center justify-center"
                  style={{ width: tam + 10, height: tam + 10, opacity: baja ? 0.5 : 1 }}>
              <span className="absolute inset-0 rounded-full"
                    style={{
                      background: `conic-gradient(from -90deg, ${color} ${animo * 3.6}deg,
                        rgba(255,255,255,0.18) ${animo * 3.6}deg)`,
                      transition: "background 500ms ease-out",
                    }} />
              <span className="absolute rounded-full"
                    style={{ inset: 4, background: "#10231a" }} />
              <span className="relative" style={{ boxShadow: "0 2px 6px rgba(0,0,0,0.55)", borderRadius: 999 }}>
                <Dorsal numero={j.numero} tam={tam} />
              </span>
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
              {/* lo que vale hoy, no el ánimo: el ánimo está en el aro */}
              <span className="num font-bold"
                    style={{ color: baja ? "#c0392b" : "#e9e4d8",
                             textShadow: "0 1px 3px rgba(0,0,0,0.9)" }}>
                {baja === "lesionado" ? "LESIÓN" : baja === "suspendido" ? "SUSP"
                  : nivelEf(j, puesto, ctx)}
              </span>
            </span>
          </button>
        );
      })}

      {/* Qué significa el aro, sin párrafo: los tres colores y listo. */}
      {/* Tocar a un jugador abre su ficha; para mover el equipo, este botón. */}
      <button onClick={onModificar}
        className="relieve absolute bottom-2 right-4 rounded-md px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-[0.1em]"
        style={{ background: "rgba(10,18,13,0.82)", color: "var(--tenue)",
                 backdropFilter: "blur(3px)", boxShadow: "0 0 0 1px rgba(255,255,255,0.14)" }}>
        Modificar
      </button>
    </div>
  );
}
