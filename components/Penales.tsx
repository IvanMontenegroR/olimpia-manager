"use client";

import { useEffect, useState } from "react";
import Dorsal from "./Dorsal.tsx";
import {
  estadoTanda, palosDeMiPenal, pateadoresLibres, zonasDeMiArquero,
  type PaloPenal, type Tanda,
} from "@/lib/temporada.ts";

/**
 * La tanda, patada por patada, jugándola vos.
 *
 * Esto empezó siendo un rng.chance(0.5) adentro de `avanzarLlave`: salías de la
 * final empatado, la bitácora decía que quedabas afuera y no veías un solo
 * penal. Después pasó a jugarse de verdad, pero seguía siendo una película: la
 * tanda venía cocinada y acá se pasaba de a un cuadro.
 *
 * Ahora se juega entera. Cada vuelta son tres decisiones:
 *
 *   1. quién patea, de los once que terminaron el partido
 *   2. a qué palo la pone, contra un arquero que llega mejor de un lado
 *   3. adónde se tira el tuyo cuando patea el rival
 *
 * Las tres muestran el número que las decide. En la tercera el número es la
 * barra: el arco entero de palo a palo y en verde lo que el arquero alcanza,
 * igual que el penal en contra del partido.
 */

/** Lo que se tarda en destapar cada penal ya resuelto. */
const PAUSA = 850;

const NOMBRE_PALO: Record<PaloPenal, string> = {
  izq: "Al palo izquierdo", centro: "Al medio", der: "Al palo derecho",
};

export default function Penales({ tanda, onPatear, onAtajar, onCerrar }: {
  tanda: Tanda;
  onPatear: (jugadorId: string, palo: PaloPenal) => void;
  onAtajar: (palo: PaloPenal) => void;
  onCerrar: () => void;
}) {
  const est = estadoTanda(tanda);
  const libres = pateadoresLibres(tanda);

  /** El pateador ya elegido, esperando que le digas a qué palo. */
  const [elegido, setElegido] = useState<string | null>(null);

  /*
   * Cuántos penales se muestran, para que el que acaba de pasar se vea antes
   * de que la pantalla pida la decisión siguiente.
   */
  const [hasta, setHasta] = useState(0);
  useEffect(() => {
    if (hasta >= tanda.penales.length) return;
    const t = setTimeout(() => setHasta((h) => h + 1), hasta === 0 ? 220 : PAUSA);
    return () => clearTimeout(t);
  }, [hasta, tanda.penales.length]);

  const vistos = tanda.penales.slice(0, hasta);
  const alDia = hasta >= tanda.penales.length;
  const mios = vistos.filter((p) => p.mio && p.entro).length;
  const suyos = vistos.filter((p) => !p.mio && p.entro).length;
  const termino = est.termino && alDia;
  const decidiendo = !est.termino && alDia;

  const color = est.gana ? "#3fa76a" : "#c0392b";
  const ultimo = vistos[vistos.length - 1];

  const patear = (palo: PaloPenal) => {
    if (!elegido) return;
    onPatear(elegido, palo);
    setElegido(null);
  };

  return (
    <div className="app px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4"
         style={{ background: `radial-gradient(120% 90% at 50% 12%, ${
           termino ? (est.gana ? "#12301f" : "#301414") : "#16221c"}, #0a120d 72%)` }}>

      <div className="shrink-0 text-center">
        <span className="text-[10px] uppercase tracking-[0.24em]" style={{ color: "var(--tenue)" }}>
          {est.enSubita ? "Muerte súbita" : "Definición por penales"}
        </span>
        <h1 className="apellido mt-0.5 text-[19px] leading-tight">Olimpia vs {tanda.rival}</h1>

        <div className="num mt-2 flex items-center justify-center gap-4 text-[40px] leading-none">
          <span style={{ color: termino ? color : "var(--blanco)" }}>{mios}</span>
          <span className="text-[20px]" style={{ color: "var(--apagado)" }}>–</span>
          <span style={{ color: "var(--tenue)" }}>{suyos}</span>
        </div>

        <div className="mx-auto mt-3 flex w-full max-w-[300px] flex-col gap-2">
          {[true, false].map((mio) => {
            const suyosVistos = vistos.filter((p) => p.mio === mio);
            return (
              <div key={String(mio)} className="text-left">
                <span className="text-[9px] uppercase tracking-[0.18em]"
                      style={{ color: "var(--apagado)" }}>
                  {mio ? "Olimpia" : tanda.rival}
                </span>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {Array.from({ length: Math.max(5, suyosVistos.length) }, (_, i) => {
                    const p = suyosVistos[i];
                    return (
                      <span key={i}
                            className="flex h-6 w-6 items-center justify-center rounded-full text-[12px]"
                            style={{
                              background: !p ? "var(--carbon)" : p.entro ? "#3fa76a" : "#c0392b",
                              color: p ? "#0a120d" : "var(--linea)",
                              transition: "background 200ms ease-out",
                            }}>
                        {p ? (p.entro ? "●" : "✕") : "-"}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-2 h-6">
          {ultimo && (
            <span className="apellido text-[14px]"
                  style={{ color: ultimo.entro === ultimo.mio ? "var(--ok)" : "var(--critico)" }}>
              {ultimo.mio
                ? `${ultimo.quien}: ${ultimo.entro ? "adentro" : "la erró"}`
                : ultimo.entro ? `Convierte ${tanda.rival}`
                : `¡La sacó ${tanda.arquero.apellido}!`}
            </span>
          )}
        </div>
      </div>

      {/* ---------- lo que hay que decidir ---------- */}
      <div className="mt-2 flex min-h-0 flex-1 flex-col">

        {/* 1. quién patea */}
        {decidiendo && est.meToca && !elegido && (
          <>
            <Rotulo>¿Quién patea el {est.ronda}°?</Rotulo>
            <div className="scroll-y mt-1.5 min-h-0 flex-1">
              {libres.map((p) => (
                <button key={p.id} onClick={() => setElegido(p.id)}
                  className="mb-1.5 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left"
                  style={{ background: "var(--carbon)" }}>
                  <Dorsal numero={p.numero} tam={26} />
                  <span className="min-w-0 flex-1">
                    <span className="apellido block truncate text-[13px]">{p.apellido}</span>
                    {!!p.nota && (
                      <span className="text-[9px]" style={{ color: "var(--apagado)" }}>{p.nota}</span>
                    )}
                  </span>
                  <Pastilla valor={p.chance} />
                </button>
              ))}
            </div>
          </>
        )}

        {/* 2. a qué palo la pone */}
        {decidiendo && est.meToca && elegido && (
          <>
            <Rotulo>
              Patea {libres.find((p) => p.id === elegido)?.apellido}. ¿Dónde la pone?
            </Rotulo>
            <div className="mt-1.5">
              {palosDeMiPenal(tanda, elegido).map((o) => (
                <button key={o.palo} onClick={() => patear(o.palo)}
                  className="mb-1.5 flex w-full items-center gap-2.5 rounded-lg px-3 py-3 text-left"
                  style={{ background: "var(--carbon)" }}>
                  <span className="apellido min-w-0 flex-1 text-[14px]">{NOMBRE_PALO[o.palo]}</span>
                  <Pastilla valor={o.chance} />
                </button>
              ))}
            </div>
            <button onClick={() => setElegido(null)}
              className="mt-1 text-[10px] uppercase tracking-[0.14em]"
              style={{ color: "var(--apagado)" }}>
              Que patee otro
            </button>
          </>
        )}

        {/* 3. adónde se tira el tuyo */}
        {decidiendo && !est.meToca && (
          <>
            <Rotulo>Patea {tanda.rival}. ¿Adónde se tira {tanda.arquero.apellido}?</Rotulo>
            <div className="mt-1.5">
              {zonasDeMiArquero(tanda).map((z) => (
                <button key={z.palo} onClick={() => onAtajar(z.palo)}
                  className="mb-1.5 w-full rounded-lg px-3 py-2.5 text-left"
                  style={{ background: "var(--carbon)" }}>
                  <span className="flex items-center gap-2.5">
                    <span className="apellido min-w-0 flex-1 text-[14px]">
                      {z.palo === "centro" ? "Se queda en el medio" : NOMBRE_PALO[z.palo]}
                    </span>
                    <Pastilla valor={z.chance} />
                  </span>
                  {/* El arco entero, y en verde lo que llega a tapar. */}
                  <span className="relative mt-1.5 flex h-2 overflow-hidden rounded-full"
                        style={{ background: "#c0392b" }}>
                    <span className="absolute inset-y-0"
                          style={{ left: `${z.desde * 100}%`,
                                   width: `${(z.hasta - z.desde) * 100}%`, background: "#3fa76a" }} />
                    {[33.3, 66.6].map((x) => (
                      <span key={x} className="absolute inset-y-0"
                            style={{ left: `${x}%`, width: 1, background: "#ffffff22" }} />
                    ))}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        {!alDia && !termino && (
          <span className="mt-4 text-center text-[12px]" style={{ color: "var(--apagado)" }}>
            …
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

function Rotulo({ children }: { children: React.ReactNode }) {
  return (
    <span className="shrink-0 text-[10px] uppercase tracking-[0.18em]"
          style={{ color: "var(--tenue)" }}>
      {children}
    </span>
  );
}

/** El porcentaje, verde según cuánto valga. Es lo único por lo que se elige. */
function Pastilla({ valor }: { valor: number }) {
  return (
    <span className="num shrink-0 rounded px-1.5 py-0.5 text-[12px] font-extrabold"
          style={{
            background: `color-mix(in srgb, #3fa76a ${
              Math.round(Math.min(1, Math.max(0, valor)) * 80) + 15}%, var(--linea))`,
            color: "#0a120d",
          }}>
      {Math.round(valor * 100)}%
    </span>
  );
}
