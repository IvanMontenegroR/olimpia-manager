import { Rng } from "./rng.ts";
import type { Jugador, Posicion } from "./tipos.ts";

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

const NOMBRES = [
  ["Marcelo", "Aguilera"], ["Julio", "Enciso"], ["Diego", "Villalba"],
  ["Óscar", "Ruiz Díaz"], ["Antonio", "Galeano"], ["Blas", "Cardozo"],
  ["Néstor", "Bogado"], ["Ramón", "Ojeda"], ["Ever", "Cabral"],
  ["Luis", "Amarilla"], ["Fabrizio", "Peralta"], ["Rodrigo", "Morínigo"],
];

const EXTRANJEROS = [
  ["Matías", "Cabrera", "URU"], ["Nicolás", "Ferreyra", "ARG"],
  ["Camilo", "Restrepo", "COL"], ["Bruno", "Nascimento", "BRA"],
  ["Cristóbal", "Muñoz", "CHI"],
];

/** Precio de referencia, en la misma escala logarítmica del documento. */
export const precioDe = (nivel: number, edad: number) => {
  const base = 25_000 * Math.pow(10, (nivel - 45) / 14);
  const factorEdad = edad <= 23 ? 1.35 : edad <= 28 ? 1.1 : edad <= 32 ? 0.75 : 0.4;
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
}

export function generarMercado(semilla: string, cantidad = 6): FichajeGenerado[] {
  const rng = new Rng(`mercado-${semilla}`);
  const posiciones: Posicion[] = ["ARQ", "DEF", "DEF", "MED", "MED", "DEL", "DEL"];
  const lista: FichajeGenerado[] = [];

  for (let i = 0; i < cantidad; i++) {
    const extranjero = rng.chance(0.4);
    const [nombre, apellido, nac] = extranjero
      ? rng.elegir(EXTRANJEROS)
      : [...rng.elegir(NOMBRES), "PAR"];
    const edad = rng.entero(19, 34);
    const nivel = clampNivel(rng.entero(56, 74) + (edad >= 30 ? -2 : 0));
    lista.push({
      id: `f-${semilla}-${i}`,
      nombre, apellido,
      posicion: rng.elegir(posiciones),
      edad,
      nacionalidad: nac,
      extranjero,
      nivel,
      precioUsd: precioDe(nivel, edad),
      sueldoUsd: Math.round((nivel - 40) * 900),
      valorComercial: extranjero && edad <= 28 ? rng.entero(2, 4) : rng.entero(1, 3),
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

  const base = precioDe(elegido.nivel, elegido.edad);
  return {
    jugadorId: elegido.id,
    club: rng.elegir(CLUBES_COMPRADORES),
    montoUsd: Math.round((base * rng.entre(0.75, 1.6)) / 10_000) * 10_000,
  };
}
