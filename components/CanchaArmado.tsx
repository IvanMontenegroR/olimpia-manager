"use client";

import { colorCondicion, esSub18, nivelEf } from "@/lib/juego.ts";
import Dorsal from "./Dorsal.tsx";
import { COORD, LINEA_DE, type ContextoPartido, type Jugador, type Posicion } from "@/engine/tipos.ts";

/**
 * Ubica a los once en la cancha vertical. Dos choques posibles: los que
 * comparten puesto (dos centrales se abren en abanico) y los que caen casi
 * encima (el enganche justo delante del volante central). Al segundo se lo
 * separa en profundidad y no de costado: un MCO corrido a la banda deja de
 * leerse como enganche.
 */
const ALTO = 16;  // profundidad que ocupa un bloque, en unidades de cancha
const ANCHO = 19; // lo que ocupa a lo ancho

function ubicarTodos(once: Jugador[], puestos: Map<string, Posicion>) {
  const porPuesto = new Map<Posicion, Jugador[]>();
  for (const j of once) {
    const p = puestos.get(j.id) ?? j.posicion;
    porPuesto.set(p, [...(porPuesto.get(p) ?? []), j]);
  }

  const puntos: { j: Jugador; x: number; y: number }[] = [];
  for (const [pos, jugadores] of porPuesto) {
    const c = COORD[pos];
    const paso = jugadores.length > 1 ? 30 : 0;
    jugadores.forEach((j, i) => {
      puntos.push({ j, x: c.x, y: c.y + (i - (jugadores.length - 1) / 2) * paso });
    });
  }

  // Relajación por pares: cada choque empuja a los dos en profundidad, mitad
  // para cada uno. Iterativo porque separar un par puede crear otro.
  for (let paso = 0; paso < 40; paso++) {
    let hubo = false;
    for (let i = 0; i < puntos.length; i++) {
      for (let k = i + 1; k < puntos.length; k++) {
        const a = puntos[i], b = puntos[k];
        if (Math.abs(a.y - b.y) >= ANCHO) continue;
        const dx = Math.abs(a.x - b.x);
        if (dx >= ALTO) continue;
        hubo = true;
        const empuje = (ALTO - dx) / 2 + 0.01;
        // el que ya está más adelante sigue adelante; si empatan, desempata el arco
        const aAdelante = a.x > b.x || (a.x === b.x && i > k);
        a.x = clampX(a.x + (aAdelante ? empuje : -empuje));
        b.x = clampX(b.x + (aAdelante ? -empuje : empuje));
      }
    }
    if (!hubo) break;
  }

  const lugares = new Map<string, { izq: number; arriba: number }>();
  for (const { j, x, y } of puntos) {
    lugares.set(j.id, {
      izq: 9 + (Math.max(4, Math.min(96, y)) / 100) * 82,
      arriba: 94 - (x / 100) * 88,
    });
  }
  return lugares;
}

const clampX = (x: number) => Math.max(2, Math.min(94, x));

export default function CanchaArmado({
  once, puestos, ctx, seleccionado, onTocar,
}: {
  once: Jugador[];
  puestos: Map<string, Posicion>;
  ctx: ContextoPartido;
  seleccionado: string | null;
  onTocar: (j: Jugador) => void;
}) {


  const lugares = ubicarTodos(once, puestos);

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
        const { izq, arriba } = lugares.get(j.id) ?? { izq: 50, arriba: 50 };
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
