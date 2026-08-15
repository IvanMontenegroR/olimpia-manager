/**
 * ¿Las decisiones del partido dicen lo que dan?
 *
 * `decisiones.ts` audita las del día a día, que muestran chips con su número.
 * Las de adentro del partido no mostraban nada de eso: solo el porcentaje de
 * que salga bien. Así, "si aguanta la cancha se prende" parecía todo riesgo y
 * ninguna ganancia, y el festejo no se entendía para qué servía.
 *
 * Este script resuelve cada opción muchas veces y mira qué produce de verdad,
 * para contrastarlo con lo que el detalle promete.
 *
 *   npx tsx scripts/momentos.ts
 */

import {
  chanceDe, generarMomento, resolverMomento, riesgoDe,
  type Momento, type TipoMomento,
} from "../engine/momentos.ts";
import { Rng } from "../engine/rng.ts";
import { partidaNueva, partidoDe, plantelDe } from "../lib/temporada.ts";
import { salidaAutomatica } from "../lib/juego.ts";

const p = partidaNueva();
const m = partidoDe(p)!;
const s = salidaAutomatica(m, plantelDe(p), { minutos: 0, partidosRestantes: 22 });
const a = { once: s.once, suplentes: s.suplentes, actitud: "equilibrado" as const, puestos: s.puestos };
const N = 3000;

const TIPOS: TipoMomento[] = [
  "penal_favor", "penal_ultima", "penal_contra", "tiro_libre", "mano_a_mano",
  "jugador_caliente", "festejo", "arquero_al_area", "cerrar_o_seguir", "rival_con_diez",
];

const fallas: string[] = [];
/** Un número en el texto es la señal de que la opción dice lo que da. */
const dicheNumero = (t: string) => /[+\-−]?\d/.test(t);

for (const tipo of TIPOS) {
  const mom: Momento | null = generarMomento(
    tipo, 60, a, m.ctx, new Rng(`au-${tipo}`), s.once[4].id, [1, 1]);
  if (!mom) { fallas.push(`${tipo}: no se pudo generar`); continue; }

  console.log(`\n  ${mom.titulo}`);
  for (const o of mom.opciones) {
    const chance = chanceDe(mom, o.id, a, m.ctx);
    const riesgo = riesgoDe(mom, o.id);
    let gol = 0, golContra = 0, roja = 0, amarilla = 0, cambio = 0, prende = 0, animo = 0;
    for (let i = 0; i < N; i++) {
      const r = resolverMomento(mom, o.id, a, m.ctx, new Rng(`r-${tipo}-${o.id}-${i}`));
      if (r.golOlimpia) gol++;
      if (r.golRival) golContra++;
      if (r.rojaA) roja++;
      if (r.amarillaA) amarilla++;
      if (r.gastaCambio) cambio++;
      if (r.enciendeAlEquipo) prende += r.enciendeAlEquipo;
      if (r.golpeAnimo) animo += r.golpeAnimo.delta;
    }
    const efectos = [
      gol ? `gol ${(gol / N * 100).toFixed(0)}%` : "",
      golContra ? `gol en contra ${(golContra / N * 100).toFixed(0)}%` : "",
      roja ? `roja ${(roja / N * 100).toFixed(0)}%` : "",
      amarilla ? `amarilla ${(amarilla / N * 100).toFixed(0)}%` : "",
      cambio ? "gasta cambio" : "",
      prende ? `enciende ${(prende / N).toFixed(1)}` : "",
      animo ? `ánimo ${(animo / N).toFixed(1)}` : "",
    ].filter(Boolean).join(", ") || "nada medible";

    console.log(`    ${o.etiqueta.slice(0, 26).padEnd(28)} ` +
      `${(chance === null ? "—" : Math.round(chance * 100) + "%").padStart(4)}  ${efectos}`);
    console.log(`      ${o.detalle}`);

    /*
     * Si la opción produce algo bueno y medible, el detalle tiene que decirlo
     * con un número. El porcentaje de arriba dice cuán probable es, no cuánto
     * vale: sin la cifra, elegir la de más chance es lo único que se puede
     * hacer.
     */
    /*
     * El gol no necesita explicación: el porcentaje de arriba ya dice todo lo
     * que hay que saber. Lo que sí hay que decir con un número es lo que no se
     * ve, que es lo que le queda al equipo después.
     */
    if (prende / N >= 1 && !dicheNumero(o.detalle)) {
      fallas.push(`${tipo}/${o.id}: enciende al equipo (${(prende / N).toFixed(1)}) ` +
        `y el detalle no dice cuánto`);
    }
    // las que solo cambian cómo te parás no producen nada que el script vea:
    // ahí el detalle es lo ÚNICO que informa, así que tiene que traer números
    const soloActitud = chance === null && !gol && !golContra && !roja && !cambio && !prende;
    if (soloActitud && !dicheNumero(o.detalle)) {
      fallas.push(`${tipo}/${o.id}: no muestra ni porcentaje ni número, solo texto`);
    }
    void riesgo;
  }
}

console.log();
if (!fallas.length) {
  console.log("  Todas dicen lo que dan.\n");
} else {
  console.log(`  ${fallas.length} no lo dicen:\n`);
  for (const f of fallas) console.log(`    ${f}`);
  console.log();
  process.exitCode = 1;
}
