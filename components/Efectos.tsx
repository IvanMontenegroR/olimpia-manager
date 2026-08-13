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
  /*
   * El vestuario se muestra en la misma moneda que la card principal: lo que
   * importa es cuánto va a subir o bajar la confianza del plantel, no un
   * número de otra escala que después hay que traducir de cabeza.
   */
  if (e.ambiente) {
    const conf = Math.round(e.ambiente * AMBIENTE_EN_CONFIANZA);
    if (conf !== 0) chips.push({ texto: `${signo(conf)} vestuario`, bueno: conf > 0 });
  }
  if (e.hinchada) chips.push({ texto: `${signo(e.hinchada)} hinchada`, bueno: e.hinchada > 0 });
  if (e.paciencia) chips.push({ texto: `${signo(e.paciencia)} dirigencia`, bueno: e.paciencia > 0 });
  if (e.condicionTodos) {
    chips.push({
      texto: `${signo(e.condicionTodos)} condición a todo el plantel`,
      bueno: e.condicionTodos > 0,
    });
  }
  /*
   * Levantarle el ánimo a uno solo mueve el promedio del once una fracción de
   * lo que se le aplica a él. Se muestra esa fracción, que es lo que se va a
   * ver en la card, y no el número grande que le toca a él y que después no
   * aparece en ninguna parte.
   */
  if (e.moralDe) {
    const d = e.moralDe.delta / ONCE;
    const conf = d > 0 ? Math.max(1, Math.round(d)) : Math.min(-1, Math.round(d));
    chips.push({
      texto: `${signo(conf)} vestuario`,
      bueno: conf > 0,
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
