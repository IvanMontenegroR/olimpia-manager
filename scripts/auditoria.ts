/**
 * Lo que de verdad se lee en cada decisión, opción por opción.
 *
 * `decisiones.ts` ya busca opciones dominadas comparando las tres monedas.
 * Esto es más crudo y más útil para mirar con los ojos: imprime EXACTAMENTE
 * los chips que la pantalla dibuja, que es lo único que el jugador tiene para
 * decidir. Sirve para encontrar el caso que se cuela: una apuesta que no
 * promete nada, una opción donde no pasa nada, dos ramas iguales.
 *
 *   npx tsx scripts/auditoria.ts
 */

import { TODAS, type Efecto } from "../engine/situaciones.ts";
import { Rng } from "../engine/rng.ts";
import { nivelSi, ovrDe, partidaNueva, plantelDe, type Partida } from "../lib/temporada.ts";

const p: Partida = partidaNueva("audit");
const plantel = plantelDe(p);

/*
 * Los mismos chips que arma `Efectos`, pero acá en texto. El nivel sale de
 * aplicar el efecto sobre una copia y medir, igual que la pantalla.
 */
function chips(e: Efecto | undefined): string[] {
  if (!e) return [];
  const out: string[] = [];
  // el mismo formato que dibuja `Efectos`: un decimal siempre
  const n = Math.round(nivelSi(p, e) * 10) / 10;
  if (Math.abs(n) >= 0.05) out.push(`${n > 0 ? "+" : "−"}${Math.abs(n).toFixed(1)} nivel`);
  if (e.dineroUsd) out.push(`${e.dineroUsd > 0 ? "+" : "−"}${Math.abs(e.dineroUsd / 1e6).toFixed(2)}M`);
  if (e.paciencia) out.push(`${e.paciencia > 0 ? "+" : "−"}${Math.abs(e.paciencia)} dirigencia`);
  if (e.suspendeA) out.push("se pierde 1 partido");
  if (e.traerPibe || e.ofreceBrasileno || e.subirDeReserva) out.push("trae un jugador");
  return out;
}

const problemas = new Set<string>();

/*
 * Cada situación se arma con veinte semillas distintas.
 *
 * Las que eligen un jugador al azar cambian de cara según a quién agarren, y
 * ahí está el defecto que se escapa: la misma decisión muestra "+0.7 nivel"
 * cuando le toca un titular y NADA cuando le toca uno del banco, porque lo que
 * promete es moral de alguien que no juega. Con una sola semilla se ve la
 * versión buena y el caso roto no aparece nunca.
 */
for (const S of TODAS) {
 for (let semilla = 0; semilla < 20; semilla++) {
  const ctx = {
    plantel, ambiente: p.ambiente, hinchada: p.hinchada,
    racha: ["G", "G", "G"] as ("G" | "E" | "P")[], posicion: 3,
    esSemanaDeClasico: true, faltanDias: 3, vistas: [] as string[],
  };
  let armada;
  try { armada = S.armar(ctx as never, new Rng(`a-${S.id}-${semilla}`)); } catch { continue; }
  if (!armada) continue;
  const { s, efectos } = armada;

  if (semilla === 0) console.log(`\n  ${s.titulo}`);
  let vacias = 0;
  const sinChips: string[] = [];
  for (const o of s.opciones) {
    const e = efectos?.[o.id];
    const bien = chips(e);
    const mal = o.apuesta && e?.siSaleMal ? chips(e.siSaleMal) : null;
    const linea = mal
      ? `bien: ${bien.join(", ") || "nada"}   |   mal: ${mal.join(", ") || "nada"}`
      : bien.join(", ") || "nada";
    if (semilla === 0) {
      console.log(`    ${o.etiqueta.slice(0, 30).padEnd(32)} ${
        o.apuesta ? `${Math.round(o.apuesta.exito * 100)}%` : "  —"}  ${linea}`);
    }

    /*
     * Una apuesta sin premio no es una apuesta.
     *
     * Si el lado bueno no promete nada, arriesgar es puro costo: la única
     * jugada racional es no elegirla nunca, y entonces sobra. Es el mismo
     * defecto que una opción donde no pasa nada, solo que disfrazado de
     * porcentaje.
     */
    /*
     * Una apuesta sin premio no es una apuesta: arriesgar es puro costo y la
     * jugada racional es no elegirla nunca.
     *
     * "No hacer nada" en cambio SÍ es una opción legítima cuando la otra
     * cuesta algo: dejar pasar al pibe del interior te ahorra los noventa mil,
     * y eso es un motivo. Lo que no puede pasar es que TODAS las opciones de
     * una situación no hagan nada, porque ahí no hay nada que elegir.
     */
    if (o.apuesta && !bien.length) {
      problemas.add(`${s.id}/${o.id}: es una apuesta y si sale bien NO PASA NADA`);
    }
    if (mal && JSON.stringify(bien) === JSON.stringify(mal)) {
      problemas.add(`${s.id}/${o.id}: sale igual bien que mal`);
    }
    vacias += bien.length ? 0 : 1;
    if (!bien.length) sinChips.push(o.etiqueta);
  }
  if (vacias === s.opciones.length) {
    problemas.add(`${s.id}: NINGUNA de sus opciones hace nada`);
  }
  /*
   * Una opción pelada al lado de otras con números.
   *
   * No es lo mismo que "no hacer nada": es que la fila se lee distinto. Donde
   * las demás muestran "+1.3 nivel - −60k", esta muestra una frase y nada, y
   * el ojo no la puede comparar con las otras. A veces es correcto (dejar
   * pasar al pibe no cuesta nada) y a veces es que le falta decir lo suyo.
   */
  if (sinChips.length && sinChips.length < s.opciones.length) {
    problemas.add(`${s.id}: "${sinChips.join('", "')}" no muestra números y las otras sí`);
  }
 }
}

console.log();
if (!problemas.size) {
  console.log("  Ninguna decisión es de mentira.\n");
} else {
  console.log(`  ${problemas.size} sin sentido:\n`);
  for (const x of problemas) console.log(`    ${x}`);
  console.log();
  process.exitCode = 1;
}

void ovrDe;
