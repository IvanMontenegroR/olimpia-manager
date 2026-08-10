"use client";

import { PLANTEL, partidosDeOlimpia, type PartidoUI } from "./juego.ts";
import { P, clamp } from "@/engine/motor.ts";
import { Rng } from "@/engine/rng.ts";
import equiposJson from "@/data/equipos_2026.json";
import fixtureJson from "@/data/fixture_clausura2026_final.json";
import type { Jugador } from "@/engine/tipos.ts";

const EQUIPOS = equiposJson as any[];
const FIXTURE = fixtureJson as any[];
const CLAVE = "olimpia-manager-clausura-2026";
const VERSION = 3;

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
  suspendido: boolean;
  lesionadoHasta: number | null; // número de fecha
  golesTorneo: number;
  minutos: number;
}

export interface Partida {
  version: number;
  fechaActual: number; // 1..22
  resultados: ResultadoFecha[];
  plantel: Record<string, EstadoPlantel>;
  minutosSub18: number;
}

export const OBJETIVO = "Salir campeón del Clausura";

export function partidaNueva(): Partida {
  return {
    version: VERSION,
    fechaActual: 1,
    resultados: [],
    plantel: Object.fromEntries(PLANTEL.map((j) => [j.id, {
      condicion: j.condicion,
      amarillas: 0,
      suspendido: false,
      lesionadoHasta: null,
      golesTorneo: 0,
      minutos: 0,
    }])),
    minutosSub18: 0,
  };
}

export function cargar(): Partida {
  if (typeof window === "undefined") return partidaNueva();
  try {
    const raw = window.localStorage.getItem(CLAVE);
    if (!raw) return partidaNueva();
    const p = JSON.parse(raw) as Partida;
    if (p.version !== VERSION) return partidaNueva();
    // por si el plantel cambió entre versiones
    for (const j of PLANTEL) {
      p.plantel[j.id] ??= {
        condicion: j.condicion, amarillas: 0, suspendido: false,
        lesionadoHasta: null, golesTorneo: 0, minutos: 0,
      };
    }
    return p;
  } catch {
    return partidaNueva();
  }
}

export function guardar(p: Partida): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CLAVE, JSON.stringify(p));
  } catch { /* sin espacio o modo privado: se sigue jugando en memoria */ }
}

export function borrar(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(CLAVE);
}

/** El plantel con la condición y las sanciones que dejó lo jugado hasta acá. */
export function plantelDe(p: Partida): Jugador[] {
  return PLANTEL.map((j) => {
    const e = p.plantel[j.id];
    if (!e) return j;
    return {
      ...j,
      condicion: Math.round(e.condicion),
      suspendido: e.suspendido,
      lesionado_hasta: e.lesionadoHasta && e.lesionadoHasta > p.fechaActual ? "futuro" : null,
      tarjetas_amarillas: e.amarillas,
    };
  });
}

export const disponible = (j: Jugador) => !j.suspendido && !j.lesionado_hasta;

// ---------------------------------------------------------------- tabla

export interface FilaTabla {
  id: string;
  nombre: string;
  pj: number; g: number; e: number; p: number;
  gf: number; gc: number; dg: number; pts: number;
}

/**
 * Tabla de posiciones. Los partidos de Olimpia son los que jugaste; el resto
 * de la liga se simula con una semilla fija, así la tabla no cambia sola cada
 * vez que se abre la pantalla.
 */
export function tablaDe(p: Partida): FilaTabla[] {
  const fuerzas: Record<string, number> = Object.fromEntries(
    EQUIPOS.map((e) => [e.id, e.fuerza]));
  const filas: Record<string, FilaTabla> = Object.fromEntries(
    EQUIPOS.map((e) => [e.id, {
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
    anotar(local, gl, gv);
    anotar(visita, gv, gl);
  }

  const rng = new Rng("liga-clausura-2026");
  for (const m of FIXTURE) {
    if (m.fecha_numero >= p.fechaActual) continue;
    if (m.local === "olimpia" || m.visitante === "olimpia") continue;
    const xl = P.xgBase * Math.exp(P.xgK * (fuerzas[m.local] + P.localiaLiga - fuerzas[m.visitante]));
    const xv = P.xgBase * Math.exp(P.xgK * (fuerzas[m.visitante] - fuerzas[m.local] - P.localiaLiga));
    const gl = rng.poisson(clamp(xl, 0.05, 6));
    const gv = rng.poisson(clamp(xv, 0.05, 6));
    anotar(m.local, gl, gv);
    anotar(m.visitante, gv, gl);
  }

  return Object.values(filas).sort(
    (a, b) => b.pts - a.pts || b.dg - a.dg || b.gf - a.gf || a.nombre.localeCompare(b.nombre));
}

export const posicionDe = (p: Partida, id = "olimpia") =>
  tablaDe(p).findIndex((f) => f.id === id) + 1;

// ---------------------------------------------------------------- avance

export interface CierrePartido {
  golesOlimpia: number;
  golesRival: number;
  minutos: Map<string, number>;
  amarillas: string[];
  rojas: string[];
  lesionados: { id: string; fechas: number }[];
  goleadores: string[];
}

const AMARILLAS_PARA_SUSPENSION = 5;

/** Cierra la fecha: descuenta condición, aplica sanciones y avanza el calendario. */
export function avanzarFecha(p: Partida, partido: PartidoUI, cierre: CierrePartido): Partida {
  const n: Partida = JSON.parse(JSON.stringify(p));

  n.resultados.push({
    fechaNumero: p.fechaActual,
    rivalId: partido.rivalId,
    esLocal: partido.ctx.esLocal,
    golesOlimpia: cierre.golesOlimpia,
    golesRival: cierre.golesRival,
  });

  const jugaron = new Set(cierre.minutos.keys());

  for (const j of PLANTEL) {
    const e = n.plantel[j.id];
    const min = cierre.minutos.get(j.id) ?? 0;

    if (min > 0) {
      let desgaste = P.desgaste90 * (min / 90);
      desgaste += (partido.ctx.viajeKm / 1000) * P.desgasteViajeKm;
      if (j.edad >= 33) desgaste += P.desgasteVeterano * (min / 90);
      e.condicion = clamp(e.condicion - desgaste, 0, 100);
      e.minutos += min;
      if (j.fecha_nacimiento >= "2007-01-01" && min >= 90) n.minutosSub18 += 90;
    } else {
      const tasa = j.edad >= 33 ? P.recuperacionVeterano : P.recuperacionPorDia;
      e.condicion = clamp(e.condicion + tasa * 6, 0, 100);
    }

    // las suspensiones duran una fecha
    e.suspendido = false;
    if (cierre.amarillas.includes(j.id)) {
      e.amarillas++;
      if (e.amarillas >= AMARILLAS_PARA_SUSPENSION) { e.amarillas = 0; e.suspendido = true; }
    }
    if (cierre.rojas.includes(j.id)) e.suspendido = true;

    const les = cierre.lesionados.find((l) => l.id === j.id);
    if (les) e.lesionadoHasta = p.fechaActual + les.fechas;
    else if (e.lesionadoHasta && e.lesionadoHasta <= p.fechaActual) e.lesionadoHasta = null;

    e.golesTorneo += cierre.goleadores.filter((g) => g === j.id).length;
    void jugaron;
  }

  n.fechaActual = p.fechaActual + 1;
  return n;
}

export function partidoDe(p: Partida): PartidoUI | null {
  return partidosDeOlimpia().find((x) => x.etiqueta.endsWith(`Fecha ${p.fechaActual}`)) ?? null;
}

export const TOTAL_FECHAS = 22;
