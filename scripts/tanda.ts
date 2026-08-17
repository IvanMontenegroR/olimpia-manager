/**
 * La tanda, ¿es una decisión o una moneda?
 *
 * Elegir pateador tiene que servir para algo y no tanto: si el que mejor patea
 * y el que peor patea dieran lo mismo, la pantalla sería un trámite con
 * botones; si dieran muy distinto, la tanda dejaría de parecerse a una tanda,
 * que en el fútbol es lo más parecido a una moneda que hay.
 *
 * Acá se juegan miles de tandas eligiendo de tres maneras y se mide cuántas se
 * ganan. También se comprueba lo otro: que el que terminó el partido sea el que
 * patea, o sea que los cambios del final tengan consecuencia.
 *
 *   npx tsx scripts/tanda.ts
 */

import {
  estadoTanda, patearPenal, pateadoresLibres, chanceDePenal,
  partidaNueva, partidoDe, plantelDe, onceTitular, cerrarPartido,
  type Partida, type Tanda,
} from "../lib/temporada.ts";

const N = 3000;

/* Una llave que llega empatada, para que se abra la tanda. */
function tandaDePrueba(semilla: string, once?: string[]): Tanda {
  const p0 = partidaNueva(semilla);
  const plantel = plantelDe(p0);
  const m = partidoDe(p0)!;
  const s = onceTitular(p0, m, plantel);
  /* Se fuerza la vuelta con el global en cero: empate y a penales. */
  const p: Partida = { ...p0, copa: { ...p0.copa, jugadosEnRonda: 1, globalO: 0, globalR: 0 } };
  const tras = cerrarPartido(p, { ...m, ctx: { ...m.ctx, competencia: "sudamericana" } }, {
    golesOlimpia: 0, golesRival: 0, minutos: new Map(), amarillas: [], rojas: [],
    lesionados: [], goleadores: [],
    onceFinal: once ?? s.once.map((j) => j.id),
  });
  if (!tras.tanda) throw new Error("no se abrió la tanda");
  return tras.tanda;
}

/** Juega una tanda entera eligiendo con la regla que se le pase. */
function jugar(t: Tanda, elegir: (libres: ReturnType<typeof pateadoresLibres>) => string) {
  let x = t;
  let vueltas = 0;
  while (!estadoTanda(x).termino && vueltas < 40) {
    const libres = pateadoresLibres(x);
    if (!libres.length) break;
    x = patearPenal(x, elegir(libres));
    vueltas++;
  }
  return estadoTanda(x);
}

const ESTRATEGIAS = {
  "el que mejor patea": (l: ReturnType<typeof pateadoresLibres>) => l[0].id,
  "el que peor patea": (l: ReturnType<typeof pateadoresLibres>) => l[l.length - 1].id,
  "el primero que caiga": (l: ReturnType<typeof pateadoresLibres>) => l[0].id,
};

console.log(`\n  ${N} tandas por estrategia\n`);
const ganadas: Record<string, number> = {};
for (const [nombre, elegir] of Object.entries(ESTRATEGIAS)) {
  let gana = 0, penales = 0;
  for (let i = 0; i < N; i++) {
    const t = tandaDePrueba(`t-${i}`);
    const r = jugar(t, nombre === "el primero que caiga"
      ? (l) => l[i % l.length].id
      : elegir);
    if (r.gana) gana++;
    penales += r.mios + r.suyos;
  }
  ganadas[nombre] = (gana / N) * 100;
  console.log(`  ${nombre.padEnd(24)} gana ${((gana / N) * 100).toFixed(1)}%` +
    `   ${(penales / N).toFixed(1)} convertidos por tanda`);
}

// ------------------------------------------------ quiénes pueden patear
const base = partidaNueva("quienes");
const plantel = plantelDe(base);
const m0 = partidoDe(base)!;
const s0 = onceTitular(base, m0, plantel);

const conTitulares = tandaDePrueba("q1");
/* Y ahora el mismo partido pero terminado con otros once: el banco entero. */
const conBanco = tandaDePrueba("q1", s0.suplentes.slice(0, 11).map((j) => j.id));

console.log(`\n  Los que patean son los que terminaron el partido:\n`);
for (const [rotulo, t] of [["el once titular", conTitulares], ["once del banco", conBanco]] as const) {
  const mejores = t.candidatos.slice(0, 3)
    .map((c) => `${c.apellido} ${Math.round(c.chance * 100)}%`).join(", ");
  console.log(`  ${rotulo.padEnd(16)} ${t.candidatos.length} pateadores · los tres primeros: ${mejores}`);
}

// ------------------------------------------------ el rango entre pateadores
const ord = [...plantel].sort((a, b) => chanceDePenal(b) - chanceDePenal(a));
console.log(`\n  El mejor del plantel patea al ${Math.round(chanceDePenal(ord[0]) * 100)}% ` +
  `(${ord[0].apellido}) y el peor al ${Math.round(chanceDePenal(ord[ord.length - 1]) * 100)}% ` +
  `(${ord[ord.length - 1].apellido})`);

const fallas: string[] = [];
const dif = ganadas["el que mejor patea"] - ganadas["el que peor patea"];
/*
 * Y lo que ata esto con la calibración: `engine/temporada.ts`, que es el que
 * dice cuántas Sudamericanas se ganan, resuelve la tanda con un rng.chance(0.5)
 * porque para calibrar alcanza con eso. Si la tanda de verdad se despegara
 * mucho de la moneda, ese 0.5 pasaría a ser mentira y el 10% de títulos de
 * copa que mide `balance.ts` dejaría de valer.
 */
if (Math.abs(ganadas["el que mejor patea"] - 50) > 8) {
  fallas.push(`jugándola bien se gana el ${ganadas["el que mejor patea"].toFixed(1)}%, ` +
    `y balance.ts la calibra como una moneda`);
}
if (dif < 3) fallas.push(`elegir bien o mal casi no cambia nada (${dif.toFixed(1)} puntos)`);
if (dif > 25) fallas.push(`elegir pesa demasiado: la tanda deja de ser una tanda (${dif.toFixed(1)} puntos)`);
if (conTitulares.candidatos.length !== 11) {
  fallas.push(`patean ${conTitulares.candidatos.length} y tendrían que patear los 11 de la cancha`);
}
if (JSON.stringify(conTitulares.candidatos.map((c) => c.id).sort())
    === JSON.stringify(conBanco.candidatos.map((c) => c.id).sort())) {
  fallas.push("terminar con otros once no cambia quiénes patean");
}

console.log();
if (fallas.length) {
  console.log(`  ${fallas.length} problemas:\n`);
  for (const f of fallas) console.log(`    ${f}`);
  console.log();
  process.exitCode = 1;
} else {
  console.log("  Elegir pateador cambia la tanda, y no la decide.\n");
}

// --------------------------------------------- que no corte antes de tiempo
/*
 * En la muerte súbita los dos patean, siempre. Olimpia patea primero, así que
 * cortar apenas mete el suyo le regalaba la llave sin dejar contestar al otro:
 * es un error que solo se ve mirando la pantalla, porque el resultado igual
 * salía "coherente".
 */
let asimetricas = 0, subitas = 0;
for (let i = 0; i < 500; i++) {
  const t = tandaDePrueba(`sub-${i}`);
  let x = t, v = 0;
  while (!estadoTanda(x).termino && v < 40) { x = patearPenal(x, pateadoresLibres(x)[0].id); v++; }
  const mios = x.penales.filter((p) => p.mio).length;
  const suyos = x.penales.filter((p) => !p.mio).length;
  if (mios >= 5 && suyos >= 5) {
    subitas++;
    if (mios !== suyos) asimetricas++;
  }
}
console.log(`  De ${subitas} tandas que fueron a muerte súbita, ${asimetricas} cortaron ` +
  `sin que patee el rival`);
if (asimetricas > 0) {
  console.log(`\n  MAL: en la súbita tienen que patear los dos\n`);
  process.exitCode = 1;
}
