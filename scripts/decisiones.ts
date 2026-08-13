/**
 * Busca las decisiones que no son decisiones.
 *
 * Una opción existe solo si ninguna otra la tapa. Si una tiene todo bueno y la
 * de al lado todo malo, no hay nada que elegir: tocás la primera y seguís. Este
 * script puntúa cada opción de cada situación y marca las dominadas.
 *
 *   npx tsx scripts/decisiones.ts
 */

import { sortearSituacion, type Efecto, type Situacion } from "../engine/situaciones.ts";
import { Rng } from "../engine/rng.ts";
import { partidaNueva, plantelDe } from "../lib/temporada.ts";

/** Cuánto vale cada cosa, en la misma unidad, para poder compararlas. */
const PESO = {
  ambiente: 1,
  hinchada: 1,
  paciencia: 1.4,        // el prestigio es la barra que manda
  condicionTodos: 1.2,
  moral: 0.35,           // le pasa a uno solo
  dinero: 1 / 25_000,    // 25 mil dólares valen un punto de barra
  suspende: -14,         // perderse un partido
  pibe: 6,
  subir: 3,
};

function valorDe(e?: Efecto): number {
  if (!e) return 0;
  return (e.ambiente ?? 0) * PESO.ambiente
    + (e.hinchada ?? 0) * PESO.hinchada
    + (e.paciencia ?? 0) * PESO.paciencia
    + (e.condicionTodos ?? 0) * PESO.condicionTodos
    + (e.moralDe?.delta ?? 0) * PESO.moral
    + (e.dineroUsd ?? 0) * PESO.dinero
    + (e.suspendeA ? PESO.suspende : 0)
    + (e.traerPibe ? PESO.pibe : 0)
    + (e.ofreceBrasileno ? PESO.pibe : 0)
    + (e.subirDeReserva ? PESO.subir : 0);
}

/** Lo que vale una opción en promedio, contando cómo puede salir. */
function esperado(s: Situacion, opcionId: string, efectos: Record<string, Efecto>) {
  const e = efectos[opcionId];
  const ap = s.opciones.find((o) => o.id === opcionId)?.apuesta;
  if (!e) return { valor: 0, riesgo: 0 };
  if (!ap || !e.siSaleMal) return { valor: valorDe(e), riesgo: 0 };
  const bien = valorDe(e);
  const mal = valorDe(e.siSaleMal as Efecto);
  return { valor: ap.exito * bien + (1 - ap.exito) * mal, riesgo: bien - mal };
}

const base = partidaNueva();
const plantel = plantelDe(base);
const vistas = new Set<string>();
const informe: { id: string; lineas: string[]; problema: string | null }[] = [];

for (let i = 0; i < 6000 && vistas.size < 40; i++) {
  const armada = sortearSituacion({
    plantel,
    ambiente: 25 + (i % 70), hinchada: 20 + (i % 78),
    racha: [["G", "E", "P"][i % 3] as "G"],
    posicion: 1 + (i % 8),
    esSemanaDeClasico: i % 2 === 0,
    faltanDias: i % 7,
    vistas: [...vistas],
  }, new Rng(`d-${i}`));
  if (!armada || vistas.has(armada.s.id)) continue;
  vistas.add(armada.s.id);

  const { s, efectos } = armada;
  const calc = s.opciones.map((o) => ({ id: o.id, etiqueta: o.etiqueta, ...esperado(s, o.id, efectos) }));
  const mejor = Math.max(...calc.map((c) => c.valor));
  const peor = Math.min(...calc.map((c) => c.valor));
  const hayRiesgo = calc.some((c) => c.riesgo > 0);

  /*
   * Sin riesgo de por medio, si una opción vale mucho más que todas las otras
   * no hay decisión: se toca esa. El corte son ocho puntos de barra, que es lo
   * que se nota.
   */
  const brecha = mejor - peor;
  const problema = !hayRiesgo && brecha >= 8
    ? `la mejor saca ${brecha.toFixed(0)} de ventaja y no arriesga nada`
    : null;

  informe.push({
    id: s.id,
    problema,
    lineas: calc.map((c) =>
      `      ${c.etiqueta.slice(0, 30).padEnd(32)} ${c.valor >= 0 ? "+" : ""}${c.valor.toFixed(1).padStart(6)}` +
      (c.riesgo ? `   se juega ${c.riesgo.toFixed(0)}` : "")),
  });
}

const malas = informe.filter((x) => x.problema);
console.log(`\n  ${vistas.size} situaciones, ${malas.length} sin decisión real\n`);
for (const x of malas) {
  console.log(`  ${x.id}  —  ${x.problema}`);
  console.log(x.lineas.join("\n"));
  console.log();
}
console.log("  ---- las que sí tienen tensión ----");
for (const x of informe.filter((y) => !y.problema)) console.log(`    ${x.id}`);
