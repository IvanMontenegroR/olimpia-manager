/**
 * Revisa que los jugadores del juego tengan sentido.
 *
 * Existe porque metí veintiocho jugadores al mercado a ojo y salieron mal de
 * tres maneras a la vez: seis ya estaban en la lista de estrellas y quedaron
 * duplicados (Diego Gómez aparecía como estrella de 76 y en el mercado común
 * de 71), varios ids eran borradores míos que ni coincidían con el jugador
 * (Diego Gómez llevaba el id "tiago_caceres"), y los niveles no tenían más
 * ancla que mi intuición.
 *
 * Lo que se chequea:
 *   - Nadie está en dos listas a la vez.
 *   - Ningún id repetido, ninguno con pinta de borrador.
 *   - El mercado no invade el rango de las estrellas.
 *   - El precio sube con el nivel, sin cruces raros.
 *
 *   npx tsx scripts/plantillas.ts
 */

import { CATALOGO } from "../engine/mercado.ts";
import { ESTRELLAS } from "../engine/estrellas.ts";
import { PLANTEL } from "../lib/juego.ts";

/** Arriba de esto ya no es un refuerzo, es una estrella. */
const TECHO_DEL_MERCADO = 75;

const fallas: string[] = [];
const nombre = (j: { nombre: string; apellido: string }) =>
  `${j.nombre} ${j.apellido}`.toLowerCase();

// ---------------------------------------------------------------- duplicados
const enEstrellas = new Map(ESTRELLAS.map((e) => [nombre(e), e]));
for (const f of CATALOGO) {
  const e = enEstrellas.get(nombre(f));
  if (e) {
    fallas.push(`${f.nombre} ${f.apellido} está en las dos listas: ` +
      `mercado ${f.nivel}, estrella ${e.nivel}`);
  }
}
const enPlantel = new Set(PLANTEL.map(nombre));
for (const f of CATALOGO) {
  if (enPlantel.has(nombre(f))) fallas.push(`${f.nombre} ${f.apellido} ya está en el plantel`);
}

// ---------------------------------------------------------------- ids
const vistos = new Set<string>();
for (const j of [...CATALOGO, ...ESTRELLAS]) {
  if (vistos.has(j.id)) fallas.push(`id repetido: ${j.id}`);
  vistos.add(j.id);
  // los borradores que dejé quedaban con sufijos así
  if (/_no$|_pj$|_ficticio$/.test(j.id)) {
    fallas.push(`id con pinta de borrador: ${j.id} (${j.nombre} ${j.apellido})`);
  }
}

// ---------------------------------------------------------------- rangos
for (const f of CATALOGO) {
  if (f.nivel > TECHO_DEL_MERCADO) {
    fallas.push(`${f.nombre} ${f.apellido} es ${f.nivel}: a ese nivel va en estrellas`);
  }
}

// ---------------------------------------------------------------- precios
const porNivel = [...ESTRELLAS].sort((a, b) => a.nivel - b.nivel);
for (let i = 1; i < porNivel.length; i++) {
  const a = porNivel[i - 1], b = porNivel[i];
  // dos niveles de diferencia y sale más barato: algo está mal cargado
  if (b.nivel - a.nivel >= 2 && b.precioUsd < a.precioUsd) {
    fallas.push(`${b.apellido} (${b.nivel}) sale ${(b.precioUsd / 1e6).toFixed(1)}M ` +
      `y ${a.apellido} (${a.nivel}) sale ${(a.precioUsd / 1e6).toFixed(1)}M`);
  }
}

// ---------------------------------------------------------------- edades
/*
 * El mercado no puede ser solo un asilo. Tenía 32 años de media y CERO
 * jugadores de 23 o menos, así que reforzarse envejecía el plantel sí o sí y
 * la mecánica de crecimiento quedaba muerta: solo crecen los de 21 o menos y
 * no había ninguno para fichar.
 */
const jovenes = CATALOGO.filter((f) => f.edad <= 23).length;
const conCrecimiento = CATALOGO.filter((f) => f.edad <= 21).length;
if (jovenes < 4) {
  fallas.push(`el mercado tiene ${jovenes} jugadores de 23 o menos: te obliga a envejecer`);
}
if (conCrecimiento < 2) {
  fallas.push(`solo ${conCrecimiento} del mercado pueden crecer (21 o menos): ` +
    `la mecánica de crecimiento no se puede usar`);
}

// ---------------------------------------------------------------- nombres
for (const j of [...CATALOGO, ...ESTRELLAS, ...PLANTEL]) {
  if (j.nombre === j.apellido || j.nombre.split(" ").includes(j.apellido)) {
    fallas.push(`nombre mal cargado: "${j.nombre} ${j.apellido}" (${j.id})`);
  }
}
const clubes = new Set([...CATALOGO, ...ESTRELLAS].map((f) => f.de));
const sinClub = [...clubes].filter((c) => /^sin club$/i.test(c));
if (sinClub.length > 1) fallas.push(`"sin club" escrito de ${sinClub.length} formas: ${sinClub.join(", ")}`);

// ---------------------------------------------------------------- informe
console.log(`\n  ${PLANTEL.length} en el plantel · ${CATALOGO.length} en el mercado ` +
  `· ${ESTRELLAS.length} estrellas\n`);
console.log(`  mercado   nivel ${Math.min(...CATALOGO.map((f) => f.nivel))}` +
  `-${Math.max(...CATALOGO.map((f) => f.nivel))}`);
console.log(`  estrellas nivel ${Math.min(...ESTRELLAS.map((f) => f.nivel))}` +
  `-${Math.max(...ESTRELLAS.map((f) => f.nivel))}`);
const media = (xs: { edad: number }[]) =>
  (xs.reduce((s, j) => s + j.edad, 0) / xs.length).toFixed(1);
console.log(`\n  edad media: plantel ${media(PLANTEL)} · mercado ${media(CATALOGO)}` +
  ` · estrellas ${media(ESTRELLAS)}`);
console.log(`  en el mercado hay ${CATALOGO.filter((f) => f.edad <= 23).length} de 23 o menos\n`);

if (!fallas.length) {
  console.log("  Nadie repetido, nadie fuera de su lista.\n");
} else {
  console.log(`  ${fallas.length} problemas:\n`);
  for (const f of fallas) console.log(`    ${f}`);
  console.log();
  process.exitCode = 1;
}
