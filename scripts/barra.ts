/**
 * ¿La bolilla frena donde dice el relato?
 *
 * La barra de los momentos tiene hasta tres tramos: lo verde, la franja oscura
 * de "y además te matan de contra", y el rojo común. La bolilla frenaba en un
 * punto cualquiera de todo lo que no era verde, así que podía quedar parada
 * sobre la franja de la contra mientras el relato contaba que la pelota se fue
 * larga y no pasó nada. Eso es lo que hacía que el aviso pareciera de adorno.
 *
 * Acá se prueban todas las combinaciones contra los tramos reales del juego.
 *
 *   npx tsx --tsconfig tsconfig.scripts.json scripts/barra.ts
 */

import { tramosDe } from "../components/Sorteo.tsx";
import { riesgoDe, type Momento } from "../engine/momentos.ts";

const CASOS: { que: string; tipo: string; opcion: string; chance: number }[] = [
  { que: "mano a mano, aguantar y asistir", tipo: "mano_a_mano", opcion: "aguantar", chance: 0.85 },
  { que: "tiro libre, centro al área", tipo: "tiro_libre", opcion: "centro", chance: 0.16 },
  { que: "último córner con el arquero", tipo: "arquero_al_area", opcion: "arquero", chance: 0.28 },
  { que: "penal en contra, quedarse", tipo: "penal_contra", opcion: "centro", chance: 0.25 },
  { que: "penal a favor (sin franja)", tipo: "penal_favor", opcion: "x", chance: 0.7 },
];

let fallas = 0;
console.log("\n  DÓNDE FRENA LA BOLILLA\n");

for (const c of CASOS) {
  const m = { tipo: c.tipo } as Momento;
  const r = riesgoDe(m, c.opcion);
  // varias semillas: el punto exacto adentro del tramo es lo único que varía
  for (let semilla = 1; semilla <= 40; semilla++) {
    const desenlaces: [string, boolean, boolean][] = [
      ["salió bien", true, false],
      ["falló nomás", false, false],
      ...(r ? [["pasó lo de la franja", false, true] as [string, boolean, boolean]] : []),
    ];
    for (const [nombre, exito, enRiesgo] of desenlaces) {
      const t = tramosDe({
        chance: c.chance, riesgo: r?.contra ?? null, riesgoSobre: r?.sobre ?? "fallo",
        exito, enRiesgo, semilla,
      });
      const dentro = enRiesgo ? t.donde >= t.desde && t.donde <= t.hasta
        : exito ? t.donde >= 0 && t.donde <= t.desde
          : t.donde >= t.hasta && t.donde <= 100;
      if (!dentro) {
        fallas++;
        if (fallas <= 8) {
          console.log(`    ✗ ${c.que} - ${nombre} - semilla ${semilla}: ` +
            `frena en ${t.donde.toFixed(1)}, la franja va de ${t.desde.toFixed(1)} a ${t.hasta.toFixed(1)}`);
        }
      }
    }
  }
  const t = tramosDe({
    chance: c.chance, riesgo: r?.contra ?? null, riesgoSobre: r?.sobre ?? "fallo",
    exito: true, enRiesgo: false, semilla: 1,
  });
  console.log(`    ${c.que.padEnd(34)} verde 0–${t.desde.toFixed(0)}` +
    (r ? `  franja ${t.desde.toFixed(0)}–${t.hasta.toFixed(0)} (${r.sobre})` : "  sin franja") +
    `  rojo ${t.hasta.toFixed(0)}–100`);
}

console.log();
if (fallas) {
  console.log(`  ${fallas} tiradas frenan en el tramo equivocado\n`);
  process.exitCode = 1;
} else {
  console.log("  Todas las tiradas frenan donde corresponde.\n");
}
