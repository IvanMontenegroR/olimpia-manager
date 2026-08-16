/**
 * ¿La formación, la actitud y los cambios hacen algo de verdad?
 *
 * Es la pregunta que hay que poder contestar con números y no con "sí, algo
 * hace". Acá se juega la MISMA fecha mil veces cambiando una sola cosa por
 * vez, con los mismos once jugadores, y se mira qué pasa con los goles.
 *
 *   npx tsx scripts/tactica.ts
 */

import { simularPartido, ovrDelOnce } from "../engine/motor.ts";
import { Rng } from "../engine/rng.ts";
import { MOLDE_DE, repartirEnMolde } from "../lib/juego.ts";
import { partidaNueva, partidoDe, plantelDe } from "../lib/temporada.ts";
import type { Actitud, Alineacion, Jugador, Posicion } from "../engine/tipos.ts";

const N = 4000;
const p = partidaNueva("tactica");
const plantel = plantelDe(p);
const m = partidoDe(p)!;
const ctx = m.ctx;

const libres = plantel.filter((j) => !j.reserva && !j.lesionado_hasta && !j.suspendido);

/** Los once mejores, repartidos en el molde que se pida. */
function armar(formacion: string, actitud: Actitud = "equilibrado"): Alineacion {
  const slots = MOLDE_DE(formacion);
  const ids = repartirEnMolde(libres, slots, ctx).filter(Boolean) as string[];
  const once = ids.map((id) => libres.find((j) => j.id === id)!);
  const puestos = new Map<string, Posicion>();
  once.forEach((j, i) => puestos.set(j.id, slots[i]));
  return { once, suplentes: [], actitud, puestos };
}

function correr(a: Alineacion, etiqueta: string) {
  let gf = 0, gc = 0, gana = 0, empata = 0;
  for (let i = 0; i < N; i++) {
    const r = simularPartido(a, ctx, new Rng(`t-${i}`));
    gf += r.golesOlimpia; gc += r.golesRival;
    if (r.golesOlimpia > r.golesRival) gana++;
    else if (r.golesOlimpia === r.golesRival) empata++;
  }
  const pts = (gana * 3 + empata) / N;
  console.log(`  ${etiqueta.padEnd(30)} ovr ${ovrDelOnce(a, ctx).toFixed(1).padStart(5)}  ` +
    `mete ${(gf / N).toFixed(2)}  recibe ${(gc / N).toFixed(2)}  ` +
    `gana ${(gana / N * 100).toFixed(0)}%  ${pts.toFixed(2)} pts`);
  return { gf: gf / N, gc: gc / N, pts };
}

// ---------------------------------------------------------------- formación
console.log(`\n  === LA FORMACIÓN, con los mismos once y actitud pareja ===\n`);
for (const f of ["3-4-3", "4-3-3", "4-4-2", "4-2-3-1", "4-5-1", "5-3-2"]) {
  correr(armar(f), f);
}

/*
 * Y lo mismo de visitante contra un equipo mejor. Una formación defensiva no
 * tiene que ganar siempre: tiene que ganar ACÁ. Si el 4-3-3 rinde más en los
 * dos escenarios, elegir formación no es una decisión.
 */
console.log(`\n  === LA FORMACIÓN, de visitante contra uno mejor ===\n`);
const duro = { ...ctx, esLocal: false, rivalFuerza: 78, viajeKm: 2200, alturaM: 2600,
               diasDescanso: 3, hinchada: undefined, ocupacion: undefined };
for (const f of ["3-4-3", "4-3-3", "4-4-2", "4-5-1", "5-3-2"]) {
  const a = armar(f);
  let gf = 0, gc = 0, gana = 0, empata = 0;
  for (let i = 0; i < N; i++) {
    const r = simularPartido(a, duro, new Rng(`v-${i}`));
    gf += r.golesOlimpia; gc += r.golesRival;
    if (r.golesOlimpia > r.golesRival) gana++;
    else if (r.golesOlimpia === r.golesRival) empata++;
  }
  console.log(`  ${f.padEnd(30)} ${" ".repeat(9)}  mete ${(gf / N).toFixed(2)}  ` +
    `recibe ${(gc / N).toFixed(2)}  gana ${(gana / N * 100).toFixed(0)}%  ` +
    `${((gana * 3 + empata) / N).toFixed(2)} pts`);
}

// ---------------------------------------------------------------- actitud
console.log(`\n  === LA ACTITUD, con 4-3-3 fijo ===\n`);
for (const act of ["defensivo", "equilibrado", "ofensivo"] as Actitud[]) {
  correr(armar("4-3-3", act), act);
}

// ------------------------------------------------------------ fuera de puesto
console.log(`\n  === PONER A ALGUIEN FUERA DE PUESTO ===\n`);
const base = armar("4-3-3");
correr(base, "todos en su puesto");

/* Se cambia un solo casillero: el delantero centro lo ocupa un central. */
const central = libres.find((j) => j.posicion === "DFC" && !base.once.includes(j))!;
const delantero = base.once.find((j) => (base.puestos.get(j.id) ?? j.posicion) === "DC")!;
const torcido: Alineacion = {
  ...base,
  once: base.once.map((j) => (j.id === delantero.id ? central : j)),
  puestos: new Map([...base.puestos].map(([id, pu]) =>
    (id === delantero.id ? [central.id, pu] : [id, pu]) as [string, Posicion])),
};
correr(torcido, `un DFC (${central.apellido} ${central.nivel}) de 9`);

/* Y el mismo cambio pero con alguien de su puesto, para separar las dos cosas. */
const otroDel = libres.find((j) => j.posicion === "DC" && !base.once.includes(j))!;
const derecho: Alineacion = {
  ...base,
  once: base.once.map((j) => (j.id === delantero.id ? otroDel : j)),
  puestos: new Map([...base.puestos].map(([id, pu]) =>
    (id === delantero.id ? [otroDel.id, pu] : [id, pu]) as [string, Posicion])),
};
correr(derecho, `un DC (${otroDel.apellido} ${otroDel.nivel}) de 9`);

// ---------------------------------------------------------------- el cansancio
console.log(`\n  === UN CAMBIO DE VERDAD: entrar fresco al minuto 65 ===\n`);
const fundido: Alineacion = {
  ...base,
  once: base.once.map((j) =>
    ((base.puestos.get(j.id) ?? j.posicion) === "DC" ? { ...j, condicion: 45 } as Jugador : j)),
};
correr(fundido, "el 9 al 45% de condición");
correr(base, "el 9 entero");
console.log();
