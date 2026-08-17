/**
 * ¿Qué te conviene fichar?
 *
 * Mete un refuerzo del nivel que le pidas en el lugar del más flojo de esa
 * línea y juega la misma fecha seis mil veces, para ver qué cambia de verdad.
 * Sirve para contestar "¿un central de 77 me hace recibir menos goles?" con un
 * número en vez de con una intuición.
 *
 * Ojo con una trampa que me comí escribiéndolo: al refuerzo hay que darle el
 * puesto DEL CASILLERO que va a ocupar, no el de la línea. Poniéndole DFC a
 * uno que entra en el lugar del lateral izquierdo, el central de 77 hacía
 * RECIBIR 2% más, porque jugaba fuera de puesto. El resultado absurdo era la
 * prueba, no el motor.
 *
 *   npx tsx scripts/refuerzo.ts
 */

import { fuerzas, simularPartido } from "../engine/motor.ts";
import { Rng } from "../engine/rng.ts";
import { salidaAutomatica } from "../lib/juego.ts";
import { partidaNueva, partidoDe, plantelDe } from "../lib/temporada.ts";
import { LINEA_DE, type Alineacion, type Jugador, type Posicion } from "../engine/tipos.ts";

const p = partidaNueva("ref");
const m = partidoDe(p)!;
const ctx = m.ctx;
const s = salidaAutomatica(m, plantelDe(p), { minutos: 0, partidosRestantes: 22 });
const base: Alineacion = { once: s.once, suplentes: [], actitud: "equilibrado", puestos: s.puestos };
const N = 6000;

const correr = (a: Alineacion) => {
  let gf = 0, gc = 0, gana = 0, empata = 0;
  for (let i = 0; i < N; i++) {
    const r = simularPartido(a, ctx, new Rng(`r-${i}`));
    gf += r.golesOlimpia; gc += r.golesRival;
    if (r.golesOlimpia > r.golesRival) gana++;
    else if (r.golesOlimpia === r.golesRival) empata++;
  }
  return { gf: gf / N, gc: gc / N, pts: (gana * 3 + empata) / N };
};

const r0 = correr(base);
const f0 = fuerzas(base, ctx);
console.log(`\n  tu once hoy: mete ${r0.gf.toFixed(2)}  recibe ${r0.gc.toFixed(2)}  ` +
  `${r0.pts.toFixed(2)} pts   (ataque ${f0.ataque.toFixed(1)} defensa ${f0.defensa.toFixed(1)})\n`);

/** Mete un refuerzo en el lugar del más flojo de su línea. */
function con(nivel: number, puesto: Posicion): Alineacion {
  const linea = LINEA_DE[puesto];
  const suyos = base.once
    .filter((j) => LINEA_DE[base.puestos.get(j.id) ?? j.posicion] === linea)
    .sort((a, b) => a.nivel - b.nivel);
  const sale = suyos[0];
  const puestos = new Map(base.puestos);
  const slot = puestos.get(sale.id)!;
  // el refuerzo es de EL CASILLERO que va a ocupar, no de la línea en general:
  // un central puesto de lateral izquierdo juega fuera de puesto y pierde
  const nuevo: Jugador = { ...sale, id: "refuerzo", apellido: "Refuerzo", nivel, posicion: slot,
                           posiciones_secundarias: [], condicion: 100, animo: 70, rasgos: [] };
  puestos.delete(sale.id);
  puestos.set(nuevo.id, slot);
  return { ...base, once: base.once.map((j) => (j.id === sale.id ? nuevo : j)), puestos };
}

console.log(`  ${"refuerzo".padEnd(26)} ${"mete".padStart(6)} ${"recibe".padStart(7)}   ` +
  `qué cambia por partido           en las 22 fechas`);
for (const [nivel, puesto] of [[77, "DFC"], [74, "DFC"], [77, "MC"], [77, "DC"], [77, "ARQ"]] as const) {
  const sale = base.once
    .filter((j) => LINEA_DE[base.puestos.get(j.id) ?? j.posicion] === LINEA_DE[puesto])
    .sort((a, b) => a.nivel - b.nivel)[0];
  const r = correr(con(nivel, puesto));
  const dPts = r.pts - r0.pts;
  console.log(`  ${`${puesto} de ${nivel} por ${sale.apellido} ${sale.nivel}`.padEnd(26)} ` +
    `${r.gf.toFixed(2).padStart(6)} ${r.gc.toFixed(2).padStart(7)}   ` +
    `recibe ${`${((r.gc / r0.gc - 1) * 100).toFixed(0)}%`.padStart(4)}  ` +
    `mete ${`${((r.gf / r0.gf - 1) * 100).toFixed(0)}%`.padStart(4)}   ` +
    `${dPts >= 0 ? "+" : ""}${(dPts * 22).toFixed(1)} puntos, ` +
    `${((r.gc - r0.gc) * 22).toFixed(1)} goles en contra`);
}
console.log();
