import { Rng } from "./rng.ts";
import { P, clamp, desgastePorPartido, nivelEfectivo, recuperar, simularPartido } from "./motor.ts";
import { armarOnce, CUPO_EXTRANJEROS, esSub18, type Estrategia, MOLDE, SUB18_META_MINUTOS } from "./dt.ts";
import type { ContextoPartido, Jugador } from "./tipos.ts";

const AMARILLAS_PARA_SUSPENSION = 5;

export interface Evento {
  fecha: string;
  competencia: "clausura" | "sudamericana";
  ronda: string;
  rivalId: string;
  rivalNombre: string;
  rivalFuerza: number;
  esLocal: boolean;
  neutral?: boolean;
  viajeKm: number;
  alturaM: number;
  esClasico: boolean;
  fechaNumero?: number;
}

export interface ResultadoTemporada {
  puntos: number;
  golesFavor: number;
  golesContra: number;
  posicion: number;
  campeon: boolean;
  rondaCopa: string;
  campeonCopa: boolean;
  lesiones: number;
  diasLesion: number;
  condicionMedia: number;
  condicionMinima: number;
  minutosSub18: number;
  cumplioSub18: boolean;
  minutosPorJugador: Map<string, number>;
  usosOnceIdeal: number;
  partidosJugados: number;
  /** Condición media de los once que salen a la cancha, no de todo el plantel. */
  condicionTitulares: number;
  /** Nivel efectivo medio del once. Sirve para calibrar la fuerza de los rivales. */
  nivelEfectivoOnce: number;
  /** Partidos jugados con algún titular por debajo del 60% de condición. */
  partidosConFundido: number;
}

const diasEntre = (a: string, b: string) =>
  Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

function clonarPlantel(p: Jugador[]): Jugador[] {
  return p.map((j) => ({ ...j, rasgos: [...j.rasgos], posiciones_secundarias: [...j.posiciones_secundarias] }));
}

const sumaDias = (fecha: string, dias: number) =>
  new Date(Date.parse(fecha) + dias * 86400000).toISOString().slice(0, 10);

export function simularTemporada(
  plantelBase: Jugador[],
  eventos: Evento[],
  otrosPartidos: { fecha: string; local: string; visitante: string; fl: number; fv: number }[],
  fuerzas: Record<string, number>,
  estrategia: Estrategia,
  rng: Rng,
): ResultadoTemporada {
  const plantel = clonarPlantel(plantelBase);
  const porId = new Map(plantel.map((j) => [j.id, j]));

  // Titulares de referencia: el mejor once posible con todos sanos y al 100%,
  // respetando el molde y el cupo de extranjeros. Sirve para medir cuánto se
  // aleja de él la alineación real fecha a fecha.
  const once_ideal = new Set<string>();
  {
    let ext = 0;
    for (const [puesto, n] of Object.entries(MOLDE) as [Jugador["posicion"], number][]) {
      const cand = plantel
        .filter((j) => j.posicion === puesto && !once_ideal.has(j.id))
        .sort((a, b) => b.nivel - a.nivel);
      let puestos = 0;
      for (const j of cand) {
        if (puestos >= n) break;
        if (j.extranjero && ext >= CUPO_EXTRANJEROS) continue;
        once_ideal.add(j.id);
        if (j.extranjero) ext++;
        puestos++;
      }
    }
  }

  const minutos = new Map<string, number>(plantel.map((j) => [j.id, 0]));
  const condiciones: number[] = [];
  let puntos = 0, gf = 0, gc = 0, lesiones = 0, diasLesion = 0;
  let minutosSub18 = 0, usosOnceIdeal = 0, condicionMinima = 100, partidosConFundido = 0;
  const condTitulares: number[] = [];
  const nivelesOnce: number[] = [];
  let rondaCopa = "octavos", campeonCopa = false, sigueEnCopa = true;
  let globalOlimpia = 0, globalRival = 0;

  const tabla: Record<string, { pts: number; dg: number; gf: number }> = {};
  for (const id of Object.keys(fuerzas)) tabla[id] = { pts: 0, dg: 0, gf: 0 };

  // partidos del resto de la liga
  for (const m of otrosPartidos) {
    const xl = P.xgBase * Math.exp(P.xgK * (m.fl + P.localiaLiga - m.fv));
    const xv = P.xgBase * Math.exp(P.xgK * (m.fv - m.fl - P.localiaLiga));
    const gl = rng.poisson(clamp(xl, 0.05, 6));
    const gv = rng.poisson(clamp(xv, 0.05, 6));
    tabla[m.local].gf += gl; tabla[m.visitante].gf += gv;
    tabla[m.local].dg += gl - gv; tabla[m.visitante].dg += gv - gl;
    if (gl > gv) tabla[m.local].pts += 3;
    else if (gv > gl) tabla[m.visitante].pts += 3;
    else { tabla[m.local].pts++; tabla[m.visitante].pts++; }
  }

  let fechaAnterior: string | null = null;
  let partidosJugados = 0;
  const totalEventos = eventos.length;

  for (let i = 0; i < eventos.length; i++) {
    const ev = eventos[i];
    if (ev.competencia === "sudamericana" && !sigueEnCopa) continue;

    const descanso = fechaAnterior ? diasEntre(fechaAnterior, ev.fecha) : 7;
    for (const j of plantel) {
      recuperar(j, Math.max(descanso, 0));
      if (j.lesionado_hasta && j.lesionado_hasta <= ev.fecha) j.lesionado_hasta = null;
      j.suspendido = false;
    }

    const ctx: ContextoPartido = {
      fecha: ev.fecha,
      competencia: ev.competencia,
      esLocal: ev.esLocal,
      neutral: ev.neutral,
      rivalFuerza: ev.rivalFuerza,
      rivalNombre: ev.rivalNombre,
      viajeKm: ev.viajeKm,
      alturaM: ev.alturaM,
      diasDescanso: descanso,
      esClasico: ev.esClasico,
    };

    const alineacion = armarOnce(plantel, ctx, estrategia, {
      minutosSub18,
      partidosRestantes: totalEventos - i,
    });
    if (alineacion.once.length < 11) continue;

    condTitulares.push(
      alineacion.once.reduce((s, j) => s + j.condicion, 0) / alineacion.once.length);
    nivelesOnce.push(
      alineacion.once.reduce(
        (s, j) => s + nivelEfectivo(j, alineacion.puestos.get(j.id) ?? j.posicion, ctx), 0,
      ) / alineacion.once.length);
    if (alineacion.once.some((j) => j.condicion < 60)) partidosConFundido++;

    const res = simularPartido(alineacion, ctx, rng);
    partidosJugados++;

    const idsOnce = new Set(alineacion.once.map((j) => j.id));
    usosOnceIdeal += [...once_ideal].filter((id) => idsOnce.has(id)).length;

    // Tres cambios al minuto 65. Salen los más fundidos, nunca el arquero ni el
    // Sub-18: si el juvenil no completa los 90, sus minutos no cuentan para la meta.
    const salen = new Set(
      alineacion.once
        .filter((j) => j.posicion !== "ARQ" && !esSub18(j))
        .sort((a, b) => a.condicion - b.condicion)
        .slice(0, alineacion.suplentes.length)
        .map((j) => j.id),
    );

    const enCancha: [Jugador, number][] = [
      ...alineacion.once.map((j) => [j, salen.has(j.id) ? 65 : 90] as [Jugador, number]),
      ...alineacion.suplentes.map((j) => [j, 25] as [Jugador, number]),
    ];

    for (const [j, min] of enCancha) {
      minutos.set(j.id, (minutos.get(j.id) ?? 0) + min);
      if (esSub18(j) && min === 90) minutosSub18 += 90;
      j.condicion = clamp(
        j.condicion - desgastePorPartido(j, min, ctx, alineacion.presionAlta), 0, 100);
      if (min === 90) condicionMinima = Math.min(condicionMinima, j.condicion);
    }
    condiciones.push(plantel.reduce((s, j) => s + j.condicion, 0) / plantel.length);

    for (const l of res.lesionados) {
      const j = porId.get(l.id)!;
      j.lesionado_hasta = sumaDias(ev.fecha, l.dias);
      lesiones++; diasLesion += l.dias;
    }
    for (const id of res.amarillas) {
      const j = porId.get(id)!;
      if (ev.competencia !== "clausura") continue;
      j.tarjetas_amarillas++;
      if (j.tarjetas_amarillas >= AMARILLAS_PARA_SUSPENSION) {
        j.tarjetas_amarillas = 0;
        j.suspendido = true;
      }
    }
    for (const id of res.rojas) porId.get(id)!.suspendido = true;

    // forma: se mueve con el resultado
    for (const j of alineacion.once) {
      if (res.golesOlimpia > res.golesRival + 1) j.forma = "en_racha";
      else if (res.golesRival > res.golesOlimpia + 1) j.forma = "en_baja";
      else j.forma = "neutral";
    }

    if (ev.competencia === "clausura") {
      gf += res.golesOlimpia; gc += res.golesRival;
      if (res.golesOlimpia > res.golesRival) puntos += 3;
      else if (res.golesOlimpia === res.golesRival) puntos += 1;
      tabla["olimpia"].pts = puntos;
      tabla["olimpia"].dg = gf - gc;
      tabla["olimpia"].gf = gf;
    } else {
      rondaCopa = ev.ronda;
      if (ev.ronda === "final") {
        let gO = res.golesOlimpia, gR = res.golesRival;
        if (gO === gR) { gO += rng.chance(0.5) ? 1 : 0; gR = gO === res.golesOlimpia ? gR + 1 : gR; }
        campeonCopa = gO > gR;
        sigueEnCopa = false;
      } else if (ev.ronda.endsWith("_ida")) {
        globalOlimpia = res.golesOlimpia; globalRival = res.golesRival;
      } else {
        globalOlimpia += res.golesOlimpia; globalRival += res.golesRival;
        let pasa = globalOlimpia > globalRival;
        if (globalOlimpia === globalRival) pasa = rng.chance(0.5); // penales, sin alargue
        if (!pasa) sigueEnCopa = false;
        globalOlimpia = 0; globalRival = 0;
      }
    }
    fechaAnterior = ev.fecha;
  }

  const orden = Object.entries(tabla).sort(
    (a, b) => b[1].pts - a[1].pts || b[1].dg - a[1].dg || b[1].gf - a[1].gf);
  const posicion = orden.findIndex(([id]) => id === "olimpia") + 1;

  return {
    puntos, golesFavor: gf, golesContra: gc, posicion, campeon: posicion === 1,
    rondaCopa: campeonCopa ? "campeon" : rondaCopa,
    campeonCopa, lesiones, diasLesion,
    condicionMedia: condiciones.reduce((a, b) => a + b, 0) / (condiciones.length || 1),
    condicionMinima,
    minutosSub18, cumplioSub18: minutosSub18 >= SUB18_META_MINUTOS,
    minutosPorJugador: minutos, usosOnceIdeal, partidosJugados,
    condicionTitulares: condTitulares.reduce((a, b) => a + b, 0) / (condTitulares.length || 1),
    nivelEfectivoOnce: nivelesOnce.reduce((a, b) => a + b, 0) / (nivelesOnce.length || 1),
    partidosConFundido,
  };
}
