/**
 * Corrige los niveles del plantel con el rendimiento real de la temporada.
 *
 * De dónde salen los datos, y por qué de ahí:
 *
 *   Sofascore y Tribuna devuelven 403 a cualquier pedido automático, así que
 *   están descartados. FotMob responde pero solo publica el podio de mejor
 *   calificados, o sea tres jugadores de veintiocho. BeSoccer sí publica una
 *   valoración para todo el plantel, y es la que se usa acá.
 *
 * Lo que hay que saber de esa valoración: está pesada por minutos. No es la
 * nota de un partido sino lo que el jugador aportó en la temporada. Se nota de
 * una mirando a los pibes que casi no jugaron, que caen a 32 o 38 sin que eso
 * diga nada de lo que valen. Por eso acá no se copia el número: se lo usa como
 * corrección y con freno.
 *
 *   - Los que se despegan para abajo diez puntos o más quedan intactos: ese
 *     hueco es de minutos, no de nivel.
 *   - Al resto se le mueve la mitad de la diferencia, con tope de cuatro
 *     puntos. Una temporada es una muestra chica y el nivel del juego ya venía
 *     de otra medición: se corrige, no se reemplaza.
 *
 *   npx tsx scripts/niveles-reales.ts          ver qué cambiaría
 *   npx tsx scripts/niveles-reales.ts --aplicar  escribirlo
 */

import { readFileSync, writeFileSync } from "node:fs";

/**
 * Valoración de BeSoccer por jugador, temporada 2026 en curso.
 * Leído de es.besoccer.com/equipo/plantilla/olimpia-asuncion.
 */
const REAL: Record<string, number> = {
  Olveira: 71, Lentinelly: 66, Verza: 45,
  Cáceres: 71, Vargas: 67, Vera: 66, Bentaberry: 66, Matus: 64, Payne: 65,
  Gamarra: 63, Rodríguez: 61, Olmedo: 53,
  Ortiz: 69, González: 67, Alfaro: 71, Sánchez: 67, Domínguez: 64,
  Leguizamón: 72, Romero: 76, Ferreira: 61, Lezcano: 65, Cardozo: 64,
  Caballero: 61, Sandoval: 52, Barone: 52, Benítez: 50, Zarza: 38,
  Alfonso: 45, Delmas: 32,
};

/** Cuánto se mueve el nivel del juego hacia el número real. */
const PESO = 0.5;
const TOPE = 4;
/** Debajo de esto, el hueco es de minutos y no se toca. */
const ARTEFACTO = 10;

const ruta = "data/plantel_olimpia_2026.json";
const crudo = JSON.parse(readFileSync(ruta, "utf8"));
const plantel: { apellido: string; nivel: number; edad: number; posicion: string }[] =
  Array.isArray(crudo) ? crudo : Object.values(crudo)[0] as never;

const aplicar = process.argv.includes("--aplicar");
let cambiados = 0;
const sinDato: string[] = [];
const intactos: string[] = [];

console.log("\n  NIVELES CONTRA EL RENDIMIENTO REAL\n");
console.log("    jugador           juego  real   queda");

for (const j of [...plantel].sort((a, b) => b.nivel - a.nivel)) {
  const real = REAL[j.apellido];
  if (real === undefined) { sinDato.push(j.apellido); continue; }

  const dif = real - j.nivel;
  if (dif <= -ARTEFACTO) { intactos.push(`${j.apellido} (${real})`); continue; }

  const mover = Math.max(-TOPE, Math.min(TOPE, Math.round(dif * PESO)));
  const nuevo = j.nivel + mover;
  if (mover !== 0) {
    cambiados++;
    console.log(`    ${j.apellido.padEnd(16)} ${String(j.nivel).padStart(4)}` +
      `${String(real).padStart(7)}${String(nuevo).padStart(8)}  ${mover > 0 ? "+" : ""}${mover}`);
  }
  if (aplicar) j.nivel = nuevo;
}

console.log(`\n  ${cambiados} niveles corregidos`);
if (intactos.length) {
  console.log(`\n  sin tocar, el número es de minutos y no de nivel:`);
  console.log(`    ${intactos.join(", ")}`);
}
if (sinDato.length) {
  console.log(`\n  no figuran en el plantel real de hoy:`);
  console.log(`    ${sinDato.join(", ")}`);
}

if (aplicar) {
  writeFileSync(ruta, JSON.stringify(crudo, null, 2) + "\n");
  console.log("\n  escrito en " + ruta);
} else {
  console.log("\n  (nada escrito; corré con --aplicar)");
}
console.log();
