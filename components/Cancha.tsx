"use client";

import { useEffect, useState } from "react";
import type { Jugador, Posicion } from "@/engine/tipos.ts";
import type { TipoEvento } from "@/engine/relato.ts";
import { estiloClub } from "./Escudo.tsx";

/** Dónde cae el juego según lo último que pasó. 0 = arco propio, 100 = arco rival. */
const ZONA: Partial<Record<TipoEvento, number>> = {
  gol: 90,
  ocasion: 82,
  gol_rival: 10,
  ocasion_rival: 18,
  amarilla: 50,
  lesion: 50,
  entretiempo: 50,
  inicio: 50,
  final: 50,
};

const X_LINEA: Record<Posicion, number> = { ARQ: 6, DEF: 23, MED: 39, DEL: 55 };

/** El rival no tiene jugadores en el modelo: se dibuja un 4-4-2 espejado. */
const RIVAL: { x: number; ys: number[] }[] = [
  { x: 95, ys: [50] },
  { x: 84, ys: [16, 38, 62, 84] },
  { x: 70, ys: [16, 38, 62, 84] },
  { x: 50, ys: [30, 70] },
];

/** Reparte a los de una línea a lo alto de la cancha. */
function repartir(n: number): number[] {
  if (n === 1) return [50];
  const margen = n >= 5 ? 12 : 18;
  return Array.from({ length: n }, (_, i) => margen + (i * (100 - 2 * margen)) / (n - 1));
}

export default function Cancha({
  once, puestos, ultimoTipo, minuto, corriendo, golDe, rivalId,
}: {
  once: Jugador[];
  puestos: Map<string, Posicion>;
  ultimoTipo: TipoEvento;
  minuto: number;
  corriendo: boolean;
  golDe: "olimpia" | "rival" | null;
  rivalId: string;
}) {
  const colorRival = estiloClub(rivalId).primario;
  const [pelota, setPelota] = useState({ x: 50, y: 50 });

  // La pelota se mueve todo el tiempo, sesgada hacia donde pasó lo último.
  useEffect(() => {
    const centro = ZONA[ultimoTipo] ?? 50;
    const t = setTimeout(() => {
      const deriva = corriendo ? (Math.random() - 0.5) * 34 : 0;
      setPelota({
        x: Math.max(6, Math.min(94, centro + deriva)),
        y: 20 + Math.random() * 60,
      });
    }, 60);
    return () => clearTimeout(t);
  }, [ultimoTipo, minuto, corriendo]);

  const lineas = (["ARQ", "DEF", "MED", "DEL"] as Posicion[]).map((pos) => ({
    pos,
    jugadores: once.filter((j) => (puestos.get(j.id) ?? j.posicion) === pos),
  }));

  return (
    <div className="relative mx-3 overflow-hidden rounded-lg"
         style={{ height: 148, background: "#10231a",
                  boxShadow: "inset 0 0 0 1px var(--linea)" }}>
      {/* césped */}
      <div className="absolute inset-0"
           style={{ backgroundImage:
             "repeating-linear-gradient(90deg, rgba(255,255,255,0.028) 0 26px, transparent 26px 52px)" }} />

      {/* líneas de cancha */}
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100"
           preserveAspectRatio="none" style={{ opacity: 0.3 }}>
        <rect x="1" y="2" width="98" height="96" fill="none" stroke="#fff" strokeWidth="0.4" />
        <line x1="50" y1="2" x2="50" y2="98" stroke="#fff" strokeWidth="0.4" />
        <rect x="1" y="26" width="12" height="48" fill="none" stroke="#fff" strokeWidth="0.4" />
        <rect x="87" y="26" width="12" height="48" fill="none" stroke="#fff" strokeWidth="0.4" />
      </svg>
      <div className="absolute left-1/2 top-1/2 h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full"
           style={{ border: "1px solid rgba(255,255,255,0.3)" }} />

      {/* rival */}
      {RIVAL.flatMap((linea, li) =>
        linea.ys.map((y, i) => (
          <span key={`r${li}-${i}`}
            className="absolute h-[12px] w-[12px] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ left: `${linea.x}%`, top: `${y}%`,
                     background: colorRival,
                     border: "1.5px solid rgba(0,0,0,0.55)",
                     boxShadow: "0 1px 3px rgba(0,0,0,0.5)" }} />
        )))}

      {/* Olimpia */}
      {lineas.map(({ pos, jugadores }) =>
        jugadores.map((j, i) => (
          <span key={j.id}
            className="num absolute flex h-[22px] w-[22px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[10px] transition-all duration-500"
            style={{
              left: `${X_LINEA[pos]}%`,
              top: `${repartir(jugadores.length)[i]}%`,
              background: "var(--blanco)",
              color: "var(--negro)",
              boxShadow: "0 1px 4px rgba(0,0,0,0.5)",
            }}>
            {j.numero}
          </span>
        )))}

      {/* pelota */}
      <span className="absolute h-[7px] w-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              left: `${pelota.x}%`, top: `${pelota.y}%`,
              background: "#fff",
              boxShadow: "0 0 8px rgba(255,255,255,0.9)",
              transition: "left 700ms cubic-bezier(0.3,0.7,0.3,1), top 700ms cubic-bezier(0.3,0.7,0.3,1)",
            }} />

      {/* destello de gol */}
      {golDe && (
        <div key={`${golDe}-${minuto}`} className="pointer-events-none absolute inset-0 flex items-center justify-center"
             style={{ animation: "destello 1200ms ease-out forwards",
                      background: golDe === "olimpia"
                        ? "radial-gradient(circle at 78% 50%, rgba(74,222,128,0.5), transparent 62%)"
                        : "radial-gradient(circle at 22% 50%, rgba(248,113,113,0.5), transparent 62%)" }}>
          <span className="apellido text-[30px]"
                style={{ color: golDe === "olimpia" ? "var(--ok)" : "var(--critico)",
                         textShadow: "0 2px 12px rgba(0,0,0,0.8)" }}>
            GOL
          </span>
        </div>
      )}
    </div>
  );
}
