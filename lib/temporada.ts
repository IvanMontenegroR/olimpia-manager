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
const VERSION = 6;

export const DIA_INICIAL = "2026-07-20";
export const TOTAL_FECHAS = 22;
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

export interface Partida {
  version: number;
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
    }])),
    minutosSub18: 0,
    dineroUsd: 1_800_000,
    ambiente: 72,
    hinchada: 68,
    entrenamiento: null,
    entrenaA: null,
    precioEntrada: 60,
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
  return PLANTEL.map((j) => {
    const e = p.plantel[j.id];
    if (!e) return j;
    return {
      ...j,
      condicion: Math.round(e.condicion),
      suspendido: e.suspendidoFechas > 0,
      lesionado_hasta: e.lesionadoHasta && e.lesionadoHasta > p.dia ? e.lesionadoHasta : null,
      tarjetas_amarillas: e.amarillas,
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

/** El que venga antes. */
export function partidoDe(p: Partida): PartidoUI | null {
  const liga = partidoLigaDe(p);
  const copa = partidoCopaDe(p);
  if (!liga) return copa;
  if (!copa) return liga;
  return copa.ctx.fecha <= liga.ctx.fecha ? copa : liga;
}

export const esPartidoDeCopa = (m: PartidoUI | null) => m?.ctx.competencia === "sudamericana";

export const hayPartidoHoy = (p: Partida) => partidoDe(p)?.ctx.fecha === p.dia;

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

  for (const j of PLANTEL) {
    const e = n.plantel[j.id];
    const min = c.minutos.get(j.id) ?? 0;
    if (min > 0) {
      let desgaste = P.desgaste90 * (min / 90);
      desgaste += (partido.ctx.viajeKm / 1000) * P.desgasteViajeKm;
      if (j.edad >= 33) desgaste += P.desgasteVeterano * (min / 90);
      e.condicion = clamp(e.condicion - desgaste, 0, 100);
      e.minutos += min;
      if (j.fecha_nacimiento >= "2007-01-01" && min >= 90) n.minutosSub18 += 90;
      e.moral = clamp(e.moral + (gano ? 4 : empate ? 0 : -4), 0, 100);
    } else {
      e.moral = clamp(e.moral - 1.5, 0, 100); // el que no juega se calienta
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

  // taquilla y humor de la gente
  if (partido.ctx.esLocal) {
    const entradas = Math.round(
      14000 * (n.hinchada / 70) * (1.5 - n.precioEntrada / 120) * (partido.ctx.esClasico ? 1.5 : 1));
    const recaudado = Math.max(0, entradas) * n.precioEntrada * 0.14;
    n.dineroUsd += Math.round(recaudado);
    n.bitacora.push({ dia: p.dia, texto:
      `Taquilla: ${Math.max(0, entradas).toLocaleString("es")} personas, ${miles(Math.round(recaudado))} de recaudación.` });
  }
  n.hinchada = clamp(n.hinchada + (gano ? 5 : empate ? -1 : -6)
    + (partido.ctx.esClasico ? (gano ? 6 : empate ? 0 : -8) : 0), 0, 100);
  n.ambiente = clamp(n.ambiente + (gano ? 3 : empate ? 0 : -3), 0, 100);

  n.bitacora.push({ dia: p.dia, texto:
    `${partido.ctx.esLocal ? "" : "De visitante. "}Olimpia ${c.golesOlimpia} - ${c.golesRival} ${partido.rivalNombre}.` });

  if (esCopa) {
    avanzarLlave(n, c, partido);
  } else {
    n.fechaActual = p.fechaActual + 1;
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

    if (entrena === "individual" && n.entrenaA === j.id && rng.chance(0.16)) {
      novedades.push(`${j.apellido} viene trabajando muy bien. Se lo nota más suelto.`);
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
    n.hinchada = clamp(n.hinchada + (opcionId === "barato" ? 5 : opcionId === "caro" ? -6 : 0), 0, 100);
    n.bitacora.push({ dia: n.dia, texto:
      `Entradas a ${n.precioEntrada} mil guaraníes.` });
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

/** Comprar del mercado. Devuelve null si no alcanza la plata. */
export function fichar(p: Partida, fichajeId: string): Partida | null {
  const f = p.fichajes.find((x) => x.id === fichajeId);
  if (!f || f.precioUsd > p.dineroUsd) return null;
  const n: Partida = estructurado(p);
  n.dineroUsd -= f.precioUsd;
  n.fichajes = n.fichajes.filter((x) => x.id !== fichajeId);
  n.bitacora.push({ dia: n.dia, texto:
    `Refuerzo: llega ${f.nombre} ${f.apellido} por ${miles(f.precioUsd)}.` });
  return n;
}

const esLunes = (dia: string) => new Date(dia + "T12:00:00").getDay() === 1;
