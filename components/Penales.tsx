"use client";

import { useEffect, useState } from "react";
import type { Tanda } from "@/lib/temporada.ts";

/**
 * La tanda, patada por patada.
 *
 * Antes esto era un rng.chance(0.5) adentro de `avanzarLlave`: salías de la
 * final empatado, la bitácora decía que quedabas afuera y no veías un solo
 * penal. Lo que decide la temporada tiene que poder mirarse.
 *
 * Nada de esto sortea nada: la tanda ya está jugada y guardada. Acá se muestra
 * de a un penal, con su pausa, que es lo único que hace que se sienta.
 */

const PASO = 620;

export default function Penales({ tanda, onCerrar }: { tanda: Tanda; onCerrar: () => void }) {
  const [hasta, setHasta] = useState(0);
  const termino = hasta >= tanda.penales.length;

  useEffect(() => {
    if (termino) return;
    const t = setTimeout(() => setHasta((h) => h + 1), hasta === 0 ? 500 : PASO);
    return () => clearTimeout(t);
  }, [hasta, termino]);

  /** El marcador hasta el penal que se está mostrando. */
  const vistos = tanda.penales.slice(0, hasta);
  const mios = vistos.filter((p) => p.mio && p.entro).length;
  const suyos = vistos.filter((p) => !p.mio && p.entro).length;

  const color = tanda.gana ? "#3fa76a" : "#c0392b";

  return (
    <div className="app items-center justify-center px-6"
         style={{ background: `radial-gradient(120% 90% at 50% 15%, ${
           termino ? (tanda.gana ? "#12301f" : "#301414") : "#16221c"}, #0a120d 72%)` }}>

      <span className="text-[10px] uppercase tracking-[0.24em]" style={{ color: "var(--tenue)" }}>
        Definición por penales
      </span>
      <h1 className="apellido mt-1 text-center text-[22px] leading-tight">
        Olimpia vs {tanda.rival}
      </h1>

      <div className="num mt-4 flex items-center gap-4 text-[46px] leading-none">
        <span style={{ color: termino ? color : "var(--blanco)" }}>{mios}</span>
        <span className="text-[24px]" style={{ color: "var(--apagado)" }}>–</span>
        <span style={{ color: "var(--tenue)" }}>{suyos}</span>
      </div>

      {/* Las dos hileras: arriba los tuyos, abajo los de ellos. */}
      <div className="mt-6 flex w-full max-w-[300px] flex-col gap-3">
        {[true, false].map((mio) => (
          <div key={String(mio)}>
            <span className="text-[9px] uppercase tracking-[0.18em]"
                  style={{ color: "var(--apagado)" }}>
              {mio ? "Olimpia" : tanda.rival}
            </span>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {/* Se guarda el lugar de cada penal en la tanda entera, que es lo
                  que dice si ya se mostró: los dos equipos patean alternado. */}
              {tanda.penales
                .map((p, orden) => ({ p, orden }))
                .filter(({ p }) => p.mio === mio)
                .map(({ p, orden }) => {
                  const mostrado = orden < hasta;
                  return (
                    <span key={orden}
                          className="flex h-7 w-7 items-center justify-center rounded-full text-[13px]"
                          style={{
                            background: !mostrado ? "var(--carbon)"
                              : p.entro ? "#3fa76a" : "#c0392b",
                            color: mostrado ? "#0a120d" : "var(--linea)",
                            transition: "background 200ms ease-out",
                          }}>
                      {mostrado ? (p.entro ? "●" : "✕") : "·"}
                    </span>
                  );
                })}
            </div>
          </div>
        ))}
      </div>

      {/* Quién está pateando ahora, que es lo que se mira. */}
      <div className="mt-5 h-8 text-center">
        {hasta > 0 && !termino && (() => {
          const p = tanda.penales[hasta - 1];
          return (
            <span className="apellido text-[15px]"
                  style={{ color: p.entro ? "var(--ok)" : "var(--critico)" }}>
              {p.mio ? `${p.quien}: ${p.entro ? "adentro" : "la erró"}`
                : p.entro ? `Convierte ${tanda.rival}` : `¡La erró ${tanda.rival}!`}
            </span>
          );
        })()}
      </div>

      {termino && (
        <>
          <span className="apellido mt-1 text-center text-[26px] leading-tight" style={{ color }}>
            {tanda.gana ? "OLIMPIA PASA" : "OLIMPIA QUEDA AFUERA"}
          </span>
          <button onClick={onCerrar}
            className="mt-6 w-full max-w-[280px] rounded-lg py-3.5 text-[13px] font-extrabold uppercase tracking-[0.14em]"
            style={{ background: color, color: "#0a120d" }}>
            Seguir
          </button>
        </>
      )}
    </div>
  );
}
