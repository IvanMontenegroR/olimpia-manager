/**
 * ¿Se pisan los jugadores en la cancha?
 *
 * Es la pregunta que venía contestándose mirando capturas, y por eso volvía:
 * se arreglaba el 5-3-2 a lo ancho y seguían pisándose las líneas a lo alto, o
 * entraba bien en el armado del once (que ocupa la pantalla entera) y se
 * amontonaba en la home (que tiene las cards arriba y le queda la mitad).
 *
 * Acá se recorren todos los tamaños de caja razonables, de un teléfono chico a
 * una tablet, y se mide la distancia real entre cada par de jugadores contra el
 * bloque que ocupa cada uno. Es geometría, no hay azar: si pasa, pasa siempre.
 *
 *   npx tsx scripts/cancha.ts
 */

import { repartirCancha } from "../lib/formacion.ts";
import { MOLDES } from "../lib/juego.ts";

/* Lo que ocupa el bloque de un jugador, del alto del aro al pie del nivel. */
const ANCHO = 66;
const ALTO = 62;

const fallas: string[] = [];
let peorX = Infinity, peorY = Infinity, peorCaso = "";

/*
 * Los dos extremos de verdad: la cancha de armar el once se come casi toda la
 * pantalla, la de la home tiene arriba las dos cards, la tira de fechas y
 * abajo la bitácora, así que le queda bastante menos.
 */
const ANCHOS = [300, 330, 360, 390, 430, 500, 640];
const ALTOS = [200, 240, 280, 320, 380, 440, 560];

for (const molde of MOLDES) {
  let peorDeEste = Infinity;
  for (const ancho of ANCHOS) {
    for (const alto of ALTOS) {
      const { ubicados, escala } = repartirCancha(molde.nombre, ancho, alto);
      if (ubicados.length !== 11) {
        fallas.push(`${molde.nombre} en ${ancho}×${alto}: salieron ${ubicados.length} y no 11`);
        continue;
      }

      const w = ANCHO * escala;
      const h = ALTO * escala;

      /*
       * Que ninguno se monte sobre las rayas.
       *
       * El rectángulo de la cancha está dibujado al 1% de cada borde, así que
       * "no salirse del div" no alcanza: los delanteros pueden quedar dentro
       * del contenedor y arriba de la línea de fondo igual. Se pide que el
       * bloque termine bien adentro, con la raya a la vista.
       */
      const RAYA = 0.03;
      for (const u of ubicados) {
        if (u.x - w / 2 < -0.5 || u.x + w / 2 > ancho + 0.5) {
          fallas.push(`${molde.nombre} en ${ancho}×${alto}: el slot ${u.slot} se sale de costado`);
          break;
        }
        if (u.y - h / 2 < alto * RAYA) {
          fallas.push(`${molde.nombre} en ${ancho}×${alto}: el slot ${u.slot} se monta sobre la ` +
            `raya de arriba (le quedan ${(u.y - h / 2).toFixed(0)}px y hacen falta ` +
            `${(alto * RAYA).toFixed(0)})`);
          break;
        }
        if (u.y + h / 2 > alto * (1 - RAYA)) {
          fallas.push(`${molde.nombre} en ${ancho}×${alto}: el slot ${u.slot} se monta sobre la ` +
            `raya de abajo`);
          break;
        }
      }

      /*
       * Dos bloques se pisan cuando se solapan en los DOS ejes a la vez. La
       * holgura es cuánto sobra en el eje donde más separados están: si es
       * negativa, hay superposición de verdad.
       */
      for (let i = 0; i < ubicados.length; i++) {
        for (let k = i + 1; k < ubicados.length; k++) {
          const a = ubicados[i], b = ubicados[k];
          const holgura = Math.max(
            Math.abs(a.x - b.x) - w,
            Math.abs(a.y - b.y) - h,
          );
          if (holgura < peorDeEste) peorDeEste = holgura;
          if (holgura < Math.min(peorX, peorY)) peorCaso = `${molde.nombre} ${ancho}×${alto}`;
          if (Math.abs(a.y - b.y) < h) peorX = Math.min(peorX, Math.abs(a.x - b.x) - w);
          if (Math.abs(a.x - b.x) < w) peorY = Math.min(peorY, Math.abs(a.y - b.y) - h);
          if (holgura < 0) {
            fallas.push(`${molde.nombre} en ${ancho}×${alto}: ` +
              `los slots ${a.slot} y ${b.slot} se pisan (${holgura.toFixed(1)}px)`);
          }
        }
      }
    }
  }
  console.log(`  ${molde.nombre.padEnd(8)} lo más justo que queda: ${peorDeEste.toFixed(1)}px`);
}

console.log(`\n  Entre vecinos de la misma línea sobran ${peorX.toFixed(1)}px`);
console.log(`  Entre líneas vecinas sobran ${peorY.toFixed(1)}px`);
console.log(`  (lo más apretado se da en ${peorCaso})`);

console.log();
if (fallas.length) {
  console.log(`  ${fallas.length} problemas:\n`);
  for (const f of [...new Set(fallas)].slice(0, 20)) console.log(`    ${f}`);
  console.log();
  process.exitCode = 1;
} else {
  console.log("  Nadie se pisa con nadie, en ningún tamaño de pantalla.\n");
}
