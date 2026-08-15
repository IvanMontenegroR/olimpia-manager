"use client";

import { useEffect, useRef, useState } from "react";
import { repartirCancha } from "@/lib/formacion.ts";
import Dorsal from "./Dorsal.tsx";
import { factorPosicion } from "@/engine/motor.ts";
import { aroDe, colorComoLlega, comoLlegaAlPartido } from "@/lib/juego.ts";
import type { ContextoPartido, Jugador, Posicion } from "@/engine/tipos.ts";

/**
 * El once que va a salir, en la cancha, en la pantalla principal.
 *
 * El número debajo de cada uno es SU NIVEL, el mismo que dice su ficha y el
 * mismo con el que lo fichaste. Antes acá se mostraba el nivel efectivo, o sea
 * el de hoy con el ánimo y las piernas metidos adentro, y eso hacía que el
 * mismo jugador fuera un 74 en el mercado y un 76 en la cancha sin que nada lo
 * explicara.
 *
 * Cómo llega no desaparece: va en el aro, que se llena con la fracción de su
 * ficha que está rindiendo hoy. Es el mismo aro y el mismo número que la
 * pantalla de armar el once: antes uno se llenaba con el ánimo y el otro con
 * la condición, así que el mismo jugador se veía distinto en cada pantalla.
 * Y el total con todo adentro sigue estando en la card de arriba, que es donde
 * corresponde: los once números de acá promedian exactamente el PLANTEL de la
 * card, y de ahí para arriba están el vestuario, la hinchada y el físico.
 */

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
  once, puestos, formacion, ctx, bajaDe, onTocar, onModificar,
}: {
  once: Jugador[];
  puestos: Map<string, Posicion>;
  formacion: string;
  ctx: ContextoPartido;
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
        // solo se avisa si le cuesta: entre mediocampistas no le cuesta nada
        const adaptado = factorPosicion(j, puesto) < 0.995;
        const rinde = comoLlegaAlPartido(j, puesto, ctx);
        const lleno = aroDe(rinde);
        const baja = bajaDe(j);
        const color = baja ? "#c0392b" : colorComoLlega(rinde);
        return (
          <button key={j.id} onClick={() => onTocar(j)}
            className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
            style={{ left: x, top: y, width: 62 * escala }}>
            {/* El aro se llena con cuánto de lo suyo está rindiendo: entero y
                enchufado lo llena, fundido o dolido lo vacía. */}
            <span className="relative flex items-center justify-center"
                  style={{ width: tam + 10, height: tam + 10, opacity: baja ? 0.5 : 1 }}>
              <span className="absolute inset-0 rounded-full"
                    style={{
                      background: `conic-gradient(from -90deg, ${color} ${lleno * 360}deg,
                        rgba(255,255,255,0.18) ${lleno * 360}deg)`,
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
              {/* su nivel, el mismo de la ficha; cómo llega está en el aro */}
              <span className="num font-bold"
                    style={{ color: baja ? "#c0392b" : "#e9e4d8",
                             textShadow: "0 1px 3px rgba(0,0,0,0.9)" }}>
                {baja === "lesionado" ? "LESIÓN" : baja === "suspendido" ? "SUSP" : j.nivel}
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
