/**
 * Poner a alguien en la lista de transferibles, ¿sirve de algo?
 *
 * Es una promesa fácil de escribir y difícil de cumplir: el botón dice "los
 * clubes van a llamar por él" y el sorteo de ofertas sigue eligiendo por nivel
 * como siempre. Acá se juegan temporadas enteras con la lista puesta y sin
 * ponerla, y se cuenta cuántas ofertas llegan y por quién.
 *
 * También mide el costo, que es lo que hace que sea una decisión y no un botón
 * gratis: el que queda ofrecido pierde ánimo, y el ánimo es nivel en la cancha.
 *
 *   npx tsx scripts/venta.ts
 */

import { ANIMO_POR_OFRECERLO, avanzarUnDia, ofrecerJugador, partidaNueva, plantelDe, type Partida } from "../lib/temporada.ts";

const DIAS = 200;
const CORRIDAS = 40;

/** Corre una temporada y cuenta las ofertas que llegaron, y por quién. */
function correr(semilla: string, ofrecidos: (p: Partida) => string[]) {
  let p = partidaNueva(semilla);
  for (const id of ofrecidos(p)) p = ofrecerJugador(p, id);
  const marcados = new Set(p.transferibles ?? []);

  let ofertas = 0, porMarcado = 0, quierenIrse = 0;
  const vistas = new Set<string>();
  for (let d = 0; d < DIAS && !p.despedido; d++) {
    p = avanzarUnDia(p).partida;
    for (const o of p.ofertas) {
      if (vistas.has(o.id)) continue;
      vistas.add(o.id);
      ofertas++;
      if (marcados.has(o.jugadorId)) porMarcado++;
      if (o.quiereIrse) quierenIrse++;
    }
    // resolver la pendiente para que el juego siga: no se vende a nadie
    p = { ...p, pendientes: [], ofertas: [] };
  }
  return { ofertas, porMarcado, quierenIrse };
}

/* A quién ofrecer: dos suplentes del montón, que sin la lista casi no suenan. */
const aOfrecer = (p: Partida) => {
  const suplentes = plantelDe(p)
    .filter((j) => !j.reserva && j.nivel >= 63)
    .sort((a, b) => a.nivel - b.nivel)
    .slice(0, 2);
  return suplentes.map((j) => j.id);
};

console.log(`\n  ${CORRIDAS} temporadas de ${DIAS} días, con y sin lista\n`);

const acumular = (ofrecidos: (p: Partida) => string[]) => {
  let ofertas = 0, porMarcado = 0, quierenIrse = 0;
  for (let i = 0; i < CORRIDAS; i++) {
    const r = correr(`venta-${i}`, ofrecidos);
    ofertas += r.ofertas; porMarcado += r.porMarcado; quierenIrse += r.quierenIrse;
  }
  return {
    ofertas: ofertas / CORRIDAS,
    porMarcado: porMarcado / CORRIDAS,
    quierenIrse: ofertas ? (quierenIrse / ofertas) * 100 : 0,
  };
};

const sin = acumular(() => []);
const con = acumular(aOfrecer);

console.log(`  ${"".padEnd(22)}${"ofertas".padStart(9)}${"por los 2 ofrecidos".padStart(21)}` +
  `${"quieren irse".padStart(14)}`);
console.log(`  ${"sin ofrecer a nadie".padEnd(22)}${sin.ofertas.toFixed(1).padStart(9)}` +
  `${sin.porMarcado.toFixed(1).padStart(21)}${(sin.quierenIrse.toFixed(0) + "%").padStart(14)}`);
console.log(`  ${"con dos en la lista".padEnd(22)}${con.ofertas.toFixed(1).padStart(9)}` +
  `${con.porMarcado.toFixed(1).padStart(21)}${(con.quierenIrse.toFixed(0) + "%").padStart(14)}`);

// ------------------------------------------------------------------ el costo
const base = partidaNueva("costo");
const victima = plantelDe(base).find((j) => !j.reserva && j.nivel >= 66)!;
const despues = ofrecerJugador(base, victima.id);
const animoAntes = base.plantel[victima.id].animo;
const animoDespues = despues.plantel[victima.id].animo;

console.log(`\n  Lo que cuesta: a ${victima.apellido} le baja el ánimo de ` +
  `${Math.round(animoAntes)} a ${Math.round(animoDespues)}`);

const fallas: string[] = [];
if (con.ofertas <= sin.ofertas) {
  fallas.push(`ofrecer no trae más ofertas (${con.ofertas.toFixed(1)} contra ${sin.ofertas.toFixed(1)})`);
}
if (con.porMarcado <= sin.porMarcado * 1.5) {
  fallas.push(`las ofertas no vienen por los ofrecidos (${con.porMarcado.toFixed(1)} contra ${sin.porMarcado.toFixed(1)})`);
}
if (Math.round(animoAntes - animoDespues) !== ANIMO_POR_OFRECERLO) {
  fallas.push("ofrecer a alguien no le cuesta el ánimo que dice el botón");
}

console.log();
if (fallas.length) {
  console.log(`  ${fallas.length} problemas:\n`);
  for (const f of fallas) console.log(`    ${f}`);
  console.log();
  process.exitCode = 1;
} else {
  console.log("  Ofrecerlo hace que llamen, y por él, y cuesta lo que dice.\n");
}
