"use client";

import { colorDe } from "./Dorsal.tsx";
import { BANDERA } from "@/lib/juego.ts";
import { miles, type Partida } from "@/lib/temporada.ts";

/** Comprar sin scouting, como pide el documento: lo que ves es lo que hay. */
export default function Mercado({
  partida, onFichar,
}: { partida: Partida; onFichar: (id: string) => void }) {
  return (
    <>
      <div className="mb-2 flex items-baseline justify-between rounded-lg px-3 py-2"
           style={{ background: "var(--carbon)" }}>
        <span className="text-[11px]" style={{ color: "var(--tenue)" }}>Caja disponible</span>
        <span className="num text-[15px]" style={{ color: "#3fa76a" }}>
          {miles(partida.dineroUsd)}
        </span>
      </div>

      {partida.fichajes.length === 0 && (
        <p className="px-2 py-6 text-center text-[12px]" style={{ color: "var(--apagado)" }}>
          No hay nadie disponible por ahora.
        </p>
      )}

      {partida.fichajes.map((f) => {
        const alcanza = f.precioUsd <= partida.dineroUsd;
        return (
          <div key={f.id} className="mb-1.5 rounded-lg p-2.5" style={{ background: "var(--carbon)" }}>
            <div className="flex items-center gap-2">
              <span className="num flex h-6 w-9 shrink-0 items-center justify-center rounded text-[10px]"
                    style={{ background: colorDe(f.posicion), color: "#0a120d" }}>
                {f.posicion}
              </span>
              <span className="min-w-0 flex-1">
                <span className="apellido block truncate text-[13px]">
                  {f.apellido} <span style={{ color: "var(--apagado)" }}>{f.nombre}</span>
                </span>
                <span className="text-[9px]" style={{ color: "var(--apagado)" }}>
                  {f.edad} años {BANDERA[f.nacionalidad] ?? ""}
                  {f.extranjero && " · ocupa cupo"}
                  {f.valorComercial >= 3 && " · vende camisetas"}
                </span>
              </span>
              <span className="num text-[20px]">{f.nivel}</span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="flex-1 text-[11px]" style={{ color: "var(--tenue)" }}>
                {miles(f.precioUsd)} · sueldo {miles(f.sueldoUsd)}
              </span>
              <button onClick={() => onFichar(f.id)} disabled={!alcanza}
                className="rounded-md px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider"
                style={{
                  background: alcanza ? "#d9a832" : "var(--linea)",
                  color: alcanza ? "#0a120d" : "var(--apagado)",
                }}>
                {alcanza ? "Fichar" : "No alcanza"}
              </button>
            </div>
          </div>
        );
      })}
    </>
  );
}
