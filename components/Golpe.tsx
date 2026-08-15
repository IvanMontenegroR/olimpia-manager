"use client";

import Dorsal from "./Dorsal.tsx";
import type { Jugador } from "@/engine/tipos.ts";

/**
 * Lo que te obliga a mover el equipo, con su momento.
 *
 * Una lesión abría el panel de cambios en el mismo instante en que pasaba, así
 * que el evento quedaba tapado antes de poder leerlo: te encontrabas eligiendo
 * un suplente sin saber a quién ni por qué. Acá el partido se frena, se ve al
 * que se rompió y recién después se decide.
 */

export type TipoGolpe = "lesion" | "roja";

/*
 * Una molestia no es una rotura. Todas las lesiones decían "se rompió" y "no
 * puede seguir", y después el jugador volvía en seis días: la pantalla gritaba
 * una tragedia que el juego no cumplía. Acá se dice lo que va a pasar de
 * verdad, con los días a la vista.
 */
function estiloLesion(dias: number) {
  if (dias <= 12) {
    return {
      rotulo: "se resintió", titulo: "PIDE EL CAMBIO", color: "#d9a832",
      fondo: "radial-gradient(120% 90% at 50% 30%, #3a3212, #0a120d 70%)",
    };
  }
  if (dias <= 28) {
    return {
      rotulo: "desgarro", titulo: "NO PUEDE SEGUIR", color: "#e0902a",
      fondo: "radial-gradient(120% 90% at 50% 30%, #3a2a12, #0a120d 70%)",
    };
  }
  return {
    rotulo: "se rompió", titulo: "SE PIERDE LA TEMPORADA", color: "#c0392b",
    fondo: "radial-gradient(120% 90% at 50% 30%, #3a1616, #0a120d 70%)",
  };
}

const ROJA = {
  rotulo: "roja directa",
  titulo: "TE QUEDÁS CON DIEZ",
  color: "#c0392b",
  fondo: "radial-gradient(120% 90% at 50% 30%, #3a1616, #0a120d 70%)",
};

/** Cuánto tiempo se pierde, en la unidad que se entiende. */
function tiempoFuera(dias: number): string {
  if (dias <= 10) return `${dias} días afuera`;
  const semanas = Math.round(dias / 7);
  if (semanas < 9) return `${semanas} semanas afuera`;
  return `${Math.round(dias / 30)} meses afuera`;
}

export default function Golpe({
  tipo, jugador, minuto, texto, diasFuera, cambiosRestantes, onCambiar, onSeguir,
}: {
  tipo: TipoGolpe;
  jugador: Jugador;
  minuto: number;
  texto: string;
  /** Cuánto se pierde, si fue lesión. */
  diasFuera?: number;
  /** Cuántos cambios te quedan. Sin ninguno, no hay nada que decidir. */
  cambiosRestantes: number;
  onCambiar: () => void;
  onSeguir: () => void;
}) {
  const e = tipo === "roja" ? ROJA : estiloLesion(diasFuera ?? 20);
  const puedeCambiar = tipo === "lesion" && cambiosRestantes > 0;

  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center px-6"
         style={{ background: e.fondo, backdropFilter: "blur(3px)" }}>
      {/* el latido de atrás, que es lo que hace que se sienta el golpe */}
      <span className="pointer-events-none absolute left-1/2 top-[38%] -translate-x-1/2 -translate-y-1/2 rounded-full latir"
            style={{ width: 200, height: 200,
                     background: `radial-gradient(closest-side, ${e.color}44, transparent)` }} />

      <span className="num relative text-[12px]" style={{ color: e.color }}>{minuto}'</span>

      <span className="golpea-hito relative mt-2 flex flex-col items-center">
        <span style={{ borderRadius: 999, boxShadow: `0 0 0 3px ${e.color}, 0 6px 20px rgba(0,0,0,0.7)` }}>
          <Dorsal numero={jugador.numero} tam={64} />
        </span>
        <span className="apellido mt-2 text-[24px] leading-none">{jugador.apellido}</span>
        <span className="mt-1 text-[10px] uppercase tracking-[0.24em]" style={{ color: e.color }}>
          {e.rotulo}
        </span>
      </span>

      <span className="apellido relative mt-4 text-center text-[19px] leading-tight"
            style={{ color: e.color }}>
        {e.titulo}
      </span>
      {/* cuánto se pierde, que es lo que de verdad importa decidir */}
      {tipo === "lesion" && diasFuera !== undefined && (
        <span className="num relative mt-1 rounded px-2 py-0.5 text-[11px] font-extrabold"
              style={{ background: e.color, color: "#0a120d" }}>
          {tiempoFuera(diasFuera)}
        </span>
      )}
      <p className="relative mt-1.5 max-w-[280px] text-center text-[12px] leading-snug"
         style={{ color: "var(--tenue)" }}>
        {texto}
      </p>

      <div className="relative mt-6 w-full max-w-[280px]">
        {puedeCambiar ? (
          <>
            <button onClick={onCambiar}
              className="w-full rounded-lg py-3.5 text-[13px] font-extrabold uppercase tracking-[0.14em]"
              style={{ background: e.color, color: "#0a120d" }}>
              Hacer el cambio
            </button>
            <button onClick={onSeguir}
              className="mt-1.5 w-full rounded-lg py-2.5 text-[11px] font-bold uppercase tracking-[0.12em]"
              style={{ background: "var(--carbon)", color: "var(--tenue)" }}>
              Que aguante como pueda
            </button>
          </>
        ) : (
          <button onClick={onSeguir}
            className="w-full rounded-lg py-3.5 text-[13px] font-extrabold uppercase tracking-[0.14em]"
            style={{ background: "var(--blanco)", color: "var(--negro)" }}>
            {tipo === "lesion" && cambiosRestantes === 0
              ? "No quedan cambios, seguir" : "Seguir"}
          </button>
        )}
      </div>
    </div>
  );
}
