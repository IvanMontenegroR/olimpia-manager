import { casillasDe } from "./juego.ts";

/**
 * Ubica los once en la cancha a partir de las líneas que declara la formación.
 *
 * Antes esto deducía la posición de cada jugador de su puesto y después
 * separaba los que se pisaban. Deducir estaba mal de raíz: partía las líneas
 * (el enganche de un 4-2-3-1 se iba a una franja propia en vez de alinearse
 * con los extremos) y obligaba a corregir choques que no deberían existir.
 * Ahora la formación dice dónde va cada casillero y acá solo se pasa a
 * píxeles, escalando el bloque si la pantalla es chica.
 */

export interface Ubicado {
  slot: number;
  x: number;
  y: number;
}

export interface Reparto {
  ubicados: Ubicado[];
  /** Escala del bloque, 1 cuando entra cómodo y menos cuando hay que apretar. */
  escala: number;
}

const BLOQUE_ALTO = 58;
const BLOQUE_ANCHO = 66;
const ESCALA_MINIMA = 0.62;

export function repartirCancha(formacion: string, ancho: number, alto: number): Reparto {
  const casillas = casillasDe(formacion);
  if (ancho <= 0 || alto <= 0) return { ubicados: [], escala: 1 };

  /*
   * Cuánto hay que encoger para que entren, y acá estaba el bug de los nombres
   * pisados en el 5-3-2 y el 3-4-3.
   *
   * La cuenta vieja era `ancho / (cuántos hay × ancho del bloque)`, que asume
   * que los bloques van pegados de borde a borde. No van: se reparten entre el
   * 12% y el 88% del ancho ÚTIL, que a su vez es el ancho menos un bloque de
   * márgenes. Con cinco defensores en 340 píxeles daba escala 1 y quedaban 52
   * píxeles de separación para bloques de 66. Se pisaban catorce.
   *
   * Lo que hay que resolver es la separación entre vecinos:
   *
   *     d × (ancho − BLOQUE × e)  ≥  BLOQUE × e
   *
   * donde d es la fracción de ancho que hay entre dos vecinos. Despejando e
   * sale lo de abajo. El 0.94 es aire para que se separen y no se toquen.
   */
  const lineas = new Set(casillas.map((c) => c.x)).size;
  const porLinea = new Map<number, number>();
  for (const c of casillas) porLinea.set(c.x, (porLinea.get(c.x) ?? 0) + 1);
  const maxPorLinea = Math.max(...porLinea.values());

  // la misma repartija que hace `casillasDe`: del 12% al 88% cuando son varios
  const abanico = maxPorLinea === 1 ? 0 : maxPorLinea === 2 ? 0.34 : 0.76;
  const d = maxPorLinea > 1 ? abanico / (maxPorLinea - 1) : 1;
  const cabeEnAncho = maxPorLinea > 1
    ? (d * ancho) / (BLOQUE_ANCHO * (1 + d)) * 0.94
    : 1;

  const escala = Math.max(
    ESCALA_MINIMA,
    Math.min(1, alto / (lineas * BLOQUE_ALTO), cabeEnAncho),
  );

  // margen para que el bloque no se corte contra el borde de la cancha
  const mx = (BLOQUE_ANCHO * escala) / 2;
  const my = (BLOQUE_ALTO * escala) / 2;

  return {
    escala,
    ubicados: casillas.map((c, slot) => ({
      slot,
      x: mx + (c.y / 100) * (ancho - mx * 2),
      // se ataca hacia arriba: más profundidad es más arriba en pantalla
      y: alto - my - (c.x / 100) * (alto - my * 2),
    })),
  };
}
