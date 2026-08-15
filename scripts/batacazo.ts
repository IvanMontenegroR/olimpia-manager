/**
 * ¿Se le puede ganar a uno que vale más?
 *
 * La fantasía del juego es levantar una copa internacional, y para eso hay que
 * pasar por River, Boca o el Mineiro, que valen más que Olimpia. Este script
 * mide si eso es posible y con qué, para no responderlo de memoria.
 *
 *   npx tsx scripts/batacazo.ts
 */

import { P, fuerzas, ovrDelOnce, simularPartido } from "../engine/motor.ts";
import { Rng } from "../engine/rng.ts";
import { partidaNueva, partidoDe, plantelDe } from "../lib/temporada.ts";
import { salidaAutomatica } from "../lib/juego.ts";
import type { Actitud, Alineacion, ContextoPartido, Jugador } from "../engine/tipos.ts";

const N = 4000;

const base = partidaNueva();
const partido = partidoDe(base)!;
const sal = salidaAutomatica(partido, plantelDe(base), { minutos: 0, partidosRestantes: 22 });

/** El once de Olimpia con el ánimo y las piernas que se le digan. */
function once(animo: number, condicion: number): Jugador[] {
  return sal.once.map((j) => ({ ...j, animo, condicion }));
}

function ali(jug: Jugador[], actitud: Actitud): Alineacion {
  return { once: jug, suplentes: sal.suplentes, actitud, puestos: sal.puestos };
}

function ctxDe(o: Partial<ContextoPartido>): ContextoPartido {
  return {
    ...partido.ctx, competencia: "sudamericana", esLocal: true, neutral: false,
    alturaM: 43, viajeKm: 0, hinchada: 70, ocupacion: 0.8, ...o,
  };
}

/** Cuántas veces gana Olimpia un partido suelto. */
function tasa(a: Alineacion, ctx: ContextoPartido) {
  let gana = 0, empata = 0, gf = 0, gc = 0;
  for (let i = 0; i < N; i++) {
    const r = simularPartido(a, ctx, new Rng(`b-${i}-${ctx.rivalFuerza}-${a.actitud}`));
    if (r.golesOlimpia > r.golesRival) gana++;
    else if (r.golesOlimpia === r.golesRival) empata++;
    gf += r.golesOlimpia; gc += r.golesRival;
  }
  return { gana: gana / N, empata: empata / N, gf: gf / N, gc: gc / N };
}

/** La serie de ida y vuelta, como se juega la copa de verdad. */
/**
 * La serie de ida y vuelta. `visita` y `local` van por separado porque la copa
 * se juega así: se aguanta afuera y se define en casa.
 */
function serie(a: Alineacion, rival: number,
               extra: Partial<ContextoPartido> = {},
               deLocal: Alineacion = a, extraLocal: Partial<ContextoPartido> = extra) {
  let pasa = 0;
  for (let i = 0; i < N; i++) {
    const v = simularPartido(a, ctxDe({ rivalFuerza: rival, esLocal: false, ...extra }),
                             new Rng(`s-v-${i}-${rival}`));
    const l = simularPartido(deLocal, ctxDe({ rivalFuerza: rival, esLocal: true, ...extraLocal }),
                             new Rng(`s-l-${i}-${rival}`));
    const mios = v.golesOlimpia + l.golesOlimpia;
    const suyos = v.golesRival + l.golesRival;
    // el empate global se define por penales, que es medio y medio
    if (mios > suyos || (mios === suyos && new Rng(`p-${i}-${rival}`).chance(0.5))) pasa++;
  }
  return pasa / N;
}

const pct = (x: number) => `${(x * 100).toFixed(0)}%`.padStart(4);

const normal = ali(once(70, 100), "equilibrado");
const miOvr = ovrDelOnce(normal, ctxDe({ rivalFuerza: 70, esLocal: true }));
console.log(`\n  Olimpia llega a la copa con OVR ${miOvr.toFixed(0)}\n`);

console.log("  UN PARTIDO SUELTO, EQUILIBRADO");
console.log("    rival   de local        de visitante        te hacen");
const recibeAfuera: number[] = [];
for (const rival of [66, 70, 74, 78, 82]) {
  const l = tasa(normal, ctxDe({ rivalFuerza: rival, esLocal: true }));
  const v = tasa(normal, ctxDe({ rivalFuerza: rival, esLocal: false }));
  recibeAfuera.push(v.gc);
  console.log(`     ${String(rival).padEnd(6)} gana ${pct(l.gana)} emp ${pct(l.empata)}` +
    `   gana ${pct(v.gana)} emp ${pct(v.empata)}      ${v.gc.toFixed(2)}`);
}

/*
 * El rival tiene que seguir importando contra los que valen más.
 *
 * Se mide en goles recibidos de visitante y no en partidos ganados. A esa
 * altura Olimpia gana afuera un 7% u 8% contra cualquiera: las victorias se
 * apilan contra el piso de la varianza y ahí un 74 y un 82 se parecen aunque
 * el motor los distinga bien. Los goles no tienen ese piso.
 *
 * Con la diferencia de nivel cortada en seco, un 74 y un 82 te hacían los
 * mismos goles (1.98 contra 2.00): el rival desaparecía justo en los partidos
 * donde más tiene que pesar.
 */
const masGoles = recibeAfuera[4] - recibeAfuera[2];   // del 74 al 82
if (masGoles < 0.10) {
  console.log(`\n  ⚠ el rival dejó de importar: de visitante un 74 te hace` +
    ` ${recibeAfuera[2].toFixed(2)} goles y un 82 ${recibeAfuera[4].toFixed(2)}, o sea lo mismo`);
  process.exitCode = 1;
}



console.log("\n  PASAR LA SERIE (ida y vuelta)\n");
console.log("    rival   así nomás   con todo a favor   diferencia");
for (const rival of [66, 70, 74, 78, 82]) {
  const pelado = serie(normal, rival);
  /*
   * Todo a favor: el plantel encendido, el Defensores lleno y a precio
   * popular, y aguantar de visitante para ir a definir a casa.
   */
  /*
   * Con todo a favor y jugada como se juega una copa: afuera se aguanta con el
   * plantel concentrado allá, y en casa se sale a definir con el Defensores
   * lleno.
   */
  const conTodo = serie(
    ali(once(92, 100), "defensivo"), rival, { aclimatacion: 1 },
    ali(once(92, 100), "equilibrado"), { hinchada: 95, ocupacion: 1 });
  console.log(`     ${String(rival).padEnd(6)}   ${pct(pelado)}         ${pct(conTodo)}` +
    `            +${((conTodo - pelado) * 100).toFixed(0)} puntos`);
}

console.log("\n  QUÉ APORTA CADA PALANCA, contra un rival de 76\n");
const R = 76;
const refL = tasa(normal, ctxDe({ rivalFuerza: R, esLocal: true })).gana;
const palancas: [string, () => number][] = [
  ["el plantel encendido (ánimo 92)", () => tasa(ali(once(92, 100), "equilibrado"), ctxDe({ rivalFuerza: R, esLocal: true })).gana],
  ["el vestuario roto (ánimo 40)", () => tasa(ali(once(40, 100), "equilibrado"), ctxDe({ rivalFuerza: R, esLocal: true })).gana],
  ["el Defensores lleno y a full", () => tasa(normal, ctxDe({ rivalFuerza: R, esLocal: true, hinchada: 95, ocupacion: 1 })).gana],
  ["la cancha a medio llenar", () => tasa(normal, ctxDe({ rivalFuerza: R, esLocal: true, hinchada: 40, ocupacion: 0.45 })).gana],
  ["salir a aguantar", () => tasa(ali(once(70, 100), "defensivo"), ctxDe({ rivalFuerza: R, esLocal: true })).gana],
  ["ir al frente", () => tasa(ali(once(70, 100), "ofensivo"), ctxDe({ rivalFuerza: R, esLocal: true })).gana],
  ["un refuerzo que suba 3 el OVR", () => tasa(ali(once(70, 100).map((j) => ({ ...j, nivel: j.nivel + 3 })), "equilibrado"), ctxDe({ rivalFuerza: R, esLocal: true })).gana],
];
console.log(`    de base, de local contra 76: gana ${pct(refL)}`);
for (const [que, medir] of palancas) {
  const v = medir();
  const d = (v - refL) * 100;
  console.log(`      ${que.padEnd(34)} ${pct(v)}   ${d >= 0 ? "+" : ""}${d.toFixed(0)}`);
}

void P; void fuerzas;
