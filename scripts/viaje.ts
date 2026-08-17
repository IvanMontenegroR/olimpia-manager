/**
 * ¿El plan de viaje hace algo, y cuánto?
 *
 * Concentrar antes de un partido de visitante cuesta plata, así que la
 * pregunta es si sirve. Hace tres cosas a la vez y en proporciones muy
 * distintas: ahorra desgaste del vuelo, recorta el castigo de la altura y
 * ablanda el ambiente hostil. Este script las separa para ver cuál manda.
 *
 *   npx tsx scripts/viaje.ts
 */

import {
  desgastePorPartido, factorAltura, factorAmbienteHostil, nivelEfectivo, P,
} from "../engine/motor.ts";
import { partidaNueva, plantelDe } from "../lib/temporada.ts";
import type { ContextoPartido, Jugador } from "../engine/tipos.ts";

const p = partidaNueva("v");
const j = plantelDe(p).find((x) => x.posicion === "MC")! as Jugador;

const escenarios: [string, Partial<ContextoPartido>][] = [
  ["Brasil, sin altura   (2200 km)", { viajeKm: 2200, alturaM: 60 }],
  ["La Paz, con altura   (2400 km)", { viajeKm: 2400, alturaM: 3600 }],
  ["Buenos Aires, cerca  (1000 km)", { viajeKm: 1000, alturaM: 25 }],
];

console.log(`\n  desgaste por 90 minutos jugando de local: ` +
  `${desgastePorPartido(j, 90, { esLocal: true, viajeKm: 0, alturaM: 43 } as ContextoPartido, "equilibrado").toFixed(1)}\n`);

for (const [nombre, extra] of escenarios) {
  console.log(`  ${nombre}`);
  console.log(`    ${"plan".padEnd(22)} ${"desgaste".padStart(9)} ${"nivel".padStart(7)}   contra ir sobre la hora`);
  const base = { esLocal: false, competencia: "sudamericana", diasDescanso: 3,
                 rivalFuerza: 74, rivalNombre: "x", esClasico: false, fecha: p.dia,
                 ...extra } as ContextoPartido;
  let ref = 0, refN = 0;
  for (const [plan, acl] of [["sobre la hora", 0], ["un día antes", 0.5], ["tres días antes", 1]] as const) {
    const ctx = { ...base, aclimatacion: acl };
    const d = desgastePorPartido(j, 90, ctx, "equilibrado");
    const n = nivelEfectivo(j, "MC", ctx);
    if (!ref) { ref = d; refN = n; }
    console.log(`    ${plan.padEnd(22)} ${d.toFixed(1).padStart(9)} ${n.toFixed(1).padStart(7)}   ` +
      (acl === 0 ? "—" : `${((d / ref - 1) * 100).toFixed(0)}% de desgaste, ${(n - refN >= 0 ? "+" : "")}${(n - refN).toFixed(1)} de nivel`));
  }
  const ctxA = { ...base, aclimatacion: 0 } as ContextoPartido;
  const ctxB = { ...base, aclimatacion: 1 } as ContextoPartido;
  console.log(`    (altura ×${factorAltura(ctxA).toFixed(2)} → ×${factorAltura(ctxB).toFixed(2)}   ` +
    `ambiente hostil ×${factorAmbienteHostil(j, ctxA).toFixed(2)} → ×${factorAmbienteHostil(j, ctxB).toFixed(2)})\n`);
}
console.log(`  el viaje ahorra hasta ${(P.viajeAclimataMax * 100).toFixed(0)}% del desgaste del vuelo,`);
console.log(`  ${(P.alturaAclimataMax * 100).toFixed(0)}% del castigo de la altura y ` +
  `${(P.aclimatacionHostil * 100).toFixed(0)}% del ambiente hostil\n`);
