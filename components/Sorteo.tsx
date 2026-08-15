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
/**
 * Cuando la barra no es una probabilidad sino un lugar: el arco, de palo a
 * palo, con lo que el arquero alcanza a tapar. La pelota cae donde cae y si
 * cae adentro de la zona, la sacó.
 */
export interface ZonaSorteo {
  /** Lo que tapa el arquero, de 0 a 1 sobre el arco. */
  desde: number;
  hasta: number;
  /** Dónde pegó el remate, de 0 a 1. */
  donde: number;
}

export interface RangoSorteo {
  min: number;
  max: number;
  /** Lo que salió de verdad. */
  valor: number;
  /** Qué es lo que se está midiendo: "nivel". */
  unidad: string;
}

/**
 * Los tres tramos de la barra y dónde frena la bolilla, sin nada de React.
 *
 * Está afuera del componente para poder revisarlo sin navegador: que la bolilla
 * caiga en la franja equivocada no se nota mirando una tirada, se nota
 * probándolas todas.
 */
export function tramosDe({ chance, riesgo, riesgoSobre, exito, enRiesgo, semilla }: {
  chance: number;
  riesgo: number | null;
  riesgoSobre: "exito" | "fallo";
  exito: boolean;
  enRiesgo: boolean;
  semilla: number;
}) {
  const pct = Math.max(2, Math.min(98, chance * 100));
  /*
   * Si el riesgo se descuenta del fallo, la franja oscura empieza donde termina
   * lo verde; si se descuenta del acierto (atajás el penal y te la empujan
   * igual), se come el final de lo verde.
   */
  const desde = riesgo === null ? pct : riesgoSobre === "exito" ? pct * (1 - riesgo) : pct;
  const hasta = riesgo === null ? pct
    : riesgoSobre === "exito" ? pct : pct + (100 - pct) * riesgo;

  const azar = ((semilla * 37) % 100) / 100;
  /*
   * Un punto cualquiera adentro del tramo, despegado de los bordes para que no
   * quede pegada a la línea. El margen se achica con el tramo: la franja del
   * rebote mide dos puntos y medio, y un margen fijo la hacía desbordar justo
   * en el caso que este número existe para contar bien.
   */
  const entre = (a: number, b: number) => {
    if (b <= a) return a;
    const margen = Math.min(1, (b - a) / 4);
    return a + margen + azar * (b - a - 2 * margen);
  };
  // frena adentro de la franja que cuenta lo que de verdad pasó
  const donde = enRiesgo ? entre(desde, hasta)
    : exito ? entre(0, desde)
      : entre(hasta, 100);
  return { pct, desde, hasta, donde };
}

export default function Sorteo({
  chance, riesgo, riesgoSobre = "fallo", exito, enRiesgo = false,
  bien, mal, peor, semilla, rango, zona, onTermina,
}: {
  /** Lo que decía la barra antes de elegir, 0 a 1. */
  chance: number;
  /** La franja de gol en contra, si esta opción la tenía. */
  riesgo: number | null;
  /** De cuál de los dos tramos se recorta esa franja. */
  riesgoSobre?: "exito" | "fallo";
  exito: boolean;
  /**
   * Si además de fallar pasó lo que la franja oscura avisaba. Sin esto la
   * bolilla frenaba en cualquier punto del rojo: caía justo sobre "si la
   * rechazan, te matan de contra" y no pasaba nada, o al revés.
   */
  enRiesgo?: boolean;
  /** Cómo se llama cada tramo: "GOL", "NO ENTRA", "GOL EN CONTRA". */
  bien: string;
  mal: string;
  peor?: string;
  /** Cualquier número estable: mueve el punto exacto donde frena. */
  semilla: number;
  /** Si viene, la barra es una escala y no dos tramos. */
  rango?: RangoSorteo;
  /** Si viene, la barra es el arco y la zona es lo que tapás. */
  zona?: ZonaSorteo;
  onTermina: () => void;
}) {
  const [pos, setPos] = useState(0);
  const [frenado, setFrenado] = useState(false);
  // el padre pasa un arrow inline; sin el ref, cada render del partido de
  // fondo reiniciaba la tirada
  const avisar = useRef(onTermina);
  avisar.current = onTermina;

  const t = tramosDe({ chance, riesgo, riesgoSobre, exito, enRiesgo, semilla });
  const { pct, desde: desdeRiesgo, hasta: hastaRiesgo } = t;

  /** Dónde frena: en la escala, el número exacto; si no, adentro del tramo. */
  const destino = useRef(
    zona ? Math.max(1.5, Math.min(98.5, zona.donde * 100))
      : rango
        ? Math.max(2, Math.min(98,
            ((rango.valor - rango.min) / Math.max(1, rango.max - rango.min)) * 100))
        : t.donde,
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
    : exito ? "#3fa76a" : enRiesgo ? "#8c2418" : "#c0392b";
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
        {/* con zona la barra es el arco: rojo todo, verde lo que tapás */}
        {zona ? (
          <span className="absolute inset-y-0"
                style={{ left: `${zona.desde * 100}%`,
                         width: `${(zona.hasta - zona.desde) * 100}%`, background: "#3fa76a" }} />
        ) : rango ? (
          <span className="absolute inset-0"
                style={{ background: "linear-gradient(90deg, #c0392b, #d9a832 52%, #3fa76a)" }} />
        ) : (
          <span className="absolute inset-y-0 left-0"
                style={{ width: `${pct}%`, background: "#3fa76a" }} />
        )}
        {/* la parte que además termina en gol del rival */}
        {riesgo !== null && !zona && (
          <span className="absolute inset-y-0"
                style={{ left: `${desdeRiesgo}%`, width: `${hastaRiesgo - desdeRiesgo}%`,
                         background: "#7a1f16" }} />
        )}
        {/* el rayado hace visible el movimiento sobre el color plano */}
        <span className="absolute inset-0" style={{
          backgroundImage: "repeating-linear-gradient(90deg, transparent 0 8px, rgba(0,0,0,0.16) 8px 9px)",
        }} />
        {/* la división entre ganar y perder; en la escala y en el arco no hay */}
        {!rango && !zona && (
          <span className="absolute inset-y-0"
                style={{ left: `${pct}%`, width: 1, background: "#0a120daa" }} />
        )}
        {/* los tres palos del arco, para que se lea como un arco */}
        {zona && [33.3, 66.6].map((x) => (
          <span key={x} className="absolute inset-y-0"
                style={{ left: `${x}%`, width: 1, background: "#ffffff22" }} />
        ))}

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
          {rango ? `${rango.unidad} ${rango.valor}`
            : exito ? bien : enRiesgo ? (peor ?? mal) : mal}
        </span>
      </span>
    </span>
  );
}
