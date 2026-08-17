"use client";

import { useEffect, useMemo, useState } from "react";
import Escudo from "./Escudo.tsx";
import Trofeo from "./Trofeo.tsx";
import {
  dondeEsta, esPlaceholder, grupoQueEspera, nombreDe,
  type Casillero, type CuadroCopa,
} from "@/lib/sorteo.ts";

/**
 * El sorteo, bolilla por bolilla.
 *
 * Es enero y todavía no se jugó nada, pero el año ya empieza acá: de este
 * sorteo sale si te toca Flamengo en el grupo o si tenés que ganar tres llaves
 * antes de entrar. Mostrarlo de golpe como una tabla sería tirar el único
 * momento del año en que no hacés nada y igual estás pendiente.
 *
 * Los casilleros aparecen de a uno, con su pausa. Los que dicen "Ganador F3-2"
 * son los que todavía no tienen dueño: cuando esas llaves se jueguen, el que
 * gane ocupa EXACTAMENTE ese lugar, no uno nuevo. Por eso el que va a la fase
 * previa ya sabe a qué grupo entra si pasa, y eso se le dice acá.
 */

const ESTILO = {
  libertadores: {
    nombre: "Copa Libertadores", acento: "#e8c25a",
    fondo: "radial-gradient(130% 80% at 50% 0%, #2c2412, #0b0906 70%)",
    halo: "rgba(240,210,130,0.30)",
  },
  sudamericana: {
    nombre: "Copa Sudamericana", acento: "#5fb0e8",
    fondo: "radial-gradient(130% 80% at 50% 0%, #1b3f63, #0a1523 70%)",
    halo: "rgba(120,190,255,0.30)",
  },
} as const;

/** Cada cuánto cae una bolilla. */
const PASO = 260;

export default function SorteoCopa({ cuadro, ano, onSeguir }: {
  cuadro: CuadroCopa;
  ano: number;
  onSeguir: () => void;
}) {
  const e = ESTILO[cuadro.torneo];
  const yo = useMemo(() => dondeEsta(cuadro, "olimpia"), [cuadro]);

  /*
   * Todo lo que se va a mostrar, en orden: primero las llaves de las fases
   * previas y después los grupos. Se arma una lista plana para que la
   * animación sea un solo contador y no cuatro estados que se pisan.
   */
  const pasos = useMemo(() => {
    const xs: { tipo: "llave" | "grupo"; clave: string }[] = [];
    for (const l of cuadro.llaves) xs.push({ tipo: "llave", clave: l.id });
    for (const g of cuadro.grupos) for (let i = 0; i < g.equipos.length; i++) {
      xs.push({ tipo: "grupo", clave: `${g.letra}-${i}` });
    }
    return xs;
  }, [cuadro]);

  const [hasta, setHasta] = useState(0);
  const listo = hasta >= pasos.length;

  useEffect(() => {
    if (listo) return;
    const t = setTimeout(() => setHasta((h) => h + 1), hasta === 0 ? 500 : PASO);
    return () => clearTimeout(t);
  }, [hasta, listo]);

  const salio = (tipo: "llave" | "grupo", clave: string) =>
    pasos.findIndex((p) => p.tipo === tipo && p.clave === clave) < hasta;

  const fases = [...new Set(cuadro.llaves.map((l) => l.fase))];
  const nombreFase: Record<string, string> = {
    F1: "Fase 1", F2: "Fase 2", F3: "Fase 3", PO: "Play-off nacional",
  };

  return (
    <div className="app scroll-y px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-5"
         style={{ background: e.fondo }}>

      <div className="flex items-end gap-3">
        <Trofeo copa={cuadro.torneo} alto={64} />
        <div className="min-w-0 flex-1">
          <span className="text-[10px] uppercase tracking-[0.24em]" style={{ color: e.acento }}>
            Sorteo - {ano}
          </span>
          <h1 className="apellido mt-1 text-[24px] leading-tight">{e.nombre}</h1>
        </div>
      </div>

      {/* Dónde quedó Olimpia, que es lo único que de verdad se está mirando. */}
      {listo && (yo.llave || yo.grupo) && (
        <div className="entrar relieve-alto mt-3 rounded-xl px-3.5 py-3"
             style={{ background: `color-mix(in srgb, ${e.acento} 16%, transparent)`,
                      boxShadow: `inset 0 0 0 1px ${e.halo}` }}>
          <span className="block text-[9px] uppercase tracking-[0.18em]" style={{ color: e.acento }}>
            Olimpia
          </span>
          {yo.grupo ? (
            <>
              <span className="apellido mt-0.5 block text-[19px] leading-tight">
                Grupo {yo.grupo.letra}
              </span>
              <span className="mt-1 block text-[11px] leading-snug" style={{ color: "var(--tenue)" }}>
                {yo.grupo.equipos.filter((x) => esPlaceholder(x) || x.id !== "olimpia")
                  .map(nombreDe).join(" - ")}
              </span>
            </>
          ) : yo.llave ? (() => {
            const rival = [yo.llave.local, yo.llave.visita]
              .find((x) => esPlaceholder(x) || x.id !== "olimpia")!;
            const espera = grupoQueEspera(cuadro, yo.llave.id);
            return (
              <>
                <span className="apellido mt-0.5 block text-[19px] leading-tight">
                  {nombreFase[yo.llave.fase] ?? yo.llave.fase} contra {nombreDe(rival)}
                </span>
                <span className="mt-1 block text-[11px] leading-snug" style={{ color: "var(--tenue)" }}>
                  {espera
                    ? `Si pasa entra al Grupo ${espera.letra}, que ya está sorteado.`
                    : "Si pasa, sigue a la llave que viene."}
                </span>
              </>
            );
          })() : null}
        </div>
      )}

      {/* ---------- las fases previas ---------- */}
      {fases.map((fase) => (
        <div key={fase}>
          <Titulo color={e.acento}>{nombreFase[fase] ?? fase}</Titulo>
          {cuadro.llaves.filter((l) => l.fase === fase).map((l) => {
            const visible = salio("llave", l.id);
            const mia = [l.local, l.visita]
              .some((x) => !esPlaceholder(x) && x.id === "olimpia");
            return (
              <div key={l.id} className="mb-1 flex items-center gap-2 rounded-md px-2.5 py-2"
                   style={{
                     background: mia ? `color-mix(in srgb, ${e.acento} 20%, var(--carbon))`
                       : "var(--carbon)",
                     opacity: visible ? 1 : 0.18,
                     transition: "opacity 220ms ease-out",
                   }}>
                <span className="num w-9 shrink-0 text-[9px]" style={{ color: e.acento }}>{l.id}</span>
                <Lado c={l.local} visible={visible} />
                <span className="shrink-0 text-[9px]" style={{ color: "var(--apagado)" }}>vs</span>
                <Lado c={l.visita} visible={visible} derecha />
              </div>
            );
          })}
        </div>
      ))}

      {/* ---------- los grupos ---------- */}
      <Titulo color={e.acento}>Fase de grupos</Titulo>
      <div className="grid grid-cols-2 gap-1.5">
        {cuadro.grupos.map((g) => (
          <div key={g.letra} className="rounded-lg px-2 py-1.5" style={{ background: "var(--carbon)" }}>
            <span className="block text-[9px] font-extrabold uppercase tracking-[0.14em]"
                  style={{ color: e.acento }}>
              Grupo {g.letra}
            </span>
            {g.equipos.map((x, i) => {
              const visible = salio("grupo", `${g.letra}-${i}`);
              const mio = !esPlaceholder(x) && x.id === "olimpia";
              return (
                <span key={i} className="mt-0.5 flex items-center gap-1.5"
                      style={{ opacity: visible ? 1 : 0.14, transition: "opacity 220ms ease-out" }}>
                  {!esPlaceholder(x) && visible && <Escudo id={x.id} nombre={x.nombre} tam={13} />}
                  <span className="min-w-0 flex-1 truncate text-[10px]"
                        style={{
                          color: mio ? e.acento : esPlaceholder(x) ? "var(--apagado)" : "var(--blanco)",
                          fontWeight: mio ? 800 : 400,
                          fontStyle: esPlaceholder(x) ? "italic" : "normal",
                        }}>
                    {visible ? nombreDe(x) : "-"}
                  </span>
                </span>
              );
            })}
          </div>
        ))}
      </div>

      <button onClick={listo ? onSeguir : () => setHasta(pasos.length)}
        className="mt-4 w-full shrink-0 rounded-lg py-3.5 text-[13px] font-extrabold uppercase tracking-[0.14em]"
        style={{ background: listo ? e.acento : "var(--carbon)",
                 color: listo ? "#0a120d" : "var(--tenue)" }}>
        {listo ? "Seguir" : "Saltear el sorteo"}
      </button>
    </div>
  );
}

function Lado({ c, visible, derecha }: { c: Casillero; visible: boolean; derecha?: boolean }) {
  const mio = !esPlaceholder(c) && c.id === "olimpia";
  return (
    <span className={`flex min-w-0 flex-1 items-center gap-1.5 ${derecha ? "flex-row-reverse" : ""}`}>
      {!esPlaceholder(c) && visible && <Escudo id={c.id} nombre={c.nombre} tam={16} />}
      <span className="min-w-0 flex-1 truncate text-[11px]"
            style={{
              textAlign: derecha ? "right" : "left",
              fontWeight: mio ? 800 : 400,
              fontStyle: esPlaceholder(c) ? "italic" : "normal",
              color: esPlaceholder(c) ? "var(--apagado)" : "var(--blanco)",
            }}>
        {visible ? nombreDe(c) : "-"}
      </span>
    </span>
  );
}

function Titulo({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <div className="mb-1.5 mt-4 text-[10px] uppercase tracking-[0.18em]" style={{ color }}>
      {children}
    </div>
  );
}
