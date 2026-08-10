"use client";

import { colorCondicion, esSub18, nivelEf } from "@/lib/juego.ts";
import type { ContextoPartido, Jugador, Posicion } from "@/engine/tipos.ts";

/** Cancha vertical: se ataca hacia arriba, el arco propio queda abajo. */
const Y_LINEA: Record<Posicion, number> = { ARQ: 87, DEF: 66, MED: 43, DEL: 19 };

function repartir(n: number): number[] {
  if (n === 1) return [50];
  const margen = n >= 5 ? 12 : n === 4 ? 15 : 22;
  return Array.from({ length: n }, (_, i) => margen + (i * (100 - 2 * margen)) / (n - 1));
}

export default function CanchaArmado({
  once, puestos, ctx, seleccionado, onTocar,
}: {
  once: Jugador[];
  puestos: Map<string, Posicion>;
  ctx: ContextoPartido;
  seleccionado: string | null;
  onTocar: (j: Jugador) => void;
}) {
  const lineas = (["ARQ", "DEF", "MED", "DEL"] as Posicion[]).map((pos) => ({
    pos,
    jugadores: once.filter((j) => (puestos.get(j.id) ?? j.posicion) === pos),
  }));

  return (
    <div className="relative mx-3 flex-1 overflow-hidden rounded-lg"
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

      {lineas.map(({ pos, jugadores }) => {
        const xs = repartir(jugadores.length);
        return jugadores.map((j, i) => {
          const elegido = seleccionado === j.id;
          const adaptado = pos !== j.posicion;
          const ef = nivelEf(j, pos, ctx);
          return (
            <button key={j.id} onClick={() => onTocar(j)}
              className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
              style={{ left: `${xs[i]}%`, top: `${Y_LINEA[pos]}%`, width: 62 }}>
              <span className="num flex h-[34px] w-[34px] items-center justify-center rounded-full text-[15px]"
                    style={{
                      background: elegido ? "var(--medio)" : "var(--blanco)",
                      color: "var(--negro)",
                      boxShadow: adaptado
                        ? "0 0 0 2px var(--medio), 0 2px 6px rgba(0,0,0,0.5)"
                        : "0 2px 6px rgba(0,0,0,0.5)",
                    }}>
                {j.numero}
              </span>
              <span className="apellido mt-0.5 max-w-full truncate text-[9px] leading-tight"
                    style={{ textShadow: "0 1px 3px rgba(0,0,0,0.9)" }}>
                {j.apellido}
              </span>
              <span className="flex items-center gap-1 text-[9px] leading-tight">
                <span className="num" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.9)" }}>{ef}</span>
                <span className="inline-block h-1 w-1 rounded-full"
                      style={{ background: colorCondicion(j.condicion) }} />
                {esSub18(j) && (
                  <span className="font-bold" style={{ color: "var(--ok)" }}>S18</span>
                )}
              </span>
            </button>
          );
        });
      })}
    </div>
  );
}
