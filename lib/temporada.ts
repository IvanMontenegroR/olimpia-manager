"use client";

import { PLANTEL, partidosDeOlimpia, type PartidoUI } from "./juego.ts";
import { P, clamp } from "@/engine/motor.ts";
import { Rng } from "@/engine/rng.ts";
import equiposJson from "@/data/equipos_2026.json";
import fixtureJson from "@/data/fixture_clausura2026_final.json";
import rivalesJson from "@/data/rivales_internacionales.json";
import { sortearSituacion, type Efecto, type Situacion } from "@/engine/situaciones.ts";
import { generarMercado, sortearOferta, type FichajeGenerado } from "@/engine/mercado.ts";
import type { Jugador } from "@/engine/tipos.ts";

const EQUIPOS = equiposJson as any[];
const FIXTURE = fixtureJson as any[];
const RIVALES = rivalesJson as any[];
const CLAVE = "olimpia-manager-clausura-2026";
const VERSION = 9;

export const DIA_INICIAL = "2026-07-20";
export const TOTAL_FECHAS = 22;
/** Capacidad del Defensores del Chaco. */
export const AFORO = 36_000;
export const OBJETIVO = "Salir campeón del Clausura";

export type Enfoque = "recuperacion" | "tactico" | "individual";
export type RondaCopa = "octavos" | "cuartos" | "semis" | "final" | "eliminado" | "campeon";

export interface EstadoCopa {
  ronda: RondaCopa;
  rivalId: string;
  globalO: number;
  globalR: number;
  jugadosEnRonda: number;
}

/** Calendario real de las fases finales, de data/sudamericana_2026.json. */
export const CALENDARIO_COPA: Record<string, { ida: string; vuelta: string }> = {
  octavos: { ida: "2026-08-13", vuelta: "2026-08-20" },
  cuartos: { ida: "2026-09-17", vuelta: "2026-09-24" },
  semis:   { ida: "2026-10-22", vuelta: "2026-10-29" },
  final:   { ida: "2026-11-21", vuelta: "2026-11-21" },
};

export interface ResultadoFecha {
  fechaNumero: number;
  rivalId: string;
  esLocal: boolean;
  golesOlimpia: number;
  golesRival: number;
}

export interface EstadoPlantel {
  condicion: number;
  amarillas: number;
  suspendidoFechas: number;
  lesionadoHasta: string | null; // día ISO
  golesTorneo: number;
  minutos: number;
  moral: number;
  forma: "en_racha" | "neutral" | "en_baja";
  /** Cuánto subió de Nivel con minutos y trabajo individual. */
  crecimiento: number;
}

export interface Oferta {
  id: string;
  jugadorId: string;
  club: string;
  montoUsd: number;
  venceEl: string;
}

export type Fichaje = FichajeGenerado;

/** Algo que espera una decisión. El día no avanza hasta resolverlo. */
export interface Asunto {
  id: string;
  tipo: "entrenamiento" | "evento" | "oferta" | "marketing" | "prensa";
  dia: string;
  titulo: string;
  detalle: string;
  datos?: Record<string, unknown>;
  situacion?: Situacion;
  efectos?: Record<string, Efecto>;
}

/** Un once armado y guardado con nombre, para volver a ponerlo de un toque. */
export interface EquipoGuardado {
  nombre: string;
  formacion: string;
  jugadores: string[];
}

export interface Partida {
  version: number;
  /** Refuerzos comprados. Se suman al plantel del JSON. */
  incorporados: Jugador[];
  dia: string;
  fechaActual: number;
  resultados: ResultadoFecha[];
  plantel: Record<string, EstadoPlantel>;
  minutosSub18: number;

  dineroUsd: number;
  ambiente: number;      // clima interno del plantel, 0 a 100
  hinchada: number;      // humor de la gente, 0 a 100
  entrenamiento: Enfoque | null;
  entrenaA: string | null;
  precioEntrada: number; // en miles de guaraníes
  /** Se firmó el contrato con premio por objetivos. */
  sponsorConBonus: boolean;
  /** Puntos que sacó la APF por incumplir la regla Sub-18. */
  puntosDescontados: number;
  /** Cuánto te banca la dirigencia, 0 a 100. En cero te echan. */
  paciencia: number;
  /** Si te echaron, por qué. */
  despedido: string | null;

  /** Alineaciones guardadas por el DT: el titular, el equipo de copa, etc. */
  equipos: EquipoGuardado[];

  copa: EstadoCopa;
  ofertas: Oferta[];
  fichajes: Fichaje[];
  pendientes: Asunto[];
  bitacora: { dia: string; texto: string }[];
}

// ---------------------------------------------------------------- utilidades

export const sumarDias = (dia: string, n: number) =>
  new Date(Date.parse(dia) + n * 86400000).toISOString().slice(0, 10);

export const diasEntre = (a: string, b: string) =>
  Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

const MESES = ["ene", "feb", "mar", "abr", "may", "jun",
               "jul", "ago", "sep", "oct", "nov", "dic"];
const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

export function formatoDia(dia: string): string {
  const d = new Date(dia + "T12:00:00");
  return `${DIAS[d.getDay()]} ${d.getDate()} ${MESES[d.getMonth()]}`;
}

// ---------------------------------------------------------------- creación

export function partidaNueva(): Partida {
  return {
    version: VERSION,
    incorporados: [],
    dia: DIA_INICIAL,
    fechaActual: 1,
    resultados: [],
    plantel: Object.fromEntries(PLANTEL.map((j) => [j.id, {
      condicion: j.condicion,
      amarillas: 0,
      suspendidoFechas: 0,
      lesionadoHasta: null,
      golesTorneo: 0,
      minutos: 0,
      moral: 70,
      forma: j.forma,
      crecimiento: 0,
    }])),
    minutosSub18: 0,
    dineroUsd: 1_800_000,
    ambiente: 72,
    hinchada: 68,
    entrenamiento: null,
    entrenaA: null,
    precioEntrada: 60,
    equipos: [],
    sponsorConBonus: false,
    puntosDescontados: 0,
    paciencia: 70,
    despedido: null,
    copa: { ronda: "octavos", rivalId: "vasco_da_gama", globalO: 0, globalR: 0, jugadosEnRonda: 0 },
    ofertas: [],
    fichajes: generarMercado(DIA_INICIAL),
    pendientes: [],
    bitacora: [{ dia: DIA_INICIAL, texto: "Arranca la pretemporada del Clausura." }],
  };
}

/**
 * Carga tolerante: en vez de descartar la partida cuando cambia el formato,
 * completa lo que falte con los valores de una partida nueva. Descartar
 * significaba perder la temporada del jugador en cada actualización.
 */
export function cargar(): Partida {
  if (typeof window === "undefined") return partidaNueva();
  try {
    const raw = window.localStorage.getItem(CLAVE);
    if (!raw) return partidaNueva();
    const guardada = JSON.parse(raw) as Partial<Partida>;
    if (!guardada || typeof guardada.dia !== "string") return partidaNueva();

    const base = partidaNueva();
    const p: Partida = { ...base, ...guardada, version: VERSION };

    // los objetos anidados se completan campo por campo
    p.copa = { ...base.copa, ...(guardada.copa ?? {}) };
    p.plantel = { ...base.plantel };
    for (const [id, e] of Object.entries(guardada.plantel ?? {})) {
      if (p.plantel[id]) p.plantel[id] = { ...p.plantel[id], ...e };
    }
    p.resultados ??= [];
    p.ofertas ??= [];
    p.fichajes ??= [];
    p.pendientes ??= [];
    p.bitacora ??= [];
    p.equipos ??= [];
    return p;
  } catch {
    return partidaNueva();
  }
}

export function guardar(p: Partida): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(CLAVE, JSON.stringify(p)); } catch { /* sin espacio */ }
}

export function borrar(): void {
  if (typeof window !== "undefined") window.localStorage.removeItem(CLAVE);
}

// ---------------------------------------------------------------- consultas

export function plantelDe(p: Partida): Jugador[] {
  return [...PLANTEL, ...(p.incorporados ?? [])].map((j) => {
    const e = p.plantel[j.id];
    if (!e) return j;
    return {
      ...j,
      nivel: j.nivel + Math.floor(e.crecimiento ?? 0),
      nivel_incertidumbre: Math.max(0, j.nivel_incertidumbre - Math.floor(e.crecimiento ?? 0)),
      condicion: Math.round(e.condicion),
      suspendido: e.suspendidoFechas > 0,
      lesionado_hasta: e.lesionadoHasta && e.lesionadoHasta > p.dia ? e.lesionadoHasta : null,
      tarjetas_amarillas: e.amarillas,
      moral: Math.round(e.moral),
      forma: e.forma,
    };
  });
}

export function partidoLigaDe(p: Partida): PartidoUI | null {
  return partidosDeOlimpia().find((x) => x.etiqueta.endsWith(`Fecha ${p.fechaActual}`)) ?? null;
}

export function partidoCopaDe(p: Partida): PartidoUI | null {
  const c = p.copa;
  if (c.ronda === "eliminado" || c.ronda === "campeon") return null;
  const cal = CALENDARIO_COPA[c.ronda];
  const esFinal = c.ronda === "final";
  const dia = c.jugadosEnRonda === 0 ? cal.ida : cal.vuelta;
  if (dia < p.dia) return null;
  const r = (RIVALES as any[]).find((x) => x.id === c.rivalId);
  if (!r) return null;
  const esLocal = !esFinal && c.jugadosEnRonda === 1;
  const nombreRonda = { octavos: "Octavos", cuartos: "Cuartos", semis: "Semifinal",
                        final: "FINAL" }[c.ronda as "octavos"];
  return {
    rivalId: c.rivalId,
    rivalNombre: r.nombre,
    estadio: esFinal ? "Metropolitano Roberto Meléndez" : esLocal ? "Defensores del Chaco" : r.estadio,
    ciudad: esFinal ? "Barranquilla" : esLocal ? "Asunción" : r.ciudad,
    etiqueta: `Sudamericana · ${nombreRonda}${esFinal ? "" : c.jugadosEnRonda === 0 ? " ida" : " vuelta"}`,
    ctx: {
      fecha: dia,
      competencia: "sudamericana",
      esLocal,
      neutral: esFinal,
      rivalFuerza: r.fuerza,
      rivalNombre: r.nombre,
      viajeKm: esLocal ? 0 : r.km_desde_asuncion,
      alturaM: esLocal ? 43 : r.altura_m,
      diasDescanso: 3,
      esClasico: false,
    },
  };
}

/** El que venga antes, ya con el estado del estadio adentro del contexto. */
export function partidoDe(p: Partida): PartidoUI | null {
  const liga = partidoLigaDe(p);
  const copa = partidoCopaDe(p);
  const elegido = !liga ? copa : !copa ? liga
    : copa.ctx.fecha <= liga.ctx.fecha ? copa : liga;
  if (!elegido) return null;
  return {
    ...elegido,
    ctx: {
      ...elegido.ctx,
      hinchada: p.hinchada,
      ocupacion: ocupacionDe(p, elegido.ctx.esClasico),
    },
  };
}

export const esPartidoDeCopa = (m: PartidoUI | null) => m?.ctx.competencia === "sudamericana";

export const hayPartidoHoy = (p: Partida) => partidoDe(p)?.ctx.fecha === p.dia;

/**
 * Qué parte del estadio se llena. Manda el precio: una popular accesible llena
 * aunque el equipo no venga bien; con la entrada cara se vacía aunque vaya
 * primero.
 */
export function ocupacionDe(p: Partida, esClasico = false): number {
  const porPrecio = clamp(1.45 - p.precioEntrada / 70, 0.25, 1.12);
  const porHumor = 0.55 + (p.hinchada / 100) * 0.55;
  return clamp(porPrecio * porHumor * (esClasico ? 1.25 : 1), 0.15, 1);
}

export function diasAlPartido(p: Partida): number | null {
  const m = partidoDe(p);
  return m ? diasEntre(p.dia, m.ctx.fecha) : null;
}

// ---------------------------------------------------------------- tabla

export interface FilaTabla {
  id: string; nombre: string;
  pj: number; g: number; e: number; p: number;
  gf: number; gc: number; dg: number; pts: number;
}

export function tablaDe(p: Partida): FilaTabla[] {
  const fuerzas: Record<string, number> = Object.fromEntries(EQUIPOS.map((e) => [e.id, e.fuerza]));
  const filas: Record<string, FilaTabla> = Object.fromEntries(EQUIPOS.map((e) => [e.id, {
    id: e.id, nombre: e.nombre, pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, dg: 0, pts: 0,
  }]));
  const anotar = (id: string, favor: number, contra: number) => {
    const f = filas[id];
    f.pj++; f.gf += favor; f.gc += contra; f.dg = f.gf - f.gc;
    if (favor > contra) { f.g++; f.pts += 3; }
    else if (favor === contra) { f.e++; f.pts += 1; }
    else f.p++;
  };
  if (p.puntosDescontados) filas["olimpia"].pts -= p.puntosDescontados;
  for (const r of p.resultados) {
    const local = r.esLocal ? "olimpia" : r.rivalId;
    const visita = r.esLocal ? r.rivalId : "olimpia";
    const gl = r.esLocal ? r.golesOlimpia : r.golesRival;
    const gv = r.esLocal ? r.golesRival : r.golesOlimpia;
    anotar(local, gl, gv); anotar(visita, gv, gl);
  }
  const rng = new Rng("liga-clausura-2026");
  for (const m of FIXTURE) {
    if (m.fecha_numero >= p.fechaActual) continue;
    if (m.local === "olimpia" || m.visitante === "olimpia") continue;
    const xl = P.xgBase * Math.exp(P.xgK * (fuerzas[m.local] + P.localiaLiga - fuerzas[m.visitante]));
    const xv = P.xgBase * Math.exp(P.xgK * (fuerzas[m.visitante] - fuerzas[m.local] - P.localiaLiga));
    const gl = rng.poisson(clamp(xl, 0.05, 6));
    const gv = rng.poisson(clamp(xv, 0.05, 6));
    anotar(m.local, gl, gv); anotar(m.visitante, gv, gl);
  }
  return Object.values(filas).sort(
    (a, b) => b.pts - a.pts || b.dg - a.dg || b.gf - a.gf || a.nombre.localeCompare(b.nombre));
}

export const posicionDe = (p: Partida, id = "olimpia") =>
  tablaDe(p).findIndex((f) => f.id === id) + 1;

// ---------------------------------------------------------------- cierre de partido

export interface CierrePartido {
  golesOlimpia: number;
  golesRival: number;
  minutos: Map<string, number>;
  amarillas: string[];
  rojas: string[];
  lesionados: { id: string; dias: number }[];
  goleadores: string[];
}

const AMARILLAS_PARA_SUSPENSION = 5;

/** Lo que falta de Sub-18 y si el ritmo alcanza para llegar. */
export function estadoSub18(p: Partida) {
  const faltan = Math.max(0, 900 - p.minutosSub18);
  const fechasRestantes = Math.max(0, TOTAL_FECHAS - p.fechaActual + 1);
  return {
    faltan,
    fechasRestantes,
    alcanza: faltan <= fechasRestantes * 90,
    cumplido: faltan === 0,
  };
}

export function cerrarPartido(p: Partida, partido: PartidoUI, c: CierrePartido): Partida {
  const n: Partida = estructurado(p);
  const esCopa = partido.ctx.competencia === "sudamericana";

  if (!esCopa) n.resultados.push({
    fechaNumero: p.fechaActual,
    rivalId: partido.rivalId,
    esLocal: partido.ctx.esLocal,
    golesOlimpia: c.golesOlimpia,
    golesRival: c.golesRival,
  });

  const gano = c.golesOlimpia > c.golesRival;
  const empate = c.golesOlimpia === c.golesRival;

  // Jugar de local con el estadio lleno levanta al plantel; jugar ante una
  // cancha vacía y silbando lo hunde.
  const empujeCancha = partido.ctx.esLocal
    ? (ocupacionDe(p, partido.ctx.esClasico) - 0.62) * 9
    : 0;

  for (const j of plantelDe(p)) {
    const e = n.plantel[j.id];
    if (!e) continue;
    const min = c.minutos.get(j.id) ?? 0;
    if (min > 0) {
      let desgaste = P.desgaste90 * (min / 90);
      desgaste += (partido.ctx.viajeKm / 1000) * P.desgasteViajeKm;
      if (j.edad >= 33) desgaste += P.desgasteVeterano * (min / 90);
      e.condicion = clamp(e.condicion - desgaste, 0, 100);
      e.minutos += min;
      if (j.fecha_nacimiento >= "2007-01-01" && min >= 90) n.minutosSub18 += 90;
      e.moral = clamp(e.moral + (gano ? 4 : empate ? 0 : -4) + empujeCancha, 0, 100);
      // la forma se mueve con lo que hizo el equipo estando él en cancha
      const golesSuyos = c.goleadores.filter((g) => g === j.id).length;
      e.forma = golesSuyos > 0 || (gano && min >= 60) ? "en_racha"
        : (!gano && !empate && min >= 60) ? "en_baja"
        : "neutral";
    } else {
      e.moral = clamp(e.moral - 1.8, 0, 100); // el que no juega se calienta
    }

    if (e.suspendidoFechas > 0) e.suspendidoFechas--;
    if (c.amarillas.includes(j.id)) {
      e.amarillas++;
      if (e.amarillas >= AMARILLAS_PARA_SUSPENSION) { e.amarillas = 0; e.suspendidoFechas = 1; }
    }
    if (c.rojas.includes(j.id)) e.suspendidoFechas = 1;

    const les = c.lesionados.find((l) => l.id === j.id);
    if (les) e.lesionadoHasta = sumarDias(p.dia, les.dias);
    e.golesTorneo += c.goleadores.filter((g) => g === j.id).length;
  }

  // taquilla
  if (partido.ctx.esLocal) {
    const ocupacion = ocupacionDe(p, partido.ctx.esClasico);
    const entradas = Math.round(AFORO * ocupacion);
    const recaudado = entradas * n.precioEntrada * 0.14;
    n.dineroUsd += Math.round(recaudado);
    n.bitacora.push({ dia: p.dia, texto:
      `${entradas.toLocaleString("es")} personas en el estadio (${Math.round(ocupacion * 100)}% del aforo), ` +
      `${miles(Math.round(recaudado))} de recaudación.` });
  }

  // La gente se enoja con los malos resultados y se enoja el doble en el clásico.
  n.hinchada = clamp(n.hinchada + (gano ? 5 : empate ? -2 : -8)
    + (partido.ctx.esClasico ? (gano ? 7 : empate ? -2 : -10) : 0), 0, 100);

  // El vestuario sigue a los resultados y también al humor de la calle: cuando
  // la hinchada está caliente, adentro se siente.
  const arrastreHinchada = (n.hinchada - 50) * 0.05;
  n.ambiente = clamp(n.ambiente + (gano ? 3 : empate ? 0 : -4) + arrastreHinchada, 0, 100);

  n.bitacora.push({ dia: p.dia, texto:
    `${partido.ctx.esLocal ? "" : "De visitante. "}Olimpia ${c.golesOlimpia} - ${c.golesRival} ${partido.rivalNombre}.` });

  actualizarPaciencia(n, { gano, empate, esCopa, esClasico: partido.ctx.esClasico });

  if (esCopa) {
    avanzarLlave(n, c, partido);
  } else {
    n.fechaActual = p.fechaActual + 1;

    // La APF descuenta puntos al que no cumple los 900 minutos de Sub-18.
    if (n.fechaActual > TOTAL_FECHAS && n.minutosSub18 < 900) {
      n.puntosDescontados = 3;
      n.bitacora.push({ dia: p.dia, texto:
        `Sanción: Olimpia no llegó a los 900 minutos Sub-18 (${n.minutosSub18}). ` +
        `La APF descuenta 3 puntos.` });
    }

    // el sponsor con bonus paga cuando hay algo que festejar
    if (n.sponsorConBonus && gano && n.fechaActual > TOTAL_FECHAS) {
      n.dineroUsd += 2_500_000;
      n.bitacora.push({ dia: p.dia, texto: "El sponsor pagó el bonus por objetivos." });
    }
  }
  n.entrenamiento = null;
  n.entrenaA = null;
  return avanzarUnDia(n).partida;
}

const SIGUIENTE: Record<string, RondaCopa> = {
  octavos: "cuartos", cuartos: "semis", semis: "final", final: "campeon",
};

const RIVALES_POR_RONDA: Record<string, string[]> = {
  // el camino real del cuadro: Olimpia sale de la llave D
  cuartos: ["river_plate", "river_plate", "santa_fe"],
  semis: ["boca_juniors", "sao_paulo", "bolivar", "recoleta"],
  final: ["atletico_mineiro", "botafogo", "santos", "bragantino", "lanus"],
};

function avanzarLlave(n: Partida, c: CierrePartido, partido: PartidoUI) {
  const copa = n.copa;
  copa.globalO += c.golesOlimpia;
  copa.globalR += c.golesRival;
  copa.jugadosEnRonda++;

  const esFinal = copa.ronda === "final";
  const cerrada = esFinal || copa.jugadosEnRonda >= 2;
  if (!cerrada) {
    n.bitacora.push({ dia: n.dia, texto:
      `Copa Sudamericana, ida: Olimpia ${c.golesOlimpia} - ${c.golesRival} ${partido.rivalNombre}.` });
    return;
  }

  const rng = new Rng(`copa-${copa.ronda}-${n.dia}`);
  // sin gol de visitante y sin alargue: el global empatado va a penales
  const pasa = copa.globalO > copa.globalR
    || (copa.globalO === copa.globalR && rng.chance(0.5));

  n.bitacora.push({ dia: n.dia, texto:
    `Copa Sudamericana: Olimpia ${c.golesOlimpia} - ${c.golesRival} ${partido.rivalNombre}. ` +
    `Global ${copa.globalO}-${copa.globalR}. ${pasa ? "Olimpia avanza." : "Olimpia queda afuera."}` });

  if (!pasa) {
    copa.ronda = "eliminado";
    n.hinchada = clamp(n.hinchada - 10, 0, 100);
    n.ambiente = clamp(n.ambiente - 6, 0, 100);
    return;
  }

  n.hinchada = clamp(n.hinchada + 9, 0, 100);
  n.ambiente = clamp(n.ambiente + 5, 0, 100);
  n.dineroUsd += copa.ronda === "octavos" ? 600_000
    : copa.ronda === "cuartos" ? 900_000
    : copa.ronda === "semis" ? 1_400_000 : 5_000_000;

  const siguiente = SIGUIENTE[copa.ronda];
  if (siguiente === "campeon") {
    copa.ronda = "campeon";
    n.bitacora.push({ dia: n.dia, texto: "OLIMPIA CAMPEÓN DE LA COPA SUDAMERICANA." });
    return;
  }
  copa.ronda = siguiente;
  copa.rivalId = rng.elegir(RIVALES_POR_RONDA[siguiente]);
  copa.globalO = 0;
  copa.globalR = 0;
  copa.jugadosEnRonda = 0;
}

/**
 * La dirigencia te banca mientras haya resultados. Pesa el resultado, la
 * posición en la tabla y el humor de la gente: si perdés y encima la hinchada
 * está en contra, la silla se calienta el doble.
 */
function actualizarPaciencia(
  n: Partida,
  { gano, empate, esCopa, esClasico }: { gano: boolean; empate: boolean; esCopa: boolean; esClasico: boolean },
) {
  let delta = gano ? 5 : empate ? -1 : -7;
  if (esClasico) delta += gano ? 6 : empate ? 0 : -7;
  if (esCopa && gano) delta += 3;

  // la tabla manda: el objetivo es salir campeón
  const pos = posicionDe(n);
  if (pos === 1) delta += 3;
  else if (pos <= 3) delta += 1;
  else if (pos >= 8) delta -= 4;
  else if (pos >= 5) delta -= 2;

  // con la gente en contra, la dirigencia se pone nerviosa
  if (n.hinchada < 40) delta -= 3;
  if (n.hinchada > 75) delta += 2;

  n.paciencia = clamp(n.paciencia + delta, 0, 100);

  if (n.paciencia <= 0 && !n.despedido) {
    n.despedido =
      `Olimpia terminó el ciclo en la fecha ${n.fechaActual}, ${pos}° en la tabla.`;
    n.bitacora.push({ dia: n.dia, texto:
      "La dirigencia decidió cortar el ciclo. Gracias por todo." });
  } else if (n.paciencia < 25) {
    n.bitacora.push({ dia: n.dia, texto:
      "La dirigencia se reunió de urgencia. El puesto está en discusión." });
  }
}

export const miles = (usd: number) =>
  usd >= 1_000_000 ? `USD ${(usd / 1_000_000).toFixed(2)}M` : `USD ${Math.round(usd / 1000)}k`;

// ---------------------------------------------------------------- avance de días

function estructurado<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T;
}

export interface ResultadoAvance {
  partida: Partida;
  novedades: string[];
}

/**
 * Un día. Recupera condición, cura lesionados y dispara lo que corresponda.
 * Si queda algo pendiente, el día siguiente no avanza hasta resolverlo.
 */
export function avanzarUnDia(p: Partida): ResultadoAvance {
  const n: Partida = estructurado(p);
  const novedades: string[] = [];
  n.dia = sumarDias(p.dia, 1);
  const rng = new Rng(`dia-${n.dia}-${n.fechaActual}`);

  const entrena = n.entrenamiento;
  void novedades;
  for (const j of PLANTEL) {
    const e = n.plantel[j.id];
    if (e.lesionadoHasta && e.lesionadoHasta <= n.dia) {
      e.lesionadoHasta = null;
      novedades.push(`${j.apellido} se recuperó y ya está a disposición.`);
    }
    if (e.lesionadoHasta) continue;

    let tasa = j.edad >= 33 ? P.recuperacionVeterano : P.recuperacionPorDia;
    if (entrena === "recuperacion") tasa *= 1.6;
    if (entrena === "tactico") tasa *= 0.85;
    if (entrena === "individual") tasa *= 0.9;
    e.condicion = clamp(e.condicion + tasa, 0, 100);

    // La moral de cada uno tiende al clima del vestuario: un plantel roto
    // arrastra a todos, uno unido levanta al que está caído.
    e.moral = clamp(e.moral + (n.ambiente - e.moral) * 0.06, 0, 100);
    // con el vestuario partido, además se cae solo
    if (n.ambiente < 30) e.moral = clamp(e.moral - 0.8, 0, 100);

    // Los juveniles crecen con minutos y con el trabajo individual. Su margen
    // es exactamente la incertidumbre de Nivel que traen.
    const margen = j.nivel_incertidumbre;
    if (margen > 0 && e.crecimiento < margen) {
      let sube = 0;
      if (entrena === "individual" && n.entrenaA === j.id) sube += 0.10;
      if (e.minutos > 0) sube += (e.minutos / 900) * 0.05;
      if (sube > 0 && rng.chance(0.35)) {
        e.crecimiento = Math.min(margen, e.crecimiento + sube);
        if (Math.floor(e.crecimiento) > Math.floor(e.crecimiento - sube)) {
          n.bitacora.push({ dia: n.dia, texto:
            `${j.apellido} dio un salto: ahora es nivel ${j.nivel + Math.floor(e.crecimiento)}.` });
        }
      }
    }
  }

  // asuntos que aparecen solos
  const alPartido = diasAlPartido(n);

  if (esLunes(n.dia) && !n.entrenamiento && alPartido !== null && alPartido > 1) {
    n.pendientes.push({
      id: `ent-${n.dia}`, tipo: "entrenamiento", dia: n.dia,
      titulo: "Plan de la semana",
      detalle: "¿En qué se enfoca el trabajo hasta el partido?",
    });
  }

  if (alPartido === 1 && !n.pendientes.some((a) => a.tipo === "marketing")) {
    const m = partidoDe(n);
    if (m?.ctx.esLocal) {
      n.pendientes.push({
        id: `mkt-${n.dia}`, tipo: "marketing", dia: n.dia,
        titulo: "Precio de la entrada",
        detalle: `Mañana se juega en ${m.estadio}. ¿A cuánto se vende?`,
      });
    }
  }

  // una situación cada tanto, nunca el día del partido ni el anterior
  if ((alPartido === null || alPartido > 1) && !n.pendientes.length && rng.chance(0.3)) {
    const armada = sortearSituacion({
      plantel: plantelDe(n),
      ambiente: n.ambiente,
      hinchada: n.hinchada,
      racha: n.resultados.slice(-3).map((r) =>
        r.golesOlimpia > r.golesRival ? "G" : r.golesOlimpia === r.golesRival ? "E" : "P"),
      posicion: 0,
    }, rng);
    if (armada) {
      n.pendientes.push({
        id: `sit-${n.dia}`, tipo: "evento", dia: n.dia,
        titulo: armada.s.titulo, detalle: armada.s.contexto,
        situacion: armada.s, efectos: armada.efectos,
      });
    }
  }

  // ofertas por los mejores
  if (!n.ofertas.length && rng.chance(0.14)) {
    const o = sortearOferta(plantelDe(n), n.dia);
    if (o) {
      n.ofertas.push({
        id: `of-${n.dia}`, jugadorId: o.jugadorId, club: o.club,
        montoUsd: o.montoUsd, venceEl: sumarDias(n.dia, 4),
      });
      const j = PLANTEL.find((x) => x.id === o.jugadorId)!;
      n.pendientes.push({
        id: `ofp-${n.dia}`, tipo: "oferta", dia: n.dia,
        titulo: "Llegó una oferta",
        detalle: `${o.club} ofrece ${miles(o.montoUsd)} por ${j.apellido}.`,
        datos: { ofertaId: `of-${n.dia}` },
      });
    }
  }

  return { partida: n, novedades };
}

// ---------------------------------------------------------------- decisiones

export function resolverAsunto(p: Partida, asuntoId: string, opcionId: string): Partida {
  const n: Partida = estructurado(p);
  const a = n.pendientes.find((x) => x.id === asuntoId);
  if (!a) return n;
  n.pendientes = n.pendientes.filter((x) => x.id !== asuntoId);

  if (a.tipo === "entrenamiento") {
    n.entrenamiento = opcionId as Enfoque;
    if (opcionId === "individual") {
      // se entrena al juvenil con más margen de crecimiento
      const juveniles = PLANTEL.filter((j) => j.nivel_incertidumbre > 0);
      n.entrenaA = juveniles.sort((x, y) => y.nivel_incertidumbre - x.nivel_incertidumbre)[0]?.id ?? null;
    }
    n.bitacora.push({ dia: n.dia, texto:
      opcionId === "recuperacion" ? "Semana de recuperación: se baja la carga."
      : opcionId === "tactico" ? "Semana táctica: se trabaja el partido."
      : "Semana de trabajo individual con los juveniles." });
    return n;
  }

  if (a.tipo === "marketing") {
    const precios: Record<string, number> = { barato: 35, normal: 60, caro: 100 };
    n.precioEntrada = precios[opcionId] ?? 60;
    n.hinchada = clamp(
      n.hinchada + (opcionId === "barato" ? 6 : opcionId === "caro" ? -9 : -1), 0, 100);
    n.bitacora.push({ dia: n.dia, texto:
      `Entradas a ${n.precioEntrada} mil. Se espera ${Math.round(ocupacionDe(n) * 100)}% del estadio.` });
    return n;
  }

  if (a.tipo === "oferta") {
    const oferta = n.ofertas.find((o) => o.id === (a.datos?.ofertaId as string));
    if (!oferta) return n;
    n.ofertas = n.ofertas.filter((o) => o.id !== oferta.id);
    const j = PLANTEL.find((x) => x.id === oferta.jugadorId)!;
    if (opcionId === "vender") {
      n.dineroUsd += oferta.montoUsd;
      n.plantel[oferta.jugadorId].lesionadoHasta = "2099-01-01"; // sale del plantel
      n.hinchada = clamp(n.hinchada - (j.nivel >= 68 ? 9 : 3), 0, 100);
      n.ambiente = clamp(n.ambiente - 3, 0, 100);
      n.bitacora.push({ dia: n.dia, texto:
        `${j.apellido} se va a ${oferta.club} por ${miles(oferta.montoUsd)}.` });
    } else {
      n.ambiente = clamp(n.ambiente + 2, 0, 100);
      n.plantel[oferta.jugadorId].moral = clamp(n.plantel[oferta.jugadorId].moral - 6, 0, 100);
      n.bitacora.push({ dia: n.dia, texto: `Se rechazó la oferta por ${j.apellido}.` });
    }
    return n;
  }

  if (a.situacion?.id === "sponsor") n.sponsorConBonus = opcionId === "variable";

  // situación de prensa, vestuario o dirigencia
  const efecto = a.efectos?.[opcionId];
  if (efecto) {
    if (efecto.ambiente) n.ambiente = clamp(n.ambiente + efecto.ambiente, 0, 100);
    if (efecto.hinchada) n.hinchada = clamp(n.hinchada + efecto.hinchada, 0, 100);
    if (efecto.dineroUsd) n.dineroUsd += efecto.dineroUsd;
    if (efecto.moralDe) {
      const e = n.plantel[efecto.moralDe.id];
      if (e) e.moral = clamp(e.moral + efecto.moralDe.delta, 0, 100);
    }
    if (efecto.condicionTodos) {
      for (const id of Object.keys(n.plantel)) {
        n.plantel[id].condicion = clamp(n.plantel[id].condicion + efecto.condicionTodos, 0, 100);
      }
    }
    n.bitacora.push({ dia: n.dia, texto: efecto.texto });
  }
  return n;
}

/** Comprar del mercado. El refuerzo entra al plantel y queda disponible. */
export function fichar(p: Partida, fichajeId: string): Partida | null {
  const f = p.fichajes.find((x) => x.id === fichajeId);
  if (!f || f.precioUsd > p.dineroUsd) return null;
  const n: Partida = estructurado(p);
  n.dineroUsd -= f.precioUsd;
  n.fichajes = n.fichajes.filter((x) => x.id !== fichajeId);

  const usados = new Set(plantelDe(n).map((j) => j.numero));
  let numero = 2;
  while (usados.has(numero) && numero < 45) numero++;

  const jugador: Jugador = {
    id: f.id,
    nombre: f.nombre,
    apellido: f.apellido,
    numero,
    posicion: f.posicion,
    posiciones_secundarias: [],
    edad: f.edad,
    fecha_nacimiento: `${2026 - f.edad}-01-01`,
    nacionalidad: f.nacionalidad,
    extranjero: f.extranjero,
    nivel: f.nivel,
    nivel_incertidumbre: f.edad <= 21 ? 8 : 0,
    condicion: 88,
    forma: "neutral",
    partidos_internacionales: f.extranjero ? 12 : 4,
    rasgos: [],
    lesionado_hasta: null,
    tarjetas_amarillas: 0,
    suspendido: false,
    valor_comercial: f.valorComercial,
  };
  n.incorporados = [...(n.incorporados ?? []), jugador];
  n.plantel[jugador.id] = {
    condicion: 88, amarillas: 0, suspendidoFechas: 0, lesionadoHasta: null,
    golesTorneo: 0, minutos: 0, moral: 78, forma: "neutral", crecimiento: 0,
  };
  n.ambiente = clamp(n.ambiente + 2, 0, 100);
  n.bitacora.push({ dia: n.dia, texto:
    `Refuerzo: llega ${f.apellido} (${f.posicion}, nivel ${f.nivel}) por ${miles(f.precioUsd)}.` });
  return n;
}

const esLunes = (dia: string) => new Date(dia + "T12:00:00").getDay() === 1;
