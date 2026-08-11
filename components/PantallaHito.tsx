"use client";

import type { Hito, TipoHito } from "@/lib/temporada.ts";
import Escudo from "./Escudo.tsx";

/**
 * Los momentos que uno se acuerda tienen su propia pantalla.
 *
 * El resto del juego es una lista de cosas que pasaron, todas iguales. Dar la
 * vuelta o quedar afuera de la copa no puede leerse igual que "se firmó el
 * contrato del sponsor": estos cinco momentos ocupan la pantalla entera,
 * tienen su color y su animación, y hay que cerrarlos para seguir.
 */

interface Estilo {
  fondo: string;
  acento: string;
  /** Lo que se ve detrás del texto. */
  fondoAnimado: "rayos" | "papelitos" | "lluvia" | "nada";
  encabezado: string;
}

const ESTILO: Record<TipoHito, Estilo> = {
  campeon_liga: {
    fondo: "radial-gradient(120% 90% at 50% 0%, #2a4a34, #0a120d 70%)",
    acento: "#e8c25a",
    fondoAnimado: "papelitos",
    encabezado: "Clausura 2026",
  },
  campeon_copa: {
    fondo: "radial-gradient(120% 90% at 50% 0%, #4a3a12, #0a120d 70%)",
    acento: "#e8c25a",
    fondoAnimado: "rayos",
    encabezado: "Copa Sudamericana",
  },
  eliminado_copa: {
    fondo: "radial-gradient(120% 90% at 50% 0%, #2a1a1a, #0a120d 70%)",
    acento: "#c0392b",
    fondoAnimado: "lluvia",
    encabezado: "Copa Sudamericana",
  },
  despedido: {
    fondo: "radial-gradient(120% 90% at 50% 0%, #241d1d, #0a120d 70%)",
    acento: "#8fa396",
    fondoAnimado: "lluvia",
    encabezado: "Dirigencia",
  },
  fichaje: {
    fondo: "radial-gradient(120% 90% at 50% 0%, #14304a, #0a120d 70%)",
    acento: "#5fb0e8",
    fondoAnimado: "papelitos",
    encabezado: "Mercado de pases",
  },
  lesion: {
    fondo: "radial-gradient(120% 90% at 50% 0%, #33222a, #0a120d 70%)",
    acento: "#c96f6f",
    fondoAnimado: "lluvia",
    encabezado: "Parte médico",
  },
  revelacion: {
    fondo: "radial-gradient(120% 90% at 50% 0%, #1c3a2a, #0a120d 70%)",
    acento: "#3fa76a",
    fondoAnimado: "rayos",
    encabezado: "Debut",
  },
  fin_temporada: {
    fondo: "radial-gradient(120% 90% at 50% 0%, #1e2a24, #0a120d 70%)",
    acento: "#8fa396",
    fondoAnimado: "nada",
    encabezado: "Clausura 2026",
  },
};

export default function PantallaHito({ hito, onCerrar }: {
  hito: Hito; onCerrar: () => void;
}) {
  const e = ESTILO[hito.tipo];

  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center px-6"
         style={{ background: e.fondo }}>
      <Telon tipo={e.fondoAnimado} color={e.acento} />

      {/* La entrada va por CSS y no por estado de React: con estado dependía de
          que el efecto llegara a correr, y si no corría la pantalla quedaba
          en negro con el contenido invisible. */}
      <div className="entra-hito relative flex w-full max-w-sm flex-col items-center text-center">
        <Escudo id="olimpia" nombre="Olimpia" tam={54} />

        <div className="mt-4 text-[10px] uppercase tracking-[0.28em]" style={{ color: e.acento }}>
          {e.encabezado}
        </div>

        <h1 className="apellido mt-1.5 text-[30px] leading-[1.05]"
            style={{ color: "var(--blanco)", textShadow: "0 3px 18px rgba(0,0,0,0.7)" }}>
          {hito.titulo}
        </h1>

        {hito.cifra && (
          <div className="golpea-hito mt-5">
            <div className="num leading-none"
                 style={{ fontSize: 62, color: e.acento, textShadow: `0 0 34px ${e.acento}44` }}>
              {hito.cifra}
            </div>
            {hito.pie && (
              <div className="mt-1 text-[10px] uppercase tracking-[0.2em]"
                   style={{ color: "var(--apagado)" }}>
                {hito.pie}
              </div>
            )}
          </div>
        )}

        <p className="mt-5 text-[13px] leading-relaxed" style={{ color: "var(--tenue)" }}>
          {hito.detalle}
        </p>

        <button onClick={onCerrar}
          className="mt-8 w-full rounded-lg py-3 text-[12px] font-extrabold uppercase tracking-[0.16em]"
          style={{ background: e.acento, color: "#0a120d" }}>
          Seguir
        </button>
      </div>
    </div>
  );
}

/** El fondo animado. Cada momento tiene el suyo. */
function Telon({ tipo, color }: { tipo: Estilo["fondoAnimado"]; color: string }) {
  if (tipo === "nada") return null;

  if (tipo === "rayos") {
    return (
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <span className="rayos-hito absolute left-1/2 top-1/2 block"
              style={{
                width: 900, height: 900, marginLeft: -450, marginTop: -450,
                background: `conic-gradient(from 0deg, transparent 0 8deg, ${color}22 8deg 16deg)`,
                borderRadius: "50%",
              }} />
      </div>
    );
  }

  if (tipo === "lluvia") {
    return (
      <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ opacity: 0.5 }}>
        {Array.from({ length: 26 }, (_, i) => (
          <span key={i} className="lluvia-hito absolute block"
                style={{
                  left: `${(i * 37) % 100}%`,
                  width: 1, height: 42,
                  background: `linear-gradient(180deg, transparent, ${color}66)`,
                  animationDelay: `${(i % 9) * 0.24}s`,
                  animationDuration: `${1.1 + (i % 5) * 0.22}s`,
                }} />
        ))}
      </div>
    );
  }

  // papelitos: la vuelta olímpica
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: 42 }, (_, i) => {
        const negro = i % 3 === 0;
        return (
          <span key={i} className="papelito-hito absolute block"
                style={{
                  left: `${(i * 23.7) % 100}%`,
                  width: 6 + (i % 3) * 2,
                  height: 9 + (i % 4) * 3,
                  background: negro ? "#1a1a1a" : "#f2efe6",
                  animationDelay: `${(i % 12) * 0.32}s`,
                  animationDuration: `${2.6 + (i % 6) * 0.42}s`,
                }} />
        );
      })}
    </div>
  );
}
