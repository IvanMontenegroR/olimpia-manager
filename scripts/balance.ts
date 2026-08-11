/**
 * Simulador headless de balanceo.
 *
 * Corre la temporada completa (Clausura + Sudamericana) muchas veces con dos DT
 * automáticos y compara. La pregunta que tiene que contestar es una sola:
 * ¿rotar el plantel rinde más que poner siempre a los once mejores?
 *
 * Si las dos estrategias empatan, la fatiga no es una mecánica, es decorado.
 *
 *   npx tsx scripts/balance.ts [corridas]
 */
import { readFileSync } from "node:fs";
import { Rng } from "../engine/rng.ts";
import { condicionRival, fuerzaBaseAjustada } from "../lib/rivales.ts";
import { factorCondicion } from "../engine/motor.ts";
import { simularTemporada, type Evento, type ResultadoTemporada } from "../engine/temporada.ts";
import type { Estrategia } from "../engine/dt.ts";
import type { Jugador } from "../engine/tipos.ts";

const D = new URL("../data/", import.meta.url).pathname;
const leer = (f: string) => JSON.parse(readFileSync(D + f, "utf8"));

const plantel: Jugador[] = leer("plantel_olimpia_2026.json");
const fixture = leer("fixture_clausura2026_final.json");
const equipos = leer("equipos_2026.json");
const internacionales = leer("rivales_internacionales.json");
const copa = leer("sudamericana_2026.json");

const fuerzas: Record<string, number> = Object.fromEntries(
  equipos.map((e: any) => [e.id, e.fuerza]));
const inter = Object.fromEntries(internacionales.map((r: any) => [r.id, r]));

/**
 * Cuánto se prepara cada viaje de copa, para medir cuánto vale el plan de
 * viaje. Se pasa por ACLIMATACION=0.55 npx tsx scripts/balance.ts
 */
const ACLIMATACION = Number(process.env.ACLIMATACION ?? 0);

function construirEventos(rng: Rng): Evento[] {
  const ev: Evento[] = [];

  for (const p of fixture) {
    if (p.local !== "olimpia" && p.visitante !== "olimpia") continue;
    const esLocal = p.local === "olimpia";
    const rivalId = esLocal ? p.visitante : p.local;
    ev.push({
      fecha: p.fecha, competencia: "clausura", ronda: `fecha_${p.fecha_numero}`,
      rivalId, rivalNombre: esLocal ? p.visitante_nombre : p.local_nombre,
      rivalFuerza: fuerzaBaseAjustada(rivalId, fuerzas[rivalId]), esLocal,
      viajeKm: p.viaje_km_olimpia ?? 0,
      alturaM: 43, esClasico: rivalId === "cerro_porteno",
      fechaNumero: p.fecha_numero,
      // el rival llega como lo dejó su propio calendario
      rivalCondicion: condicionRival(rivalId, p.fecha),
    });
  }

  // Sudamericana. Octavos es el cruce real; de cuartos en adelante se sortea
  // el rival entre los que efectivamente están en esa mitad del cuadro.
  const cal = copa.calendario;
  const llave = (ronda: string, ida: string, vuelta: string, rid: string) => {
    const r = inter[rid];
    ev.push({ fecha: ida, competencia: "sudamericana", ronda: `${ronda}_ida`,
      rivalId: rid, rivalNombre: r.nombre, rivalFuerza: r.fuerza, esLocal: false,
      viajeKm: r.km_desde_asuncion, alturaM: r.altura_m, esClasico: false,
      aclimatacion: ACLIMATACION });
    ev.push({ fecha: vuelta, competencia: "sudamericana", ronda: `${ronda}_vuelta`,
      rivalId: rid, rivalNombre: r.nombre, rivalFuerza: r.fuerza, esLocal: true,
      viajeKm: 0, alturaM: 43, esClasico: false });
  };

  // Camino real por el cuadro: Olimpia sale de la llave D.
  llave("octavos", cal.octavos.ida, cal.octavos.vuelta, "vasco_da_gama");
  // cuartos: ganador de Santa Fe vs River
  llave("cuartos", cal.cuartos.ida, cal.cuartos.vuelta,
        rng.chance(0.7) ? "river_plate" : "santa_fe");
  // semis: ganador de Boca-Recoleta contra Bolívar-São Paulo
  llave("semis", cal.semifinales.ida, cal.semifinales.vuelta,
        rng.elegir(["boca_juniors", "sao_paulo", "boca_juniors", "bolivar", "recoleta"]));

  // final: contra la mitad derecha del cuadro
  const finalista = rng.elegir(["atletico_mineiro", "botafogo", "santos", "bragantino", "lanus"]);
  const rf = inter[finalista];
  ev.push({ fecha: cal.final.fecha, competencia: "sudamericana", ronda: "final",
    rivalId: finalista, rivalNombre: rf.nombre, rivalFuerza: rf.fuerza,
    esLocal: false, neutral: true, viajeKm: copa.final.km_desde_asuncion,
    alturaM: copa.final.altura_m, esClasico: false, aclimatacion: ACLIMATACION });

  ev.sort((a, b) => a.fecha.localeCompare(b.fecha));
  return ev;
}

const otrosPartidos = fixture
  .filter((p: any) => p.local !== "olimpia" && p.visitante !== "olimpia")
  .map((p: any) => ({
    fecha: p.fecha, local: p.local, visitante: p.visitante,
    // el desgaste vale para todos, si no el torneo se gana solo
    fl: fuerzaBaseAjustada(p.local, fuerzas[p.local]) *
        factorCondicion(condicionRival(p.local, p.fecha)),
    fv: fuerzaBaseAjustada(p.visitante, fuerzas[p.visitante]) *
        factorCondicion(condicionRival(p.visitante, p.fecha)),
  }));

// ------------------------------------------------------------------ corrida

const N = Number(process.argv[2] ?? 500);
const ESTRATEGIAS: Estrategia[] = ["once_fijo", "rotacion"];
const salida = new Map<Estrategia, ResultadoTemporada[]>();

for (const est of ESTRATEGIAS) {
  const rs: ResultadoTemporada[] = [];
  for (let i = 0; i < N; i++) {
    const rng = new Rng(`olimpia-2026-${i}`);
    rs.push(simularTemporada(plantel, construirEventos(new Rng(`cuadro-${i}`)),
                             otrosPartidos, fuerzas, est, rng));
  }
  salida.set(est, rs);
}

const med = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const pct = (xs: boolean[]) => (100 * xs.filter(Boolean).length) / xs.length;
const RONDAS = ["octavos", "cuartos", "semis", "final", "campeon"];
const rondaIdx = (r: string) => {
  const base = r.replace(/_ida|_vuelta/, "");
  const i = RONDAS.indexOf(base);
  return i < 0 ? 0 : i;
};

console.log(`\n=== BALANCEO: ${N} temporadas por estrategia ===\n`);
const fila = (k: string, f: (r: ResultadoTemporada[]) => string) => {
  const a = f(salida.get("once_fijo")!);
  const b = f(salida.get("rotacion")!);
  console.log(`  ${k.padEnd(34)} ${a.padStart(12)} ${b.padStart(12)}`);
};

console.log(`  ${"".padEnd(34)} ${"ONCE FIJO".padStart(12)} ${"ROTACIÓN".padStart(12)}`);
console.log("  " + "-".repeat(60));
fila("Puntos en el Clausura", (r) => med(r.map((x) => x.puntos)).toFixed(1));
fila("Sale campeón", (r) => pct(r.map((x) => x.campeon)).toFixed(1) + "%");
fila("Posición media", (r) => med(r.map((x) => x.posicion)).toFixed(2));
fila("Ronda alcanzada en copa", (r) => med(r.map((x) => rondaIdx(x.rondaCopa))).toFixed(2));
fila("Gana la Sudamericana", (r) => pct(r.map((x) => x.campeonCopa)).toFixed(1) + "%");
for (const [i, nom] of ["cae en octavos","cae en cuartos","cae en semis","pierde la final","CAMPEON"].entries())
  fila("  " + nom, (r) => pct(r.map((x) => rondaIdx(x.rondaCopa) === i)).toFixed(1) + "%");
console.log("  " + "-".repeat(60));
fila("Lesiones por temporada", (r) => med(r.map((x) => x.lesiones)).toFixed(1));
fila("Días de baja acumulados", (r) => med(r.map((x) => x.diasLesion)).toFixed(0));
fila("Condición media del plantel", (r) => med(r.map((x) => x.condicionMedia)).toFixed(1));
fila("Condición media de los titulares", (r) => med(r.map((x) => x.condicionTitulares)).toFixed(1));
fila("Partidos con un titular bajo 60%", (r) => med(r.map((x) => x.partidosConFundido)).toFixed(1));
fila("Nivel efectivo medio del once", (r) => med(r.map((x) => x.nivelEfectivoOnce)).toFixed(1));
fila("Condición mínima tocada", (r) => med(r.map((x) => x.condicionMinima)).toFixed(1));
console.log("  " + "-".repeat(60));
fila("Titulares de referencia (de 11)",
     (r) => med(r.map((x) => x.usosOnceIdeal / Math.max(x.partidosJugados, 1))).toFixed(1));
fila("Minutos Sub-18 (meta 900)", (r) => med(r.map((x) => x.minutosSub18)).toFixed(0));
fila("Cumple la regla Sub-18", (r) => pct(r.map((x) => x.cumplioSub18)).toFixed(1) + "%");

// reparto de minutos con la estrategia de rotación
const rot = salida.get("rotacion")!;
const acum = new Map<string, number>();
for (const r of rot) for (const [id, m] of r.minutosPorJugador) acum.set(id, (acum.get(id) ?? 0) + m);
const porId = new Map(plantel.map((j) => [j.id, j]));
console.log(`\n  REPARTO DE MINUTOS (media por temporada, estrategia de rotación)\n`);
const ordenado = [...acum.entries()].sort((a, b) => b[1] - a[1]);
for (const [id, tot] of ordenado) {
  const j = porId.get(id)!;
  const m = tot / rot.length;
  const barra = "#".repeat(Math.round(m / 90));
  console.log(`   ${String(j.nivel).padStart(3)}  ${(j.nombre + " " + j.apellido).padEnd(22)}` +
              ` ${String(Math.round(m)).padStart(5)} min  ${(m / 90).toFixed(1).padStart(4)} pj  ${barra}`);
}
