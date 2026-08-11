import plantelJson from "@/data/plantel_olimpia_2026.json";
import fixtureJson from "@/data/fixture_clausura2026_final.json";
import equiposJson from "@/data/equipos_2026.json";
import { nivelEfectivo } from "@/engine/motor.ts";
import type { Actitud, ContextoPartido, Jugador, Posicion } from "@/engine/tipos.ts";

export const PLANTEL = plantelJson as unknown as Jugador[];
const EQUIPOS = equiposJson as any[];
const FIXTURE = fixtureJson as any[];

export const CUPO_EXTRANJEROS = 4;
export const SUB18_DESDE = "2007-01-01";
export const esSub18 = (j: Jugador) => j.fecha_nacimiento >= SUB18_DESDE;

/**
 * Las formaciones se declaran por líneas, que es como se dibujan y como se
 * hablan: el 4-2-3-1 es cuatro atrás, doble cinco, tres por delante y un
 * punta. Antes la posición en la cancha se deducía del puesto de cada
 * jugador, y eso partía las líneas: el enganche de un 4-2-3-1 caía en una
 * franja propia en vez de ir al lado de los extremos, como corresponde.
 *
 * `x` es la profundidad, 0 el arco propio y 100 el rival. Los `y` de cada
 * línea se reparten solos a lo ancho.
 */
export interface Linea { x: number; puestos: Posicion[] }
export interface Formacion {
  nombre: string;
  descripcion: string;
  lineas: Linea[];
}

const ARQUERO: Linea = { x: 4, puestos: ["ARQ"] };

export const MOLDES: Formacion[] = [
  {
    nombre: "4-3-3", descripcion: "Ancho y ofensivo",
    lineas: [ARQUERO,
      { x: 25, puestos: ["LI", "DFC", "DFC", "LD"] },
      { x: 53, puestos: ["MC", "MCD", "MC"] },
      { x: 83, puestos: ["EI", "DC", "ED"] }],
  },
  {
    nombre: "4-4-2", descripcion: "Dos puntas, clásico",
    lineas: [ARQUERO,
      { x: 25, puestos: ["LI", "DFC", "DFC", "LD"] },
      { x: 54, puestos: ["MI", "MC", "MC", "MD"] },
      { x: 84, puestos: ["DC", "DC"] }],
  },
  {
    nombre: "4-2-3-1", descripcion: "Doble cinco y enganche",
    lineas: [ARQUERO,
      { x: 23, puestos: ["LI", "DFC", "DFC", "LD"] },
      { x: 45, puestos: ["MCD", "MCD"] },
      { x: 69, puestos: ["EI", "MCO", "ED"] },
      { x: 89, puestos: ["DC"] }],
  },
  {
    nombre: "4-3-1-2", descripcion: "Enganche entre líneas",
    lineas: [ARQUERO,
      { x: 23, puestos: ["LI", "DFC", "DFC", "LD"] },
      { x: 46, puestos: ["MC", "MCD", "MC"] },
      { x: 68, puestos: ["MCO"] },
      { x: 89, puestos: ["DC", "DC"] }],
  },
  {
    nombre: "4-5-1", descripcion: "Poblar el medio",
    lineas: [ARQUERO,
      { x: 25, puestos: ["LI", "DFC", "DFC", "LD"] },
      { x: 55, puestos: ["MI", "MC", "MCD", "MC", "MD"] },
      { x: 87, puestos: ["DC"] }],
  },
  {
    // tres centrales, dos carrileros y tres por el medio: la línea de cinco va
    // plana, sin enganche descentrado entre medio
    nombre: "3-5-2", descripcion: "Carrileros largos",
    lineas: [ARQUERO,
      { x: 23, puestos: ["DFC", "DFC", "DFC"] },
      { x: 53, puestos: ["MI", "MC", "MCD", "MC", "MD"] },
      { x: 85, puestos: ["DC", "DC"] }],
  },
  {
    nombre: "5-3-2", descripcion: "Aguantar y salir",
    lineas: [ARQUERO,
      { x: 23, puestos: ["LI", "DFC", "DFC", "DFC", "LD"] },
      { x: 53, puestos: ["MC", "MCD", "MC"] },
      { x: 85, puestos: ["DC", "DC"] }],
  },
  {
    nombre: "3-4-3", descripcion: "Todo al ataque",
    lineas: [ARQUERO,
      { x: 23, puestos: ["DFC", "DFC", "DFC"] },
      { x: 51, puestos: ["MI", "MC", "MC", "MD"] },
      { x: 83, puestos: ["EI", "DC", "ED"] }],
  },
];

/** Los once casilleros de una formación, de atrás hacia adelante. */
export interface Casilla { puesto: Posicion; x: number; y: number }

export function casillasDe(nombre: string): Casilla[] {
  const f = MOLDES.find((m) => m.nombre === nombre) ?? MOLDES[0];
  const casillas: Casilla[] = [];
  for (const linea of f.lineas) {
    const n = linea.puestos.length;
    // Repartidos parejo a lo ancho, con las bandas bien abiertas cuando son
    // varios y al medio cuando es uno solo.
    const desde = n === 1 ? 50 : n === 2 ? 33 : 12;
    const hasta = n === 1 ? 50 : n === 2 ? 67 : 88;
    linea.puestos.forEach((puesto, i) => {
      casillas.push({
        puesto,
        x: linea.x,
        y: n === 1 ? 50 : desde + (i / (n - 1)) * (hasta - desde),
      });
    });
  }
  return casillas;
}

export interface Asignacion {
  molde: string;
  puestos: Map<string, Posicion>;
  total: number;
  adaptados: Jugador[];
  fueraDePuesto: Jugador[];
}

export const MOLDE_DE = (nombre: string): Posicion[] =>
  casillasDe(nombre).map((c) => c.puesto);

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
  for (const { nombre } of MOLDES) {
    const puestos = MOLDE_DE(nombre);
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

  for (const { nombre } of MOLDES) {
    const slots = MOLDE_DE(nombre);
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

/** Once inicial sugerido: el mejor posible respetando cupo y Sub-18. */
export function autoOnce(ctx: PartidoUI["ctx"], plantel: Jugador[]): string[] {
  // Se llena el 4-3-3 slot por slot con el mejor de cada uno, en vez de por
  // línea: así no termina un lateral derecho jugando de izquierdo teniendo un
  // izquierdo natural en el banco.
  const slots: Posicion[] =
    ["ARQ", "LD", "DFC", "DFC", "LI", "MCD", "MC", "MC", "ED", "DC", "EI"];
  const elegidos: Jugador[] = [];
  const usado = new Set<string>();
  let ext = 0;

  const meter = (j: Jugador) => {
    elegidos.push(j);
    usado.add(j.id);
    if (j.extranjero) ext++;
  };

  // El Sub-18 entra primero y consume el slot que mejor le calza, no uno
  // cualquiera: si no se descuenta un slot, el molde queda de doce y el último
  // puesto se pierde al recortar.
  const sub = plantel.filter(esSub18)
    .sort((a, b) => nivelEf(b, b.posicion, ctx) - nivelEf(a, a.posicion, ctx))[0];
  if (sub) {
    meter(sub);
    const suyo = slots.indexOf(sub.posicion);
    slots.splice(suyo >= 0 ? suyo : slots.length - 1, 1);
  }

  // Cada vuelta es un slot: contar por puesto natural saltea slots y deja el
  // once en diez, que es lo que trababa la pantalla.
  for (const puesto of slots) {
    const cand = plantel
      .filter((j) => !usado.has(j.id))
      .sort((a, b) => nivelEf(b, puesto, ctx) - nivelEf(a, puesto, ctx));
    const j = cand.find((c) => !c.extranjero || ext < CUPO_EXTRANJEROS);
    if (j) meter(j);
  }

  // Red de seguridad por si el cupo de extranjeros dejó algún hueco.
  for (const j of [...plantel].sort((a, b) => b.nivel - a.nivel)) {
    if (elegidos.length >= 11) break;
    if (usado.has(j.id)) continue;
    if (j.extranjero && ext >= CUPO_EXTRANJEROS) continue;
    meter(j);
  }
  return elegidos.slice(0, 11).map((j) => j.id);
}

/**
 * Los siete del banco: primero un arquero, después los mejores que queden. La
 * reserva no cuenta salvo que la hayas subido a mano.
 */
export function bancoSugerido(
  aptos: Jugador[], once: Jugador[], ctx: ContextoPartido,
): Jugador[] {
  const dentro = new Set(once.map((j) => j.id));
  const libres = aptos.filter((j) => !dentro.has(j.id) && !j.reserva);
  const porNivel = (a: Jugador, b: Jugador) =>
    nivelEf(b, b.posicion, ctx) - nivelEf(a, a.posicion, ctx);
  const arquero = libres.filter((j) => j.posicion === "ARQ").sort(porNivel)[0];
  return [
    ...(arquero ? [arquero] : []),
    ...libres.filter((j) => j.posicion !== "ARQ").sort(porNivel).slice(0, 6),
  ];
}

/**
 * El equipo con el que sale Olimpia si no tocás nada. Lo usan el botón de
 * jugar directo y la pantalla de armado, así que los dos parten de lo mismo.
 */
export function salidaAutomatica(partido: PartidoUI, plantel: Jugador[]) {
  const { ctx } = partido;
  const aptos = plantel.filter((j) => !j.suspendido && !j.lesionado_hasta);
  const porId = new Map(aptos.map((j) => [j.id, j]));

  const elegidos = autoOnce(ctx, aptos.filter((j) => !j.reserva))
    .map((id) => porId.get(id)!).filter(Boolean);
  const { formacion, alineado } = mejorMolde(elegidos, ctx);
  const slots = MOLDE_DE(formacion);

  const once = alineado.map((id) => (id ? porId.get(id) : null)).filter(Boolean) as Jugador[];
  const puestos = new Map<string, Posicion>();
  alineado.forEach((id, s) => { if (id) puestos.set(id, slots[s]); });

  return {
    once,
    suplentes: bancoSugerido(aptos, once, ctx),
    actitud: (ctx.esLocal ? "ofensivo" : "equilibrado") as Actitud,
    puestos,
  };
}
