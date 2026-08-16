/**
 * Los niveles y los rasgos, sacados de lo que pasó en la cancha.
 *
 * Hasta acá el plantel estaba cargado a ojo: yo ponía 74 y listo. Con los
 * datos de Sofascore de 2026 (Apertura, Clausura y la Sudamericana) se puede
 * anclar a algo. Lo que este script NO hace es inventar precisión donde no la
 * hay, y por eso vale la pena decir qué se descartó:
 *
 *   - El xG está solo en la Sudamericana, seis partidos de grupo, y el total
 *     por jugador va de 0.02 a 1.82. El mayor goles−xG del plantel es +0.87 y
 *     es de un central que metió un golazo de afuera. No se puede clasificar a
 *     un definidor con medio gol esperado de muestra, así que la definición
 *     sale de tiros, conversión y ocasiones claras perdidas sobre los tres
 *     torneos, que ahí sí hay volumen.
 *   - `goalsPrevented` del arquero, lo mismo: +0.34 en un solo torneo.
 *   - El rating suelto tampoco sirve como nivel. Tiene un sesgo de puesto
 *     enorme (los defensores promedian 7.11 y los delanteros 6.62 en este
 *     mismo plantel), así que solo se usa DENTRO de cada línea, nunca entre
 *     líneas, y pesado por minutos: un 7.70 de un partido no es un 7.70.
 *
 * El nivel resultante se recentra para que la media del plantel no se mueva.
 * Esto reparte de otra manera, no infla: el balance de la temporada tiene que
 * seguir dando lo mismo y `balance.ts` lo comprueba.
 *
 *   npx tsx scripts/calibrar.ts            ve qué propone
 *   npx tsx scripts/calibrar.ts --aplicar  lo escribe en el plantel
 */

import { readFileSync, writeFileSync } from "node:fs";
import { LINEA_DE, type Linea, type Posicion } from "../engine/tipos.ts";

/*
 * Los que no jugaron porque no pudieron.
 *
 * Sin esto el modelo los castiga por minutos que no hizo falta ganarse: Derlis
 * González lleva meses lesionado y sale con once minutos en todo el año. Eso
 * no dice que sea peor, dice que está roto. Se le respeta el nivel y se le
 * pone el rasgo, que es lo que de verdad describe su problema.
 */
const LESIONADOS = new Set(["Derlis González"]);

/*
 * Lo que sabe el que los ve jugar y el dato no dice.
 *
 * Sofascore mide lo que pasó en 2026, no lo que el jugador es. Un extremo que
 * jugó todo un torneo malo en un equipo que no le llegaba puntea abajo, y uno
 * que entró veinte minutos por partido en buen momento no aparece. Estas son
 * correcciones de Ivan, que los ve todos los domingos, y ganan sobre el
 * modelo: se aplican después de las dos anclas y antes de recentrar, así que
 * el orden que él pide se respeta y el balance del once no se mueve.
 */
const A_MANO: Record<string, number> = {
  "Romeo Benítez": 68, "Pedro Zarza": 66, "Eduardo Delmas": 65,
  "Rubén Lezcano": 63, "Iván Leguizamón": 63,
  "Bryan Bentaberry": 66, "Juan Ángel Vera": 64,
};

interface Torneo { [k: string]: number }
interface Fila { id: number; nombre: string; posicion: string; dorsal: string;
                 torneos: Record<string, Torneo> }

const SOFA: Fila[] = JSON.parse(readFileSync("data/sofascore_2026.json", "utf8"));
const RUTA = "data/plantel_olimpia_2026.json";
const PLANTEL: Record<string, unknown>[] = JSON.parse(readFileSync(RUTA, "utf8"));

const sinTildes = (t: string) =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Suma de una métrica en los tres torneos. */
const S = (f: Fila, k: string) =>
  Object.values(f.torneos).reduce((s, t) => s + (t[k] ?? 0), 0);
const por90 = (f: Fila, k: string) => {
  const m = S(f, "minutesPlayed");
  return m ? (S(f, k) / m) * 90 : 0;
};
/** El rating pesado por minutos: uno de 7.70 en un partido no es un 7.70. */
const rating = (f: Fila) => {
  const tot = S(f, "totalRating"), n = S(f, "countRating");
  return n ? tot / n : null;
};

// ---------------------------------------------------------------- el cruce
interface Par { f: Fila; j: Record<string, unknown>; linea: Linea }
const pares: Par[] = [];
const sinDato: Record<string, unknown>[] = [];
for (const j of PLANTEL) {
  const ap = sinTildes(j.apellido as string);
  const nom = sinTildes(j.nombre as string);
  const f = SOFA.find((x) => {
    const partes = sinTildes(x.nombre).split(" ");
    return partes.at(-1) === ap && partes[0] === nom.split(" ")[0];
  }) ?? SOFA.find((x) => sinTildes(x.nombre).split(" ").at(-1) === ap);
  if (f) pares.push({ f, j, linea: LINEA_DE[j.posicion as Posicion] });
  else sinDato.push(j);
}

// ---------------------------------------------------------------- el nivel
/*
 * Dos anclas, porque cada una tapa el agujero de la otra.
 *
 * El rating dice qué tan bien jugó cuando jugó, pero no vale entre puestos y
 * con pocos minutos es ruido. Los minutos dicen cuánto confía el técnico en
 * él, que es lo que un manager de verdad ve, pero no distinguen al que juega
 * todo porque es bueno del que juega todo porque no hay otro.
 */
const linea = (l: Linea) => pares.filter((p) => p.linea === l);
const prom = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const desvio = (xs: number[]) => {
  const m = prom(xs);
  return Math.sqrt(prom(xs.map((x) => (x - m) ** 2))) || 1;
};

interface Prop { p: Par; antes: number; crudo: number; nivel: number; rasgos: string[] }
const props: Prop[] = [];

for (const p of pares) {
  const g = linea(p.linea);
  const rs = g.map((x) => rating(x.f)).filter((x): x is number => x !== null);
  const r = rating(p.f);
  const min = S(p.f, "minutesPlayed");
  const nivelesDeLaLinea = g.map((x) => x.j.nivel as number);

  // con menos de 900 minutos el rating pesa a medias, y con 100 casi nada
  const confianza = Math.min(1, min / 900);
  /*
   * Con menos de cuatro en la línea el z-score es un artefacto: con dos, uno
   * siempre da +1 y el otro −1 sin importar la diferencia real. Los arqueros
   * caen justo ahí, así que se ordenan por minutos y nada más.
   */
  const z = r !== null && g.length >= 4 ? (r - prom(rs)) / desvio(rs) : 0;
  // cuánto de titular es, contra el que más jugó de su misma línea
  const tope = Math.max(...g.map((x) => S(x.f, "minutesPlayed")), 1);
  const lesionado = LESIONADOS.has(p.f.nombre);
  const titular = lesionado ? 0.55 : min / tope;

  const objetivo = prom(nivelesDeLaLinea) + z * 4.0 * confianza * (lesionado ? 0 : 1)
    + (titular - 0.55) * 10;
  // la mitad del camino: los datos son de UNA temporada, no la verdad revelada
  const antes = p.j.nivel as number;
  const crudo = antes * 0.5 + objetivo * 0.5;
  props.push({
    p, antes, crudo: Math.max(antes - 8, Math.min(antes + 8, crudo)), nivel: 0, rasgos: [],
  });
}

/*
 * Recentrado: el ONCE queda donde estaba, no el plantel.
 *
 * Sin esto cualquier sesgo del modelo se traduce en un equipo mejor o peor y
 * el balance de la temporada se corre sin que nadie lo haya decidido. Y el
 * ancla tiene que ser el once, no los treinta: la calibración achata la punta
 * (el que estaba en 74 baja a 66) y sube la cola, así que la media del plantel
 * puede quedar clavada mientras el equipo que sale a la cancha pierde un punto
 * y medio. Eso se vio como medio punto menos en el Clausura.
 */
const ONCE = 11;
const mediaOnce = (ns: number[]) =>
  prom([...ns].sort((a, b) => b - a).slice(0, ONCE));
const antesMedia = prom(props.map((x) => x.antes));
const objetivoOnce = mediaOnce(props.map((x) => x.antes));
let ajuste = objetivoOnce - mediaOnce(props.map((x) => x.crudo));
// el corrimiento cambia quiénes son los once, así que se asienta iterando
for (let i = 0; i < 20; i++) {
  const d = objetivoOnce - mediaOnce(props.map((x) => x.crudo + ajuste));
  if (Math.abs(d) < 0.005) break;
  ajuste += d;
}
for (const x of props) x.nivel = Math.round(x.crudo + ajuste);
/*
 * Las correcciones del DT van AL FINAL, después de recentrar. Si fueran antes,
 * el recentrado se las llevaría puestas y correr el script dos veces daría
 * números distintos; así el valor que él pidió es el que queda, y correrlo de
 * nuevo no mueve nada.
 */
for (const x of props) {
  const k = `${x.p.j.nombre} ${x.p.j.apellido}`;
  if (k in A_MANO) x.nivel = A_MANO[k];
}

// ---------------------------------------------------------------- los rasgos
for (const x of props) {
  const f = x.p.f;
  const min = S(f, "minutesPlayed");
  const tiros = S(f, "totalShots");
  const conv = tiros ? (S(f, "goals") / tiros) * 100 : 0;
  const aereos = por90(f, "aerialDuelsWon");
  const pctAereo = (S(f, "aerialDuelsWon") /
    Math.max(1, S(f, "aerialDuelsWon") + S(f, "aerialLost"))) * 100;

  // gana arriba de verdad: salta mucho Y las gana
  if (min >= 500 && aereos >= 2.5 && pctAereo >= 55) x.rasgos.push("juego_aereo");
  // se va de encima: regates completados, no intentados
  if (min >= 500 && por90(f, "successfulDribbles") >= 1.8) x.rasgos.push("desequilibrante");
  // definición: la muestra de tiros alcanza donde la de xG no llegaba
  /*
   * El plantel entero convierte 42 de 417, o sea 10.1%. Un 9% no es una
   * definición irregular, es el promedio del equipo: el umbral estaba
   * marcando como irregulares a seis jugadores normales. Irregular es el que
   * queda muy por debajo con volumen, o el que perdió muchas claras.
   */
  if (tiros >= 12 && conv >= 18) x.rasgos.push("definidor");
  else if ((tiros >= 20 && conv <= 6) || S(f, "bigChancesMissed") >= 6) {
    x.rasgos.push("definicion_irregular");
  }
  // va fuerte: es el que se gana la amarilla y después la decisión de sacarlo
  if (min >= 500 && por90(f, "fouls") >= 1.8) x.rasgos.push("va_fuerte");

  // los que no salen de estos datos se respetan tal como estaban
  for (const r of (x.p.j.rasgos as string[]) ?? []) {
    if (r === "veterano_de_copas" || r === "fragil") x.rasgos.push(r);
  }
  if (LESIONADOS.has(f.nombre)) x.rasgos.push("fragil");
  x.rasgos = [...new Set(x.rasgos)];
}

// ---------------------------------------------------------------- informe
const flecha = (d: number) => d === 0 ? "  ·  " : d > 0 ? `  ▲${d}` : `  ▼${-d}`;
console.log(`\n  ${pares.length} cruzados · ${sinDato.length} sin datos de Sofascore\n`);
console.log(`  ${"jugador".padEnd(20)} ${"pos".padEnd(4)} ${"min".padStart(5)} ` +
  `${"rat".padStart(5)}  nivel        rasgos`);
console.log("  " + "-".repeat(92));
for (const x of [...props].sort((a, b) => b.nivel - a.nivel)) {
  const f = x.p.f, j = x.p.j;
  const r = rating(f);
  console.log(`  ${(j.apellido as string).slice(0, 20).padEnd(20)} ` +
    `${(j.posicion as string).padEnd(4)} ${String(S(f, "minutesPlayed")).padStart(5)} ` +
    `${(r?.toFixed(2) ?? "—").padStart(5)}  ` +
    `${String(x.antes).padStart(2)} → ${String(x.nivel).padStart(2)}${flecha(x.nivel - x.antes)}   ` +
    x.rasgos.join(" "));
}
if (sinDato.length) {
  console.log("\n  sin datos (quedan como estaban):");
  for (const j of sinDato) console.log(`    ${j.apellido} (nivel ${j.nivel})`);
}
console.log(`\n  media del once:    ${objetivoOnce.toFixed(2)} → ` +
  `${mediaOnce(props.map((x) => x.nivel)).toFixed(2)}   (es la que mueve el balance)`);
console.log(`  media del plantel: ${antesMedia.toFixed(2)} → ` +
  `${prom(props.map((x) => x.nivel)).toFixed(2)}\n`);

// ---------------------------------------------------------------- escribir
if (process.argv.includes("--aplicar")) {
  for (const x of props) {
    x.p.j.nivel = x.nivel;
    x.p.j.rasgos = x.rasgos;
    x.p.j.minutos_ultimos_12_meses = S(x.p.f, "minutesPlayed");
  }
  writeFileSync(RUTA, JSON.stringify(PLANTEL, null, 2) + "\n");
  console.log(`  escrito en ${RUTA}\n`);
}
