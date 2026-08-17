/**
 * ¿El calendario generado es un torneo de verdad?
 *
 * Un fixture mal armado no se rompe: simplemente hay un equipo que juega dos
 * veces contra el mismo, otro que juega catorce de local, o una fecha con cinco
 * partidos en vez de seis. Nada de eso tira una excepción y todo eso arruina la
 * temporada, así que se revisa acá y no mirando la pantalla.
 *
 *   npx tsx scripts/calendario.ts
 */

import EQUIPOS from "../data/equipos_2026.json" with { type: "json" };
import { calendarioDelAno, partidosDelTorneo, FECHAS_POR_TORNEO } from "../lib/calendario.ts";

const ids = (EQUIPOS as { id: string }[]).map((e) => e.id);
const N = ids.length;
const fallas: string[] = [];
const probar = (que: string, ok: boolean) => {
  if (!ok) fallas.push(que);
  return ok;
};

console.log(`\n  ${N} equipos, ${FECHAS_POR_TORNEO} fechas por torneo\n`);

for (const ano of [2027, 2028, 2031]) {
  for (const torneo of ["apertura", "clausura"] as const) {
    const ps = partidosDelTorneo(ano, torneo, "semilla-x");
    const rotulo = `${ano} ${torneo}`;

    probar(`${rotulo}: ${(N * (N - 1))} partidos`, ps.length === N * (N - 1));
    probar(`${rotulo}: ${FECHAS_POR_TORNEO} fechas`,
      new Set(ps.map((p) => p.fechaNumero)).size === FECHAS_POR_TORNEO);

    /* Cada fecha tiene a los doce jugando una vez: ni repetidos ni libres. */
    let fechasSanas = true;
    for (let f = 1; f <= FECHAS_POR_TORNEO; f++) {
      const dela = ps.filter((p) => p.fechaNumero === f);
      const juegan = dela.flatMap((p) => [p.local, p.visitante]);
      if (dela.length !== N / 2 || new Set(juegan).size !== N) fechasSanas = false;
    }
    probar(`${rotulo}: en cada fecha juegan todos, una sola vez`, fechasSanas);

    /* Todos contra todos, ida y vuelta: cada par se cruza exactamente dos veces,
       una en cada cancha. Es lo que separa un torneo de una lista de partidos. */
    const cruces = new Map<string, number>();
    for (const p of ps) cruces.set(`${p.local}|${p.visitante}`, (cruces.get(`${p.local}|${p.visitante}`) ?? 0) + 1);
    let idaYVuelta = true;
    for (const a of ids) for (const b of ids) {
      if (a === b) continue;
      if ((cruces.get(`${a}|${b}`) ?? 0) !== 1) idaYVuelta = false;
    }
    probar(`${rotulo}: cada cruce se juega una vez en cada cancha`, idaYVuelta);

    /* Y que nadie tenga once de local y once de visitante mal repartidos. */
    const locales = new Map<string, number>();
    for (const p of ps) locales.set(p.local, (locales.get(p.local) ?? 0) + 1);
    probar(`${rotulo}: todos juegan ${N - 1} de local`,
      ids.every((id) => locales.get(id) === N - 1));

    /* Las fechas avanzan en el tiempo y no se pisan. */
    const dias = [...new Set(ps.map((p) => p.dia))].sort();
    probar(`${rotulo}: las fechas van una atrás de otra`,
      dias.length === FECHAS_POR_TORNEO &&
      ps.every((p) => p.dia === dias[p.fechaNumero - 1]));

    const km = ps.filter((p) => p.visitante === "olimpia");
    console.log(`  ${rotulo.padEnd(16)} ${ps.length} partidos - ${dias[0]} a ${dias[dias.length - 1]}` +
      ` - Olimpia viaja ${km.reduce((s, p) => s + p.viajeKm, 0)} km`);
  }
}

// ------------------------------------------------------- el año entero
const ano = calendarioDelAno(2027, "semilla-x");
probar("el año tiene los dos torneos", new Set(ano.map((p) => p.torneo)).size === 2);
probar("el Apertura va antes que el Clausura",
  Math.max(...ano.filter((p) => p.torneo === "apertura").map((p) => Date.parse(p.dia))) <
  Math.min(...ano.filter((p) => p.torneo === "clausura").map((p) => Date.parse(p.dia))));

// --------------------------------------------------- 2026 sigue siendo el real
const c2026 = partidosDelTorneo(2026, "clausura", "cualquiera");
probar("el Clausura 2026 sigue siendo el de verdad",
  c2026.length === 132 && c2026.some((p) => p.dia === "2026-07-24"));
probar("y no depende de la semilla",
  JSON.stringify(partidosDelTorneo(2026, "clausura", "otra")) === JSON.stringify(c2026));

// ------------------------------------------------ cada partida, otro torneo
const a = partidosDelTorneo(2027, "apertura", "una").map((p) => `${p.local}-${p.visitante}-${p.fechaNumero}`);
const b = partidosDelTorneo(2027, "apertura", "otra").map((p) => `${p.local}-${p.visitante}-${p.fechaNumero}`);
probar("dos partidas tienen calendarios distintos", a.join() !== b.join());

console.log();
if (fallas.length) {
  console.log(`  ${fallas.length} problemas:\n`);
  for (const f of fallas) console.log(`    ${f}`);
  console.log();
  process.exitCode = 1;
} else {
  console.log("  Todos los calendarios son torneos de verdad.\n");
}
