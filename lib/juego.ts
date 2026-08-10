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

/** Moldes que el sistema puede deducir a partir de los once elegidos. */
export const MOLDES: { nombre: string; cupos: Record<Posicion, number> }[] = [
  { nombre: "4-3-3", cupos: { ARQ: 1, DEF: 4, MED: 3, DEL: 3 } },
  { nombre: "4-4-2", cupos: { ARQ: 1, DEF: 4, MED: 4, DEL: 2 } },
  { nombre: "4-5-1", cupos: { ARQ: 1, DEF: 4, MED: 5, DEL: 1 } },
  { nombre: "3-5-2", cupos: { ARQ: 1, DEF: 3, MED: 5, DEL: 2 } },
  { nombre: "5-3-2", cupos: { ARQ: 1, DEF: 5, MED: 3, DEL: 2 } },
  { nombre: "5-4-1", cupos: { ARQ: 1, DEF: 5, MED: 4, DEL: 1 } },
  { nombre: "3-4-3", cupos: { ARQ: 1, DEF: 3, MED: 4, DEL: 3 } },
];

export interface Asignacion {
  molde: string;
  puestos: Map<string, Posicion>;
  total: number;
  adaptados: Jugador[];
  fueraDePuesto: Jugador[];
}

/**
 * "Once sueltos": el DT elige a los once y el sistema deduce la formación.
 * Prueba todos los moldes y se queda con el que mejor aprovecha a esos once,
 * dejando explícito quién termina jugando adaptado o fuera de puesto.
 */
export function asignarPuestos(once: Jugador[], ctx: ContextoPartido): Asignacion | null {
  if (once.length !== 11) return null;
  let mejor: Asignacion | null = null;

  for (const { nombre, cupos } of MOLDES) {
    const libres = { ...cupos };
    const puestos = new Map<string, Posicion>();
    let total = 0;

    // primero los que van a su puesto natural, después el resto por mejor encaje
    const pendientes = [...once];
    for (const pos of ["ARQ", "DEF", "MED", "DEL"] as Posicion[]) {
      for (let i = pendientes.length - 1; i >= 0; i--) {
        const j = pendientes[i];
        if (j.posicion === pos && libres[pos] > 0) {
          libres[pos]--;
          puestos.set(j.id, pos);
          total += nivelEfectivo(j, pos, ctx);
          pendientes.splice(i, 1);
        }
      }
    }
    for (const j of pendientes) {
      let mejorPos: Posicion | null = null;
      let mejorVal = -Infinity;
      for (const pos of ["ARQ", "DEF", "MED", "DEL"] as Posicion[]) {
        if (libres[pos] <= 0) continue;
        const v = nivelEfectivo(j, pos, ctx);
        if (v > mejorVal) { mejorVal = v; mejorPos = pos; }
      }
      if (!mejorPos) { total = -Infinity; break; }
      libres[mejorPos]--;
      puestos.set(j.id, mejorPos);
      total += mejorVal;
    }

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
