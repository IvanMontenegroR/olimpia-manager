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

import { CATALOGO, NIVELES_POR_DECADA, factorEdad, precioDe } from "../engine/mercado.ts";
import { ESTRELLAS } from "../engine/estrellas.ts";
import { PLANTEL } from "../lib/juego.ts";

/**
 * Arriba de esto ya no es un refuerzo, es una estrella.
 *
 * Subió de 75 a 79 cuando la lista de estrellas se limpió. Una "estrella" de
 * 73 no era una estrella: era un buen jugador con pantalla propia, y mientras
 * tanto el mercado no pasaba de 74 contra un plantel que ya tenía 73, 70 y
 * 69. O sea que ninguno de los seis que te ofrecían te mejoraba el once y no
 * daban ganas de comprar a nadie.
 *
 * Ahora la estrella arranca en 80 (Messi, Cristiano, Neymar, Icardi, Diego
 * Gómez, Enciso) y todos los demás se fueron al mercado, que es donde son
 * exactamente lo que hacía falta: refuerzos de 73 a 77.
 */
const TECHO_DEL_MERCADO = 79;
/** Y de acá para arriba es estrella, sin excepciones. */
const PISO_DE_ESTRELLA = 80;

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
for (const e of ESTRELLAS) {
  if (e.nivel < PISO_DE_ESTRELLA) {
    fallas.push(`${e.nombre} ${e.apellido} es ${e.nivel}: con eso no es estrella, va al mercado`);
  }
}
for (const f of CATALOGO) {
  if (f.nivel > TECHO_DEL_MERCADO) {
    fallas.push(`${f.nombre} ${f.apellido} es ${f.nivel}: a ese nivel va en estrellas`);
  }
}

// ---------------------------------------------------------------- precios
/*
 * Esto antes solo miraba las estrellas entre ellas y con una vara floja (dos
 * niveles de diferencia), así que no vio nada de lo que estaba roto: el
 * mercado común tenía jugadores de 77 más baratos que otros de 74, y las
 * estrellas, con el precio escrito a mano en el JSON, valían menos que un
 * refuerzo bueno en proporción a lo que rinden.
 *
 * Ahora se auditan los ochenta y tres juntos, mercado y estrellas, porque
 * salen de la misma curva y tienen que leerse como una sola lista de precios.
 */
const TODOS = [
  ...CATALOGO.map((f) => ({ ...f, tier: "mercado" as const, precioUsd: precioDe(f.nivel, f.edad) })),
  ...ESTRELLAS.map((e) => ({ ...e, tier: "estrella" as const })),
];

/*
 * La garantía estructural: la edad no puede dar vuelta el orden por nivel.
 *
 * Si el rango entero de la curva de edad es menor que lo que valen dos
 * niveles, entonces dos jugadores separados por dos niveles nunca se cruzan,
 * por más que uno tenga veinte años y el otro cuarenta. Es la propiedad que
 * hace que el mercado se pueda leer, y se chequea acá y no de memoria.
 */
const edades = Array.from({ length: 30 }, (_, i) => 18 + i).map(factorEdad);
const rangoEdad = Math.max(...edades) / Math.min(...edades);
const dosNiveles = Math.pow(10, 2 / NIVELES_POR_DECADA);
if (rangoEdad >= dosNiveles) {
  fallas.push(`la edad mueve el precio ${rangoEdad.toFixed(3)}x y dos niveles valen ` +
    `${dosNiveles.toFixed(3)}x: con eso un jugador puede salir más caro que otro mejor`);
}

/* Y la comprobación directa sobre los que de verdad están cargados. */
const porNivel = [...TODOS].sort((a, b) => a.nivel - b.nivel);
const M = (n: number) => `${(n / 1e6).toFixed(2)}M`;
for (const a of porNivel) {
  for (const b of porNivel) {
    if (b.nivel - a.nivel < 2 || b.precioUsd >= a.precioUsd) continue;
    fallas.push(`${b.apellido} (${b.nivel}, ${b.edad}) sale ${M(b.precioUsd)} y ` +
      `${a.apellido} (${a.nivel}, ${a.edad}), que es peor, sale ${M(a.precioUsd)}`);
  }
}

/*
 * Y la estrella más barata tiene que costar más que el mejor del mercado.
 * Si no, el tier no existe: comprás el 77 y te queda plata.
 */
const topMercado = TODOS.filter((t) => t.tier === "mercado")
  .reduce((a, b) => (b.precioUsd > a.precioUsd ? b : a));
const pisoEstrella = TODOS.filter((t) => t.tier === "estrella")
  .reduce((a, b) => (b.precioUsd < a.precioUsd ? b : a));
if (pisoEstrella.precioUsd <= topMercado.precioUsd) {
  fallas.push(`la estrella más barata (${pisoEstrella.apellido}, ${M(pisoEstrella.precioUsd)}) ` +
    `no cuesta más que el refuerzo más caro (${topMercado.apellido}, ${M(topMercado.precioUsd)})`);
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
console.log(`\n  ${PLANTEL.length} en el plantel - ${CATALOGO.length} en el mercado ` +
  `- ${ESTRELLAS.length} estrellas\n`);
console.log(`  mercado   nivel ${Math.min(...CATALOGO.map((f) => f.nivel))}` +
  `-${Math.max(...CATALOGO.map((f) => f.nivel))}`);
console.log(`  estrellas nivel ${Math.min(...ESTRELLAS.map((f) => f.nivel))}` +
  `-${Math.max(...ESTRELLAS.map((f) => f.nivel))}`);
const media = (xs: { edad: number }[]) =>
  (xs.reduce((s, j) => s + j.edad, 0) / xs.length).toFixed(1);
console.log(`\n  edad media: plantel ${media(PLANTEL)} - mercado ${media(CATALOGO)}` +
  ` - estrellas ${media(ESTRELLAS)}`);
console.log(`  en el mercado hay ${CATALOGO.filter((f) => f.edad <= 23).length} de 23 o menos`);

/* La escalera de precios, que es lo que hay que poder leer de un vistazo. */
console.log(`\n  LO QUE SALE CADA NIVEL\n`);
const niveles = [...new Set(TODOS.map((t) => t.nivel))].sort((a, b) => a - b);
for (const n of niveles) {
  const xs = TODOS.filter((t) => t.nivel === n).sort((a, b) => a.precioUsd - b.precioUsd);
  const barato = xs[0], caro = xs[xs.length - 1];
  const rango = barato === caro ? M(barato.precioUsd)
    : `${M(barato.precioUsd)} a ${M(caro.precioUsd)}`;
  console.log(`    ${n}  ${rango.padStart(15)}   ${xs.length} jugador${xs.length > 1 ? "es" : ""}` +
    `${xs[0].tier === "estrella" ? "   estrella" : ""}`);
}
console.log();

if (!fallas.length) {
  console.log("  Nadie repetido, nadie fuera de su lista.\n");
} else {
  console.log(`  ${fallas.length} problemas:\n`);
  for (const f of fallas) console.log(`    ${f}`);
  console.log();
  process.exitCode = 1;
}
