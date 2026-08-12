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

export default function Sorteo({ chance, riesgo, exito, bien, mal, semilla, onTermina }: {
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
  onTermina: () => void;
}) {
  const [pos, setPos] = useState(0);
  const [frenado, setFrenado] = useState(false);
  // el padre pasa un arrow inline; sin el ref, cada render del partido de
  // fondo reiniciaba la tirada
  const avisar = useRef(onTermina);
  avisar.current = onTermina;

  const pct = Math.max(2, Math.min(98, chance * 100));

  /** Dónde frena: adentro del tramo que salió, nunca pegado a la división. */
  const destino = useRef(
    exito
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

  const color = exito ? "#3fa76a" : "#c0392b";
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
        {/* lo que tenías a favor */}
        <span className="absolute inset-y-0 left-0"
              style={{ width: `${pct}%`, background: "#3fa76a" }} />
        {/* de lo que falla, esta parte además termina en gol del rival */}
        {riesgo !== null && (
          <span className="absolute inset-y-0"
                style={{ left: `${pct}%`, width: `${(100 - pct) * riesgo}%`, background: "#7a1f16" }} />
        )}
        {/* el rayado hace visible el movimiento sobre el color plano */}
        <span className="absolute inset-0" style={{
          backgroundImage: "repeating-linear-gradient(90deg, transparent 0 8px, rgba(0,0,0,0.16) 8px 9px)",
        }} />
        {/* la división entre ganar y perder */}
        <span className="absolute inset-y-0"
              style={{ left: `${pct}%`, width: 1, background: "#0a120daa" }} />

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
        <span className="num absolute whitespace-nowrap rounded px-1.5 py-[1px] text-[10px] font-extrabold"
              style={{
                left: `${rotulo}%`,
                top: 5,
                transform: "translateX(-50%)",
                background: frenado ? color : "transparent",
                color: frenado ? "#0a120d" : "transparent",
                transition: "background 160ms ease-out, color 160ms ease-out",
              }}>
          {exito ? bien : mal}
        </span>
      </span>
    </span>
  );
}
