/**
 * El reparto de cupos a las copas, que tiene más casos raros de los que parece.
 *
 * La regla se dice en dos renglones (campeones a grupos, el mejor del anual a
 * fase 2, la Copa Paraguay a fase 1, los cuatro siguientes a la Sudamericana),
 * pero abajo hay empalmes que hay que resolver y que en una temporada normal no
 * se ven nunca: que el mismo equipo gane los dos torneos, que el campeón de la
 * Copa Paraguay sea además el mejor del acumulativo, que Olimpia gane todo.
 * Esos casos existen y cuando aparecen no puede quedar un cupo sin dueño ni un
 * equipo con dos.
 *
 *   npx tsx scripts/cupos.ts
 */

import { repartirCupos, sorteoSudamericana, tablaAcumulativa, type FilaAnual } from "../lib/anual.ts";
import { partidaNueva } from "../lib/temporada.ts";

const fallas: string[] = [];
const probar = (que: string, ok: boolean) => {
  console.log(`  ${ok ? "ok  " : "MAL "} ${que}`);
  if (!ok) fallas.push(que);
};

/** Una tabla anual inventada, del primero al último. */
const ORDEN = ["olimpia", "cerro_porteno", "libertad", "guarani", "nacional", "recoleta",
               "sportivo_ameliano", "sportivo_luqueno", "sportivo_trinidense", "2_de_mayo",
               "san_lorenzo", "rubio_nu"];
const anual = (orden = ORDEN): FilaAnual[] =>
  orden.map((id, i) => ({ id, nombre: id, pts: 80 - i * 3, dg: 20 - i * 2, gf: 50 - i }));

/** Lo que siempre tiene que valer, gane quien gane. */
function revisar(caso: string, cupos: ReturnType<typeof repartirCupos>) {
  const ids = cupos.map((c) => c.id);
  probar(`${caso}: se reparten los 8 cupos`, cupos.length === 8);
  probar(`${caso}: nadie tiene dos`, new Set(ids).size === ids.length);
  probar(`${caso}: 4 a la Libertadores`,
    cupos.filter((c) => c.torneo === "libertadores").length === 4);
  probar(`${caso}: 2 van derecho a los grupos`,
    cupos.filter((c) => c.fase === "grupos").length === 2);
  probar(`${caso}: 1 a fase 2 y 1 a fase 1`,
    cupos.filter((c) => c.fase === "fase 2").length === 1 &&
    cupos.filter((c) => c.fase === "fase 1").length === 1);
  probar(`${caso}: 4 a la Sudamericana`,
    cupos.filter((c) => c.torneo === "sudamericana").length === 4);
}

console.log(`\n  === el caso normal: cuatro campeones distintos ===\n`);
const normal = repartirCupos(anual(), "cerro_porteno", "olimpia", "guarani");
revisar("normal", normal);
for (const c of normal) {
  console.log(`       ${c.nombre.padEnd(20)} ${c.torneo.padEnd(14)} ${c.fase.padEnd(11)} ${c.por}`);
}
probar("normal: el campeón del Clausura va derecho a los grupos",
  normal.find((c) => c.id === "olimpia")?.fase === "grupos");
probar("normal: el campeón de la Copa Paraguay entra por fase 1",
  normal.find((c) => c.id === "guarani")?.fase === "fase 1");

console.log(`\n  === el mismo gana los dos torneos ===\n`);
/*
 * Sobra un lugar de fase de grupos. No puede quedar vacío ni puede quedarse el
 * bicampeón con los dos: baja por el acumulativo.
 */
const bicampeon = repartirCupos(anual(), "olimpia", "olimpia", "guarani");
revisar("bicampeón", bicampeon);
for (const c of bicampeon.filter((x) => x.torneo === "libertadores")) {
  console.log(`       ${c.nombre.padEnd(20)} ${c.fase.padEnd(11)} ${c.por}`);
}
probar("bicampeón: el lugar de grupos que sobra lo toma el 2° del acumulativo",
  bicampeon.some((c) => c.id === "cerro_porteno" && c.fase === "grupos"));

console.log(`\n  === el campeón de la Copa Paraguay ya está clasificado ===\n`);
/*
 * Si el que ganó la Copa Paraguay es además campeón del torneo, su cupo de
 * fase 1 no se pierde: corre al siguiente del acumulativo.
 */
const solapado = repartirCupos(anual(), "cerro_porteno", "olimpia", "olimpia");
revisar("solapado", solapado);
probar("solapado: la fase 1 corre al siguiente del acumulativo",
  solapado.some((c) => c.fase === "fase 1" && c.id !== "olimpia"));

console.log(`\n  === el campeón de la Copa Paraguay es el mejor del acumulativo ===\n`);
/*
 * Acá tiene dos caminos posibles y hay que darle el más corto: la fase 2 tiene
 * una llave y la fase 1 tiene dos. Perjudicarlo por ganar la Copa Paraguay
 * sería exactamente al revés de lo que la copa premia.
 */
const doble = repartirCupos(anual(), "guarani", "nacional", "olimpia");
revisar("doble camino", doble);
probar("doble camino: se queda con la fase 2, que es la más corta",
  doble.find((c) => c.id === "olimpia")?.fase === "fase 2");

console.log(`\n  === el sorteo de la Sudamericana ===\n`);
const llaves = sorteoSudamericana(normal, "una-semilla");
probar("se arman dos llaves", llaves.length === 2);
const enLlaves = llaves.flatMap((l) => [l.local, l.visita]);
probar("juegan los cuatro clasificados y ninguno se repite",
  new Set(enLlaves).size === 4 &&
  enLlaves.every((id) => normal.some((c) => c.torneo === "sudamericana" && c.id === id)));
for (const l of llaves) console.log(`       ${l.nombreLocal} vs ${l.nombreVisita}`);

/* Y que el sorteo dependa de la partida y no salga siempre el mismo cruce. */
const distintos = new Set(
  Array.from({ length: 40 }, (_, i) =>
    sorteoSudamericana(normal, `s${i}`).map((l) => [l.local, l.visita].sort().join("+")).sort().join(" | ")));
probar(`el sorteo cambia con la partida (${distintos.size} cruces distintos en 40)`,
  distintos.size >= 2);

console.log(`\n  === con una partida de verdad ===\n`);
const p = partidaNueva("cupos");
const s = p.semestre!;
/* Un Clausura inventado, para ver la suma de los dos semestres. */
const clausura = ORDEN.map((id, i) => ({ id, pts: 45 - i * 2, dg: 10 - i, gf: 40 - i }));
const acumulada = tablaAcumulativa(s.apertura, clausura);
probar("la acumulativa suma los doce equipos", acumulada.length === 12);
probar("la acumulativa suma los dos semestres",
  acumulada.every((f) => {
    const a = s.apertura.find((x) => x.id === f.id)!;
    const c = clausura.find((x) => x.id === f.id)!;
    return f.pts === a.pts + c.pts;
  }));
console.log(`       Apertura ${s.apertura[0].nombre} campeón - Copa Paraguay ${s.campeonCopaParaguay}`);
console.log(`       Acumulativa: ${acumulada.slice(0, 5).map((f) => `${f.nombre} ${f.pts}`).join(" - ")}`);


console.log(`\n  === Olimpia campeón de la Copa Sudamericana ===\n`);
/*
 * Ese cupo lo da la Conmebol, no la APF: es EXTRA y no le saca el lugar a
 * ningún paraguayo. Sin esto, la pantalla le decía al campeón de América que
 * tenía que jugar la fase previa de la Sudamericana.
 */
const campeonAmerica = repartirCupos(anual(), "cerro_porteno", "libertad", "guarani", "olimpia");
probar("campeón de América: Olimpia entra a los grupos de la Libertadores",
  campeonAmerica.find((c) => c.id === "olimpia")?.fase === "grupos" &&
  campeonAmerica.find((c) => c.id === "olimpia")?.torneo === "libertadores");
probar("campeón de América: no le saca el cupo a nadie, Paraguay sigue dando 4 y 4",
  campeonAmerica.filter((c) => c.torneo === "libertadores" && c.id !== "olimpia").length === 4 &&
  campeonAmerica.filter((c) => c.torneo === "sudamericana").length === 4);
probar("campeón de América: nadie tiene dos cupos",
  new Set(campeonAmerica.map((c) => c.id)).size === campeonAmerica.length);

/* Y si además sale campeón del Clausura, su cupo local baja por el acumulativo. */
const todo = repartirCupos(anual(), "cerro_porteno", "olimpia", "guarani", "olimpia");
probar("campeón de América y del Clausura: el cupo local que deja libre lo toma otro",
  new Set(todo.map((c) => c.id)).size === todo.length &&
  todo.filter((c) => c.torneo === "libertadores").length === 5 &&
  todo.filter((c) => c.torneo === "sudamericana").length === 4);

console.log();
if (fallas.length) {
  console.log(`  ${fallas.length} fallan\n`);
  process.exitCode = 1;
} else {
  console.log("  Los ocho cupos se reparten bien, pase lo que pase.\n");
}
