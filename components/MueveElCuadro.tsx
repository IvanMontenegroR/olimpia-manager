"use client";

import { useEffect, useState } from "react";
import Escudo from "./Escudo.tsx";
import Trofeo from "./Trofeo.tsx";
import type { ResueltaLlave } from "@/lib/copaEnJuego.ts";

/**
 * Ganaste la serie y el cuadro se mueve.
 *
 * La primera versión de esto mostraba solo tu grupo, y le faltaba lo mejor: una
 * fase previa no es tu partido, es ocho partidos que pasan la misma noche y de
 * los que sale con quién te vas a cruzar. Ahora se ven las llaves de tu fase
 * resolviéndose de a una (quién ganó y quién se fue), y recién cuando terminan
 * todas tu casillero baja al lugar que te esperaba.
 *
 * El destino no se sortea acá: es el que tu cartel ya ocupaba en el sorteo de
 * enero. Por eso la pantalla lo dice.
 */

const ESTILO = {
  libertadores: { nombre: "Copa Libertadores", acento: "#e8c25a",
                  fondo: "radial-gradient(130% 80% at 50% 8%, #2c2412, #0b0906 72%)" },
  sudamericana: { nombre: "Copa Sudamericana", acento: "#5fb0e8",
                  fondo: "radial-gradient(130% 80% at 50% 8%, #1b3f63, #0a1523 72%)" },
} as const;

const NOMBRE_FASE: Record<string, string> = {
  F1: "Fase 1", F2: "Fase 2", F3: "Fase 3", PO: "Play-off nacional",
};

/** Cada cuánto se resuelve una llave. */
const PASO = 520;

export interface MovimientoCuadro {
  torneo: "libertadores" | "sudamericana";
  fase: string;
  llaves: ResueltaLlave[];
  destino: { tipo: "grupo"; letra: string; equipos: string[] }
         | { tipo: "llave"; id: string; contra: string };
}

export default function MueveElCuadro({ mov, onSeguir }: {
  mov: MovimientoCuadro;
  onSeguir: () => void;
}) {
  const e = ESTILO[mov.torneo];
  /* La de Olimpia se resuelve última: es la que importa. */
  const orden = [...mov.llaves].sort((a, b) => Number(a.mia) - Number(b.mia));

  const [hasta, setHasta] = useState(0);
  const resueltas = hasta >= orden.length;
  /* Y un respiro antes de que el casillero se mueva. */
  const [movido, setMovido] = useState(false);

  useEffect(() => {
    if (resueltas) return;
    const t = setTimeout(() => setHasta((h) => h + 1), hasta === 0 ? 420 : PASO);
    return () => clearTimeout(t);
  }, [hasta, resueltas]);

  useEffect(() => {
    if (!resueltas || movido) return;
    const t = setTimeout(() => setMovido(true), 700);
    return () => clearTimeout(t);
  }, [resueltas, movido]);

  return (
    <div className="app scroll-y px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-5"
         style={{ background: e.fondo }}>

      <div className="flex items-end gap-3">
        <Trofeo copa={mov.torneo} alto={58} />
        <div className="min-w-0 flex-1">
          <span className="text-[10px] uppercase tracking-[0.24em]" style={{ color: e.acento }}>
            {e.nombre}
          </span>
          <h1 className="apellido mt-1 text-[22px] leading-tight">
            {NOMBRE_FASE[mov.fase] ?? mov.fase}
          </h1>
          <p className="mt-0.5 text-[11px]" style={{ color: "var(--tenue)" }}>
            Se jugaron todas las llaves
          </p>
        </div>
      </div>

      {/* ---------- las llaves resolviéndose ---------- */}
      <div className="mt-4">
        {orden.map((l, i) => {
          const visto = i < hasta;
          return (
            <div key={l.id} className="mb-1.5 rounded-lg px-2.5 py-2"
                 style={{
                   background: l.mia && visto
                     ? `color-mix(in srgb, ${e.acento} 22%, var(--carbon))` : "var(--carbon)",
                   boxShadow: l.mia && visto ? `inset 0 0 0 1.5px ${e.acento}` : "none",
                   transition: "background 320ms ease-out, box-shadow 320ms ease-out",
                 }}>
              <span className="mb-1 block text-[8px] uppercase tracking-[0.16em]"
                    style={{ color: "var(--apagado)" }}>{l.id}</span>
              {[l.local, l.visita].map((nombre) => {
                const gano = visto && nombre === l.ganador;
                const perdio = visto && nombre !== l.ganador;
                return (
                  <span key={nombre} className="flex items-center gap-2 leading-tight">
                    <span className="w-3 shrink-0 text-[10px]"
                          style={{ color: gano ? e.acento : "transparent" }}>▸</span>
                    <span className="min-w-0 flex-1 truncate text-[12px]"
                          style={{
                            color: gano ? e.acento : perdio ? "var(--apagado)" : "var(--blanco)",
                            fontWeight: gano ? 800 : 400,
                            textDecoration: perdio ? "line-through" : "none",
                            opacity: perdio ? 0.55 : 1,
                            transition: "color 320ms ease-out, opacity 320ms ease-out",
                          }}>
                      {nombre}
                    </span>
                  </span>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* ---------- y Olimpia bajando al casillero que la esperaba ---------- */}
      <div className="mt-2 flex flex-col items-center"
           style={{ opacity: resueltas ? 1 : 0, transition: "opacity 400ms ease-out" }}>
        <span className="text-[18px]" style={{ color: e.acento }}>↓</span>
        <span className="mt-0.5 text-[9px] uppercase tracking-[0.16em]"
              style={{ color: "var(--apagado)" }}>
          El lugar ya estaba sorteado desde enero
        </span>
      </div>

      <div className="relieve-alto mt-2 rounded-xl px-3.5 py-3"
           style={{
             background: movido
               ? `color-mix(in srgb, ${e.acento} 20%, transparent)` : "var(--carbon)",
             boxShadow: movido ? `inset 0 0 0 1.5px ${e.acento}` : "none",
             transform: movido ? "translateY(0)" : "translateY(-10px)",
             opacity: resueltas ? 1 : 0,
             transition: "background 420ms ease-out, box-shadow 420ms ease-out," +
                         " transform 420ms ease-out, opacity 300ms ease-out",
           }}>
        {mov.destino.tipo === "grupo" ? (
          <>
            <span className="block text-[9px] uppercase tracking-[0.18em]" style={{ color: e.acento }}>
              Olimpia entra al
            </span>
            <span className="apellido mt-0.5 block text-[22px] leading-tight">
              Grupo {mov.destino.letra}
            </span>
            <div className="mt-1.5 flex flex-col gap-1">
              {mov.destino.equipos.map((n) => (
                <span key={n} className="flex items-center gap-2">
                  <span className="text-[11px]"
                        style={{ color: n === "Olimpia" ? e.acento : "var(--tenue)",
                                 fontWeight: n === "Olimpia" ? 800 : 400 }}>
                    {n === "Olimpia" && <Escudo id="olimpia" nombre="Olimpia" tam={14} />} {n}
                  </span>
                </span>
              ))}
            </div>
          </>
        ) : (
          <>
            <span className="block text-[9px] uppercase tracking-[0.18em]" style={{ color: e.acento }}>
              Olimpia pasa a la {mov.destino.id}
            </span>
            <span className="apellido mt-0.5 block text-[19px] leading-tight">
              contra {mov.destino.contra}
            </span>
          </>
        )}
      </div>

      <button onClick={movido ? onSeguir : () => { setHasta(orden.length); setMovido(true); }}
        className="mt-4 w-full shrink-0 rounded-lg py-3.5 text-[13px] font-extrabold uppercase tracking-[0.14em]"
        style={{ background: movido ? e.acento : "var(--carbon)",
                 color: movido ? "#0a120d" : "var(--tenue)" }}>
        {movido ? "Seguir" : "Saltear"}
      </button>
    </div>
  );
}
