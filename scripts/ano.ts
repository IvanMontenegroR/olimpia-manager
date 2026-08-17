/**
 * ¿El año de dos torneos se juega entero?
 *
 * El juego duraba un Clausura, y ahora el año son un Apertura y un Clausura con
 * dos tablas que se suman al final. Eso rompe cosas que no avisan: que la tabla
 * del Clausura arrastre los resultados del Apertura, que el Apertura no termine
 * nunca, que al pasar de torneo el día no salte y te queden veinte fechas
 * apretadas en una semana, o que la acumulativa no sea la suma de las dos.
 *
 *   npx tsx scripts/ano.ts
 */

import {
  TOTAL_FECHAS, avanzarUnDia, balanceDelAno, cerrarPartido, hayPartidoHoy,
  onceTitular, partidaNueva, partidoDe, plantelDe, tablaDe, tandaAutomatica,
  type Partida,
} from "../lib/temporada.ts";
import { simularPartido } from "../engine/motor.ts";
import { Rng } from "../engine/rng.ts";

const fallas: string[] = [];
const probar = (que: string, ok: boolean) => {
  console.log(`  ${ok ? "ok  " : "MAL "} ${que}`);
  if (!ok) fallas.push(que);
};

/** Juega hasta que el año se termine, o hasta que se cuelgue. */
function jugarElAno(p0: Partida) {
  let p = p0;
  let vueltas = 0;
  const hitos: string[] = [];
  while (vueltas++ < 1200) {
    if (p.hito) { hitos.push(p.hito.titulo); p = { ...p, hito: null }; }
    if (p.tanda) { p = tandaAutomatica(p); continue; }
    if (p.torneo === "clausura" && p.fechaActual > TOTAL_FECHAS) break;

    if (hayPartidoHoy(p)) {
      const m = partidoDe(p)!;
      const s = onceTitular(p, m, plantelDe(p));
      const r = simularPartido(
        { once: s.once, suplentes: s.suplentes, actitud: "equilibrado", puestos: s.puestos },
        m.ctx, new Rng(`a-${p.dia}-${p.torneo}`));
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
  return { p, vueltas, hitos };
}

const { p, vueltas, hitos } = jugarElAno({ ...partidaNueva("ano"), ano: 2027, torneo: "apertura",
  dia: "2027-01-20", aperturaJugado: true });

console.log(`\n  Se jugó el año en ${vueltas} vueltas, terminó el ${p.dia}\n`);
probar("el año no se colgó", vueltas < 1200);
probar("se jugaron los dos torneos",
  new Set(p.resultados.map((r) => r.torneo)).size === 2);
probar(`Olimpia jugó ${TOTAL_FECHAS * 2} fechas de liga`,
  p.resultados.length === TOTAL_FECHAS * 2);

const apertura = tablaDe(p, "apertura");
const clausura = tablaDe(p, "clausura");
probar("cada tabla tiene 22 fechas por equipo",
  apertura.every((f) => f.pj === TOTAL_FECHAS) && clausura.every((f) => f.pj === TOTAL_FECHAS));
probar("las dos tablas son distintas",
  JSON.stringify(apertura.map((f) => f.id)) !== JSON.stringify(clausura.map((f) => f.id)) ||
  apertura[0].pts !== clausura[0].pts);

const b = balanceDelAno(p);
probar("la acumulativa es la suma de las dos",
  b.acumulada.every((f) => {
    const a = apertura.find((x) => x.id === f.id)!;
    const c = clausura.find((x) => x.id === f.id)!;
    return f.pts === a.pts + c.pts;
  }));
probar("el Apertura que cuenta es el que jugaste, no uno simulado",
  b.apertura.every((f) => f.pts === apertura.find((x) => x.id === f.id)!.pts));

/* Que el paso de un torneo al otro haya movido el calendario de verdad. */
const ultimaApertura = p.resultados.filter((r) => r.torneo === "apertura").length;
probar("el Apertura terminó antes de que arrancara el Clausura", ultimaApertura === TOTAL_FECHAS);
probar("hubo pantalla de fin de los dos torneos",
  hitos.filter((h) => /Apertura|Clausura/.test(h)).length >= 2);

console.log(`\n  Apertura: ${apertura.slice(0, 3).map((f) => `${f.nombre} ${f.pts}`).join(" - ")}`);
console.log(`  Clausura: ${clausura.slice(0, 3).map((f) => `${f.nombre} ${f.pts}`).join(" - ")}`);
console.log(`  Anual:    ${b.acumulada.slice(0, 3).map((f) => `${f.nombre} ${f.pts}`).join(" - ")}`);
console.log(`  Olimpia:  ${b.puestoApertura}° / ${b.puestoClausura}° / ${b.puestoAnual}° en el año`);
console.log(`  Hitos:    ${hitos.join(" - ") || "ninguno"}`);
console.log(`  Cupo:     ${b.miCupo ? `${b.miCupo.torneo} ${b.miCupo.fase}` : "sin copa"}`);

console.log();
if (fallas.length) {
  console.log(`  ${fallas.length} fallan\n`);
  process.exitCode = 1;
} else {
  console.log("  El año de dos torneos se juega entero.\n");
}
