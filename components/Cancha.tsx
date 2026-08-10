"use client";

import { useEffect, useRef, useState } from "react";
import type { Jugador, Posicion } from "@/engine/tipos.ts";
import type { TipoEvento } from "@/engine/relato.ts";
import { estiloClub } from "./Escudo.tsx";

type Fase = "ataque" | "medio" | "defensa";

/** Qué fase impone cada evento. Los demás la dejan seguir sola. */
const FASE_EVENTO: Partial<Record<TipoEvento, Fase>> = {
  gol: "ataque",
  ocasion: "ataque",
  gol_rival: "defensa",
  ocasion_rival: "defensa",
};

/** Cancha vertical: Olimpia ataca hacia arriba, su arco queda abajo.
 *  En un teléfono la cancha es más alta que ancha, así que en horizontal
 *  se deformaba. */
const Y_BASE: Record<Posicion, number> = { ARQ: 93, DEF: 76, MED: 56, DEL: 36 };

/** Cuánto se desplaza el bloque según la fase. El arquero casi no acompaña. */
/** Negativo porque atacar es ir hacia arriba. */
const EMPUJE: Record<Fase, number> = { ataque: -11, medio: 0, defensa: 8 };
const ELASTICIDAD: Record<Posicion, number> = { ARQ: 0.25, DEF: 0.85, MED: 1.1, DEL: 1.25 };

const RIVAL_BASE: { y: number; xs: number[] }[] = [
  { y: 5, xs: [50] },
  { y: 20, xs: [16, 38, 62, 84] },
  { y: 36, xs: [16, 38, 62, 84] },
  { y: 52, xs: [34, 66] },
];

function repartir(n: number): number[] {
  if (n === 1) return [50];
  const margen = n >= 5 ? 11 : 17;
  return Array.from({ length: n }, (_, i) => margen + (i * (100 - 2 * margen)) / (n - 1));
}

/** Ruido estable por jugador: cada uno se mueve distinto, pero siempre igual. */
function semillaDe(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(h, 31) + id.charCodeAt(i)) | 0;
  return Math.abs(h % 1000) / 1000;
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
  const [fase, setFase] = useState<Fase>("medio");
  const [tic, setTic] = useState(0);
  /** Quién tiene la pelota: índice dentro del once, o -1 si la tiene el rival. */
  const [poseedor, setPoseedor] = useState(5);
  const faseRef = useRef<Fase>("medio");

  // Un evento manda la fase. Entre eventos, el juego va y viene solo.
  useEffect(() => {
    const impuesta = FASE_EVENTO[ultimoTipo];
    if (impuesta) {
      setFase(impuesta);
      faseRef.current = impuesta;
    }
  }, [ultimoTipo, minuto]);

  // Latido del partido: mueve el bloque y hace circular la pelota.
  useEffect(() => {
    if (!corriendo) return;
    const t = setInterval(() => {
      setTic((n) => n + 1);

      const r = Math.random();
      const actual = faseRef.current;
      const siguiente: Fase =
        actual === "medio" ? (r < 0.34 ? "ataque" : r < 0.6 ? "defensa" : "medio")
        : r < 0.55 ? "medio" : actual;
      faseRef.current = siguiente;
      setFase(siguiente);

      setPoseedor(() => {
        if (Math.random() < 0.28) return -1; // la pierde
        const prefiere: Posicion[] =
          siguiente === "ataque" ? ["DEL", "MED"]
          : siguiente === "defensa" ? ["DEF", "ARQ"]
          : ["MED", "DEF"];
        const candidatos = once
          .map((j, i) => ({ i, p: puestos.get(j.id) ?? j.posicion }))
          .filter((c) => prefiere.includes(c.p));
        if (!candidatos.length) return Math.floor(Math.random() * once.length);
        return candidatos[Math.floor(Math.random() * candidatos.length)].i;
      });
    }, 780);
    return () => clearInterval(t);
  }, [corriendo, once, puestos]);

  const lineas = (["ARQ", "DEF", "MED", "DEL"] as Posicion[]).map((pos) => ({
    pos,
    jugadores: once.filter((j) => (puestos.get(j.id) ?? j.posicion) === pos),
  }));

  const posiciones = new Map<string, { x: number; y: number }>();
  for (const { pos, jugadores } of lineas) {
    const ys = repartir(jugadores.length);
    jugadores.forEach((j, i) => {
      const s = semillaDe(j.id);
      // poco jitter: alcanza para que respiren sin que se pierda la formación
      const vaiven = Math.sin((tic + s * 10) * 0.9) * 1.8;
      const lateral = Math.cos((tic + s * 14) * 0.7) * 2.4;
      posiciones.set(j.id, {
        x: Math.max(8, Math.min(92, ys[i] + lateral)),
        y: Math.max(20, Math.min(97, Y_BASE[pos] + EMPUJE[fase] * ELASTICIDAD[pos] + vaiven)),
      });
    });
  }

  // el rival hace lo contrario: si Olimpia sube, él se mete atrás
  const empujeRival = -EMPUJE[fase] * 0.8;

  const idx = poseedor >= 0 && poseedor < once.length ? poseedor : null;
  const conLaPelota = idx !== null ? once[idx] : null;
  const posPelota = conLaPelota
    ? posiciones.get(conLaPelota.id)!
    : { x: 50 + Math.sin(tic) * 18, y: Math.max(4, Math.min(80, 32 + empujeRival)) };

  return (
    <div className="relative mx-3 min-h-0 flex-1 overflow-hidden rounded-lg"
         style={{ background: "#10231a", boxShadow: "inset 0 0 0 1px var(--linea)" }}>
      <div className="absolute inset-0"
           style={{ backgroundImage:
             "repeating-linear-gradient(0deg, rgba(255,255,255,0.03) 0 34px, transparent 34px 68px)" }} />

      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100"
           preserveAspectRatio="none" style={{ opacity: 0.28 }}>
        <rect x="2" y="1" width="96" height="98" fill="none" stroke="#fff" strokeWidth="0.35" />
        <line x1="2" y1="50" x2="98" y2="50" stroke="#fff" strokeWidth="0.35" />
        <rect x="26" y="1" width="48" height="10" fill="none" stroke="#fff" strokeWidth="0.35" />
        <rect x="26" y="89" width="48" height="10" fill="none" stroke="#fff" strokeWidth="0.35" />
      </svg>
      <div className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full"
           style={{ border: "1px solid rgba(255,255,255,0.28)" }} />

      {/* rival */}
      {RIVAL_BASE.flatMap((linea, li) =>
        linea.xs.map((x, i) => {
          const s = semillaDe(`r${li}${i}`);
          const elast = li === 0 ? 0.25 : li === 1 ? 0.85 : 1.1;
          return (
            <span key={`r${li}-${i}`}
              className="absolute h-[15px] w-[15px] -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{
                left: `${Math.max(8, Math.min(92, x + Math.cos((tic + s * 12) * 0.6) * 2.2))}%`,
                top: `${Math.max(3, Math.min(80, linea.y + empujeRival * elast + Math.sin((tic + s * 9) * 0.8) * 1.8))}%`,
                background: colorRival,
                border: "1.5px solid rgba(0,0,0,0.55)",
                boxShadow: "0 1px 3px rgba(0,0,0,0.5)",
                transition: "left 760ms linear, top 760ms linear",
              }} />
          );
        }))}

      {/* Olimpia */}
      {once.map((j) => {
        const p = posiciones.get(j.id);
        if (!p) return null;
        const tieneLaPelota = conLaPelota?.id === j.id;
        return (
          <span key={j.id}
            className="num absolute flex h-[26px] w-[26px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[11px]"
            style={{
              left: `${p.x}%`, top: `${p.y}%`,
              background: "var(--blanco)",
              color: "var(--negro)",
              boxShadow: tieneLaPelota
                ? "0 0 0 2.5px rgba(255,255,255,0.9), 0 1px 4px rgba(0,0,0,0.5)"
                : "0 1px 4px rgba(0,0,0,0.5)",
              transition: "left 760ms linear, top 760ms linear, box-shadow 200ms",
            }}>
            {j.numero}
          </span>
        );
      })}

      {/* pelota: va con el que la tiene */}
      <span className="absolute h-[8px] w-[8px] rounded-full"
            style={{
              left: `${posPelota.x}%`,
              top: `${posPelota.y}%`,
              marginLeft: conLaPelota ? 7 : -3.5,
              marginTop: conLaPelota ? 6 : -3.5,
              background: "#fff",
              boxShadow: "0 0 8px rgba(255,255,255,0.9)",
              transition: "left 520ms cubic-bezier(0.3,0.7,0.3,1), top 520ms cubic-bezier(0.3,0.7,0.3,1)",
            }} />

      {golDe && (
        <div key={`${golDe}-${minuto}`}
             className="pointer-events-none absolute inset-0 flex items-center justify-center"
             style={{ animation: "destello 1200ms ease-out forwards",
                      background: golDe === "olimpia"
                        ? "radial-gradient(circle at 50% 14%, rgba(74,222,128,0.5), transparent 62%)"
                        : "radial-gradient(circle at 50% 88%, rgba(248,113,113,0.5), transparent 62%)" }}>
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
