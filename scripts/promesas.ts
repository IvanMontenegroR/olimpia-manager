/**
 * ¿Pasa lo que la decisión prometió?
 *
 * Cada opción muestra unos chips ("+1 vestuario", "−70 mil") antes de elegir.
 * Ese número sale de la tabla de efectos; lo que de verdad ocurre sale de
 * `resolverAsunto`. Nada garantizaba que fueran lo mismo, y no lo eran: las
 * ofertas y el viaje movían el clima del vestuario sin tocar el ánimo del
 * plantel, que es el número que la pantalla principal muestra. O sea que
 * prometían un "+1 vestuario" que no aparecía nunca.
 *
 * Este script resuelve cada opción de verdad y mide el antes y el después.
 *
 *   npx tsx scripts/promesas.ts
 */

import {
  ovrDe, partidaNueva, plantelDe, resolverAsunto, type Asunto, type Partida,
} from "../lib/temporada.ts";
import { TODAS } from "../engine/situaciones.ts";
import { P } from "../engine/motor.ts";
import { Rng } from "../engine/rng.ts";

const ONCE = 11;

/** Lo que el chip de vestuario dice que va a pasar. */
function prometido(e: { ambiente?: number; moralDe?: { delta: number } } | undefined) {
  if (!e) return 0;
  return (e.ambiente ?? 0) * P.ambienteEnAnimo + (e.moralDe?.delta ?? 0) / ONCE;
}

/** El ánimo medio del once, que es el número "vestuario" de la card. */
const vestuarioDe = (p: Partida) => {
  const o = ovrDe(p);
  if (!o.once.length) return 0;
  return o.once.reduce((s, j) => s + (p.plantel[j.id]?.animo ?? j.animo), 0) / o.once.length;
};

let revisadas = 0;
const fallas: string[] = [];

for (const S of TODAS) {
  const rng = new Rng(`prom-${S.id}`);
  const base = partidaNueva();
  const ctx = {
    plantel: plantelDe(base), ambiente: base.ambiente, hinchada: base.hinchada,
    racha: [] as ("G" | "E" | "P")[], posicion: 5, esSemanaDeClasico: true,
    faltanDias: 3, vistas: [] as string[],
  };
  let armada;
  try { armada = S.armar(ctx as never, rng); } catch { continue; }
  if (!armada) continue;

  for (const op of armada.s.opciones) {
    const efecto = armada.efectos?.[op.id];
    // las apuestas se sortean adentro: acá solo se miran las que no lo son
    if (!efecto || op.apuesta) continue;

    const p: Partida = structuredClone(base);
    const asunto: Asunto = {
      id: `t-${S.id}`, tipo: "evento", dia: p.dia,
      titulo: armada.s.titulo, detalle: armada.s.contexto,
      situacion: armada.s, efectos: armada.efectos,
    };
    p.pendientes = [asunto];

    const antesVest = vestuarioDe(p);
    const antesPlata = p.dineroUsd;
    const antesHin = p.hinchada;
    const antesDir = p.paciencia;

    const d = resolverAsunto(p, asunto.id, op.id);
    revisadas++;

    const enElOnce = new Set(ovrDe(p).once.map((j) => j.id));
    const dice = prometido(
      efecto.moralDe && !enElOnce.has(efecto.moralDe.id)
        ? { ...efecto, moralDe: undefined } : efecto);
    const pasa = vestuarioDe(d) - antesVest;
    // media unidad de tolerancia: el chip está redondeado a entero
    if (Math.abs(dice - pasa) > 0.6) {
      fallas.push(`${S.id}/${op.id}  vestuario: promete ${dice.toFixed(1)}, pasa ${pasa.toFixed(1)}`);
    }
    const chequear = (que: string, prom: number, real: number) => {
      if (Math.abs(prom - real) > 0.6) {
        fallas.push(`${S.id}/${op.id}  ${que}: promete ${prom.toFixed(0)}, pasa ${real.toFixed(0)}`);
      }
    };
    chequear("plata", efecto.dineroUsd ?? 0, d.dineroUsd - antesPlata);
    chequear("hinchada", efecto.hinchada ?? 0, d.hinchada - antesHin);
    chequear("dirigencia", efecto.paciencia ?? 0, d.paciencia - antesDir);
  }
}

console.log(`\n  ${revisadas} opciones resueltas de verdad\n`);
if (!fallas.length) {
  console.log("  Todas cumplen lo que muestran.\n");
} else {
  console.log(`  ${fallas.length} prometen algo que no pasa:\n`);
  for (const f of fallas) console.log(`    ${f}`);
  console.log();
  process.exitCode = 1;
}
