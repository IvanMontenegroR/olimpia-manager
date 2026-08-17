"use client";

import { useEffect, useState } from "react";
import Escudo from "./Escudo.tsx";
import { esPlaceholder, nombreDe, type Casillero, type Grupo } from "@/lib/sorteo.ts";

/**
 * Ganaste la previa: este es el grupo que te estaba esperando.
 *
 * No es un sorteo nuevo. En enero, cuando se sortearon los grupos, este lugar
 * decía "Ganador F3-2" y estaba en ESTE grupo: ganar la llave lo único que hace
 * es ponerle tu nombre. Por eso la pantalla muestra primero a los tres que ya
 * estaban y recién después se pone Olimpia en el casillero vacío, que es el
 * orden en que pasó.
 *
 * Es el premio de haber jugado dos o tres llaves para entrar, y tiene que
 * sentirse distinto a una línea de bitácora que dice "Olimpia clasificó".
 */

const ESTILO = {
  libertadores: { nombre: "Copa Libertadores", acento: "#e8c25a",
                  fondo: "radial-gradient(130% 80% at 50% 10%, #2c2412, #0b0906 72%)" },
  sudamericana: { nombre: "Copa Sudamericana", acento: "#5fb0e8",
                  fondo: "radial-gradient(130% 80% at 50% 10%, #1b3f63, #0a1523 72%)" },
} as const;

export default function CaeElGrupo({ torneo, grupo, desdeLlave, onSeguir }: {
  torneo: "libertadores" | "sudamericana";
  grupo: Grupo;
  /** La llave que ganaste para llegar acá. */
  desdeLlave: string;
  onSeguir: () => void;
}) {
  const e = ESTILO[torneo];
  /* Los otros tres primero, y Olimpia al final: es el orden en que pasó. */
  const otros = grupo.equipos.filter((x) => esPlaceholder(x) || x.id !== "olimpia");
  const [hasta, setHasta] = useState(0);
  const listo = hasta > otros.length;

  useEffect(() => {
    if (listo) return;
    const t = setTimeout(() => setHasta((h) => h + 1), hasta === 0 ? 700 : 620);
    return () => clearTimeout(t);
  }, [hasta, listo]);

  return (
    <div className="app items-center justify-center px-6" style={{ background: e.fondo }}>
      <span className="text-[10px] uppercase tracking-[0.24em]" style={{ color: e.acento }}>
        {e.nombre}
      </span>
      <h1 className="apellido mt-1 text-center text-[20px] leading-tight">
        Olimpia ganó la {desdeLlave.startsWith("PO") ? "llave" : desdeLlave.slice(0, 2)}
      </h1>
      <p className="mt-1 text-center text-[11px]" style={{ color: "var(--tenue)" }}>
        El lugar ya estaba sorteado desde enero
      </p>

      <span className="apellido mt-5 text-[40px] leading-none" style={{ color: e.acento }}>
        Grupo {grupo.letra}
      </span>

      <div className="mt-5 flex w-full max-w-[300px] flex-col gap-1.5">
        {otros.map((x, i) => (
          <Fila key={i} c={x} acento={e.acento} visible={i < hasta} />
        ))}
        {/* Y el casillero que decía tu nombre en clave. */}
        <div className="rounded-lg px-3 py-2.5"
             style={{
               background: listo ? `color-mix(in srgb, ${e.acento} 26%, transparent)` : "var(--carbon)",
               boxShadow: listo ? `inset 0 0 0 1.5px ${e.acento}` : "none",
               transition: "background 320ms ease-out, box-shadow 320ms ease-out",
             }}>
          <span className="flex items-center gap-2.5">
            {listo && <Escudo id="olimpia" nombre="Olimpia" tam={22} />}
            <span className="apellido flex-1 text-[15px]"
                  style={{ color: listo ? e.acento : "var(--apagado)",
                           fontStyle: listo ? "normal" : "italic" }}>
              {listo ? "Olimpia" : `Ganador ${desdeLlave}`}
            </span>
          </span>
        </div>
      </div>

      <button onClick={onSeguir} disabled={!listo}
        className="mt-7 w-full max-w-[300px] rounded-lg py-3.5 text-[13px] font-extrabold uppercase tracking-[0.14em]"
        style={{ background: listo ? e.acento : "var(--carbon)",
                 color: listo ? "#0a120d" : "var(--apagado)",
                 transition: "background 320ms ease-out" }}>
        Seguir
      </button>
    </div>
  );
}

function Fila({ c, acento, visible }: { c: Casillero; acento: string; visible: boolean }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg px-3 py-2"
         style={{ background: "var(--carbon)", opacity: visible ? 1 : 0.15,
                  transition: "opacity 300ms ease-out" }}>
      {!esPlaceholder(c) && visible && <Escudo id={c.id} nombre={c.nombre} tam={20} />}
      <span className="apellido min-w-0 flex-1 truncate text-[13px]"
            style={{ fontStyle: esPlaceholder(c) ? "italic" : "normal",
                     color: esPlaceholder(c) ? "var(--apagado)" : "var(--blanco)" }}>
        {visible ? nombreDe(c) : "·"}
      </span>
      {visible && !esPlaceholder(c) && (
        <span className="num text-[10px]" style={{ color: acento }}>{c.pais}</span>
      )}
    </div>
  );
}
