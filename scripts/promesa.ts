/**
 * Lo que la decisión promete, ¿es lo que después se ve?
 *
 * Los momentos del partido prometen "+0.8 nivel" y el partido muestra un nivel
 * al lado de cada escudo. Son dos cuentas distintas hechas en dos archivos
 * distintos: la promesa la arma `enciende()` sobre el promedio de las fichas, y
 * el número de la pantalla sale de `ovrDelOnce`, que pasa a cada uno por su
 * puesto, su condición, su ánimo y la localía. Nada garantiza que den lo mismo,
 * y si no dan lo mismo la promesa es humo.
 *
 * Acá se arma el once, se aplica el ánimo que de verdad reparte cada opción y
 * se mide el número de la pantalla antes y después.
 *
 *   npx tsx scripts/promesa.ts
 */

import { ovrDelOnce, P } from "../engine/motor.ts";
import { partidaNueva, partidoDe, plantelDe, onceTitular } from "../lib/temporada.ts";
import type { Alineacion, Jugador } from "../engine/tipos.ts";

const p = partidaNueva("promesa");
const plantel = plantelDe(p);
const m = partidoDe(p)!;
const s = onceTitular(p, m, plantel);
const base: Alineacion = { once: s.once, suplentes: s.suplentes, actitud: "equilibrado", puestos: s.puestos };

/** La misma cuenta que hace la promesa en `momentos.ts`. */
const promete = (deAnimo: number) => {
  const media = base.once.reduce((n, x) => n + x.nivel, 0) / base.once.length;
  return media * deAnimo * P.animoPorPunto;
};

/** El once con ánimo movido, como lo arma `conLoDelPartido` en el partido. */
const conAnimo = (delta: number, aQuien?: string): Alineacion => ({
  ...base,
  once: base.once.map((j) => (!aQuien || j.id === aQuien
    ? { ...j, animo: Math.max(0, Math.min(100, j.animo + delta)) } as Jugador
    : j)),
});

const antes = ovrDelOnce(base, m.ctx);
console.log(`\n  El once arranca en ${antes.toFixed(2)}\n`);
console.log(`  ${"lo que promete".padEnd(22)}${"ánimo".padStart(7)}` +
  `${"se ve".padStart(9)}${"diferencia".padStart(12)}`);

const fallas: string[] = [];

/* Los tres empujones que reparten los momentos a TODO el equipo. */
for (const deAnimo of [1, 2, 4, 6, 7, 12]) {
  const dicho = promete(deAnimo);
  const visto = ovrDelOnce(conAnimo(deAnimo), m.ctx) - antes;
  const dif = visto - dicho;
  console.log(`  +${dicho.toFixed(1)} nivel`.padEnd(24) +
    `${deAnimo}`.padStart(5) + `  ${visto >= 0 ? "+" : ""}${visto.toFixed(2)}`.padStart(9) +
    `${dif >= 0 ? "+" : ""}${dif.toFixed(2)}`.padStart(12));
  /*
   * Medio décimo de tolerancia. La promesa usa el promedio de las fichas y la
   * pantalla usa el nivel efectivo, así que nunca van a dar idénticos: lo que
   * no puede pasar es que se despeguen tanto que el número prometido y el que
   * se ve sean dos cosas distintas.
   */
  if (Math.abs(dif) > 0.05) {
    fallas.push(`con ${deAnimo} de ánimo promete ${dicho.toFixed(1)} y se ve ${visto.toFixed(2)}`);
  }
}

/*
 * Y el golpe que va a UNO SOLO, que es el del penal. Repartido entre once, un
 * bajón de 45 al que la erra tiene que seguir viéndose en la pantalla: si no,
 * "si la erra se le viene el mundo abajo" es una frase sin consecuencia.
 */
console.log(`\n  El golpe de errar un penal, que le pega a uno solo:\n`);
for (const delta of [14, -45]) {
  const quien = base.once[7];
  const visto = ovrDelOnce(conAnimo(delta, quien.id), m.ctx) - antes;
  console.log(`  ${delta > 0 ? "la mete" : "la erra"} ${quien.apellido.padEnd(14)}` +
    `${delta}`.padStart(5) + `  ${visto >= 0 ? "+" : ""}${visto.toFixed(2)} nivel del equipo`);
  if (Math.abs(visto) < 0.08) {
    fallas.push(`errar/meter el penal mueve ${visto.toFixed(2)}, que es nada`);
  }
}

console.log();
if (fallas.length) {
  console.log(`  ${fallas.length} promesas que no se cumplen:\n`);
  for (const f of fallas) console.log(`    ${f}`);
  console.log();
  process.exitCode = 1;
} else {
  console.log("  Lo que promete la decisión es lo que se mueve en pantalla.\n");
}
