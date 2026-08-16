/**
 * Busca las decisiones que no son decisiones.
 *
 * Una opción existe solo si ninguna otra la tapa. Si una tiene todo bueno y la
 * de al lado todo malo, no hay nada que elegir: tocás la primera y seguís.
 *
 * La versión anterior puntuaba con unos pesos inventados acá adentro (el ánimo
 * vale 1, la condición 1.2, la plata 1 cada 25 mil) y comparaba ese puntaje.
 * El problema es que ese número no existía en ninguna pantalla: la cábala del
 * micro daba 3.2 contra −1.4 y pasaba el corte, cuando en lo que el jugador
 * de verdad lee decía "+1 nivel" contra "−0.5 nivel", o sea una obvia y la
 * otra no. Ahora se comparan exactamente los tres chips que se muestran.
 *
 * Una opción tapa a otra cuando no es peor en ninguna de las tres monedas y es
 * mejor en alguna. Con apuestas de por medio la vara sube: para tapar a otra
 * tiene que ganarle hasta cuando sale mal, porque si no el riesgo es la
 * decisión.
 *
 *   npx tsx scripts/decisiones.ts
 */

import { TODAS, type Efecto, type Situacion } from "../engine/situaciones.ts";
import { Rng } from "../engine/rng.ts";
import { nivelSi, partidaNueva, plantelDe, type Partida } from "../lib/temporada.ts";

/**
 * Lo que muestran los chips de una opción.
 *
 * `jugador` no es un chip: es traer a alguien al club. No mueve el nivel del
 * domingo porque un pibe de 17 no entra al once, pero la pantalla sí lo enseña
 * (la ruleta dice en qué nivel puede caer) y es lo que se está comprando. Sin
 * contarlo, "traerlo a probarse" figura como pagar noventa mil por nada.
 */
interface Chips { nivel: number; plata: number; dirigencia: number; jugador: number }

const chipsDe = (p: Partida, e?: Efecto): Chips => ({
  nivel: e ? nivelSi(p, e) : 0,
  plata: e?.dineroUsd ?? 0,
  dirigencia: e?.paciencia ?? 0,
  jugador: (e?.traerPibe ? 1 : 0) + (e?.ofreceBrasileno ? 1 : 0) + (e?.subirDeReserva ? 1 : 0),
});

/** Cuánto tiene que cambiar cada uno para que se note en pantalla. */
const MINIMO: Chips = { nivel: 0.05, plata: 5_000, dirigencia: 0.5, jugador: 0.5 };

/** `a` no es peor que `b` en nada, y es mejor en algo. */
function tapa(a: Chips, b: Chips): boolean {
  const peorEn = (k: keyof Chips) => a[k] < b[k] - MINIMO[k];
  const mejorEn = (k: keyof Chips) => a[k] > b[k] + MINIMO[k];
  const claves: (keyof Chips)[] = ["nivel", "plata", "dirigencia", "jugador"];
  return !claves.some(peorEn) && claves.some(mejorEn);
}

/** Lo que muestra una opción: lo seguro, o los dos desenlaces de la apuesta. */
function verDe(p: Partida, s: Situacion, id: string, efectos: Record<string, Efecto>) {
  const e = efectos[id];
  const ap = s.opciones.find((o) => o.id === id)?.apuesta;
  const bien = chipsDe(p, e);
  const mal = ap && e?.siSaleMal ? chipsDe(p, e.siSaleMal) : bien;
  return { bien, mal, esApuesta: !!ap };
}

const p = partidaNueva("fijo");
const plantel = plantelDe(p);
const problemas: string[] = [];
const sanas: string[] = [];

for (const S of TODAS) {
  const ctx = {
    plantel, ambiente: p.ambiente, hinchada: p.hinchada,
    racha: ["G", "G", "G"] as ("G" | "E" | "P")[], posicion: 3,
    esSemanaDeClasico: true, faltanDias: 3, vistas: [] as string[],
  };
  let armada;
  try { armada = S.armar(ctx as never, new Rng(`d-${S.id}`)); } catch { continue; }
  if (!armada) continue;
  const { s, efectos } = armada;

  const vistos = s.opciones.map((o) => ({
    id: o.id, etiqueta: o.etiqueta, ...verDe(p, s, o.id, efectos),
  }));

  const dominadas: string[] = [];
  for (const a of vistos) {
    for (const b of vistos) {
      if (a.id === b.id) continue;
      /*
       * Para tapar a otra hay que ganarle en el peor escenario propio; y si la
       * tapada era una apuesta, hay que ganarle también a su mejor escenario.
       * Así el riesgo sigue siendo una decisión y no un defecto.
       */
      if (tapa(a.mal, b.bien)) dominadas.push(`${b.etiqueta} nunca conviene contra ${a.etiqueta}`);
    }
  }

  const linea = vistos.map((v) =>
    `      ${v.etiqueta.slice(0, 30).padEnd(32)} nivel ${v.bien.nivel >= 0 ? "+" : ""}${v.bien.nivel.toFixed(1).padStart(5)}` +
    (v.bien.plata ? `  plata ${(v.bien.plata / 1000).toFixed(0)}k` : "") +
    (v.bien.dirigencia ? `  dirigencia ${v.bien.dirigencia > 0 ? "+" : ""}${v.bien.dirigencia}` : "") +
    (v.esApuesta ? `  (apuesta: si sale mal, nivel ${v.mal.nivel.toFixed(1)})` : ""));

  if (dominadas.length) {
    problemas.push(`  ${s.id}  —  ${[...new Set(dominadas)].join("; ")}\n${linea.join("\n")}`);
  } else {
    sanas.push(s.id);
  }
}

console.log(`\n  ${problemas.length + sanas.length} situaciones, ${problemas.length} sin decisión real\n`);
for (const x of problemas) { console.log(x); console.log(); }
if (problemas.length) process.exitCode = 1;
console.log("  ---- las que sí tienen tensión ----");
for (const id of sanas) console.log(`    ${id}`);
console.log();
