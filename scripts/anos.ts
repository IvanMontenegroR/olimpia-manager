/**
 * Cinco temporadas seguidas, ¿aguanta?
 *
 * Dirigir varios años rompe cosas que una temporada sola no muestra: el plantel
 * que se queda sin arqueros porque se retiraron los dos, el que envejece hasta
 * ser un equipo de sesenta, el crecimiento que se aplica dos veces, la
 * bitácora que crece hasta no entrar en el guardado. Acá se juegan cinco años
 * de corrido y se mira el plantel al final de cada uno.
 *
 *   npx tsx scripts/anos.ts
 */

import {
  EDAD_DE_RETIRO, TOTAL_FECHAS, avanzarUnDia, balanceDelAno, cerrarPartido,
  hayPartidoHoy, onceTitular, partidaNueva, partidoDe, plantelDe,
  tandaAutomatica, temporadaSiguiente, type Partida,
} from "../lib/temporada.ts";
import { simularPartido } from "../engine/motor.ts";
import { Rng } from "../engine/rng.ts";

const fallas: string[] = [];
const probar = (que: string, ok: boolean) => {
  if (!ok) { console.log(`  MAL  ${que}`); fallas.push(que); }
  return ok;
};

/** Juega el año hasta que el Clausura se termine. */
function jugarElAno(p0: Partida): Partida {
  let p: Partida = { ...p0, pretemporada: false };
  let vueltas = 0;
  while (vueltas++ < 1400) {
    if (p.hito) p = { ...p, hito: null };
    if (p.tanda) { p = tandaAutomatica(p); continue; }
    if (p.torneo === "clausura" && p.fechaActual > TOTAL_FECHAS) break;
    if (p.despedido) break;

    if (hayPartidoHoy(p)) {
      const m = partidoDe(p)!;
      const s = onceTitular(p, m, plantelDe(p));
      const r = simularPartido(
        { once: s.once, suplentes: s.suplentes, actitud: "equilibrado", puestos: s.puestos },
        m.ctx, new Rng(`m-${p.ano}-${p.dia}-${p.torneo}`));
      p = cerrarPartido(p, m, {
        golesOlimpia: r.golesOlimpia, golesRival: r.golesRival,
        minutos: new Map(s.once.map((j) => [j.id, 90])),
        amarillas: [], rojas: [], lesionados: [], goleadores: [],
        onceFinal: s.once.map((j) => j.id),
      });
    } else {
      p = avanzarUnDia(p).partida;
    }
    p = { ...p, pendientes: [] };
  }
  return p;
}

console.log(`\n  ${"año".padEnd(6)}${"plantel".padStart(8)}${"edad".padStart(7)}` +
  `${"once".padStart(6)}${"retiros".padStart(9)}  posición y copa`);

let p = partidaNueva("anos");
/* La primera es la de 2026, que arranca en el Clausura. */
for (let i = 0; i < 5; i++) {
  p = jugarElAno(p);
  if (p.despedido) { console.log(`\n  Lo echaron en ${p.ano}: ${p.despedido}`); break; }

  const b = balanceDelAno(p);
  const plantel = plantelDe(p);
  const once = [...plantel].filter((j) => !j.reserva)
    .sort((a, b2) => b2.nivel - a.nivel).slice(0, 11);
  const nivelOnce = Math.round(once.reduce((s, j) => s + j.nivel, 0) / 11);
  const edad = (plantel.reduce((s, j) => s + j.edad, 0) / plantel.length).toFixed(1);

  const siguiente = temporadaSiguiente(p);
  const retiros = (siguiente.retirados ?? []).length;

  console.log(`  ${String(p.ano).padEnd(6)}${String(plantel.length).padStart(8)}` +
    `${edad.padStart(7)}${String(nivelOnce).padStart(6)}${String(retiros).padStart(9)}  ` +
    `${b.puestoAnual}° del año · ${b.miCupo ? `${b.miCupo.torneo} ${b.miCupo.fase}` : "sin copa"}`);

  probar(`${p.ano}: queda plantel para jugar`, plantel.length >= 16);
  probar(`${p.ano}: hay por lo menos un arquero`,
    plantel.some((j) => j.posicion === "ARQ"));
  probar(`${p.ano}: nadie pasa la edad de retiro`,
    plantel.every((j) => j.edad < EDAD_DE_RETIRO));
  probar(`${p.ano}: el nivel del once es de primera división`,
    nivelOnce >= 55 && nivelOnce <= 90);
  probar(`${p.ano}: la bitácora no se desbordó`, p.bitacora.length < 4000);

  p = siguiente;
  probar(`${p.ano}: arranca en pretemporada y en el Apertura`,
    !!p.pretemporada && p.torneo === "apertura" && p.fechaActual === 1);
  probar(`${p.ano}: la tabla arranca vacía`, p.resultados.length === 0);
  probar(`${p.ano}: todos vuelven enteros`,
    plantelDe(p).every((j) => j.condicion === 100 && !j.lesionado_hasta && !j.suspendido));
}

console.log();
if (fallas.length) {
  console.log(`  ${fallas.length} fallan\n`);
  process.exitCode = 1;
} else {
  console.log("  Cinco temporadas seguidas sin romperse.\n");
}
