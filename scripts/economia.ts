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

/**
 * Dos maneras de dirigir, porque la plata solo tiene sentido comparada.
 *
 * "gasta" es el que compra cada vez que puede, y es la que se venía midiendo.
 * El problema es que con esa sola no se puede responder la pregunta que el
 * juego hace: si ahorrás, ¿llegás a la estrella? Con el que gasta la respuesta
 * es siempre no, y eso no dice si el precio está mal o si el que gasta eligió
 * mal. "ahorra" no compra un solo refuerzo, vende a todo el que le ofertan y
 * cobra la entrada cara. Si ni así llega, el precio está mal de verdad.
 */
type Politica = "gasta" | "ahorra";

interface Corrida {
  pico: number; final: number; estrellas: number; refuerzos: number;
  alcanzo: number; aparecio: number;
}

function correrTemporada(s: number, politica: Politica, contar: boolean): Corrida {
  const rng = new Rng(`eco-${s}`);
  let p: Partida = partidaNueva(`eco-${s}`);
  let pico = p.dineroUsd;
  let antes = p.dineroUsd;
  const r: Corrida = { pico: 0, final: 0, estrellas: 0, refuerzos: 0, alcanzo: 0, aparecio: 0 };

  const registrar = (que: string, ahora: number) => {
    const d = ahora - antes;
    if (contar && Math.abs(d) > 500) anotar(que, d);
    antes = ahora;
  };

  for (let d = 0; d < 200 && !p.despedido; d++) {
    if (p.pendientes.length) {
      const a = p.pendientes[0];
      const ops = a.tipo === "oferta" ? ["vender", "rechazar"]
        : a.tipo === "marketing" ? ["barato", "normal", "caro"]
        : a.tipo === "viaje" ? ["sobrelahora", "dosdias", "semana"]
        : Object.keys(a.efectos ?? {});
      /* El que ahorra vende siempre y cobra la entrada cara. */
      const op = politica === "ahorra" && a.tipo === "oferta" ? "vender"
        : politica === "ahorra" && a.tipo === "marketing" ? "caro"
        : ops.length ? rng.elegir(ops) : "";
      p = resolverAsunto(p, a.id, op);
      registrar(a.tipo === "oferta" ? (op === "vender" ? "vender un jugador" : "rechazar oferta")
        : a.tipo === "viaje" ? "el viaje"
        : a.tipo === "marketing" ? "entradas"
        : `decisión: ${a.situacion?.id ?? "?"}`, p.dineroUsd);
      continue;
    }
    if (p.hito) { p = { ...p, hito: null }; continue; }
    if (p.estrella) {
      r.aparecio++;
      const e = ESTRELLAS.find((x) => x.id === p.estrella!.id)!;
      if (p.dineroUsd >= e.precioUsd) r.alcanzo++;
      if (p.dineroUsd >= e.precioUsd && (politica === "ahorra" || rng.chance(0.7))) {
        p = ficharEstrella(p); r.estrellas++;
        registrar("fichar una estrella", p.dineroUsd);
      } else p = rechazarEstrella(p);
      continue;
    }
    if (politica === "gasta" && p.fichajes.length && rng.chance(0.06)) {
      const f = rng.elegir(p.fichajes);
      const t = fichar(p, f.id);
      if (t) { p = t; r.refuerzos++; registrar("fichar del mercado", p.dineroUsd); continue; }
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
  r.pico = pico;
  r.final = p.dineroUsd;
  return r;
}

const sumar = (xs: Corrida[]): Corrida => xs.reduce((a, b) => ({
  pico: a.pico + b.pico, final: a.final + b.final, estrellas: a.estrellas + b.estrellas,
  refuerzos: a.refuerzos + b.refuerzos, alcanzo: a.alcanzo + b.alcanzo,
  aparecio: a.aparecio + b.aparecio,
}));

const temp = Array.from({ length: temporadas }, (_, s) => s);
const gasta = sumar(temp.map((s) => correrTemporada(s, "gasta", true)));
const ahorra = sumar(temp.map((s) => correrTemporada(s, "ahorra", false)));

const n = (x: number) => x / temporadas;

console.log(`\n  LA PLATA, media de ${temporadas} temporadas\n`);
console.log(`    arranca con              ${M(partidaNueva("eco").dineroUsd)}`);
console.log(`    lo máximo que llega a tener  ${M(n(gasta.pico))}  si comprás cada vez que podés`);
console.log(`                                 ${M(n(ahorra.pico))}  si ahorrás todo el año`);
console.log(`    termina con              ${M(n(gasta.final))}`);

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
const pct = (c: Corrida) => c.aparecio ? Math.round((c.alcanzo / c.aparecio) * 100) : 0;
console.log(`    aparece una estrella     ${n(gasta.aparecio).toFixed(1)} veces por temporada`);
console.log(`    y te alcanza             ${pct(gasta)}% de esas veces si venís comprando refuerzos`);
console.log(`                             ${pct(ahorra)}% si guardás todo para ella`);
console.log(`    terminás fichando        ${n(gasta.estrellas).toFixed(2)} estrellas y ` +
  `${n(gasta.refuerzos).toFixed(1)} refuerzos comprando`);
console.log(`                             ${n(ahorra.estrellas).toFixed(2)} estrellas ahorrando`);
