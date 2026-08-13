"use client";

import { useEffect, useRef, useState } from "react";

/**
 * El dado, tirado sobre la misma barra que estabas mirando.
 *
 * La barra ya decía dónde estaba lo verde y dónde lo rojo. Lo único que
 * faltaba era ver caer la bolilla ahí adentro: recorre la barra rebotando de
 * punta a punta, desacelera y frena en el tramo que salió. Si tenías 81% y
 * frena en la franja roja del final, se entiende de una que fue mala suerte y
 * no una mala decisión.
 *
 * Nada de esto sortea nada: el resultado ya está resuelto, esto solo lo cuenta.
 */

/** Cuántas veces cruza la barra antes de frenar. */
const VUELTAS = 3;
const DURACION = 1750;
/** Lo que espera con el resultado a la vista antes de dejar seguir. */
const REMATE = 620;

/**
 * Lo que se sortea cuando no es sí o no sino cuánto: el nivel del pibe que
 * traés a ciegas. La barra deja de tener dos tramos y pasa a ser la escala
 * entera, y la bolilla frena en el número que salió.
 */
export interface RangoSorteo {
  min: number;
  max: number;
  /** Lo que salió de verdad. */
  valor: number;
  /** Qué es lo que se está midiendo: "nivel". */
  unidad: string;
}

export default function Sorteo({
  chance, riesgo, exito, bien, mal, semilla, rango, onTermina,
}: {
  /** Lo que decía la barra antes de elegir, 0 a 1. */
  chance: number;
  /** La franja de gol en contra, si esta opción la tenía. */
  riesgo: number | null;
  exito: boolean;
  /** Cómo se llama cada tramo: "GOL", "NO ENTRA". */
  bien: string;
  mal: string;
  /** Cualquier número estable: mueve el punto exacto donde frena. */
  semilla: number;
  /** Si viene, la barra es una escala y no dos tramos. */
  rango?: RangoSorteo;
  onTermina: () => void;
}) {
  const [pos, setPos] = useState(0);
  const [frenado, setFrenado] = useState(false);
  // el padre pasa un arrow inline; sin el ref, cada render del partido de
  // fondo reiniciaba la tirada
  const avisar = useRef(onTermina);
  avisar.current = onTermina;

  const pct = Math.max(2, Math.min(98, chance * 100));

  /** Dónde frena: en la escala, el número exacto; si no, adentro del tramo. */
  const destino = useRef(
    rango
      ? Math.max(2, Math.min(98,
          ((rango.valor - rango.min) / Math.max(1, rango.max - rango.min)) * 100))
      : exito
        ? 2 + ((semilla * 37) % 100) / 100 * Math.max(2, pct - 5)
        : pct + 3 + ((semilla * 37) % 100) / 100 * Math.max(2, 100 - pct - 5),
  ).current;

  useEffect(() => {
    const corto = typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (corto) {
      setPos(destino);
      setFrenado(true);
      const t = window.setTimeout(() => avisar.current(), 400);
      return () => window.clearTimeout(t);
    }

    // recorre VUELTAS barras completas y termina justo en el destino
    const total = 200 * VUELTAS + destino;
    let raf = 0;
    let fin = 0;
    let termino = false;
    const parar = () => {
      if (termino) return;
      termino = true;
      setPos(destino);
      setFrenado(true);
      fin = window.setTimeout(() => avisar.current(), REMATE);
    };
    const inicio = performance.now();
    const paso = (ahora: number) => {
      const t = Math.min(1, (ahora - inicio) / DURACION);
      const avance = (total * (1 - Math.pow(1 - t, 5))) % 200;
      setPos(avance <= 100 ? avance : 200 - avance);
      if (t < 1) { raf = requestAnimationFrame(paso); return; }
      parar();
    };
    raf = requestAnimationFrame(paso);
    /*
     * Respaldo: con la pestaña en segundo plano el navegador no corre
     * requestAnimationFrame, así que la bolilla no frenaba nunca y el partido
     * quedaba trabado sin poder tocar Seguir. Si al tiempo esperado la tirada
     * no terminó, se cierra igual.
     */
    const rescate = window.setTimeout(() => {
      cancelAnimationFrame(raf);
      parar();
    }, DURACION + 250);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(fin);
      window.clearTimeout(rescate);
    };
  }, []);

  /*
   * En la escala no hay ganar ni perder: hay un número más alto o más bajo, y
   * el color sale de dónde cayó. En los dos tramos, del tramo que tocó.
   */
  const color = rango
    ? `color-mix(in srgb, #3fa76a ${Math.round(destino)}%, #c0392b)`
    : exito ? "#3fa76a" : "#c0392b";
  const rotulo = Math.max(13, Math.min(87, frenado ? destino : pos));

  return (
    <span className="mt-2 block">
      <span className="relative block h-5 overflow-hidden rounded-md"
            style={{
              background: "#c0392b",
              outline: frenado ? `1.5px solid ${color}` : "1px solid #ffffff1a",
              boxShadow: frenado ? `0 0 22px ${color}66` : "none",
              transition: "box-shadow 200ms ease-out",
            }}>
        {/* con rango la barra es la escala entera; si no, lo que tenías a favor */}
        {rango ? (
          <span className="absolute inset-0"
                style={{ background: "linear-gradient(90deg, #c0392b, #d9a832 52%, #3fa76a)" }} />
        ) : (
          <span className="absolute inset-y-0 left-0"
                style={{ width: `${pct}%`, background: "#3fa76a" }} />
        )}
        {/* de lo que falla, esta parte además termina en gol del rival */}
        {riesgo !== null && (
          <span className="absolute inset-y-0"
                style={{ left: `${pct}%`, width: `${(100 - pct) * riesgo}%`, background: "#7a1f16" }} />
        )}
        {/* el rayado hace visible el movimiento sobre el color plano */}
        <span className="absolute inset-0" style={{
          backgroundImage: "repeating-linear-gradient(90deg, transparent 0 8px, rgba(0,0,0,0.16) 8px 9px)",
        }} />
        {/* la división entre ganar y perder; en la escala no hay ninguna */}
        {!rango && (
          <span className="absolute inset-y-0"
                style={{ left: `${pct}%`, width: 1, background: "#0a120daa" }} />
        )}

        {/* la bolilla */}
        <span className="absolute inset-y-0"
              style={{
                left: `${pos}%`,
                width: frenado ? 5 : 3,
                marginLeft: frenado ? -2.5 : -1.5,
                background: "#fff",
                boxShadow: frenado ? "0 0 14px #fff, 0 0 4px #fff" : "0 0 8px #ffffffcc",
                transition: "width 180ms ease-out, margin-left 180ms ease-out",
              }} />
      </span>

      {/* qué tramo tocó, debajo de donde frenó */}
      <span className="relative block h-[19px]">
        {rango && (
          <>
            <span className="num absolute text-[9px] font-bold"
                  style={{ left: 0, top: 6, color: "#ffffff55" }}>{rango.min}</span>
            <span className="num absolute text-[9px] font-bold"
                  style={{ right: 0, top: 6, color: "#ffffff55" }}>{rango.max}</span>
          </>
        )}
        <span className="num absolute whitespace-nowrap rounded px-1.5 py-[1px] text-[10px] font-extrabold"
              style={{
                left: `${rotulo}%`,
                top: 5,
                transform: "translateX(-50%)",
                background: frenado ? color : "transparent",
                color: frenado ? "#0a120d" : "transparent",
                transition: "background 160ms ease-out, color 160ms ease-out",
              }}>
          {rango ? `${rango.unidad} ${rango.valor}` : exito ? bien : mal}
        </span>
      </span>
    </span>
  );
}
