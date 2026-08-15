"use client";

import { miles } from "@/lib/temporada.ts";
import { P } from "@/engine/motor.ts";

/** Lo mismo que aplica resolverAsunto, para prometer exactamente lo que pasa. */
const AMBIENTE_EN_CONFIANZA = P.ambienteEnAnimo;

/** El vestuario que se muestra es el promedio del once. */
const ONCE = 11;

export interface EfectoVisible {
  ambiente?: number;
  hinchada?: number;
  dineroUsd?: number;
  condicionTodos?: number;
  moralDe?: { id: string; delta: number };
  moralTexto?: string;
  paciencia?: number;
  /** Se pierde el próximo partido: es el costo más caro y no se veía. */
  suspendeA?: string;
  /** Apellido del que se pierde el partido, para poder nombrarlo. */
  suspendeTexto?: string;
  /** Lo que la decisión mueve del nivel con el que se llega al partido. */
  nivel?: number;
  /** Los números del otro desenlace, si la opción era una apuesta. */
  siSaleMal?: EfectoVisible;
}

/**
 * Los números de lo que va a pasar, antes de elegir. La idea es que el costo
 * de cada opción se vea sin tener que leer el texto.
 */
export default function Efectos({ e }: { e: EfectoVisible }) {
  const chips: { texto: string; bueno: boolean }[] = [];

  if (e.dineroUsd) {
    chips.push({
      texto: `${e.dineroUsd > 0 ? "+" : "−"}${miles(Math.abs(e.dineroUsd))}`,
      bueno: e.dineroUsd > 0,
    });
  }
  if (e.nivel) chips.push({ texto: `${signo(e.nivel)} nivel`, bueno: e.nivel > 0 });
  /*
   * El vestuario es UN chip, siempre.
   *
   * Hay decisiones que mueven el clima del grupo para un lado y el ánimo de un
   * jugador para el otro: multar al que llegó tarde le cae bien al plantel y
   * mal a él. Como los dos terminan en el mismo número (el ánimo medio del
   * once, que es lo que dice la card principal), mostrarlos por separado ponía
   * un "+1 vestuario" al lado de un "−1 vestuario" en la misma opción. Se
   * suman y se muestra el neto, que es lo que de verdad va a pasar.
   */
  const vest = (e.ambiente ?? 0) * AMBIENTE_EN_CONFIANZA + (e.moralDe?.delta ?? 0) / ONCE;
  // se redondea alejándose del cero: media unidad para arriba no es "0"
  const vestEntero = Math.sign(vest) * Math.round(Math.abs(vest));
  if (vestEntero !== 0) {
    chips.push({ texto: `${signo(vestEntero)} vestuario`, bueno: vestEntero > 0 });
  }
  if (e.hinchada) chips.push({ texto: `${signo(e.hinchada)} hinchada`, bueno: e.hinchada > 0 });
  if (e.paciencia) chips.push({ texto: `${signo(e.paciencia)} dirigencia`, bueno: e.paciencia > 0 });
  if (e.condicionTodos) {
    chips.push({
      texto: `${signo(e.condicionTodos)} condición a todo el plantel`,
      bueno: e.condicionTodos > 0,
    });
  }
  // perder al jugador para la fecha que viene es el costo más caro de varias
  // apuestas y no aparecía por ningún lado
  if (e.suspendeA) {
    chips.push({
      texto: e.suspendeTexto ? `${e.suspendeTexto} se pierde la próxima` : "Se pierde la próxima",
      bueno: false,
    });
  }
  if (!chips.length) return null;

  return (
    <span className="mt-1.5 flex flex-wrap gap-1">
      {chips.map((c, i) => (
        <span key={i} className="num rounded px-1.5 py-0.5 text-[9px] font-extrabold"
              style={{
                background: c.bueno
                  ? "color-mix(in srgb, var(--cesped) 24%, transparent)"
                  : "color-mix(in srgb, var(--ladrillo) 24%, transparent)",
                color: c.bueno ? "var(--cesped)" : "var(--ladrillo)",
              }}>
          {c.texto}
        </span>
      ))}
    </span>
  );
}

const signo = (n: number) => (n > 0 ? `+${Math.round(n)}` : `−${Math.abs(Math.round(n))}`);
