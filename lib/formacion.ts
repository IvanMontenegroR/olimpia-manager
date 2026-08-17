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

/*
 * Lo que ocupa cada jugador en la cancha, medido de verdad: el aro con el
 * dorsal adentro (40), el apellido (11) y el renglón del nivel (10).
 */
const BLOQUE_ALTO = 62;
const BLOQUE_ANCHO = 66;
const ESCALA_MINIMA = 0.62;

/**
 * Cuánto más que el bloque tiene que medir el hueco entre dos vecinos.
 *
 * Con 1 quedan pegados: técnicamente no se pisan, pero el apellido de uno
 * arranca donde termina el del otro y la línea se lee como una sola mancha.
 */
const AIRE = 1.14;

/**
 * Entre qué profundidades se reparten las líneas, de arco a arco.
 *
 * No van de borde a borde: el rectángulo de la cancha está dibujado adentro,
 * y llevando a los delanteros al 100% el dorsal les quedaba montado sobre la
 * raya de arriba y a veces la pasaba. Con esto la línea de arriba entra en el
 * área grande sin tocar la línea de fondo, y el arquero queda parado en su
 * área chica, que es donde tiene que estar.
 */
const ABAJO = 0.04;
const ARRIBA = 0.92;

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
   *     d × (ancho − BLOQUE × e)  ≥  BLOQUE × e × AIRE
   *
   * donde d es la fracción de ancho que hay entre dos vecinos. Despejando e
   * sale lo de abajo.
   */
  const porLinea = new Map<number, number>();
  for (const c of casillas) porLinea.set(c.x, (porLinea.get(c.x) ?? 0) + 1);
  const maxPorLinea = Math.max(...porLinea.values());

  // la misma repartija que hace `casillasDe`: del 12% al 88% cuando son varios
  const abanico = maxPorLinea === 1 ? 0 : maxPorLinea === 2 ? 0.34 : 0.76;
  const d = maxPorLinea > 1 ? abanico / (maxPorLinea - 1) : 1;
  const cabeEnAncho = maxPorLinea > 1
    ? (d * ancho) / (BLOQUE_ANCHO * (AIRE + d))
    : 1;

  /*
   * A lo alto era la misma cuenta mal hecha, y por eso las líneas se pisaban
   * en la cancha de la home.
   *
   * Era `alto / (líneas × BLOQUE_ALTO)`, que también supone bloques pegados de
   * borde a borde. Peor todavía: las profundidades escritas en la formación no
   * llegan a los extremos (el arquero está en 3 y los delanteros en 83), así
   * que los once se apretaban dentro del 80% del alto y el 20% de arriba
   * quedaba de adorno.
   *
   * Las líneas se reparten parejo entre ARRIBA y ABAJO. La distancia exacta
   * que hay entre el arquero y los centrales no dice nada que no diga ya el
   * dibujo (son cuatro líneas y siempre son cuatro), y repartir parejo le da a
   * cada una el hueco más grande posible, que es lo único que se ve.
   */
  const profundidades = [...porLinea.keys()].sort((a, b) => a - b);
  const orden = new Map(profundidades.map((x, i) => [x, i]));
  const ultima = profundidades.length - 1;
  const estirada = (x: number) =>
    (ultima ? ABAJO + ((orden.get(x) ?? 0) / ultima) * (ARRIBA - ABAJO) : 0.5);

  const hueco = ultima ? (ARRIBA - ABAJO) / ultima : 1;
  const cabeEnAlto = ultima ? (hueco * alto) / (BLOQUE_ALTO * (AIRE + hueco)) : 1;

  const escala = Math.max(ESCALA_MINIMA, Math.min(1, cabeEnAlto, cabeEnAncho));

  // margen para que el bloque no se corte contra el borde de la cancha
  const mx = (BLOQUE_ANCHO * escala) / 2;
  const my = (BLOQUE_ALTO * escala) / 2;

  return {
    escala,
    ubicados: casillas.map((c, slot) => ({
      slot,
      x: mx + (c.y / 100) * (ancho - mx * 2),
      // se ataca hacia arriba: más profundidad es más arriba en pantalla
      y: alto - my - estirada(c.x) * (alto - my * 2),
    })),
  };
}
