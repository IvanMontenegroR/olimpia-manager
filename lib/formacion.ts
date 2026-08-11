import { COORD, type Posicion } from "@/engine/tipos.ts";

/**
 * Reparte los once en la cancha sin que se pisen, midiendo el contenedor real.
 *
 * La versión anterior ubicaba en porcentajes y separaba con umbrales fijos en
 * unidades de cancha, pero los bloques (dorsal + apellido + datos) miden
 * píxeles: en un teléfono con la cancha más baja las líneas se juntaban en
 * vertical y en uno más angosto se juntaban en horizontal. Acá la separación
 * sale del espacio disponible, así que no depende del tamaño de pantalla.
 *
 * Primero se agrupan los puestos en bandas de profundidad (la defensa, el
 * doble cinco, el ataque). Cada banda recibe su franja del alto y adentro se
 * reparte el ancho. Como las dos repartijas garantizan una separación mínima,
 * no hace falta detectar choques después.
 */

export interface Ubicado<T> {
  item: T;
  /** centro del bloque, en píxeles dentro del contenedor */
  x: number;
  y: number;
}

export interface Reparto<T> {
  ubicados: Ubicado<T>[];
  /** Escala del bloque, 1 cuando entra cómodo y menos cuando hay que apretar. */
  escala: number;
}

/** Dos puestos a menos de esto de profundidad son la misma línea. */
const MISMA_BANDA = 9;

const BLOQUE_ALTO = 58;
const BLOQUE_ANCHO = 68;
const ESCALA_MINIMA = 0.7;

export function repartirCancha<T>(
  items: T[],
  puestoDe: (item: T) => Posicion,
  ancho: number,
  alto: number,
): Reparto<T> {
  if (!items.length || ancho <= 0 || alto <= 0) return { ubicados: [], escala: 1 };

  // Agrupar por profundidad: los que están a la misma altura son una línea. Se
  // ordena de más adelantado a menos, porque se ataca hacia arriba y `separar`
  // espera las posiciones ya crecientes en píxeles.
  const conCoord = items.map((item) => ({ item, c: COORD[puestoDe(item)] }));
  const ordenados = [...conCoord].sort((a, b) => b.c.x - a.c.x);

  const bandas: { x: number; miembros: typeof conCoord }[] = [];
  for (const e of ordenados) {
    const ultima = bandas[bandas.length - 1];
    if (ultima && ultima.x - e.c.x < MISMA_BANDA) ultima.miembros.push(e);
    else bandas.push({ x: e.c.x, miembros: [e] });
  }

  // Cuánto hay que encoger para que entren: manda la restricción más dura,
  // la de las bandas a lo alto o la de la banda más poblada a lo ancho.
  const maxPorBanda = Math.max(...bandas.map((b) => b.miembros.length));
  const escala = Math.max(
    ESCALA_MINIMA,
    Math.min(
      1,
      alto / (bandas.length * BLOQUE_ALTO),
      ancho / (maxPorBanda * BLOQUE_ANCHO),
    ),
  );
  const sepAlto = BLOQUE_ALTO * escala;
  const sepAncho = BLOQUE_ANCHO * escala;

  // Profundidad: se parte de dónde querría estar cada línea y se separa lo
  // necesario. Se ataca hacia arriba, así que la mayor x va más arriba.
  const deseadoY = bandas.map((b) => alto - (b.x / 100) * alto);
  const ys = separar(deseadoY, sepAlto, sepAlto / 2, alto - sepAlto / 2);

  const ubicados: Ubicado<T>[] = [];
  bandas.forEach((banda, i) => {
    const miembros = [...banda.miembros].sort((a, b) => a.c.y - b.c.y);
    const deseadoX = miembros.map((m) => (m.c.y / 100) * ancho);
    const xs = separar(deseadoX, sepAncho, sepAncho / 2, ancho - sepAncho / 2);
    miembros.forEach((m, k) => ubicados.push({ item: m.item, x: xs[k], y: ys[i] }));
  });

  return { ubicados, escala };
}

/**
 * Acomoda posiciones en una línea respetando un mínimo entre vecinos y los
 * bordes, quedando lo más cerca posible de donde querían estar. Entra ordenado
 * de menor a mayor: se empuja hacia adelante, después hacia atrás si se pasó
 * del borde, y al final se centra lo que sobre.
 */
function separar(deseado: number[], minimo: number, desde: number, hasta: number): number[] {
  const n = deseado.length;
  if (!n) return [];
  if (n === 1) return [Math.max(desde, Math.min(hasta, deseado[0]))];

  const p = [...deseado];
  p[0] = Math.max(p[0], desde);
  for (let i = 1; i < n; i++) p[i] = Math.max(p[i], p[i - 1] + minimo);

  // si el último se fue del borde, se comprime tirando desde el otro extremo
  if (p[n - 1] > hasta) {
    p[n - 1] = hasta;
    for (let i = n - 2; i >= 0; i--) p[i] = Math.min(p[i], p[i + 1] - minimo);
  }

  // si quedó lugar de sobra a los costados, se centra el conjunto
  const sobraIzq = p[0] - desde;
  const sobraDer = hasta - p[n - 1];
  if (sobraIzq > 0 && sobraDer > 0) {
    const ajuste = (sobraDer - sobraIzq) / 2;
    for (let i = 0; i < n; i++) p[i] += ajuste;
  }
  return p;
}
