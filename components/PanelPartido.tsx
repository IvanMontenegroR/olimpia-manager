"use client";

import { colorCondicion } from "@/lib/juego.ts";
import Dorsal, { colorDe } from "./Dorsal.tsx";
import { riesgoDeRoja } from "@/engine/riesgo.ts";
import type { Alineacion, ContextoPartido, Jugador, Posicion } from "@/engine/tipos.ts";

export interface EstadoJugador {
  amarilla: boolean;
  goles: number;
  lesionado: boolean;
  encendido: boolean;
  apagado: boolean;
}

export { colorDe as COLOR_POS_FN } from "./Dorsal.tsx";

/**
 * Los once en cancha durante el partido, del más gastado al más entero.
 *
 * Antes había pestañas para ver al rival y las estadísticas, pero en el
 * partido lo único que se hace acá es decidir a quién sacar: todo lo demás
 * ocupaba lugar y no se miraba.
 */
export default function PanelPartido({
  once, puestos, estado, condicionDe, minuto, alineacion, ctx, dominio, onTocar,
}: {
  once: Jugador[];
  puestos: Map<string, Posicion>;
  estado: Map<string, EstadoJugador>;
  condicionDe: (j: Jugador) => number;
  minuto: number;
  alineacion: Alineacion;
  ctx: ContextoPartido;
  dominio: number;
  onTocar: (j: Jugador) => void;
}) {
  const posesion = Math.round(dominio * 100);
  return (
    <div className="flex min-h-0 flex-1 flex-col px-3">
      {/* dominio */}
      <div className="mb-1.5 flex items-center gap-2">
        <span className="num w-7 text-[10px]" style={{ color: "#3fa76a" }}>
          {posesion}%
        </span>
        <span className="flex h-1.5 flex-1 overflow-hidden rounded-full"
              style={{ background: "var(--linea)" }}>
          <span style={{ width: `${dominio * 100}%`, background: "#3fa76a",
                         transition: "width 700ms ease-out" }} />
          <span style={{ width: `${(1 - dominio) * 100}%`, background: "#c0392b",
                         transition: "width 700ms ease-out" }} />
        </span>
        <span className="num w-7 text-right text-[10px]" style={{ color: "#c0392b" }}>
          {100 - posesion}%
        </span>
      </div>

      <div className="scroll-y min-h-0 flex-1">
        {[...once]
          // el lesionado siempre primero: es el cambio que no se puede postergar
          .sort((a, b) =>
            Number(estado.get(b.id)?.lesionado ?? false) - Number(estado.get(a.id)?.lesionado ?? false) ||
            condicionDe(a) - condicionDe(b))
          .map((j) => {
            const pos = puestos.get(j.id) ?? j.posicion;
            const e = estado.get(j.id) ?? {
              amarilla: false, goles: 0, lesionado: false, encendido: false, apagado: false };
            const c = condicionDe(j);
            const riesgo = riesgoDeRoja(j, e.amarilla, minuto, alineacion, ctx);
            const alarma = e.lesionado ? "#e0902a"
              : riesgo > 0.05 ? "#c0392b"
              : c < 50 ? "#e0902a"
              : null;

            return (
              <button key={j.id} onClick={() => onTocar(j)}
                className="mb-[3px] flex w-full items-center gap-2 rounded-md px-1.5 py-[3px] text-left"
                style={{
                  background: alarma
                    ? `color-mix(in srgb, ${alarma} 18%, var(--carbon))`
                    : "var(--carbon)",
                  outline: alarma ? `1px solid color-mix(in srgb, ${alarma} 55%, transparent)` : "none",
                }}>
                <Dorsal numero={j.numero} tam={24} />
                <span className="apellido min-w-0 flex-1 truncate text-[11px]">{j.apellido}</span>

                <span className="flex shrink-0 items-center gap-1">
                  {e.encendido && <Chapa texto="EN LLAMAS" color="#e0902a" />}
                  {e.apagado && <Chapa texto="APAGADO" color="#5d7167" />}
                  {e.goles > 0 && <Chapa texto={e.goles > 1 ? `${e.goles} GOLES` : "GOL"} color="#3fa76a" />}
                  {e.lesionado && <Chapa texto="LESIÓN" color="#e0902a" />}
                  {e.amarilla && (
                    <span className="inline-block h-3 w-[7px] rounded-[1px]" style={{ background: "#facc15" }} />
                  )}
                  {riesgo > 0.01 && (
                    <span className="num text-[9px]" style={{ color: "#c0392b" }}>
                      {Math.round(riesgo * 100)}%
                    </span>
                  )}
                </span>

                <Barra valor={c} />
              </button>
            );
          })}

      </div>
    </div>
  );
}

function Chapa({ texto, color }: { texto: string; color: string }) {
  return (
    <span className="rounded px-1 text-[8px] font-extrabold uppercase tracking-wider"
          style={{ background: color, color: "#0a120d" }}>
      {texto}
    </span>
  );
}

function Barra({ valor }: { valor: number }) {
  return (
    <span className="flex w-14 shrink-0 items-center gap-1">
      <span className="h-1 flex-1 overflow-hidden rounded-full" style={{ background: "var(--linea)" }}>
        <span className="block h-full rounded-full transition-all duration-500"
              style={{ width: `${valor}%`, background: colorCondicion(valor) }} />
      </span>
      <span className="num w-4 text-right text-[9px]" style={{ color: colorCondicion(valor) }}>
        {valor}
      </span>
    </span>
  );
}
