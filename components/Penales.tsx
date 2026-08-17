"use client";

import { useEffect, useState } from "react";
import Dorsal from "./Dorsal.tsx";
import { estadoTanda, pateadoresLibres, type Tanda } from "@/lib/temporada.ts";

/**
 * La tanda, patada por patada, pateando vos.
 *
 * Esto empezó siendo un rng.chance(0.5) adentro de `avanzarLlave`: salías de la
 * final empatado, la bitácora decía que quedabas afuera y no veías un solo
 * penal. Después pasó a jugarse de verdad, pero seguía siendo una película: la
 * tanda venía cocinada y acá se pasaba de a un cuadro.
 *
 * Ahora se juega. Elegís pateador de cada penal, y elegir importa: el que
 * define mejor mete más, el que tiene noventa partidos de Conmebol encima
 * aguanta la cabeza, y al pibe de veinte le pesa. La chance está a la vista
 * porque es la única forma de que elegir sea una decisión y no una corazonada.
 *
 * El rival contesta solo. Su penal se resuelve en la misma llamada que el tuyo
 * para que la tirada no dependa de cuántas veces se dibujó la pantalla.
 */

/** Lo que tarda en aparecer el penal del rival después del tuyo. */
const PAUSA_RIVAL = 900;

export default function Penales({ tanda, onPatear, onCerrar }: {
  tanda: Tanda;
  onPatear: (jugadorId: string) => void;
  onCerrar: () => void;
}) {
  const est = estadoTanda(tanda);
  const libres = pateadoresLibres(tanda);

  /*
   * Cuántos penales se muestran. Cuando pateás, la tanda salta de golpe con el
   * tuyo y el del rival adentro; acá se destapan de a uno para que se vean los
   * dos y no aparezcan juntos.
   */
  const [hasta, setHasta] = useState(0);
  useEffect(() => {
    if (hasta >= tanda.penales.length) return;
    const t = setTimeout(() => setHasta((h) => h + 1), hasta === 0 ? 260 : PAUSA_RIVAL);
    return () => clearTimeout(t);
  }, [hasta, tanda.penales.length]);

  const vistos = tanda.penales.slice(0, hasta);
  const alDia = hasta >= tanda.penales.length;
  const mios = vistos.filter((p) => p.mio && p.entro).length;
  const suyos = vistos.filter((p) => !p.mio && p.entro).length;
  /* Nada se decide hasta que la pantalla terminó de mostrar lo que ya pasó. */
  const termino = est.termino && alDia;
  const eligiendo = est.meToca && !est.termino && alDia;

  const color = est.gana ? "#3fa76a" : "#c0392b";
  const ultimo = vistos[vistos.length - 1];

  return (
    <div className="app px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-5"
         style={{ background: `radial-gradient(120% 90% at 50% 12%, ${
           termino ? (est.gana ? "#12301f" : "#301414") : "#16221c"}, #0a120d 72%)` }}>

      <div className="shrink-0 text-center">
        <span className="text-[10px] uppercase tracking-[0.24em]" style={{ color: "var(--tenue)" }}>
          {est.enSubita ? "Muerte súbita" : "Definición por penales"}
        </span>
        <h1 className="apellido mt-1 text-[20px] leading-tight">Olimpia vs {tanda.rival}</h1>

        <div className="num mt-3 flex items-center justify-center gap-4 text-[44px] leading-none">
          <span style={{ color: termino ? color : "var(--blanco)" }}>{mios}</span>
          <span className="text-[22px]" style={{ color: "var(--apagado)" }}>–</span>
          <span style={{ color: "var(--tenue)" }}>{suyos}</span>
        </div>

        {/* Las dos hileras. Los casilleros vacíos son los cinco de arranque:
            en la muerte súbita se van agregando de a uno. */}
        <div className="mx-auto mt-4 flex w-full max-w-[300px] flex-col gap-2.5">
          {[true, false].map((mio) => {
            const suyosVistos = vistos.filter((p) => p.mio === mio);
            const cuantos = Math.max(5, suyosVistos.length);
            return (
              <div key={String(mio)} className="text-left">
                <span className="text-[9px] uppercase tracking-[0.18em]"
                      style={{ color: "var(--apagado)" }}>
                  {mio ? "Olimpia" : tanda.rival}
                </span>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {Array.from({ length: cuantos }, (_, i) => {
                    const p = suyosVistos[i];
                    return (
                      <span key={i}
                            className="flex h-7 w-7 items-center justify-center rounded-full text-[13px]"
                            style={{
                              background: !p ? "var(--carbon)" : p.entro ? "#3fa76a" : "#c0392b",
                              color: p ? "#0a120d" : "var(--linea)",
                              transition: "background 200ms ease-out",
                            }}>
                        {p ? (p.entro ? "●" : "✕") : "·"}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Lo último que pasó. */}
        <div className="mt-3 h-6">
          {ultimo && (
            <span className="apellido text-[15px]"
                  style={{ color: ultimo.entro === ultimo.mio ? "var(--ok)" : "var(--critico)" }}>
              {ultimo.mio
                ? `${ultimo.quien}: ${ultimo.entro ? "adentro" : "la erró"}`
                : ultimo.entro ? `Convierte ${tanda.rival}` : `¡La erró ${tanda.rival}!`}
            </span>
          )}
        </div>
      </div>

      {/* ---------- a quién le das la pelota ---------- */}
      <div className="mt-3 flex min-h-0 flex-1 flex-col">
        {eligiendo && (
          <>
            <span className="shrink-0 text-[10px] uppercase tracking-[0.18em]"
                  style={{ color: "var(--tenue)" }}>
              ¿Quién patea el {est.ronda}°?
            </span>
            <div className="scroll-y mt-1.5 min-h-0 flex-1">
              {libres.map((p) => (
                <button key={p.id} onClick={() => onPatear(p.id)}
                  className="mb-1.5 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left"
                  style={{ background: "var(--carbon)" }}>
                  <Dorsal numero={p.numero} tam={26} />
                  <span className="min-w-0 flex-1">
                    <span className="apellido block truncate text-[13px]">{p.apellido}</span>
                    {!!p.nota && (
                      <span className="text-[9px]" style={{ color: "var(--apagado)" }}>{p.nota}</span>
                    )}
                  </span>
                  {/* La chance, que es lo único por lo que se elige. */}
                  <span className="num shrink-0 rounded px-1.5 py-0.5 text-[12px] font-extrabold"
                        style={{
                          background: `color-mix(in srgb, #3fa76a ${
                            Math.round((p.chance - 0.45) / 0.45 * 70) + 18}%, var(--linea))`,
                          color: "#0a120d",
                        }}>
                        {Math.round(p.chance * 100)}%
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        {!eligiendo && !termino && (
          <span className="mt-4 text-center text-[12px]" style={{ color: "var(--apagado)" }}>
            Patea {tanda.rival}…
          </span>
        )}

        {termino && (
          <div className="mt-auto shrink-0">
            <span className="apellido block text-center text-[26px] leading-tight" style={{ color }}>
              {est.gana ? "OLIMPIA PASA" : "OLIMPIA QUEDA AFUERA"}
            </span>
            <button onClick={onCerrar}
              className="mt-5 w-full rounded-lg py-3.5 text-[13px] font-extrabold uppercase tracking-[0.14em]"
              style={{ background: color, color: "#0a120d" }}>
              Seguir
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
