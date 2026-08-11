"use client";

import { useEffect, useRef, useState } from "react";
import { colorCondicion, esSub18, nivelEf } from "@/lib/juego.ts";
import { repartirCancha } from "@/lib/formacion.ts";
import Dorsal from "./Dorsal.tsx";
import type { ContextoPartido, Jugador, Posicion } from "@/engine/tipos.ts";

export interface Casillero {
  slot: number;
  puesto: Posicion;
  jugador: Jugador | null;
}

/** Mide el contenedor: el reparto necesita píxeles reales, no porcentajes. */
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

export default function CanchaArmado({
  casilleros, ctx, seleccionado, destino, onTocar,
}: {
  casilleros: Casillero[];
  ctx: ContextoPartido;
  seleccionado: string | null;
  /** Casillero resaltado mientras se arrastra algo encima. */
  destino: number | null;
  onTocar: (slot: number) => void;
}) {
  const [ref, caja] = useMedida();
  const margen = 34; // aire para que el bloque no se corte contra el borde
  const { ubicados, escala } = repartirCancha(
    casilleros,
    (c) => c.puesto,
    Math.max(0, caja.ancho - margen),
    Math.max(0, caja.alto - margen),
  );

  const tamDorsal = Math.round(32 * escala);

  return (
    <div ref={ref} className="relative mx-3 flex-1 overflow-hidden rounded-lg"
         style={{ background: "#10231a", boxShadow: "inset 0 0 0 1px var(--linea)" }}>
      <div className="absolute inset-0"
           style={{ backgroundImage:
             "repeating-linear-gradient(0deg, rgba(255,255,255,0.03) 0 30px, transparent 30px 60px)" }} />

      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100"
           preserveAspectRatio="none" style={{ opacity: 0.28 }}>
        <rect x="2" y="1" width="96" height="98" fill="none" stroke="#fff" strokeWidth="0.35" />
        <line x1="2" y1="50" x2="98" y2="50" stroke="#fff" strokeWidth="0.35" />
        <rect x="26" y="1" width="48" height="11" fill="none" stroke="#fff" strokeWidth="0.35" />
        <rect x="26" y="88" width="48" height="11" fill="none" stroke="#fff" strokeWidth="0.35" />
      </svg>
      {/* el círculo va aparte: dentro del SVG escalado saldría ovalado */}
      <div className="absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full"
           style={{ border: "1px solid rgba(255,255,255,0.28)" }} />

      {ubicados.map(({ item: c, x, y }) => {
        const j = c.jugador;
        const elegido = !!j && seleccionado === j.id;
        const esDestino = destino === c.slot;
        const adaptado = !!j && c.puesto !== j.posicion;
        return (
          <button key={c.slot} data-slot={c.slot} onClick={() => onTocar(c.slot)}
            className="absolute flex -translate-x-1/2 -translate-y-1/2 touch-none flex-col items-center"
            style={{
              left: x + margen / 2,
              top: y + margen / 2,
              width: 68 * escala,
              opacity: elegido ? 0.35 : 1,
            }}>
            {j ? (
              <>
                <span style={{
                        borderRadius: 999,
                        boxShadow: esDestino
                          ? "0 0 0 3px var(--ok), 0 2px 10px rgba(0,0,0,0.6)"
                          : adaptado
                            ? "0 0 0 2px var(--medio), 0 2px 6px rgba(0,0,0,0.5)"
                            : "0 2px 6px rgba(0,0,0,0.5)",
                      }}>
                  <Dorsal numero={j.numero} tam={tamDorsal} />
                </span>
                <span className="apellido mt-0.5 max-w-full truncate leading-tight"
                      style={{ fontSize: 9 * escala, textShadow: "0 1px 3px rgba(0,0,0,0.9)" }}>
                  {j.apellido}
                </span>
                <span className="flex items-center gap-1 leading-tight" style={{ fontSize: 8 * escala }}>
                  <span className="font-bold" style={{ color: adaptado ? "var(--medio)" : "var(--tenue)" }}>
                    {c.puesto}
                  </span>
                  <span className="num" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.9)" }}>
                    {nivelEf(j, c.puesto, ctx)}
                  </span>
                  <span className="inline-block h-1 w-1 rounded-full"
                        style={{ background: colorCondicion(j.condicion) }} />
                  {esSub18(j) && <span className="font-bold" style={{ color: "var(--ok)" }}>S18</span>}
                </span>
              </>
            ) : (
              // casillero libre: se ve el hueco y se puede soltar a alguien ahí
              <>
                <span className="flex items-center justify-center rounded-full"
                      style={{
                        width: tamDorsal, height: tamDorsal,
                        border: `1.5px dashed ${esDestino ? "var(--ok)" : "rgba(255,255,255,0.35)"}`,
                        background: esDestino ? "rgba(255,255,255,0.12)" : "transparent",
                      }}>
                  <span style={{ fontSize: 13 * escala, color: "var(--tenue)" }}>+</span>
                </span>
                <span className="mt-0.5 font-bold leading-tight"
                      style={{ fontSize: 8 * escala, color: "var(--tenue)" }}>
                  {c.puesto}
                </span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}
