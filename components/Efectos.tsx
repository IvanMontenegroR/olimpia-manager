"use client";

import { miles } from "@/lib/temporada.ts";

export interface EfectoVisible {
  ambiente?: number;
  hinchada?: number;
  dineroUsd?: number;
  condicionTodos?: number;
  moralDe?: { id: string; delta: number };
  moralTexto?: string;
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
  if (e.ambiente) chips.push({ texto: `${signo(e.ambiente)} vestuario`, bueno: e.ambiente > 0 });
  if (e.hinchada) chips.push({ texto: `${signo(e.hinchada)} hinchada`, bueno: e.hinchada > 0 });
  if (e.condicionTodos) {
    chips.push({ texto: `${signo(e.condicionTodos)} condición`, bueno: e.condicionTodos > 0 });
  }
  if (e.moralDe) {
    chips.push({
      texto: `${signo(e.moralDe.delta)} ánimo${e.moralTexto ? ` de ${e.moralTexto}` : ""}`,
      bueno: e.moralDe.delta > 0,
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
