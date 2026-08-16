"use client";

import { miles } from "@/lib/temporada.ts";

/**
 * Lo que va a pasar si elegís esto, en las tres únicas monedas del juego.
 *
 *   NIVEL       lo que te cambia para el domingo
 *   PLATA       lo que entra o sale de la caja
 *   DIRIGENCIA  lo que te acerca o te aleja de que te echen
 *
 * Antes había cinco: vestuario, hinchada y físico iban por separado, cada uno
 * en su propia escala interna de 0 a 100. Eso tenía dos problemas. Uno, que
 * eran tres números más para seguir. Y dos, peor, que ninguno de los tres
 * coincidía con lo que después se movía en la pantalla: un "+14 hinchada"
 * levantaba el nivel del equipo dos décimas, así que la card no se movía
 * nunca y el chip quedaba como una promesa vacía.
 *
 * Ahora los tres se calculan juntos aplicando el efecto de verdad sobre una
 * copia de la partida y midiendo el nivel que queda. Vestuario, hinchada y
 * físico siguen existiendo: son la explicación de por qué el nivel es el que
 * es, y viven adentro de la card principal, que es donde se entienden.
 */

export interface EfectoVisible {
  ambiente?: number;
  hinchada?: number;
  dineroUsd?: number;
  condicionTodos?: number;
  moralDe?: { id: string; delta: number };
  moralTexto?: string;
  paciencia?: number;
  /** Se pierde el próximo partido: no es un número, es quién falta. */
  suspendeA?: string;
  /** Apellido del que se pierde el partido, para poder nombrarlo. */
  suspendeTexto?: string;
  /**
   * Lo que la decisión mueve del nivel. Lo calcula la pantalla aplicando el
   * efecto sobre una copia: acá llega ya resuelto.
   */
  nivel?: number;
  /** El que se va del plantel: el once del domingo lo tiene que reemplazar. */
  seVa?: string;
  /** Lo que suma llegar aclimatado, ya medido en nivel. */
  aclimatacion?: number;
  /** Los números del otro desenlace, si la opción era una apuesta. */
  siSaleMal?: EfectoVisible;
}

/**
 * Los chips de un efecto, como lista.
 *
 * Sale de adentro del componente porque quien lo dibuja a veces necesita saber
 * CUÁNTOS son antes de dibujarlos: las dos ramas de una apuesta se reparten el
 * ancho según cuánto tiene cada una, y la que no tiene nada necesita decirlo
 * en vez de quedar como un hueco.
 */
export function chipsDe(e: EfectoVisible): { texto: string; bueno: boolean }[] {
  const chips: { texto: string; bueno: boolean }[] = [];

  /*
   * El nivel se muestra con un decimal cuando no llega a la unidad. Redondear
   * a entero convertía media docena de decisiones reales en "+0", que es peor
   * que no decir nada: parece que la opción no hace nada.
   */
  if (e.nivel && Math.abs(e.nivel) >= 0.05) {
    const n = Math.abs(e.nivel) >= 1 ? Math.round(e.nivel) : Math.round(e.nivel * 10) / 10;
    if (n !== 0) {
      chips.push({ texto: `${n > 0 ? "+" : "−"}${Math.abs(n)} nivel`, bueno: n > 0 });
    }
  }
  if (e.dineroUsd) {
    chips.push({
      texto: `${e.dineroUsd > 0 ? "+" : "−"}${miles(Math.abs(e.dineroUsd))}`,
      bueno: e.dineroUsd > 0,
    });
  }
  if (e.paciencia) {
    chips.push({ texto: `${signo(e.paciencia)} dirigencia`, bueno: e.paciencia > 0 });
  }
  // perder al jugador para la fecha que viene ya está adentro del nivel; esto
  // dice quién es, que es lo que el número solo no cuenta
  if (e.suspendeA) {
    chips.push({
      texto: e.suspendeTexto ? `${e.suspendeTexto} se pierde la próxima` : "Se pierde la próxima",
      bueno: false,
    });
  }
  return chips;
}

/** Un chip suelto, del color que le toca. */
export function Chip({ texto, bueno }: { texto: string; bueno: boolean }) {
  return (
    <span className="num rounded px-1.5 py-0.5 text-[9px] font-extrabold"
          style={{
            background: bueno
              ? "color-mix(in srgb, var(--cesped) 24%, transparent)"
              : "color-mix(in srgb, var(--ladrillo) 24%, transparent)",
            color: bueno ? "var(--cesped)" : "var(--ladrillo)",
          }}>
      {texto}
    </span>
  );
}

export default function Efectos({ e }: { e: EfectoVisible }) {
  const chips = chipsDe(e);
  if (!chips.length) return null;
  return (
    <span className="mt-1.5 flex flex-wrap gap-1">
      {chips.map((c, i) => <Chip key={i} {...c} />)}
    </span>
  );
}

const signo = (n: number) => (n > 0 ? `+${Math.round(n)}` : `−${Math.abs(Math.round(n))}`);
