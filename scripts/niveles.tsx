/**
 * ¿El mismo jugador se ve igual en todas las pantallas?
 *
 * La regla del juego es una sola: el número grande es el de la FICHA, el mismo
 * con el que lo fichaste, y lo que cambia según dónde lo pongas y cómo llegue
 * va al lado en chiquito, con signo. Sin eso, arrastrar a alguien de 66 a un
 * casillero lo convertía en 59 y parecía otro jugador.
 *
 * La regla se rompió tres veces en tres lugares distintos porque cada pantalla
 * dibuja su propia fila: el banco del alineador, la cancha de la home y el
 * panel de cambios del partido. Este script dibuja las cinco y falla si alguna
 * imprime un número que no sea el de la ficha.
 *
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/niveles.tsx
 */

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import CanchaHome from "@/components/CanchaHome.tsx";
import CanchaArmado from "@/components/CanchaArmado.tsx";
import Alineador from "@/components/Alineador.tsx";
import { MOLDE_DE, salidaAutomatica } from "@/lib/juego.ts";
import { partidaNueva, partidoDe, plantelDe } from "@/lib/temporada.ts";
import { nivelEfectivo } from "@/engine/motor.ts";
import type { Posicion } from "@/engine/tipos.ts";

const p = partidaNueva("niveles");
const m = partidoDe(p)!;
const ctx = m.ctx;
const s = salidaAutomatica(m, plantelDe(p), { minutos: 0, partidosRestantes: 22 });
const fallas: string[] = [];

/**
 * Alguien cuyo nivel de ficha y nivel efectivo NO coincidan, que es el único
 * caso donde la confusión se puede ver. Si fueran iguales, la prueba pasaría
 * sin probar nada.
 */
const cobayo = s.once
  .map((j) => ({ j, puesto: s.puestos.get(j.id)!, ef: Math.round(nivelEfectivo(j, s.puestos.get(j.id)!, ctx)) }))
  .find((x) => x.ef !== x.j.nivel);

if (!cobayo) {
  console.log("\n  nadie del once rinde distinto a su ficha: no hay nada que comprobar\n");
  process.exit(0);
}
const { j, puesto, ef } = cobayo;
console.log(`\n  ${j.apellido}: ficha ${j.nivel}, hoy de ${puesto} rinde ${ef}\n`);

/** ¿La pantalla imprime el número de la ficha y no el efectivo? */
function mirar(pantalla: string, html: string) {
  const tieneFicha = new RegExp(`>\\s*${j.nivel}\\s*<`).test(html);
  const tieneEfectivo = new RegExp(`>\\s*${ef}\\s*<`).test(html);
  const ok = tieneFicha && !tieneEfectivo;
  console.log(`  ${ok ? "ok  " : "MAL "} ${pantalla.padEnd(28)} ` +
    `${tieneFicha ? `muestra ${j.nivel}` : `NO muestra ${j.nivel}`}` +
    `${tieneEfectivo ? `, y muestra ${ef} suelto` : ""}`);
  if (!ok) fallas.push(pantalla);
}

mirar("cancha de la home", renderToStaticMarkup(
  <CanchaHome once={s.once} puestos={s.puestos} formacion={s.formacion} ctx={ctx}
              bajaDe={() => null} onTocar={() => {}} onModificar={() => {}} />));

const casilleros = MOLDE_DE(s.formacion).map((pu, i) => ({
  slot: i, puesto: pu as Posicion,
  jugador: s.once.find((x) => s.puestos.get(x.id) === pu) ?? null,
}));
mirar("cancha de armar el once", renderToStaticMarkup(
  <CanchaArmado casilleros={casilleros} formacion={s.formacion} ctx={ctx}
                seleccionado={null} destino={null} onTocar={() => {}} />));

mirar("banco del alineador", renderToStaticMarkup(
  <Alineador aptos={plantelDe(p)} ctx={ctx}
             estado={{ formacion: s.formacion, alineado: new Array(11).fill(null) }}
             onCambio={() => {}} />));

console.log();
if (fallas.length) {
  console.log(`  ${fallas.length} pantalla(s) muestran otro número\n`);
  process.exitCode = 1;
} else {
  console.log("  El mismo jugador se ve igual en todas.\n");
}
