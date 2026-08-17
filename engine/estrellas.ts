import estrellasJson from "@/data/estrellas.json";
import { precioDe } from "./mercado.ts";
import { Rng } from "./rng.ts";
import type { Jugador, Posicion, Rasgo } from "./tipos.ts";

/**
 * Los fichajes estrella: cracks en el ocaso que se pueden traer a Olimpia.
 *
 * Existen para que la plata valga algo. Antes entraba y salía sin que
 * quisieras nada con ella, así que ninguna decisión económica dolía: daba lo
 * mismo el precio de la entrada y nunca vendías a nadie. Acá hay algo que
 * querés y que no podés pagar de una, y recién entonces las demás decisiones
 * se vuelven difíciles.
 *
 * No es un catálogo: aparecen de a una, con el nivel a la vista (un crack
 * conocido no es un misterio) y con una semana para decidir. Si la dejás
 * pasar, firma en otro lado.
 */

export type CategoriaEstrella = "regreso" | "crack" | "leyenda" | "clasico";

export interface Estrella {
  id: string;
  nombre: string;
  apellido: string;
  edad: number;
  posicion: Posicion;
  nacionalidad: string;
  extranjero: boolean;
  nivel: number;
  precioUsd: number;
  categoria: CategoriaEstrella;
  titular: string;
  de: string;
  historia: string;
  riesgo: string;
  peso: number;
  /** Lo que sabe hacer. Es lo que lo diferencia de otro del mismo nivel. */
  rasgos?: Rasgo[];
}

/**
 * El precio no se carga: se calcula, con la misma curva que el mercado común.
 *
 * Escrito a mano quedó incoherente de todas las formas posibles. Messi salía
 * catorce millones y Cristiano nueve, que es más barato que un refuerzo de 77
 * en proporción a lo que rinden; Enciso, veintidós años y titular en la
 * Premier, salía seis, menos que Neymar de treinta y cuatro. Con la curva
 * compartida el orden sale solo y no se puede volver a romper: la estrella más
 * barata cuesta más que el mejor del mercado, y entre ellas manda el nivel.
 */
export const ESTRELLAS: Estrella[] =
  (estrellasJson as Omit<Estrella, "precioUsd">[])
    .map((e) => ({ ...e, precioUsd: precioDe(e.nivel, e.edad) }));

/**
 * Cada cuánto puede aparecer una. Las leyendas son rarísimas a propósito: si
 * Messi apareciera todas las temporadas dejaría de ser Messi.
 */
export const CHANCE_POR_CATEGORIA: Record<CategoriaEstrella, number> = {
  regreso: 0.48,
  crack: 0.28,
  clasico: 0.16,
  leyenda: 0.08,
};

/** Días que tenés para decidir antes de que firme en otro lado. */
export const DIAS_DE_VENTANA = 7;

/**
 * Sortea una oportunidad, sin repetir las que ya aparecieron. El sorteo es por
 * categoría primero para que la rareza no dependa de cuántos jugadores haya
 * cargados de cada tipo.
 */
export function sortearEstrella(semilla: string, yaVistas: string[]): Estrella | null {
  const rng = new Rng(`estrella-${semilla}`);
  const vistas = new Set(yaVistas);

  const categorias = (Object.keys(CHANCE_POR_CATEGORIA) as CategoriaEstrella[])
    .filter((c) => ESTRELLAS.some((e) => e.categoria === c && !vistas.has(e.id)));
  if (!categorias.length) return null;

  const total = categorias.reduce((s, c) => s + CHANCE_POR_CATEGORIA[c], 0);
  let r = rng.next() * total;
  let elegida = categorias[categorias.length - 1];
  for (const c of categorias) { r -= CHANCE_POR_CATEGORIA[c]; if (r <= 0) { elegida = c; break; } }

  const candidatos = ESTRELLAS.filter((e) => e.categoria === elegida && !vistas.has(e.id));
  const pesoTotal = candidatos.reduce((s, e) => s + e.peso, 0);
  let p = rng.next() * pesoTotal;
  for (const e of candidatos) { p -= e.peso; if (p <= 0) return e; }
  return candidatos[candidatos.length - 1] ?? null;
}

/**
 * El jugador que entra al plantel. Un crack en el ocaso rinde alto pero llega
 * con el cuerpo justo: arranca por debajo del 100% y se cansa como un veterano.
 */
export function jugadorDeEstrella(e: Estrella, numero: number): Jugador {
  return {
    id: `estrella-${e.id}`,
    numero,
    nombre: e.nombre,
    apellido: e.apellido,
    posicion: e.posicion,
    posiciones_secundarias: [],
    edad: e.edad,
    fecha_nacimiento: `${2026 - e.edad}-01-01`,
    nacionalidad: e.nacionalidad,
    extranjero: e.extranjero,
    nivel: e.nivel,
    nivel_incertidumbre: 0,
    condicion: 78,
    animo: 85,
    partidos_internacionales: 90,
    // El que llegó de arriba sabe jugar estos partidos, pero el cuerpo ya no
    // es el mismo: los de 36 para arriba se rompen más seguido.
    /*
     * Los rasgos propios de cada uno, del JSON. Antes eran fijos para todos y
     * eso rompía la premisa del fichaje: como el rasgo definidor vale nueve
     * puntos de chance (lo mismo que quince de nivel) y ninguna estrella lo
     * tenía, Messi pateaba los penales peor que un titular de 71 que sí es
     * definidor.
     */
    rasgos: [
      ...(e.rasgos ?? []),
      "veterano_de_copas" as const,
      ...(e.edad >= 36 ? ["fragil" as const] : []),
    ],
    lesionado_hasta: null,
    tarjetas_amarillas: 0,
    suspendido: false,
    valor_comercial: 5,
  };
}

/**
 * Lo que mueve traer a alguien así, más allá de la cancha.
 *
 * El ídolo del clásico es un caso aparte: la hinchada se divide, así que sube
 * menos de lo que subiría cualquier otro refuerzo del mismo nivel, pero
 * sacárselo a Cerro es lo que más prestigio da en Asunción.
 */
export function impactoDe(e: Estrella): { hinchada: number; ambiente: number; prestigio: number } {
  if (e.categoria === "leyenda") return { hinchada: 30, ambiente: 18, prestigio: 25 };
  if (e.categoria === "clasico") return { hinchada: 7, ambiente: 4, prestigio: 20 };
  if (e.categoria === "crack") return { hinchada: 16, ambiente: 10, prestigio: 12 };
  return { hinchada: 12, ambiente: 8, prestigio: 8 };
}
