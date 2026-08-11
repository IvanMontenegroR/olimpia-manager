import { Rng } from "./rng.ts";
import { LINEA_DE, type Posicion } from "./tipos.ts";

/**
 * El modelo no guarda planteles rivales, solo una fuerza por club. Para poder
 * mostrar su estado en pantalla se arma un once sintético, determinista por
 * club: el mismo rival tiene siempre los mismos once.
 *
 * No son datos reales y no pretenden serlo. Sirven para que "al lateral de
 * Libertad le sacaron amarilla" signifique algo.
 */

const APELLIDOS = [
  "Benítez", "González", "Ramírez", "Ortiz", "Cáceres", "Villalba", "Duarte",
  "Rojas", "Ayala", "Fernández", "Giménez", "Acosta", "Riveros", "Vera",
  "Espínola", "Franco", "Aquino", "Bareiro", "Insfrán", "Torales", "Núñez",
  "Escobar", "Alderete", "Sanabria", "Recalde", "Ovelar", "Cardozo", "Paredes",
];

export interface JugadorRival {
  id: string;
  numero: number;
  apellido: string;
  posicion: Posicion;
  nivel: number;
}

const MOLDE: Posicion[] =
  ["ARQ", "LD", "DFC", "DFC", "LI", "MD", "MCD", "MC", "MI", "DC", "DC"];

export function onceRival(clubId: string, fuerza: number): JugadorRival[] {
  const rng = new Rng(`rival-${clubId}`);
  const once: JugadorRival[] = [];
  const usados = new Set<string>();
  let numero = 1;

  for (const pos of MOLDE) {
    {
      let apellido = rng.elegir(APELLIDOS);
      let intentos = 0;
      while (usados.has(apellido) && intentos++ < 30) apellido = rng.elegir(APELLIDOS);
      usados.add(apellido);
      once.push({
        id: `${clubId}-${numero}`,
        numero: numero++,
        apellido,
        posicion: pos,
        // los del fondo un poco por debajo, los de arriba por encima
        nivel: Math.round(
          fuerza + (LINEA_DE[pos] === "DEL" ? 2 : pos === "ARQ" ? -1 : 0) + rng.entre(-4, 4)),
      });
    }
  }
  return once;
}
