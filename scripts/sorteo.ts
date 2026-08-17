/**
 * ¿El cuadro de las copas tiene la forma de verdad?
 *
 * Un sorteo mal armado no tira una excepción: te deja un grupo de cinco y otro
 * de tres, o dos brasileños juntos, o una llave donde el mismo equipo juega
 * contra sí mismo, o cuatro carteles de "Ganador F3-2" apuntando a una llave
 * que no existe. Todo eso se ve recién cuando ya jugaste media copa.
 *
 *   npx tsx scripts/sorteo.ts
 */

import { CUPOS, participantesDelAno, type CupoParaguayo } from "../lib/copas.ts";
import {
  esPlaceholder, grupoQueEspera, nombreDe, resolverLlave,
  sortearLibertadores, sortearSudamericana, type CuadroCopa,
} from "../lib/sorteo.ts";

const fallas: string[] = [];
const probar = (que: string, ok: boolean) => {
  if (!ok) { console.log(`  MAL  ${que}`); fallas.push(que); }
  return ok;
};

/* Los cuatro paraguayos de cada copa, como los reparte la tabla anual. */
const PARAGUAYOS: CupoParaguayo[] = [
  { id: "olimpia", nombre: "Olimpia", torneo: "libertadores", fase: "grupos" },
  { id: "cerro_porteno", nombre: "Cerro Porteño", torneo: "libertadores", fase: "grupos" },
  { id: "libertad", nombre: "Libertad", torneo: "libertadores", fase: "fase 2" },
  { id: "guarani", nombre: "Guaraní", torneo: "libertadores", fase: "fase 1" },
  { id: "nacional", nombre: "Nacional", torneo: "sudamericana", fase: "fase previa" },
  { id: "recoleta", nombre: "Deportivo Recoleta", torneo: "sudamericana", fase: "fase previa" },
  { id: "sportivo_luqueno", nombre: "Sportivo Luqueño", torneo: "sudamericana", fase: "fase previa" },
  { id: "sportivo_ameliano", nombre: "Sportivo Ameliano", torneo: "sudamericana", fase: "fase previa" },
];

/** Lo que tiene que valer en cualquier cuadro, sortee lo que sortee. */
function revisar(c: CuadroCopa, grupos: number) {
  const t = c.torneo;
  probar(`${t}: ${grupos} grupos`, c.grupos.length === grupos);
  probar(`${t}: todos los grupos tienen 4`, c.grupos.every((g) => g.equipos.length === 4));

  /* Nadie puede estar dos veces, ni en dos grupos ni en dos llaves. */
  const enGrupos = c.grupos.flatMap((g) => g.equipos);
  const ids = enGrupos.filter((e) => !esPlaceholder(e)).map((e) => (e as { id: string }).id);
  probar(`${t}: nadie está en dos grupos`, new Set(ids).size === ids.length);

  const enLlaves = c.llaves.flatMap((l) => [l.local, l.visita])
    .filter((e) => !esPlaceholder(e)).map((e) => (e as { id: string }).id);
  probar(`${t}: nadie juega dos llaves de la misma fase`,
    new Set(enLlaves).size === enLlaves.length);
  probar(`${t}: nadie está en un grupo y también en una llave`,
    !enLlaves.some((id) => ids.includes(id)));
  probar(`${t}: nadie juega contra sí mismo`,
    c.llaves.every((l) => nombreDe(l.local) !== nombreDe(l.visita)));

  /* Dos del mismo país no comparten grupo. Es la regla que más se rompe sola. */
  const juntos = c.grupos.filter((g) => {
    const paises = g.equipos.filter((e) => !esPlaceholder(e))
      .map((e) => (e as { pais: string }).pais);
    return new Set(paises).size !== paises.length;
  });
  probar(`${t}: no hay dos del mismo país en un grupo`, juntos.length === 0);

  /* Cada cartel apunta a una llave que existe de verdad. */
  /* Los que bajan de la Libertadores apuntan a llaves de la otra copa. */
  const llaves = new Set([...c.llaves.map((l) => l.id),
                          ...c.llaves.map((l) => `perdedor-${l.id}`),
                          ...["F3-1", "F3-2", "F3-3", "F3-4"].map((x) => `perdedor-${x}`)]);
  const carteles = [...enGrupos, ...c.llaves.flatMap((l) => [l.local, l.visita])]
    .filter(esPlaceholder);
  probar(`${t}: los ${carteles.length} carteles apuntan a llaves que existen`,
    carteles.every((p) => llaves.has(p.llave)));
  /* Y ninguna llave alimenta dos casilleros, que sería clonar al ganador. */
  const apuntadas = carteles.map((p) => p.llave);
  probar(`${t}: ninguna llave alimenta dos lugares`,
    new Set(apuntadas).size === apuntadas.length);
}

// ------------------------------------------------------------ Libertadores
const { libertadores, sudamericana } = participantesDelAno("s1", 2027, PARAGUAYOS);

console.log(`\n  === LIBERTADORES: ${libertadores.length} equipos ===\n`);
for (const f of ["grupos", "fase 2", "fase 1"] as const) {
  console.log(`  ${f.padEnd(8)} ${libertadores.filter((p) => p.fase === f).length}`);
}
probar("la Libertadores tiene 47 equipos", libertadores.length === 47);
probar("28 entran directo a grupos",
  libertadores.filter((p) => p.fase === "grupos").length === 28);
probar("13 arrancan en la fase 2", libertadores.filter((p) => p.fase === "fase 2").length === 13);
probar("6 arrancan en la fase 1", libertadores.filter((p) => p.fase === "fase 1").length === 6);

const lib = sortearLibertadores(libertadores, "s1");
console.log(`\n  Llaves: ${["F1", "F2", "F3"].map((f) =>
  `${f} ${lib.llaves.filter((l) => l.fase === f).length}`).join(" · ")}\n`);
probar("3 llaves en la fase 1", lib.llaves.filter((l) => l.fase === "F1").length === 3);
probar("8 llaves en la fase 2", lib.llaves.filter((l) => l.fase === "F2").length === 8);
probar("4 llaves en la fase 3", lib.llaves.filter((l) => l.fase === "F3").length === 4);
revisar(lib, 8);

for (const g of lib.grupos.slice(0, 3)) {
  console.log(`  Grupo ${g.letra}: ${g.equipos.map(nombreDe).join(" · ")}`);
}

// ------------------------------------------------------------ Sudamericana
console.log(`\n  === SUDAMERICANA: ${sudamericana.length} equipos ===\n`);
probar("la Sudamericana tiene 44 equipos propios", sudamericana.length === 44);
probar("12 entran directo (los de Brasil y Argentina)",
  sudamericana.filter((p) => p.fase === "grupos").length === 12);
probar("32 juegan el play-off nacional",
  sudamericana.filter((p) => p.fase === "fase previa").length === 32);

const suda = sortearSudamericana(
  sudamericana, "s1", lib.llaves.filter((l) => l.fase === "F3"));
probar("16 llaves de play-off", suda.llaves.length === 16);
/* Y la que más se implementa mal: el play-off es entre clubes del mismo país. */
probar("el play-off es siempre entre dos del mismo país",
  suda.llaves.every((l) =>
    !esPlaceholder(l.local) && !esPlaceholder(l.visita) &&
    (l.local as { pais: string }).pais === (l.visita as { pais: string }).pais));
revisar(suda, 8);

for (const l of suda.llaves.slice(0, 3)) {
  console.log(`  ${l.id}: ${nombreDe(l.local)} vs ${nombreDe(l.visita)}`);
}
for (const g of suda.grupos.slice(0, 2)) {
  console.log(`  Grupo ${g.letra}: ${g.equipos.map(nombreDe).join(" · ")}`);
}

// -------------------------------------------------- que cambie cada temporada
console.log(`\n  === que no sea el mismo cuadro todos los años ===\n`);
const cuadros = new Set<string>();
let conFlamengo = 0;
for (let i = 0; i < 30; i++) {
  const { libertadores: l } = participantesDelAno(`x${i}`, 2027, PARAGUAYOS);
  cuadros.add(l.map((p) => p.id).sort().join());
  if (l.some((p) => p.id === "flamengo")) conFlamengo++;
}
probar(`el cuadro cambia en cada partida (${cuadros.size} distintos en 30)`, cuadros.size >= 25);
console.log(`  Flamengo entra el ${Math.round(conFlamengo / 30 * 100)}% de los años`);
probar("los grandes están casi siempre", conFlamengo >= 20);

/* Y que los cupos por país cierren con la tabla de la Conmebol. */
const porPais: Record<string, number> = {};
for (const p of libertadores) porPais[p.pais] = (porPais[p.pais] ?? 0) + 1;
/* Cada país pone lo suyo; los dos campeones defensores son dos de más. */
const deMas = Object.entries(CUPOS)
  .reduce((s, [pais, c]) => s + (porPais[pais] ?? 0) - (c.grupos + c.fase2 + c.fase1), 0);
probar(`cada país pone los cupos que le tocan, más los 2 campeones (sobran ${deMas})`,
  deMas === 2 && Object.entries(CUPOS).every(([pais, c]) =>
    (porPais[pais] ?? 0) >= c.grupos + c.fase2 + c.fase1));


// -------------------------- el grupo revelado es el del cartel, no otro
console.log(`\n  === ganar la previa te mete en el grupo que ya te esperaba ===\n`);
/*
 * Es la razón de ser del cartel. En enero el Grupo B dice "Ganador F3-2"; si
 * ganás la F3-2 tenés que caer en el Grupo B y en ninguno otro. Si el juego
 * sorteara el grupo recién al ganar, el sorteo de enero sería un dibujo.
 */
let todasBien = true;
for (const [cuadro, rotulo] of [[lib, "libertadores"], [suda, "sudamericana"]] as const) {
  for (const l of cuadro.llaves) {
    const esperaba = grupoQueEspera(cuadro, l.id);
    if (!esperaba) continue;
    const gana = [l.local, l.visita].find((x) => !esPlaceholder(x));
    if (!gana) continue;
    const despues = resolverLlave(cuadro, l.id, gana as never);
    const cayo = despues.grupos.find((g) =>
      g.equipos.some((x) => !esPlaceholder(x) && (x as { id: string }).id === (gana as { id: string }).id));
    if (cayo?.letra !== esperaba.letra) {
      console.log(`  MAL  ${rotulo} ${l.id}: esperaba el ${esperaba.letra} y cayó en el ${cayo?.letra}`);
      todasBien = false;
    }
  }
}
probar("el que gana una llave cae exactamente en el grupo que decía su cartel", todasBien);

/* Y que al resolverla no queden dos carteles de la misma llave dando vueltas. */
const tras = resolverLlave(lib, "F3-1",
  { id: "olimpia", nombre: "Olimpia", pais: "PAR", fuerza: 67, fase: "grupos" });
probar("resolver una llave borra su cartel del cuadro",
  !tras.grupos.some((g) => g.equipos.some((x) => esPlaceholder(x) && x.llave === "F3-1")));
probar("y no toca los otros carteles",
  tras.grupos.flatMap((g) => g.equipos).filter(esPlaceholder).length ===
  lib.grupos.flatMap((g) => g.equipos).filter(esPlaceholder).length - 1);

console.log();
if (fallas.length) {
  console.log(`  ${fallas.length} fallan\n`);
  process.exitCode = 1;
} else {
  console.log("  Los dos cuadros tienen la forma de verdad.\n");
}
