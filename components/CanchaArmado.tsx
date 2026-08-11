"use client";

import { colorCondicion, esSub18, nivelEf } from "@/lib/juego.ts";
import Dorsal from "./Dorsal.tsx";
import { COORD, LINEA_DE, type ContextoPartido, type Jugador, type Posicion } from "@/engine/tipos.ts";

/** Cancha vertical: se ataca hacia arriba, el arco propio queda abajo.
 *  Cada jugador va donde corresponde su puesto, sin tablas aparte. */
function ubicar(pos: Posicion, indice = 0, total = 1) {
  const c = COORD[pos];
  // dos centrales o dos volantes comparten coordenada: se abren en abanico
  const paso = total > 1 ? 30 : 0;
  const y = c.y + (indice - (total - 1) / 2) * paso;
  return {
    izq: 8 + (Math.max(4, Math.min(96, y)) / 100) * 84,
    arriba: 92 - (c.x / 100) * 84,
  };
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

      {once.map((j) => {
        const pos = puestos.get(j.id) ?? j.posicion;
        const mismos = once.filter((x) => (puestos.get(x.id) ?? x.posicion) === pos);
        const { izq, arriba } = ubicar(pos, mismos.indexOf(j), mismos.length);
        const elegido = seleccionado === j.id;
        const adaptado = pos !== j.posicion;
        const ef = nivelEf(j, pos, ctx);
        return (
          <button key={j.id} onClick={() => onTocar(j)}
            className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
            style={{ left: `${izq}%`, top: `${arriba}%`, width: 58 }}>
            <span style={{
                    borderRadius: 999,
                    boxShadow: elegido
                      ? "0 0 0 3px var(--medio), 0 2px 8px rgba(0,0,0,0.55)"
                      : adaptado
                        ? "0 0 0 2px var(--medio), 0 2px 6px rgba(0,0,0,0.5)"
                        : "0 2px 6px rgba(0,0,0,0.5)",
                  }}>
              <Dorsal numero={j.numero} tam={32} />
            </span>
            <span className="apellido mt-0.5 max-w-full truncate text-[9px] leading-tight"
                  style={{ textShadow: "0 1px 3px rgba(0,0,0,0.9)" }}>
              {j.apellido}
            </span>
            <span className="flex items-center gap-1 text-[8px] leading-tight">
              <span className="font-bold" style={{ color: adaptado ? "var(--medio)" : "var(--tenue)" }}>
                {pos}
              </span>
              <span className="num" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.9)" }}>{ef}</span>
              <span className="inline-block h-1 w-1 rounded-full"
                    style={{ background: colorCondicion(j.condicion) }} />
              {esSub18(j) && <span className="font-bold" style={{ color: "var(--ok)" }}>S18</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
