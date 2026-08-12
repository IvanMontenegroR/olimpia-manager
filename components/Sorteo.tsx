"use client";

import { useEffect, useRef, useState } from "react";

/**
 * El sorteo, a la vista.
 *
 * Antes la chance se mostraba antes de elegir y después aparecía el resultado
 * ya cocinado: entre una cosa y la otra no pasaba nada, así que el azar no se
 * sentía. Acá el cartel alterna entre las dos caras cada vez más lento y frena
 * en la que salió, con la barra de proporción al lado para que se vea que un
 * 69% no es lo mismo que un 45%.
 *
 * La alternancia es estricta y la cantidad de pasos se calcula para terminar en
 * el resultado real: nada de esto decide nada, el dado ya se tiró.
 */

/** Cuántas veces parpadea antes de frenar. */
const PASOS = 11;
const PRIMER_MS = 30;
const FRENO = 1.26;

export interface CarasSorteo {
  /** La pregunta de arriba: "¿ENTRA?", "¿LA SACA?". */
  pregunta: string;
  bien: string;
  mal: string;
}

export default function Sorteo({ chance, exito, riesgo, caras, grande, onTermina }: {
  /** Lo que decía la barra antes de elegir, 0 a 1. */
  chance: number;
  exito: boolean;
  /** La parte roja que además termina en gol del rival, si la había. */
  riesgo: number | null;
  caras: CarasSorteo;
  /** En pantalla completa el cartel tiene que pesar más. */
  grande?: boolean;
  onTermina: () => void;
}) {
  const [paso, setPaso] = useState(0);
  const [frenado, setFrenado] = useState(false);
  const timers = useRef<number[]>([]);
  /**
   * El callback se guarda aparte porque el padre lo pasa como arrow inline: si
   * el efecto dependiera de él, cada render del partido de fondo reiniciaba la
   * ruleta y frenaba en cualquier cara.
   */
  const avisar = useRef(onTermina);
  avisar.current = onTermina;

  // la secuencia arranca donde haga falta para caer en `exito` al final
  const cara = (i: number) => ((PASOS - 1 - i) % 2 === 0 ? exito : !exito);

  useEffect(() => {
    const corto = typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (corto) {
      setPaso(PASOS - 1);
      setFrenado(true);
      const t = window.setTimeout(() => avisar.current(), 420);
      return () => window.clearTimeout(t);
    }

    let t = 0;
    let ms = PRIMER_MS;
    for (let i = 1; i < PASOS; i++) {
      t += ms;
      ms *= FRENO;
      timers.current.push(window.setTimeout(() => setPaso(i), t));
    }
    timers.current.push(window.setTimeout(() => setFrenado(true), t + 40));
    timers.current.push(window.setTimeout(() => avisar.current(), t + 560));
    return () => { timers.current.forEach(window.clearTimeout); timers.current = []; };
  }, []);

  const va = cara(paso);
  const color = va ? "#3fa76a" : "#c0392b";
  const pct = Math.round(chance * 100);

  return (
    <div className={grande ? "w-full overflow-hidden rounded-xl px-4 py-4"
                           : "mb-3 overflow-hidden rounded-lg px-3 py-3"}
         style={{ background: grande ? "#00000044" : "#0d1a13",
                  outline: "1px solid #ffffff14" }}>

      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[9px] uppercase tracking-[0.2em]" style={{ color: "#ffffff66" }}>
          {caras.pregunta}
        </span>
        <span className="num text-[11px] font-extrabold" style={{ color: "#3fa76a" }}>
          {pct}%
        </span>
      </div>

      {/* la proporción real: lo verde es lo que tenías a favor */}
      <span className="mb-3 flex h-1.5 overflow-hidden rounded-full" style={{ background: "#c0392b" }}>
        <span style={{ width: `${pct}%`, background: "#3fa76a" }} />
        {riesgo !== null && (
          // el riesgo cae sobre la parte que falla, no sobre el total
          <span style={{ width: `${(1 - chance) * riesgo * 100}%`, background: "#7a1f16" }} />
        )}
      </span>

      {/* el cartel que alterna y frena */}
      <div className="flex justify-center">
        <span
          key={`${paso}-${frenado}`}
          className={frenado ? "golpea-hito" : undefined}
          style={{
            display: "block",
            padding: grande ? (frenado ? "16px 34px" : "13px 28px")
                            : (frenado ? "10px 22px" : "8px 18px"),
            borderRadius: 8,
            background: frenado ? color : `${color}22`,
            outline: `1.5px solid ${color}`,
            color: frenado ? "#0a120d" : color,
            transition: "padding 160ms ease-out",
            boxShadow: frenado ? `0 0 30px ${color}88` : "none",
          }}>
          <span className="apellido block leading-none"
                style={{ fontSize: grande ? (frenado ? 38 : 30) : (frenado ? 26 : 20),
                         letterSpacing: "0.02em" }}>
            {va ? caras.bien : caras.mal}
          </span>
        </span>
      </div>
    </div>
  );
}
