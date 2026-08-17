/**
 * De dónde sale y adónde va la plata en una temporada.
 *
 * El juego pide juntar para un fichaje grande, pero nunca se midió si eso
 * cierra: cuánto entra por la puerta, cuánto por vender, cuánto mueven las
 * decisiones, y si con todo eso alcanza para lo que hay en el mercado.
 *
 *   npx tsx scripts/economia.ts [temporadas]
 */

import {
  TOTAL_FECHAS, avanzarUnDia, cerrarPartido, tandaAutomatica, fichar, ficharEstrella, hayPartidoHoy,
  partidaNueva, partidoDe, plantelDe, rechazarEstrella, resolverAsunto,
  type CierrePartido, type Partida,
} from "../lib/temporada.ts";
import { salidaAutomatica } from "../lib/juego.ts";
import { ESTRELLAS } from "../engine/estrellas.ts";
import { CATALOGO, precioDe } from "../engine/mercado.ts";
import { Rng } from "../engine/rng.ts";

const temporadas = Number(process.argv[2] ?? 60);
const M = (n: number) => `${(n / 1e6).toFixed(2)}M`;

/** Todo lo que mueve plata, sumado por concepto. */
const mov = new Map<string, { veces: number; total: number }>();
const anotar = (que: string, monto: number) => {
  const m = mov.get(que) ?? { veces: 0, total: 0 };
  m.veces++; m.total += monto;
  mov.set(que, m);
};

let picoMedio = 0, finalMedio = 0, estrellasFichadas = 0, refuerzosFichados = 0;
let vecesQueAlcanzo = 0, vecesQueAparecio = 0;

for (let s = 0; s < temporadas; s++) {
  const rng = new Rng(`eco-${s}`);
  let p: Partida = partidaNueva(`eco-${s}`);
  let pico = p.dineroUsd;
  let antes = p.dineroUsd;

  const registrar = (que: string, ahora: number) => {
    const d = ahora - antes;
    if (Math.abs(d) > 500) anotar(que, d);
    antes = ahora;
  };

  for (let d = 0; d < 200 && !p.despedido; d++) {
    if (p.pendientes.length) {
      const a = p.pendientes[0];
      const ops = a.tipo === "oferta" ? ["vender", "rechazar"]
        : a.tipo === "marketing" ? ["barato", "normal", "caro"]
        : a.tipo === "viaje" ? ["sobrelahora", "dosdias", "semana"]
        : Object.keys(a.efectos ?? {});
      const op = ops.length ? rng.elegir(ops) : "";
      p = resolverAsunto(p, a.id, op);
      registrar(a.tipo === "oferta" ? (op === "vender" ? "vender un jugador" : "rechazar oferta")
        : a.tipo === "viaje" ? "el viaje"
        : a.tipo === "marketing" ? "entradas"
        : `decisión: ${a.situacion?.id ?? "?"}`, p.dineroUsd);
      continue;
    }
    if (p.hito) { p = { ...p, hito: null }; continue; }
    if (p.estrella) {
      vecesQueAparecio++;
      const e = ESTRELLAS.find((x) => x.id === p.estrella!.id)!;
      if (p.dineroUsd >= e.precioUsd) vecesQueAlcanzo++;
      if (p.dineroUsd >= e.precioUsd && rng.chance(0.7)) {
        p = ficharEstrella(p); estrellasFichadas++;
        registrar("fichar una estrella", p.dineroUsd);
      } else p = rechazarEstrella(p);
      continue;
    }
    if (p.fichajes.length && rng.chance(0.06)) {
      const f = rng.elegir(p.fichajes);
      const t = fichar(p, f.id);
      if (t) { p = t; refuerzosFichados++; registrar("fichar del mercado", p.dineroUsd); continue; }
    }
    if (hayPartidoHoy(p)) {
      const m = partidoDe(p)!;
      const sal = salidaAutomatica(m, plantelDe(p), {
        minutos: p.minutosSub18,
        partidosRestantes: Math.max(0, TOTAL_FECHAS - p.fechaActual + 1),
      });
      if (sal.once.length < 11) { p = avanzarUnDia(p).partida; antes = p.dineroUsd; continue; }
      const c: CierrePartido = {
        golesOlimpia: Math.floor(rng.entre(0, 3)), golesRival: Math.floor(rng.entre(0, 3)),
        minutos: new Map(sal.once.map((j) => [j.id, 90])),
        amarillas: [], rojas: [], lesionados: [], goleadores: [],
      };
      p = cerrarPartido(p, m, c);
      if (p.tanda) p = tandaAutomatica(p);
      registrar(m.ctx.esLocal ? "recaudación de local" : "premios y visitante", p.dineroUsd);
      continue;
    }
    p = avanzarUnDia(p).partida;
    registrar("el día a día", p.dineroUsd);
    pico = Math.max(pico, p.dineroUsd);
  }
  picoMedio += pico;
  finalMedio += p.dineroUsd;
}

const n = (x: number) => x / temporadas;

console.log(`\n  LA PLATA, media de ${temporadas} temporadas\n`);
console.log(`    arranca con              ${M(partidaNueva("eco").dineroUsd)}`);
console.log(`    lo máximo que llega a tener  ${M(n(picoMedio))}`);
console.log(`    termina con              ${M(n(finalMedio))}`);

console.log("\n  DE DÓNDE SALE Y ADÓNDE VA (por temporada)\n");
const filas = [...mov].map(([que, m]) => ({ que, veces: n(m.veces), total: n(m.total) }))
  .sort((a, b) => Math.abs(b.total) - Math.abs(a.total));
for (const f of filas.slice(0, 14)) {
  const signo = f.total >= 0 ? "+" : "−";
  console.log(`    ${f.que.padEnd(30)} ${signo}${M(Math.abs(f.total)).padStart(7)}` +
    `   ${f.veces.toFixed(1)} veces`);
}

console.log("\n  ¿ALCANZA PARA LO QUE HAY EN EL MERCADO?\n");
const estrellas = [...ESTRELLAS].sort((a, b) => a.precioUsd - b.precioUsd);
console.log(`    la estrella más barata   ${M(estrellas[0].precioUsd)}  (${estrellas[0].apellido}, ${estrellas[0].nivel})`);
console.log(`    la mediana               ${M(estrellas[Math.floor(estrellas.length / 2)].precioUsd)}`);
console.log(`    la más cara              ${M(estrellas[estrellas.length - 1].precioUsd)}  (${estrellas[estrellas.length - 1].apellido}, ${estrellas[estrellas.length - 1].nivel})`);
const cat = CATALOGO.map((f) => precioDe(f.nivel, f.edad)).sort((a, b) => a - b);
console.log(`    refuerzo del mercado     de ${M(cat[0])} a ${M(cat[cat.length - 1])}`);
console.log();
console.log(`    aparece una estrella     ${n(vecesQueAparecio).toFixed(1)} veces por temporada`);
console.log(`    y te alcanzaba           ${vecesQueAparecio ? Math.round(vecesQueAlcanzo / vecesQueAparecio * 100) : 0}% de esas veces`);
console.log(`    terminás fichando        ${n(estrellasFichadas).toFixed(2)} estrellas y ${n(refuerzosFichados).toFixed(1)} refuerzos`);
