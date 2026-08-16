/**
 * ¿El equipo que guardaste es el que sale a la cancha?
 *
 * Esto se rompió tres veces de tres maneras distintas, así que va acá adentro
 * y no en mi memoria:
 *
 *   1. Guardar el Titular lo mandaba al final de la lista, y como la pantalla
 *      principal dibuja `equipos[0]`, terminabas viendo el Alternativo.
 *   2. Al reabrir un equipo se lo pasaba por `repartirEnMolde`, que reparte a
 *      los once por dónde rinde mejor cada uno: el orden que habías guardado no
 *      volvía nunca, y como después se guardaba lo que estaba en pantalla, el
 *      equipo se iba corriendo solo cada vez que lo mirabas.
 *   3. Vender a alguien lo dejaba adentro de los equipos guardados.
 *
 * Los tres se ven igual desde afuera ("no se guarda") y ninguno lo agarraba
 * `humo.ts`, porque el bot juega con la salida automática y nunca abre un
 * equipo guardado.
 *
 *   npx tsx scripts/equipos.ts
 */

import {
  comoLoDejaste, guardarEquipo, onceTitular, partidaNueva, partidoDe, plantelDe,
  type EquipoGuardado, type Partida,
} from "../lib/temporada.ts";
import { MOLDE_DE } from "../lib/juego.ts";

const fallas: string[] = [];
const probar = (que: string, ok: boolean) => {
  console.log(`  ${ok ? "ok  " : "MAL "} ${que}`);
  if (!ok) fallas.push(que);
};

const p: Partida = partidaNueva("equipos");
const plantel = plantelDe(p);
const porId = new Map(plantel.map((j) => [j.id, j]));

// ---------------------------------------------------------------- el orden
/*
 * Se guarda un once a propósito raro, con los apellidos que caigan en cada
 * casillero, y se comprueba que vuelve exactamente igual. Si volviera
 * ordenado por dónde rinde cada uno, este once no sobreviviría una vuelta.
 */
const slots = MOLDE_DE("4-3-3");
const arquero = plantel.find((j) => j.posicion === "ARQ")!;
const libre = (j: { reserva?: boolean; lesionado_hasta?: string | null; suspendido?: boolean }) =>
  !j.reserva && !j.lesionado_hasta && !j.suspendido;
const decampo = plantel.filter((j) => j.posicion !== "ARQ" && libre(j))
  .sort((a, b) => a.apellido.localeCompare(b.apellido))
  .slice(0, slots.length - 1);
const mio: EquipoGuardado = {
  nombre: "Titular", formacion: "4-3-3",
  jugadores: [arquero.id, ...decampo.map((j) => j.id)],
};

const vuelta = comoLoDejaste(mio, (id) => porId.has(id));
probar("el once vuelve casillero por casillero como se guardó",
  JSON.stringify(vuelta) === JSON.stringify(mio.jugadores));

// ---------------------------------------------------------------- el lugar
let equipos: EquipoGuardado[] = [
  { nombre: "Titular", formacion: "4-3-3", jugadores: mio.jugadores },
  { nombre: "Alternativo", formacion: "4-3-3", jugadores: mio.jugadores },
];
equipos = guardarEquipo(equipos, mio);
probar("guardar el Titular no lo manda al final", equipos[0].nombre === "Titular");
probar("guardar no duplica ni pierde equipos", equipos.length === 2);

equipos = guardarEquipo(equipos, { nombre: "Copa", formacion: "4-4-2", jugadores: mio.jugadores });
probar("un equipo nuevo se agrega al final", equipos[2]?.nombre === "Copa");
probar("y el Titular sigue primero", equipos[0].nombre === "Titular");

// ------------------------------------------------------------- a la cancha
/*
 * Lo único que importa de verdad: que el once guardado sea el que juega, en
 * los mismos puestos. `onceTitular` es lo que consulta la pantalla principal
 * y lo que arma la salida del domingo.
 */
const conEquipo: Partida = { ...p, equipos: [mio] };
const partido = partidoDe(conEquipo)!;
const salida = onceTitular(conEquipo, partido, plantel);

probar("sale a la cancha el once guardado",
  JSON.stringify(salida.once.map((j) => j.id)) === JSON.stringify(mio.jugadores));
probar("y cada uno en el puesto donde lo dejaste",
  mio.jugadores.every((id, i) => salida.puestos.get(id) === slots[i]));

// ---------------------------------------------------- el que ya no está
/*
 * Un vendido o un lesionado deja un hueco, y ese hueco se llena SOLO: los diez
 * que quedan no se pueden mover de lugar por culpa del que falta.
 */
const sale = mio.jugadores[7];
const conBaja = plantel.filter((j) => j.id !== sale);
const salidaBaja = onceTitular({ ...p, equipos: [mio] }, partido, conBaja);
probar("con una baja siguen jugando los otros diez",
  mio.jugadores.filter((id) => id !== sale)
    .every((id) => salidaBaja.once.some((j) => j.id === id)));
probar("y el hueco se llena sin mover a nadie de puesto",
  mio.jugadores.filter((id) => id !== sale)
    .every((id, ) => salidaBaja.puestos.get(id) === slots[mio.jugadores.indexOf(id)]));
probar("el once sigue completo", salidaBaja.once.length === slots.length);

// -------------------------------------------------- el banco es el otro equipo
/*
 * Si salís con el Titular, el Alternativo entero se tiene que poder sentar
 * atrás. Antes el banco eran siete elegidos por nivel, así que a cuatro de los
 * once que vos habías armado no los podías poner nunca en todo el partido.
 */
const dosEquipos: EquipoGuardado[] = [
  mio,
  {
    nombre: "Alternativo", formacion: "4-3-3",
    jugadores: [
      plantel.find((j) => j.posicion === "ARQ" && j.id !== arquero.id)!.id,
      ...plantel.filter((j) => j.posicion !== "ARQ" && libre(j) &&
        !mio.jugadores.includes(j.id)).slice(0, 10).map((j) => j.id),
    ],
  },
];
const conDos = onceTitular({ ...p, equipos: dosEquipos }, partido, plantel);
const enBanco = new Set(conDos.suplentes.map((j) => j.id));
const afuera = dosEquipos[1].jugadores.filter((id) => !enBanco.has(id));

probar(`el alternativo entero llega al banco (${dosEquipos[1].jugadores.length - afuera.length}/11)`,
  afuera.length === 0);
probar("hay arquero suplente",
  conDos.suplentes.some((j) => j.posicion === "ARQ"));
probar("nadie está en el once y en el banco a la vez",
  !conDos.suplentes.some((j) => conDos.once.some((x) => x.id === j.id)));

console.log();
if (fallas.length) {
  console.log(`  ${fallas.length} fallan\n`);
  process.exitCode = 1;
} else {
  console.log("  Lo que guardás es lo que juega.\n");
}
