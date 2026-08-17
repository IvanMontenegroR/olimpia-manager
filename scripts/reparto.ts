/**
 * ¿El motor lee una sola cifra o lee las líneas por separado?
 *
 * Arma equipos con el nivel repartido a propósito (una muralla atrás con nada
 * arriba, al revés, y todo parejo) y los juega ocho mil veces. Sirve para
 * contestar si tener una defensa de 90 y un ataque de 50 hace lo que uno
 * espera, o si en el fondo el motor promedia todo y da lo mismo dónde está la
 * calidad.
 *
 *   npx tsx scripts/reparto.ts
 */

import { Rng } from "../engine/rng.ts";
import { MOLDE_DE } from "../lib/juego.ts";
import { partidaNueva, partidoDe, plantelDe } from "../lib/temporada.ts";
import { LINEA_DE, type Alineacion, type Jugador, type Linea, type Posicion } from "../engine/tipos.ts";

const p = partidaNueva("rep");
const m = partidoDe(p)!; const ctx = m.ctx;
const slots = MOLDE_DE("4-3-3");
const base = plantelDe(p).filter((j) => !j.reserva).slice(0, 11);
const N = 8000;

function equipo(niveles: Record<Linea, number>): Alineacion {
  const puestos = new Map<string, Posicion>();
  const once = slots.map((slot, i) => {
    const j: Jugador = { ...base[i], id: `p${i}`, posicion: slot, posiciones_secundarias: [],
                         nivel: niveles[LINEA_DE[slot]], condicion: 100, animo: 70, rasgos: [] };
    puestos.set(j.id, slot);
    return j;
  });
  return { once, suplentes: [], actitud: "equilibrado", puestos };
}

let ESCENARIO = ctx;
const correr = (a: Alineacion, etiqueta: string) => {
  let gf = 0, gc = 0, gana = 0, empata = 0;
  for (let i = 0; i < N; i++) {
    const r = simularPartido(a, ESCENARIO, new Rng(`x-${i}`));
    gf += r.golesOlimpia; gc += r.golesRival;
    if (r.golesOlimpia > r.golesRival) gana++;
    else if (r.golesOlimpia === r.golesRival) empata++;
  }
  const f = fuerzas(a, ESCENARIO);
  const media = a.once.reduce((s, j) => s + j.nivel, 0) / 11;
  console.log(`  ${etiqueta.padEnd(30)} ficha ${media.toFixed(1)}  ovr ${ovrDelOnce(a, ESCENARIO).toFixed(1)}  ` +
    `ataque ${f.ataque.toFixed(0)} defensa ${f.defensa.toFixed(0)}  ` +
    `mete ${(gf / N).toFixed(2)}  recibe ${(gc / N).toFixed(2)}  ` +
    `${((gana * 3 + empata) / N).toFixed(2)} pts`);
};

console.log(`\n  === DE LOCAL CONTRA UNO PAREJO (${Math.round(ctx.rivalFuerza)}) ===\n`);
correr(equipo({ ARQ: 90, DEF: 90, MED: 70, DEL: 50 }), "muralla 90 / ataque 50");
correr(equipo({ ARQ: 70, DEF: 70, MED: 70, DEL: 70 }), "todo parejo en 70");
correr(equipo({ ARQ: 50, DEF: 50, MED: 70, DEL: 90 }), "defensa 50 / ataque 90");
console.log();
console.log(`  === EL MISMO, DE VISITANTE CONTRA UNO MUY SUPERIOR ===\n`);
ESCENARIO = { ...ctx, esLocal: false, rivalFuerza: 80, viajeKm: 2200, alturaM: 2600,
              diasDescanso: 3, hinchada: undefined, ocupacion: undefined };
correr(equipo({ ARQ: 90, DEF: 90, MED: 70, DEL: 50 }), "muralla 90 / ataque 50");
correr(equipo({ ARQ: 70, DEF: 70, MED: 70, DEL: 70 }), "todo parejo en 70");
correr(equipo({ ARQ: 50, DEF: 50, MED: 70, DEL: 90 }), "defensa 50 / ataque 90");
console.log();
