"use client";

import { useEffect, useRef } from "react";

/**
 * El botón de atrás del navegador cierra la pantalla que estés mirando.
 *
 * Esto no es una app con URLs: todo pasa adentro de una sola página y las
 * pantallas son estado de React. Sin hacer nada, tocar atrás te saca del juego
 * entero, que es lo peor que puede pasar en algo que se juega en el celular.
 *
 * Cada pantalla que se puede cerrar mete una entrada en el historial cuando se
 * abre. Así el atrás del navegador, el botón físico de Android y el gesto de
 * deslizar desde el borde en iPhone hacen todos lo mismo, que es cerrar UNA
 * capa. Los botones de volver de adentro del juego siguen funcionando igual:
 * cuando cerrás con uno de ellos, la entrada se saca del historial sola.
 *
 * ---------------------------------------------------------------------------
 * Cómo se sincroniza, y por qué no alcanzaba contar.
 *
 * Con capas anidadas (plantel → equipos → editar) hay tres oyentes a la vez.
 * Cerrar la de arriba con su botón tiene que llamar a `history.back()` para
 * sacar su entrada, y ese `back` dispara un `popstate` que los de abajo
 * también escuchan: cerrabas el editor y se te cerraba el plantel de atrás.
 *
 * El primer intento fue llevar un contador de "estos backs los pedí yo,
 * ignoralos". Anda hasta que se desincroniza una sola vez (un `back` que el
 * navegador no ejecuta porque no hay a dónde volver, o el doble montaje de
 * efectos de React en desarrollo) y a partir de ahí el contador se come el
 * primer atrás de verdad. Lo viví: después de navegar un rato, el atrás dejaba
 * de hacer nada.
 *
 * Así que no se cuenta nada. Cada entrada lleva escrito a qué profundidad de
 * capas corresponde, y en cada `popstate` se cierran las que sobren respecto
 * de esa profundidad. Si algo se desalinea, el `popstate` siguiente lo vuelve
 * a alinear solo.
 */

interface Capa {
  cerrar: () => void;
  /** No se cierra con el atrás: se lo come y no pasa nada. */
  trabada?: boolean;
}

/** Las capas abiertas, de la más vieja a la más nueva. */
const pila: Capa[] = [];
let enganchado = false;

/** A qué profundidad de capas corresponde la entrada actual del historial. */
const profundidad = () => {
  const s = history.state as { capa?: number } | null;
  return typeof s?.capa === "number" ? s.capa : 0;
};

function alVolver() {
  // se cierran las capas que sobran, que casi siempre es una sola
  while (pila.length > profundidad()) {
    const arriba = pila[pila.length - 1];
    if (arriba.trabada) {
      // de un partido empezado no se sale con el atrás: se devuelve la entrada
      history.pushState({ capa: pila.length }, "");
      return;
    }
    pila.pop()!.cerrar();
  }
}

function enganchar() {
  if (enganchado || typeof window === "undefined") return;
  enganchado = true;
  // la entrada de arranque es el piso: sin capas abiertas
  if (profundidad() !== 0) history.replaceState({ capa: 0 }, "");
  window.addEventListener("popstate", alVolver);
}

/**
 * Se come el atrás sin hacer nada mientras esté activo.
 *
 * Para las pantallas de las que no se sale volviendo: un partido en vivo, la
 * tanda de penales, la pantalla de campeón. Sin esto el atrás no cerraría una
 * capa (no hay ninguna) y te sacaría de la página.
 */
export function useAtrasTrabado(activo: boolean) {
  useEffect(() => {
    if (!activo) return;
    enganchar();
    const capa: Capa = { cerrar: () => {}, trabada: true };
    pila.push(capa);
    history.pushState({ capa: pila.length }, "");
    return () => {
      const i = pila.lastIndexOf(capa);
      if (i < 0) return;
      pila.splice(i, 1);
      if (profundidad() > pila.length) history.back();
    };
  }, [activo]);
}

export function useAtras(abierta: boolean, cerrar: () => void) {
  /*
   * `cerrar` se suele escribir en línea, así que cambia de identidad en cada
   * render. Va por referencia para que el efecto dependa solo de `abierta` y
   * la capa no se apile y desapile sola en cada dibujo.
   */
  const ref = useRef(cerrar);
  ref.current = cerrar;

  useEffect(() => {
    if (!abierta) return;
    enganchar();
    const capa = { cerrar: () => ref.current() };
    pila.push(capa);
    history.pushState({ capa: pila.length }, "");

    return () => {
      const i = pila.lastIndexOf(capa);
      if (i < 0) return;                 // la sacó el navegador, ya está
      pila.splice(i, 1);
      /*
       * Se cerró desde adentro (un botón), así que hay que devolver la entrada
       * que habíamos metido. El `popstate` que dispara esto no cierra nada,
       * porque la profundidad a la que se vuelve ya coincide con la pila.
       */
      if (profundidad() > pila.length) history.back();
    };
  }, [abierta]);
}
