"use client";

import { colorCondicion } from "@/lib/juego.ts";
import type { EventoRelato } from "@/engine/relato.ts";
import type { Jugador } from "@/engine/tipos.ts";

/**
 * Propuesta visual alternativa a la cancha.
 *
 * En vez de fingir una simulación de fútbol, muestra las dos cosas que el juego
 * realmente trata: quién está dominando el partido y cómo se va gastando el once.
 * El pulso se dibuja minuto a minuto y no se borra, así al final del partido
 * queda el relato entero de un vistazo: dónde apretaste, dónde te comieron.
 */

const PESO: Record<string, number> = {
  gol: 1.0,
  ocasion: 0.62,
  gol_rival: -1.0,
  ocasion_rival: -0.62,
  amarilla: -0.12,
  roja: -0.5,
  lesion: -0.2,
};

/** Ruido estable por minuto: el mismo partido dibuja siempre el mismo pulso. */
function ruido(m: number, semilla: number): number {
  const x = Math.sin(m * 12.9898 + semilla * 78.233) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

export default function Pulso({
  eventos, minuto, once, condicionDe, tendencia, semilla,
}: {
  eventos: EventoRelato[];
  minuto: number;
  once: Jugador[];
  condicionDe: (j: Jugador) => number;
  /** Cuánto mejor es Olimpia que el rival, normalizado a -1..1. */
  tendencia: number;
  semilla: number;
}) {
  const hasta = Math.min(minuto, 90);

  // valor de dominio por minuto, con los eventos empujando y decayendo
  const barras: number[] = [];
  for (let m = 1; m <= hasta; m++) {
    let v = tendencia * 0.45 + ruido(m, semilla) * 0.3;
    for (const e of eventos) {
      const p = PESO[e.tipo];
      if (!p) continue;
      const d = m - e.minuto;
      if (d < 0 || d > 5) continue;
      v += p * Math.exp(-d / 2.2);
    }
    barras.push(Math.max(-1, Math.min(1, v)));
  }

  const goles = eventos.filter((e) => e.tipo === "gol" || e.tipo === "gol_rival");

  return (
    <div className="shrink-0 px-3">
      {/* ---------- pulso del partido ---------- */}
      <div className="relative overflow-hidden rounded-lg"
           style={{ height: 168, background: "var(--carbon)",
                    boxShadow: "inset 0 0 0 1px var(--linea)" }}>

        <div className="absolute left-0 right-0 top-1/2 h-px" style={{ background: "var(--linea)" }} />

        <div className="absolute left-2 top-1.5 text-[9px] uppercase tracking-[0.14em]"
             style={{ color: "var(--apagado)" }}>
          Olimpia
        </div>
        <div className="absolute bottom-1.5 left-2 text-[9px] uppercase tracking-[0.14em]"
             style={{ color: "var(--apagado)" }}>
          Rival
        </div>

        {/* marcas de gol, detrás de las barras */}
        {goles.map((g, i) => (
          <div key={i} className="absolute bottom-0 top-0 w-px"
               style={{
                 left: `${(g.minuto / 90) * 100}%`,
                 background: g.tipo === "gol" ? "rgba(74,222,128,0.5)" : "rgba(248,113,113,0.5)",
               }} />
        ))}

        {/* barras: hacia arriba domina Olimpia, hacia abajo el rival */}
        <div className="absolute inset-0 flex items-center gap-px px-1">
          {Array.from({ length: 90 }, (_, i) => {
            const v = barras[i];
            const jugado = i < barras.length;
            const alto = jugado ? Math.abs(v) * 44 : 0;
            const arriba = jugado && v > 0;
            return (
              <div key={i} className="relative flex-1" style={{ height: "100%" }}>
                {jugado && (
                  <div className="absolute left-0 right-0 rounded-[1px]"
                       style={{
                         height: `${alto}%`,
                         top: arriba ? `${50 - alto}%` : "50%",
                         background: arriba
                           ? `rgba(255,255,255,${0.28 + Math.abs(v) * 0.6})`
                           : `rgba(248,113,113,${0.22 + Math.abs(v) * 0.55})`,
                         transition: "height 260ms ease-out, top 260ms ease-out",
                       }} />
                )}
              </div>
            );
          })}
        </div>

        {/* etiquetas de gol */}
        {goles.map((g, i) => (
          <div key={`t${i}`}
               className="num absolute top-1 -translate-x-1/2 rounded px-1 text-[9px]"
               style={{
                 left: `${(g.minuto / 90) * 100}%`,
                 background: g.tipo === "gol" ? "var(--ok)" : "var(--critico)",
                 color: "var(--negro)",
               }}>
            {g.minuto}'
          </div>
        ))}

        {/* línea del minuto actual */}
        <div className="absolute bottom-0 top-0 w-px"
             style={{ left: `${(hasta / 90) * 100}%`, background: "rgba(255,255,255,0.55)",
                      transition: "left 300ms linear" }} />
      </div>

      {/* ---------- desgaste del once ---------- */}
      <div className="mt-2 shrink-0">
        <div className="mb-1 flex items-baseline justify-between">
          <span className="text-[9px] uppercase tracking-[0.14em]" style={{ color: "var(--apagado)" }}>
            En cancha
          </span>
          <span className="text-[9px]" style={{ color: "var(--apagado)" }}>
            condición
          </span>
        </div>
        <div className="flex gap-[3px]">
          {once.map((j) => {
            const c = condicionDe(j);
            return (
              <div key={j.id} className="flex flex-1 flex-col items-center gap-1">
                <span className="num text-[10px] leading-none"
                      style={{ color: c < 50 ? "var(--critico)" : "var(--tenue)" }}>
                  {j.numero}
                </span>
                <div className="relative h-8 w-full overflow-hidden rounded-sm"
                     style={{ background: "var(--carbon)" }}>
                  <div className="w-full transition-all duration-500"
                       style={{
                         height: `${c}%`,
                         marginTop: `${100 - c}%`,
                         background: colorCondicion(c),
                         opacity: c < 55 ? 1 : 0.7,
                       }} />
                  <span className="num absolute inset-0 flex items-center justify-center text-[9px]"
                        style={{ color: "var(--negro)", textShadow: "0 0 3px rgba(255,255,255,0.5)" }}>
                    {c}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
