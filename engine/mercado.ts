import fichajesJson from "@/data/fichajes.json";
import { Rng } from "./rng.ts";
import type { Jugador, Posicion, Rasgo } from "./tipos.ts";

/**
 * Mercado de pases, versión mínima del documento: comprar, vender y nada de
 * scouting. El condimento regional obligatorio es el cupo de extranjeros, que
 * se controla al armar el once, así que fichar a un extranjero tiene costo de
 * oportunidad además de precio.
 */

const CLUBES_COMPRADORES = [
  "Racing", "Vélez", "Cruzeiro", "Talleres", "Athletico Paranaense",
  "Independiente", "Peñarol", "Universidad Católica", "Bahia", "Estudiantes",
];

/**
 * A quién podés traer.
 *
 * Antes eran nombres inventados y daba lo mismo cualquiera: fichabas un número.
 * Estos existen, se reconocen y cada uno trae lo suyo, que es lo que hace que
 * la decisión tenga cara.
 */
interface FichajeDelCatalogo {
  id: string;
  nombre: string;
  apellido: string;
  posicion: Posicion;
  edad: number;
  nacionalidad: string;
  nivel: number;
  de: string;
  rasgos: Rasgo[];
  nota: string;
}

export const CATALOGO = fichajesJson as FichajeDelCatalogo[];

/**
 * Precio de referencia, en escala logarítmica sobre el nivel.
 *
 * Estaba tan barato que rompía la única decisión económica del juego: un
 * refuerzo de 70 salía 610 mil, o sea menos de dos partidos de recaudación,
 * mientras que una estrella del mismo nivel pedía cinco o seis veces eso.
 * Nadie iba a ahorrar para el crack pudiendo llenarse de buenos a precio de
 * ganga. Ahora la estrella sale menos del doble que un refuerzo equivalente,
 * y esa diferencia se paga con lo que trae de hinchada y de vestuario.
 *
 * El castigo por edad también era brutal: un cuarentón valía el 40% de su
 * nivel, y como el catálogo son casi todos veteranos, todo salía regalado.
 */
export const precioDe = (nivel: number, edad: number) => {
  const base = 45_000 * Math.pow(10, (nivel - 45) / 14);
  const factorEdad = edad <= 23 ? 1.3 : edad <= 28 ? 1.1
    : edad <= 32 ? 0.85 : edad <= 35 ? 0.65 : 0.5;
  return Math.round((base * factorEdad) / 10_000) * 10_000;
};

export interface FichajeGenerado {
  id: string;
  nombre: string;
  apellido: string;
  posicion: Posicion;
  edad: number;
  nacionalidad: string;
  extranjero: boolean;
  nivel: number;
  precioUsd: number;
  sueldoUsd: number;
  valorComercial: number;
  /** Lo que sabe hacer, para que no sean todos el mismo número. */
  rasgos: Rasgo[];
  /** De dónde viene y por qué te suena. */
  de: string;
  nota: string;
}

export function generarMercado(
  semilla: string, cantidad = 6, yaEstan: string[] = [],
): FichajeGenerado[] {
  const rng = new Rng(`mercado-${semilla}`);
  const dentro = new Set(yaEstan);
  const libres = CATALOGO.filter((f) => !dentro.has(f.id));
  const lista: FichajeGenerado[] = [];
  const usados = new Set<string>();

  while (lista.length < cantidad && usados.size < libres.length) {
    const f = rng.elegir(libres);
    if (usados.has(f.id)) continue;
    usados.add(f.id);
    const extranjero = f.nacionalidad !== "PAR";
    lista.push({
      id: f.id,
      nombre: f.nombre,
      apellido: f.apellido,
      posicion: f.posicion,
      edad: f.edad,
      nacionalidad: f.nacionalidad,
      extranjero,
      nivel: f.nivel,
      precioUsd: precioDe(f.nivel, f.edad),
      sueldoUsd: Math.round((f.nivel - 40) * 900),
      valorComercial: extranjero && f.edad <= 28 ? 3 : f.edad <= 31 ? 2 : 1,
      rasgos: f.rasgos,
      de: f.de,
      nota: f.nota,
    });
  }
  return lista;
}

const clampNivel = (n: number) => Math.max(50, Math.min(78, n));

/** Llegan ofertas por los mejores, que es cuando duele decidir. */
export function sortearOferta(plantel: Jugador[], semilla: string) {
  const rng = new Rng(`oferta-${semilla}`);
  const candidatos = plantel.filter((j) => j.nivel >= 63 && !j.lesionado_hasta);
  if (!candidatos.length) return null;

  const peso = (j: Jugador) => Math.pow(2, (j.nivel - 60) / 4);
  const total = candidatos.reduce((s, j) => s + peso(j), 0);
  let r = rng.next() * total;
  let elegido = candidatos[candidatos.length - 1];
  for (const j of candidatos) { r -= peso(j); if (r <= 0) { elegido = j; break; } }

  /**
   * Que el jugador quiera irse o no es lo que decide si rechazar la oferta le
   * cae mal. Antes se enojaban todos por igual, que no tiene sentido: al que
   * está cómodo en el club le da lo mismo, y al que está caliente o es joven
   * con una vidriera afuera sí le duele quedarse.
   */
  const joven = elegido.edad <= 24;
  const dolido = (elegido.animo ?? 70) < 55;
  const chanceDeQuererse = (joven ? 0.35 : 0.15) + (dolido ? 0.35 : 0);
  const quiereIrse = rng.chance(Math.min(0.85, chanceDeQuererse));

  const base = precioDe(elegido.nivel, elegido.edad);
  return {
    jugadorId: elegido.id,
    club: rng.elegir(CLUBES_COMPRADORES),
    montoUsd: Math.round((base * rng.entre(0.75, 1.6)) / 10_000) * 10_000,
    quiereIrse,
  };
}
