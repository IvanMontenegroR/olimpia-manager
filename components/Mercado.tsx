"use client";

import { colorDe } from "./Dorsal.tsx";
import { BANDERA } from "@/lib/juego.ts";
import { miles, type Partida } from "@/lib/temporada.ts";

/** Cómo se llama cada rasgo cuando hay que leerlo de un vistazo. */
const RASGO: Record<string, { texto: string; color: string }> = {
  definidor: { texto: "definidor", color: "#3fa76a" },
  juego_aereo: { texto: "gana arriba", color: "#4a7fb5" },
  definicion_irregular: { texto: "irregular", color: "#e0902a" },
  veterano_de_copas: { texto: "jugó de todo", color: "#a1a1aa" },
  fragil: { texto: "se rompe seguido", color: "#c0392b" },
};

/**
 * Comprar sin scouting: lo que ves es lo que hay.
 *
 * Los nombres son de jugadores que existen y de cada uno se muestra de dónde
 * viene y qué sabe hacer. Cuando eran inventados y sin rasgos, fichar era
 * elegir un número.
 */
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
                  <span style={{ color: "var(--apagado)" }}>{f.nombre}</span> {f.apellido}
                </span>
                <span className="text-[9px]" style={{ color: "var(--apagado)" }}>
                  {f.edad} años {BANDERA[f.nacionalidad] ?? ""}
                  {f.de ? ` · ${f.de}` : ""}
                  {f.extranjero && " · ocupa cupo"}
                </span>
              </span>
              <span className="num text-[20px]">{f.nivel}</span>
            </div>

            {f.nota && (
              <p className="mt-1 text-[10px] leading-snug" style={{ color: "var(--tenue)" }}>
                {f.nota}
              </p>
            )}

            {/* Lo que sabe hacer, que es lo que lo separa de otro del mismo nivel. */}
            {!!f.rasgos?.length && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {f.rasgos.map((r) => {
                  const e = RASGO[r];
                  return e ? (
                    <span key={r} className="rounded px-1.5 py-[1px] text-[9px] font-extrabold uppercase tracking-wider"
                          style={{ background: `color-mix(in srgb, ${e.color} 22%, transparent)`,
                                   color: e.color }}>
                      {e.texto}
                    </span>
                  ) : null;
                })}
                {f.valorComercial >= 3 && (
                  <span className="rounded px-1.5 py-[1px] text-[9px] font-extrabold uppercase tracking-wider"
                        style={{ background: "#d9a83222", color: "#d9a832" }}>
                    vende camisetas
                  </span>
                )}
              </div>
            )}
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
