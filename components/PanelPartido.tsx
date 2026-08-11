"use client";

import { useMemo, useState } from "react";
import { colorCondicion } from "@/lib/juego.ts";
import Dorsal, { DorsalRival, colorDe } from "./Dorsal.tsx";
import { riesgoDeRoja } from "@/engine/riesgo.ts";
import type { JugadorRival } from "@/engine/rival.ts";
import type { EventoRelato } from "@/engine/relato.ts";
import { LINEA_DE, type Alineacion, type ContextoPartido, type Jugador, type Posicion } from "@/engine/tipos.ts";

export interface EstadoJugador {
  amarilla: boolean;
  goles: number;
  lesionado: boolean;
  encendido: boolean;
  apagado: boolean;
}

export { colorDe as COLOR_POS_FN } from "./Dorsal.tsx";

type Pestania = "olimpia" | "rival" | "stats";

export default function PanelPartido({
  once, puestos, estado, condicionDe, minuto, alineacion, ctx,
  dominio, rival11, estadoRival, eventos, rivalNombre, onTocar,
}: {
  once: Jugador[];
  puestos: Map<string, Posicion>;
  estado: Map<string, EstadoJugador>;
  condicionDe: (j: Jugador) => number;
  minuto: number;
  alineacion: Alineacion;
  ctx: ContextoPartido;
  dominio: number;
  rival11: JugadorRival[];
  estadoRival: Map<string, { amarilla: boolean; expulsado: boolean }>;
  eventos: EventoRelato[];
  rivalNombre: string;
  onTocar: (j: Jugador) => void;
}) {
  const [pestania, setPestania] = useState<Pestania>("olimpia");
  /**
   * Durante el partido lo que se busca es a quién hay que sacar, así que por
   * defecto arriba van los más gastados y no hay que bajar la lista para
   * encontrarlos. Se puede volver al orden por puesto para leer el equipo.
   */
  const [porEstado, setPorEstado] = useState(true);

  const stats = useMemo(() => {
    const cuenta = (t: string) => eventos.filter((e) => e.tipo === t).length;
    const golesO = cuenta("gol"), golesR = cuenta("gol_rival");
    const ocO = cuenta("ocasion"), ocR = cuenta("ocasion_rival");
    return {
      posesion: Math.round(dominio * 100),
      remates: [golesO + ocO + Math.round(minuto * dominio * 0.06),
                golesR + ocR + Math.round(minuto * (1 - dominio) * 0.06)],
      alArco: [golesO + Math.round(ocO * 0.7), golesR + Math.round(ocR * 0.7)],
      corners: [Math.round(minuto * dominio * 0.055), Math.round(minuto * (1 - dominio) * 0.055)],
      amarillas: [cuenta("amarilla"), cuenta("amarilla_rival")],
      rojas: [cuenta("roja"), cuenta("roja_rival")],
    };
  }, [eventos, dominio, minuto]);

  const orden = ["ARQ", "DEF", "MED", "DEL"] as const;
  const linea = (p: Posicion) => orden.indexOf(LINEA_DE[p]);

  return (
    <div className="flex min-h-0 flex-1 flex-col px-3">
      {/* dominio */}
      <div className="mb-1.5 flex items-center gap-2">
        <span className="num w-7 text-[10px]" style={{ color: "#3fa76a" }}>
          {stats.posesion}%
        </span>
        <span className="flex h-1.5 flex-1 overflow-hidden rounded-full"
              style={{ background: "var(--linea)" }}>
          <span style={{ width: `${dominio * 100}%`, background: "#3fa76a",
                         transition: "width 700ms ease-out" }} />
          <span style={{ width: `${(1 - dominio) * 100}%`, background: "#c0392b",
                         transition: "width 700ms ease-out" }} />
        </span>
        <span className="num w-7 text-right text-[10px]" style={{ color: "#c0392b" }}>
          {100 - stats.posesion}%
        </span>
      </div>

      {/* pestañas */}
      <div className="mb-1.5 flex gap-1">
        {([["olimpia", "Mi equipo"], ["rival", rivalNombre], ["stats", "Números"]] as const)
          .map(([id, texto]) => (
            <button key={id} onClick={() => setPestania(id)}
              className="flex-1 truncate rounded-md py-1.5 text-[10px] font-bold uppercase tracking-wider"
              style={{
                background: pestania === id ? "var(--blanco)" : "var(--carbon)",
                color: pestania === id ? "var(--negro)" : "var(--tenue)",
              }}>
              {texto}
            </button>
          ))}
      </div>

      {pestania === "olimpia" && (
        <div className="mb-1 flex items-center justify-between px-0.5">
          <span className="text-[8px] uppercase tracking-[0.14em]" style={{ color: "var(--apagado)" }}>
            {porEstado ? "Los más gastados primero" : "Por puesto"}
          </span>
          <button onClick={() => setPorEstado((v) => !v)}
            className="rounded px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider"
            style={{ background: "var(--carbon)", color: "var(--tenue)" }}>
            {porEstado ? "Ver por puesto" : "Ver por estado"}
          </button>
        </div>
      )}

      <div className="scroll-y min-h-0 flex-1">
        {pestania === "olimpia" && [...once]
          .sort((a, b) => porEstado
            // el lesionado siempre primero: es el cambio que no se puede postergar
            ? Number(estado.get(b.id)?.lesionado ?? false) - Number(estado.get(a.id)?.lesionado ?? false) ||
              condicionDe(a) - condicionDe(b)
            : linea(puestos.get(a.id) ?? a.posicion) - linea(puestos.get(b.id) ?? b.posicion))
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

        {pestania === "rival" && rival11.map((r) => {
          const e = estadoRival.get(r.id) ?? { amarilla: false, expulsado: false };
          return (
            <div key={r.id}
              className="mb-[3px] flex w-full items-center gap-2 rounded-md px-1.5 py-[3px]"
              style={{
                background: e.expulsado ? "color-mix(in srgb, #c0392b 22%, var(--carbon))" : "var(--carbon)",
                opacity: e.expulsado ? 0.55 : 1,
              }}>
              <DorsalRival numero={r.numero} color={colorDe(r.posicion)} tam={22} />
              <span className="apellido min-w-0 flex-1 truncate text-[11px]">{r.apellido}</span>
              {e.expulsado && <Chapa texto="EXPULSADO" color="#c0392b" />}
              {e.amarilla && !e.expulsado && (
                <span className="inline-block h-3 w-[7px] rounded-[1px]" style={{ background: "#facc15" }} />
              )}
              <span className="num w-6 text-right text-[11px]" style={{ color: "var(--tenue)" }}>
                {r.nivel}
              </span>
            </div>
          );
        })}

        {pestania === "stats" && (
          <div className="pt-0.5">
            <Fila etiqueta="Posesión" a={`${stats.posesion}%`} b={`${100 - stats.posesion}%`}
                  proporcion={dominio} />
            <Fila etiqueta="Remates" a={stats.remates[0]} b={stats.remates[1]} />
            <Fila etiqueta="Al arco" a={stats.alArco[0]} b={stats.alArco[1]} />
            <Fila etiqueta="Córners" a={stats.corners[0]} b={stats.corners[1]} />
            <Fila etiqueta="Amarillas" a={stats.amarillas[0]} b={stats.amarillas[1]} />
            <Fila etiqueta="Rojas" a={stats.rojas[0]} b={stats.rojas[1]} />
          </div>
        )}
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

function Fila({ etiqueta, a, b, proporcion }: {
  etiqueta: string; a: number | string; b: number | string; proporcion?: number;
}) {
  const na = typeof a === "number" ? a : 0;
  const nb = typeof b === "number" ? b : 0;
  const p = proporcion ?? (na + nb === 0 ? 0.5 : na / (na + nb));
  return (
    <div className="mb-2">
      <div className="flex items-baseline justify-between text-[11px]">
        <span className="num" style={{ color: "#3fa76a" }}>{a}</span>
        <span className="uppercase tracking-wider" style={{ color: "var(--apagado)", fontSize: 9 }}>
          {etiqueta}
        </span>
        <span className="num" style={{ color: "#c0392b" }}>{b}</span>
      </div>
      <div className="mt-1 flex h-1 overflow-hidden rounded-full" style={{ background: "var(--linea)" }}>
        <span style={{ width: `${p * 100}%`, background: "#3fa76a", transition: "width 500ms" }} />
        <span style={{ width: `${(1 - p) * 100}%`, background: "#c0392b", transition: "width 500ms" }} />
      </div>
    </div>
  );
}
