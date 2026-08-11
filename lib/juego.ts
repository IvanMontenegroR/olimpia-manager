import plantelJson from "@/data/plantel_olimpia_2026.json";
import fixtureJson from "@/data/fixture_clausura2026_final.json";
import equiposJson from "@/data/equipos_2026.json";
import { nivelEfectivo } from "@/engine/motor.ts";
import type { ContextoPartido, Jugador, Posicion } from "@/engine/tipos.ts";

export const PLANTEL = plantelJson as unknown as Jugador[];
const EQUIPOS = equiposJson as any[];
const FIXTURE = fixtureJson as any[];

export const CUPO_EXTRANJEROS = 4;
export const SUB18_DESDE = "2007-01-01";
export const esSub18 = (j: Jugador) => j.fecha_nacimiento >= SUB18_DESDE;

/** Cada formación es una lista de once puestos concretos, no un conteo por línea. */
export const MOLDES: { nombre: string; puestos: Posicion[] }[] = [
  { nombre: "4-3-3",   puestos: ["ARQ", "LD", "DFC", "DFC", "LI", "MCD", "MC", "MC", "ED", "DC", "EI"] },
  { nombre: "4-4-2",   puestos: ["ARQ", "LD", "DFC", "DFC", "LI", "MD", "MC", "MC", "MI", "DC", "DC"] },
  { nombre: "4-2-3-1", puestos: ["ARQ", "LD", "DFC", "DFC", "LI", "MCD", "MCD", "ED", "MCO", "EI", "DC"] },
  { nombre: "4-3-1-2", puestos: ["ARQ", "LD", "DFC", "DFC", "LI", "MCD", "MC", "MC", "MCO", "DC", "DC"] },
  { nombre: "4-5-1",   puestos: ["ARQ", "LD", "DFC", "DFC", "LI", "MD", "MCD", "MC", "MCO", "MI", "DC"] },
  { nombre: "3-5-2",   puestos: ["ARQ", "DFC", "DFC", "DFC", "MD", "MCD", "MC", "MCO", "MI", "DC", "DC"] },
  { nombre: "5-3-2",   puestos: ["ARQ", "LD", "DFC", "DFC", "DFC", "LI", "MCD", "MC", "MC", "DC", "DC"] },
  { nombre: "3-4-3",   puestos: ["ARQ", "DFC", "DFC", "DFC", "MD", "MCD", "MC", "MI", "ED", "DC", "EI"] },
];

export interface Asignacion {
  molde: string;
  puestos: Map<string, Posicion>;
  total: number;
  adaptados: Jugador[];
  fueraDePuesto: Jugador[];
}

export const MOLDE_DE = (nombre: string) =>
  MOLDES.find((m) => m.nombre === nombre)?.puestos ?? MOLDES[0].puestos;

/** Una alineación son once casilleros: el jugador que ocupa cada puesto, o nadie. */
export type Alineado = (string | null)[];

/**
 * Reparte a estos jugadores entre los casilleros de una formación, buscando el
 * mejor encaje global. Los que ya vienen con casillero asignado se respetan:
 * así arrastrar a alguien a un puesto no se deshace al recalcular.
 */
export function repartirEnMolde(
  jugadores: Jugador[], slots: Posicion[], ctx: ContextoPartido,
): Alineado {
  const alineado: Alineado = new Array(slots.length).fill(null);
  const parejas: { id: string; slot: number; valor: number }[] = [];
  for (const j of jugadores) {
    for (let s = 0; s < slots.length; s++) {
      parejas.push({ id: j.id, slot: s, valor: nivelEfectivo(j, slots[s], ctx) });
    }
  }
  parejas.sort((a, b) => b.valor - a.valor);

  const puesto = new Set<string>();
  for (const { id, slot } of parejas) {
    if (puesto.has(id) || alineado[slot]) continue;
    alineado[slot] = id;
    puesto.add(id);
  }
  return alineado;
}

/** La formación que mejor le calza a estos once, con su reparto. */
export function mejorMolde(
  jugadores: Jugador[], ctx: ContextoPartido,
): { formacion: string; alineado: Alineado } {
  const porId = new Map(jugadores.map((j) => [j.id, j]));
  let mejor = { formacion: MOLDES[0].nombre, alineado: [] as Alineado, total: -Infinity };
  for (const { nombre, puestos } of MOLDES) {
    const alineado = repartirEnMolde(jugadores, puestos, ctx);
    let total = 0;
    alineado.forEach((id, s) => {
      const j = id ? porId.get(id) : null;
      if (j) total += nivelEfectivo(j, puestos[s], ctx);
    });
    if (total > mejor.total) mejor = { formacion: nombre, alineado, total };
  }
  return { formacion: mejor.formacion, alineado: mejor.alineado };
}

/**
 * "Once sueltos": el DT elige a los once y el sistema deduce el sistema.
 * Prueba todos los moldes, y dentro de cada uno reparte a los once entre los
 * slots buscando el mejor encaje global. Deja explícito quién termina fuera
 * de su puesto y cuánto pierde por eso.
 */
export function asignarPuestos(once: Jugador[], ctx: ContextoPartido): Asignacion | null {
  if (once.length !== 11) return null;
  let mejor: Asignacion | null = null;

  for (const { nombre, puestos: slots } of MOLDES) {
    // Todas las parejas jugador-slot ordenadas por lo que rinde cada una: se
    // van tomando de la mejor a la peor mientras los dos lados estén libres.
    const parejas: { j: Jugador; slot: number; valor: number }[] = [];
    for (const j of once) {
      for (let s = 0; s < slots.length; s++) {
        parejas.push({ j, slot: s, valor: nivelEfectivo(j, slots[s], ctx) });
      }
    }
    parejas.sort((a, b) => b.valor - a.valor);

    const puestos = new Map<string, Posicion>();
    const slotUsado = new Array(slots.length).fill(false);
    let total = 0;
    for (const { j, slot, valor } of parejas) {
      if (puestos.has(j.id) || slotUsado[slot]) continue;
      puestos.set(j.id, slots[slot]);
      slotUsado[slot] = true;
      total += valor;
      if (puestos.size === 11) break;
    }
    if (puestos.size !== 11) continue;

    if (total > (mejor?.total ?? -Infinity)) {
      const adaptados: Jugador[] = [];
      const fueraDePuesto: Jugador[] = [];
      for (const j of once) {
        const p = puestos.get(j.id)!;
        if (p === j.posicion) continue;
        if (j.posiciones_secundarias.includes(p)) adaptados.push(j);
        else fueraDePuesto.push(j);
      }
      mejor = { molde: nombre, puestos, total, adaptados, fueraDePuesto };
    }
  }
  return mejor;
}

export interface PartidoUI {
  ctx: ContextoPartido;
  rivalId: string;
  rivalNombre: string;
  estadio: string;
  ciudad: string;
  etiqueta: string;
}

/** Partidos de Olimpia en el Clausura, en orden. */
export function partidosDeOlimpia(): PartidoUI[] {
  const porId = Object.fromEntries(EQUIPOS.map((e) => [e.id, e]));
  return FIXTURE
    .filter((p) => p.local === "olimpia" || p.visitante === "olimpia")
    .sort((a, b) => a.fecha_numero - b.fecha_numero)
    .map((p) => {
      const esLocal = p.local === "olimpia";
      const rivalId = esLocal ? p.visitante : p.local;
      const rival = porId[rivalId];
      return {
        rivalId,
        rivalNombre: rival.nombre,
        estadio: p.estadio,
        ciudad: p.ciudad,
        etiqueta: `Clausura · Fecha ${p.fecha_numero}`,
        ctx: {
          fecha: p.fecha,
          competencia: "clausura",
          esLocal,
          rivalFuerza: rival.fuerza,
          rivalNombre: rival.nombre,
          viajeKm: p.viaje_km_olimpia ?? 0,
          alturaM: 43,
          diasDescanso: 6,
          esClasico: rivalId === "cerro_porteno",
        } satisfies ContextoPartido,
      };
    });
}

export function nivelEf(j: Jugador, puesto: Posicion, ctx: ContextoPartido): number {
  return Math.round(nivelEfectivo(j, puesto, ctx));
}

export const BANDERA: Record<string, string> = {
  PAR: "🇵🇾", URU: "🇺🇾", ARG: "🇦🇷", CHI: "🇨🇱", NZL: "🇳🇿",
  BRA: "🇧🇷", COL: "🇨🇴", ECU: "🇪🇨", PER: "🇵🇪", BOL: "🇧🇴", VEN: "🇻🇪",
};

/** Nombre corto para los marcadores, donde no entra el nombre completo. */
const CORTOS: Record<string, string> = {
  cerro_porteno: "Cerro",
  recoleta: "Recoleta",
  sportivo_ameliano: "Ameliano",
  sportivo_luqueno: "Luqueño",
  sportivo_trinidense: "Trinidense",
  san_lorenzo: "San Lorenzo",
  "2_de_mayo": "2 de Mayo",
};
export const nombreCorto = (id: string, nombre: string) =>
  CORTOS[id] ?? nombre.replace(/^(Club|Sportivo|Deportivo)\s+/i, "");

export const colorCondicion = (c: number) =>
  c >= 80 ? "var(--ok)" : c >= 60 ? "var(--medio)" : c >= 40 ? "var(--bajo)" : "var(--critico)";
