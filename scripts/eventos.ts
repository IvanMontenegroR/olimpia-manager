/**
 * Qué te pasa en una temporada, contado. Sirve para ver la mezcla: el reclamo
 * era que todo el tiempo te compran un jugador y no pasa mucho más.
 *
 *   npx tsx scripts/eventos.ts [temporadas]
 */
import {
  TOTAL_FECHAS, avanzarUnDia, cerrarPartido, ficharEstrella, hayPartidoHoy,
  partidaNueva, partidoDe, plantelDe, rechazarEstrella, resolverAsunto,
  type CierrePartido, type Partida,
} from "../lib/temporada.ts";
import { salidaAutomatica } from "../lib/juego.ts";
import { Rng } from "../engine/rng.ts";

const temporadas = Number(process.argv[2] ?? 60);
const porTipo = new Map<string, number>();
const porSituacion = new Map<string, number>();
let conApuesta = 0, totalSituaciones = 0;

for (let s = 0; s < temporadas; s++) {
  const rng = new Rng(`ev-${s}`);
  let p: Partida = partidaNueva("fijo");
  for (let d = 0; d < 200 && !p.despedido; d++) {
    if (p.pendientes.length) {
      const a = p.pendientes[0];
      porTipo.set(a.tipo, (porTipo.get(a.tipo) ?? 0) + 1);
      if (a.situacion) {
        totalSituaciones++;
        porSituacion.set(a.situacion.id, (porSituacion.get(a.situacion.id) ?? 0) + 1);
        if (a.situacion.opciones.some((o) => o.apuesta)) conApuesta++;
      }
      const ops = Object.keys(a.efectos ?? {});
      p = resolverAsunto(p, a.id, ops.length ? rng.elegir(ops) : "");
      continue;
    }
    if (p.hito) { p = { ...p, hito: null }; continue; }
    if (p.estrella) {
      porTipo.set("estrella", (porTipo.get("estrella") ?? 0) + 1);
      p = rng.chance(0.3) ? ficharEstrella(p) : rechazarEstrella(p);
      continue;
    }
    if (hayPartidoHoy(p)) {
      const partido = partidoDe(p)!;
      const sal = salidaAutomatica(partido, plantelDe(p), {
        minutos: p.minutosSub18,
        partidosRestantes: Math.max(0, TOTAL_FECHAS - p.fechaActual + 1),
      });
      if (sal.once.length < 11) { p = avanzarUnDia(p).partida; continue; }
      const c: CierrePartido = {
        golesOlimpia: Math.floor(rng.entre(0, 4)), golesRival: Math.floor(rng.entre(0, 4)),
        minutos: new Map(sal.once.map((j) => [j.id, 90])),
        amarillas: [], rojas: [], lesionados: [], goleadores: [],
      };
      p = cerrarPartido(p, partido, c);
      continue;
    }
    p = avanzarUnDia(p).partida;
  }
}

const n = (x: number) => (x / temporadas).toFixed(1);
console.log(`\n  Por temporada, media de ${temporadas} corridas\n`);
console.log("  QUÉ TE INTERRUMPE EL DÍA");
for (const [t, v] of [...porTipo].sort((a, b) => b[1] - a[1])) {
  console.log(`    ${t.padEnd(12)} ${n(v).padStart(5)}`);
}
console.log(`\n  SITUACIONES: ${n(totalSituaciones)} por temporada, ` +
  `${Math.round((conApuesta / Math.max(1, totalSituaciones)) * 100)}% con ruleta`);
console.log(`  distintas que llegaste a ver: ${porSituacion.size} de 40\n`);
const top = [...porSituacion].sort((a, b) => b[1] - a[1]);
for (const [id, v] of top.slice(0, 8)) console.log(`    ${id.padEnd(24)} ${n(v)}`);
