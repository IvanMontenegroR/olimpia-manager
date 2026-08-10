"use client";

import { colorCondicion } from "@/lib/juego.ts";
import { riesgoDeRoja } from "@/engine/riesgo.ts";
import type { Alineacion, ContextoPartido, Jugador, Posicion } from "@/engine/tipos.ts";

export interface EstadoJugador {
  amarilla: boolean;
  goles: number;
  lesionado: boolean;
  caliente: boolean;
}

const COLOR_POS: Record<Posicion, string> = {
  ARQ: "#f59e0b",
  DEF: "#3b82f6",
  MED: "#22c55e",
  DEL: "#ef4444",
};

/**
 * Reemplaza al gráfico de dominio. Lo que hace falta ver durante el partido es
 * el estado de los once: quién está fundido, quién tiene amarilla y cuánto
 * riesgo hay de quedarse con diez.
 */
export default function PanelJugadores({
  once, puestos, estado, condicionDe, minuto, alineacion, ctx, dominio, onTocar,
}: {
  once: Jugador[];
  puestos: Map<string, Posicion>;
  estado: Map<string, EstadoJugador>;
  condicionDe: (j: Jugador) => number;
  minuto: number;
  alineacion: Alineacion;
  ctx: ContextoPartido;
  /** 0 a 1: cuánto del partido está llevando Olimpia. */
  dominio: number;
  onTocar: (j: Jugador) => void;
}) {
  const orden: Posicion[] = ["ARQ", "DEF", "MED", "DEL"];
  const ordenados = [...once].sort((a, b) =>
    orden.indexOf(puestos.get(a.id) ?? a.posicion) - orden.indexOf(puestos.get(b.id) ?? b.posicion));

  return (
    <div className="shrink-0 px-3 pb-1">
      {/* franja de dominio: reemplaza al gráfico sin ocupar media pantalla */}
      <div className="mb-1.5 flex h-1.5 overflow-hidden rounded-full"
           style={{ background: "var(--linea)" }}>
        <div style={{ width: `${dominio * 100}%`, background: "#22c55e",
                      transition: "width 700ms ease-out" }} />
        <div style={{ width: `${(1 - dominio) * 100}%`, background: "#ef4444",
                      transition: "width 700ms ease-out" }} />
      </div>
      {ordenados.map((j) => {
        const pos = puestos.get(j.id) ?? j.posicion;
        const e = estado.get(j.id) ?? { amarilla: false, goles: 0, lesionado: false, caliente: false };
        const c = condicionDe(j);
        const riesgo = riesgoDeRoja(j, e.amarilla, minuto, alineacion, ctx);
        const alarma = e.lesionado ? "var(--bajo)"
          : riesgo > 0.05 ? "var(--critico)"
          : e.amarilla ? "var(--medio)"
          : c < 50 ? "var(--bajo)"
          : null;

        return (
          <button key={j.id} onClick={() => onTocar(j)}
            className="mb-[3px] flex w-full items-center gap-2 rounded-md px-2 py-[3px] text-left"
            style={{
              background: alarma ? `color-mix(in srgb, ${alarma} 14%, var(--carbon))` : "var(--carbon)",
              boxShadow: alarma ? `inset 3px 0 0 ${alarma}` : `inset 3px 0 0 ${COLOR_POS[pos]}`,
            }}>

            <span className="num w-5 shrink-0 text-center text-[13px]">{j.numero}</span>

            <span className="w-7 shrink-0 text-[8px] font-bold" style={{ color: COLOR_POS[pos] }}>
              {pos}
            </span>

            <span className="apellido min-w-0 flex-1 truncate text-[11px]">{j.apellido}</span>

            {/* estados, en color */}
            <span className="flex shrink-0 items-center gap-1">
              {e.goles > 0 && (
                <span className="num rounded px-1 text-[8px]"
                      style={{ background: "var(--ok)", color: "var(--negro)" }}>
                  {e.goles > 1 ? `${e.goles}G` : "GOL"}
                </span>
              )}
              {e.lesionado && (
                <span className="rounded px-1 text-[8px] font-bold"
                      style={{ background: "var(--bajo)", color: "var(--negro)" }}>
                  LES
                </span>
              )}
              {e.amarilla && (
                <span className="inline-block h-3 w-2 rounded-[1px]"
                      style={{ background: "#facc15" }} />
              )}
            </span>

            {/* riesgo de quedarse con diez */}
            <span className="w-7 shrink-0 text-right">
              {riesgo > 0.01 ? (
                <span className="num text-[9px]" style={{ color: "var(--critico)" }}>
                  {Math.round(riesgo * 100)}%
                </span>
              ) : null}
            </span>

            {/* condición */}
            <span className="flex w-14 shrink-0 items-center gap-1">
              <span className="h-1 flex-1 overflow-hidden rounded-full"
                    style={{ background: "var(--linea)" }}>
                <span className="block h-full rounded-full transition-all duration-500"
                      style={{ width: `${c}%`, background: colorCondicion(c) }} />
              </span>
              <span className="num w-4 text-right text-[9px]" style={{ color: colorCondicion(c) }}>
                {c}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
