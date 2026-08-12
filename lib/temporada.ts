"use client";

import {
  CUPO_EXTRANJEROS, MOLDE_DE, PLANTEL, esSub18, partidosDeOlimpia, repartirEnMolde,
  type PartidoUI,
} from "./juego.ts";
import { P, clamp, factorCondicion, recuperar } from "@/engine/motor.ts";
import { Rng } from "@/engine/rng.ts";
import equiposJson from "@/data/equipos_2026.json";
import fixtureJson from "@/data/fixture_clausura2026_final.json";
import rivalesJson from "@/data/rivales_internacionales.json";
import { condicionRival, fuerzaBaseAjustada } from "./rivales.ts";
import { sortearSituacion, type Efecto, type Situacion } from "@/engine/situaciones.ts";
import { generarMercado, sortearOferta, type FichajeGenerado } from "@/engine/mercado.ts";
import {
  DIAS_DE_VENTANA, ESTRELLAS, impactoDe, jugadorDeEstrella, sortearEstrella,
} from "@/engine/estrellas.ts";
import type { Jugador } from "@/engine/tipos.ts";

const EQUIPOS = equiposJson as any[];
const FIXTURE = fixtureJson as any[];
const RIVALES = rivalesJson as any[];
const CLAVE = "olimpia-manager-clausura-2026";
const VERSION = 14;

export const DIA_INICIAL = "2026-07-20";
export const TOTAL_FECHAS = 22;
/** Capacidad del Defensores del Chaco. */
export const AFORO = 36_000;
export const OBJETIVO = "Salir campeón del Clausura";

export type RondaCopa = "octavos" | "cuartos" | "semis" | "final" | "eliminado" | "campeon";

export const NOMBRE_RONDA: Record<string, string> = {
  octavos: "octavos", cuartos: "cuartos", semis: "semifinales", final: "la final",
  eliminado: "eliminado", campeon: "campeón",
};

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
  /** Cómo está anímicamente, 0 a 100. Junta lo que eran moral y forma. */
  animo: number;
  /** Cuánto subió de Nivel con minutos y trabajo individual. */
  crecimiento: number;
}

export interface Oferta {
  id: string;
  jugadorId: string;
  club: string;
  montoUsd: number;
  venceEl: string;
  /** Si el jugador quiere irse, rechazarla le cae mal. Si está cómodo, no. */
  quiereIrse: boolean;
}

export type Fichaje = FichajeGenerado;

/** Algo que espera una decisión. El día no avanza hasta resolverlo. */
export interface Asunto {
  id: string;
  tipo: "evento" | "oferta" | "marketing" | "prensa" | "viaje";
  dia: string;
  titulo: string;
  detalle: string;
  datos?: Record<string, unknown>;
  situacion?: Situacion;
  efectos?: Record<string, Efecto>;
}

/**
 * Una línea del diario. Las que importan llevan `marca` y se dibujan distinto:
 * un resultado, una lesión y "se firmó el sponsor" no pueden leerse todas
 * iguales, que era lo que hacía que todo pareciera lo mismo.
 */
export type MarcaDiario =
  | "victoria" | "derrota" | "empate" | "titulo" | "golpe" | "plata" | "aviso";

export interface EntradaDiario {
  dia: string;
  texto: string;
  marca?: MarcaDiario;
  /** Dato corto y grande, como el marcador. */
  cifra?: string;
}

/**
 * Un momento que merece su propia pantalla. Son pocos y son los que uno se
 * acuerda: salir campeón, quedar afuera de la copa, que te echen. El resto de
 * lo que pasa va a la bitácora.
 */
export type TipoHito =
  | "campeon_liga" | "campeon_copa" | "eliminado_copa" | "despedido"
  | "fin_temporada" | "fichaje" | "lesion" | "revelacion";

export interface Hito {
  tipo: TipoHito;
  titulo: string;
  detalle: string;
  /** Dato grande de la pantalla: el marcador, la posición, los puntos. */
  cifra?: string;
  pie?: string;
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
  precioEntrada: number; // en miles de guaraníes
  /** Se firmó el contrato con premio por objetivos. */
  sponsorConBonus: boolean;
  /** Puntos que sacó la APF por incumplir la regla Sub-18. */
  puntosDescontados: number;
  /** Cuánto te banca la dirigencia, 0 a 100. En cero te echan. */
  paciencia: number;
  /** Si te echaron, por qué. */
  despedido: string | null;
  /** Lo que hay que mostrar a pantalla completa antes de seguir. */
  hito: Hito | null;
  /** Cómo salió la última apuesta, para poder mostrarla antes de continuar. */
  resultadoApuesta: { salioBien: boolean; texto: string; chance: number } | null;

  /**
   * La oportunidad de fichaje que está sobre la mesa, si hay alguna. Tiene
   * fecha de vencimiento: no es un catálogo donde ahorrar tranquilo.
   */
  estrella: { id: string; venceEl: string } | null;
  /** Las que ya aparecieron, para no repetirlas. */
  estrellasVistas: string[];

  /** Alineaciones guardadas por el DT: el titular, el equipo de copa, etc. */
  equipos: EquipoGuardado[];
  /**
   * Quiénes están en la reserva. Arranca con los que vienen marcados en el
   * plantel y lo maneja el DT: subir a un pibe es una decisión, no un dato
   * fijo. Sirve para que la pantalla del partido muestre a los que compiten y
   * no a los treinta y tres del club.
   */
  enReserva: string[];
  /**
   * Cómo se preparó el viaje del próximo partido de visitante, 0 a 1. Recorta
   * el castigo de la altura y el desgaste del vuelo. Se consume al jugar.
   */
  aclimatacion: number;

  copa: EstadoCopa;
  ofertas: Oferta[];
  fichajes: Fichaje[];
  pendientes: Asunto[];
  bitacora: EntradaDiario[];
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

/**
 * Los dos equipos con los que arranca el DT: el titular y un alternativo para
 * rotar. Vienen armados porque rotar es el centro del juego y no tiene sentido
 * que la primera vez que lo necesitás haya que armar once nombres a mano.
 *
 * El alternativo no es "los once peores": es el mejor equipo posible sin usar
 * a ninguno de los titulares, que es lo que de verdad se pone un domingo
 * cuando el jueves hay copa.
 */
function equiposIniciales(): EquipoGuardado[] {
  const ctx = {
    fecha: DIA_INICIAL, competencia: "clausura" as const, esLocal: true,
    rivalFuerza: 62, rivalNombre: "—", viajeKm: 0, alturaM: 43,
    diasDescanso: 6, esClasico: false,
  };
  const slots = MOLDE_DE("4-3-3");

  const armar = (disponibles: typeof PLANTEL): string[] => {
    // se respeta el cupo de extranjeros sacando a los que sobran por nivel
    let ext = 0;
    const elegibles = [...disponibles]
      .sort((a, b) => b.nivel - a.nivel)
      .filter((j) => {
        if (!j.extranjero) return true;
        if (ext >= CUPO_EXTRANJEROS) return false;
        ext++;
        return true;
      });
    return repartirEnMolde(elegibles, slots, ctx).filter(Boolean) as string[];
  };

  const primerEquipo = PLANTEL.filter((j) => !j.reserva);
  const titular = armar(primerEquipo);
  const usados = new Set(titular);
  const suplente = armar(primerEquipo.filter((j) => !usados.has(j.id)));

  const equipos: EquipoGuardado[] = [
    { nombre: "Titular", formacion: "4-3-3", jugadores: titular },
  ];
  if (suplente.length === 11) {
    equipos.push({ nombre: "Alternativo", formacion: "4-3-3", jugadores: suplente });
  }
  return equipos;
}

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
      animo: 70,
      crecimiento: 0,
    }])),
    minutosSub18: 0,
    dineroUsd: 1_800_000,
    ambiente: 72,
    hinchada: 68,
    precioEntrada: 60,
    equipos: equiposIniciales(),
    enReserva: PLANTEL.filter((j) => j.reserva).map((j) => j.id),
    aclimatacion: 0,
    sponsorConBonus: false,
    puntosDescontados: 0,
    paciencia: 70,
    despedido: null,
    hito: null,
    resultadoApuesta: null,
    estrella: null,
    estrellasVistas: [],
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
      if (!p.plantel[id]) continue;
      p.plantel[id] = { ...p.plantel[id], ...e };
      // partidas de antes de fusionar moral y forma en ánimo
      const viejo = e as unknown as { moral?: number; forma?: string };
      if (p.plantel[id].animo === undefined && viejo.moral !== undefined) {
        const empuje = viejo.forma === "en_racha" ? 12 : viejo.forma === "en_baja" ? -12 : 0;
        p.plantel[id].animo = clamp(viejo.moral + empuje, 0, 100);
      }
    }
    p.resultados ??= [];
    p.ofertas ??= [];
    p.fichajes ??= [];
    p.pendientes ??= [];
    p.bitacora ??= [];
    p.equipos ??= [];
    p.enReserva ??= PLANTEL.filter((j) => j.reserva).map((j) => j.id);
    p.aclimatacion ??= 0;
    p.hito ??= null;
    p.resultadoApuesta ??= null;
    p.estrella ??= null;
    p.estrellasVistas ??= [];
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
  const reserva = new Set(p.enReserva ?? []);
  return [...PLANTEL, ...(p.incorporados ?? [])].map((j) => {
    const e = p.plantel[j.id];
    if (!e) return { ...j, reserva: reserva.has(j.id) };
    return {
      ...j,
      reserva: reserva.has(j.id),
      nivel: j.nivel + Math.floor(e.crecimiento ?? 0),
      nivel_incertidumbre: Math.max(0, j.nivel_incertidumbre - Math.floor(e.crecimiento ?? 0)),
      condicion: Math.round(e.condicion),
      suspendido: e.suspendidoFechas > 0,
      lesionado_hasta: e.lesionadoHasta && e.lesionadoHasta > p.dia ? e.lesionadoHasta : null,
      tarjetas_amarillas: e.amarillas,
      animo: Math.round(e.animo),
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
      aclimatacion: elegido.ctx.esLocal ? 0 : p.aclimatacion,
      // Los rivales de liga arrastran su propio calendario; los de copa llegan
      // enteros porque su fixture internacional no está modelado. La fuerza va
      // ajustada para que el desgaste no les cambie el promedio del torneo.
      ...(elegido.ctx.competencia === "clausura" ? {
        rivalFuerza: fuerzaBaseAjustada(elegido.rivalId, elegido.ctx.rivalFuerza),
        rivalCondicion: condicionRival(elegido.rivalId, elegido.ctx.fecha),
      } : { rivalCondicion: 100 }),
    },
  };
}

/**
 * Un viaje se planifica cuando pesa: mucho kilómetro o mucha altura. Contra
 * Recoleta en Asunción no hay nada que decidir.
 */
export function viajeExigente(m: PartidoUI): boolean {
  return !m.ctx.esLocal && (m.ctx.viajeKm >= 800 || m.ctx.alturaM >= 1500);
}

export const esPartidoDeCopa = (m: PartidoUI | null) => m?.ctx.competencia === "sudamericana";

export const hayPartidoHoy = (p: Partida) => partidoDe(p)?.ctx.fecha === p.dia;

/**
 * Qué parte del estadio se llena. Manda el precio: una popular accesible llena
 * aunque el equipo no venga bien; con la entrada cara se vacía aunque vaya
 * primero.
 */
export function ocupacionDe(p: Partida, esClasico = false): number {
  // La curva es inelástica a propósito: cobrar caro tiene que recaudar más que
  // llenar. Si llenar diera más plata y además más aliento, elegir la popular
  // sería obvio y no habría nada que decidir. Así la decisión es de verdad:
  // caja contra el Defensores lleno.
  const porPrecio = clamp(1.15 - p.precioEntrada / 220, 0.28, 1.0);
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
    // Todos arrastran su calendario, no solo los rivales de Olimpia: si el
    // desgaste valiera únicamente contra vos, el torneo se ganaría solo.
    const fl = fuerzaBaseAjustada(m.local, fuerzas[m.local]) *
      factorCondicion(condicionRival(m.local, m.fecha));
    const fv = fuerzaBaseAjustada(m.visitante, fuerzas[m.visitante]) *
      factorCondicion(condicionRival(m.visitante, m.fecha));
    const xl = P.xgBase * Math.exp(P.xgK * (fl + P.localiaLiga - fv));
    const xv = P.xgBase * Math.exp(P.xgK * (fv - fl - P.localiaLiga));
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
  /** Lo que levantó la gente por los golazos del partido. */
  hinchadaExtra?: number;
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
  // el plan de viaje valía para este partido y se agota acá
  n.aclimatacion = 0;

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

      /**
       * Los juveniles crecen jugando, y esto es lo único del juego que deja
       * una marca permanente en el plantel.
       *
       * Estaba prácticamente apagado: un pibe con techo +15 subía medio punto
       * en toda la temporada y terminaba igual que empezó, así que darle
       * minutos no construía nada. Ahora un titular juvenil llega cerca de su
       * techo en una temporada, y el que no juega no crece: bancarlo aunque
       * hoy rinda menos es una decisión con premio.
       */
      const margen = j.nivel_incertidumbre;
      if (margen > 0 && e.crecimiento < margen) {
        const antesEntero = Math.floor(e.crecimiento);
        e.crecimiento = Math.min(margen, e.crecimiento + (min / 90) * (margen / 20));
        if (Math.floor(e.crecimiento) > antesEntero) {
          n.bitacora.push({ dia: p.dia, marca: "titulo",
            texto: `${j.apellido} dio un salto: ahora es nivel ${j.nivel + Math.floor(e.crecimiento)}.` });
        }
      }

      // El pibe del interior deja de ser una incógnita cuando pisa la cancha.
      const traido = n.incorporados.find((x) => x.id === j.id && x.aRevelar);
      if (traido && e.minutos >= 20) {
        traido.aRevelar = false;
        const bueno = traido.nivel >= 66;
        n.hito = {
          tipo: "revelacion",
          titulo: `${traido.apellido} debutó`,
          detalle: bueno
            ? `El pibe que trajiste del interior es mejor de lo que decían. Nadie lo había visto jugar.`
            : `El pibe que trajiste del interior es de los que hay muchos. Al menos costó poco.`,
          cifra: String(traido.nivel),
          pie: "de nivel",
        };
        n.bitacora.push({ dia: p.dia, marca: bueno ? "titulo" : undefined,
          texto: `Debutó ${traido.apellido}: resultó ser nivel ${traido.nivel}.` });
      }
      if (j.fecha_nacimiento >= "2007-01-01" && min >= 90) n.minutosSub18 += 90;
      // El ánimo se mueve con el resultado y con lo que hizo él: el que
      // convierte se levanta más que el que solo estuvo en cancha. Tira al
      // medio para que una racha no lo deje clavado arriba para siempre.
      const golesSuyos = c.goleadores.filter((g) => g === j.id).length;
      const dif = c.golesOlimpia - c.golesRival;
      const porResultado = dif >= 2 ? 4 : dif === 1 ? 2 : dif === 0 ? 0 : dif === -1 ? -2 : -4;
      const suyo = golesSuyos > 0 ? 5 : 0;
      e.animo = clamp(
        e.animo + porResultado + suyo + empujeCancha + (70 - e.animo) * 0.25, 0, 100);
    } else {
      e.animo = clamp(e.animo - 1.8, 0, 100); // el que no juega se calienta
    }

    if (e.suspendidoFechas > 0) e.suspendidoFechas--;
    if (c.amarillas.includes(j.id)) {
      e.amarillas++;
      if (e.amarillas >= AMARILLAS_PARA_SUSPENSION) { e.amarillas = 0; e.suspendidoFechas = 1; }
    }
    if (c.rojas.includes(j.id)) e.suspendidoFechas = 1;

    const les = c.lesionados.find((l) => l.id === j.id);
    if (les) {
      e.lesionadoHasta = sumarDias(p.dia, les.dias);
      // Que se te rompa un titular es tan grande como perder una apuesta, así
      // que se muestra igual y no en una línea del diario. Si hay varias, gana
      // la más larga.
      const semanas = Math.round(les.dias / 7);
      if (!n.hito || (n.hito.tipo === "lesion" && Number(n.hito.cifra) < semanas)) {
        n.hito = {
          tipo: "lesion",
          titulo: `Se rompió ${j.apellido}`,
          detalle: les.dias >= 30
            ? `${j.nombre} ${j.apellido} se lesionó y no vuelve hasta dentro de un mes largo.`
            : `${j.nombre} ${j.apellido} salió lesionado. El parte médico dice que vuelve pronto.`,
          cifra: String(semanas),
          pie: semanas === 1 ? "semana afuera" : "semanas afuera",
        };
      }
      n.bitacora.push({ dia: p.dia, marca: "golpe",
        texto: `${j.apellido} se lesionó: ${semanas} semana${semanas === 1 ? "" : "s"} afuera.` });
    }
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
  n.hinchada = clamp(n.hinchada + (c.hinchadaExtra ?? 0) + (gano ? 5 : empate ? -2 : -8)
    + (partido.ctx.esClasico ? (gano ? 7 : empate ? -2 : -10) : 0), 0, 100);

  // El vestuario sigue a los resultados y también al humor de la calle: cuando
  // la hinchada está caliente, adentro se siente.
  const arrastreHinchada = (n.hinchada - 50) * 0.05;
  n.ambiente = clamp(n.ambiente + (gano ? 3 : empate ? 0 : -4) + arrastreHinchada, 0, 100);

  n.bitacora.push({
    dia: p.dia,
    marca: gano ? "victoria" : empate ? "empate" : "derrota",
    cifra: `${c.golesOlimpia}-${c.golesRival}`,
    texto: `${partido.ctx.esLocal ? "De local" : "De visitante"} contra ` +
      `${partido.rivalNombre}${partido.ctx.esClasico ? ", el clásico" : ""}.`,
  });

  actualizarPaciencia(n, { gano, empate, esCopa, esClasico: partido.ctx.esClasico });

  if (esCopa) {
    avanzarLlave(n, c, partido);
  } else {
    n.fechaActual = p.fechaActual + 1;

    // La APF descuenta puntos al que no cumple los 900 minutos de Sub-18.
    if (n.fechaActual > TOTAL_FECHAS && n.minutosSub18 < 900) {
      n.puntosDescontados = 3;
      n.bitacora.push({ dia: p.dia, marca: "golpe", texto:
        `Sanción: Olimpia no llegó a los 900 minutos Sub-18 (${n.minutosSub18}). ` +
        `La APF descuenta 3 puntos.` });
    }

    // el sponsor con bonus paga cuando hay algo que festejar
    if (n.sponsorConBonus && gano && n.fechaActual > TOTAL_FECHAS) {
      n.dineroUsd += 2_500_000;
      n.bitacora.push({ dia: p.dia, marca: "plata",
        texto: "El sponsor pagó el bonus por objetivos." });
    }

    // se terminó el torneo: campeón o no, la temporada merece su pantalla
    if (n.fechaActual > TOTAL_FECHAS) {
      const tabla = tablaDe(n);
      const yo = tabla.findIndex((f) => f.id === "olimpia") + 1;
      const mios = tabla.find((f) => f.id === "olimpia");
      n.hito = yo === 1
        ? {
            tipo: "campeon_liga",
            titulo: "Campeón del Clausura",
            detalle: "Olimpia dio la vuelta.",
            cifra: `${mios?.pts ?? 0}`,
            pie: "puntos en 22 fechas",
          }
        : {
            tipo: "fin_temporada",
            titulo: "Se terminó el Clausura",
            detalle: `Olimpia cerró ${yo}° con ${mios?.pts ?? 0} puntos.`,
            cifra: `${yo}°`,
            pie: `a ${(tabla[0]?.pts ?? 0) - (mios?.pts ?? 0)} del campeón`,
          };
    }
  }
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
  const rondaJugada = copa.ronda;
  // sin gol de visitante y sin alargue: el global empatado va a penales
  const pasa = copa.globalO > copa.globalR
    || (copa.globalO === copa.globalR && rng.chance(0.5));

  n.bitacora.push({
    dia: n.dia,
    marca: pasa ? "victoria" : "golpe",
    cifra: `${copa.globalO}-${copa.globalR}`,
    texto: `Sudamericana contra ${partido.rivalNombre}. ` +
      `${pasa ? "Olimpia avanza de ronda." : "Olimpia queda afuera."}`,
  });

  if (!pasa) {
    copa.ronda = "eliminado";
    n.hinchada = clamp(n.hinchada - 10, 0, 100);
    n.ambiente = clamp(n.ambiente - 6, 0, 100);
    n.hito = {
      tipo: "eliminado_copa",
      titulo: "Afuera de la Sudamericana",
      detalle: `${partido.rivalNombre} eliminó a Olimpia en ${NOMBRE_RONDA[rondaJugada]}.`,
      cifra: `${copa.globalO} - ${copa.globalR}`,
      pie: "global",
    };
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
    n.bitacora.push({ dia: n.dia, marca: "titulo",
      texto: "Olimpia campeón de la Copa Sudamericana." });
    n.hito = {
      tipo: "campeon_copa",
      titulo: "Campeón de América",
      detalle: `Olimpia le ganó la final a ${partido.rivalNombre} en Barranquilla.`,
      cifra: `${c.golesOlimpia} - ${c.golesRival}`,
      pie: "la final",
    };
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
    n.bitacora.push({ dia: n.dia, marca: "golpe",
      texto: "La dirigencia decidió cortar el ciclo. Gracias por todo." });
    n.hito = {
      tipo: "despedido",
      titulo: "Se terminó el ciclo",
      detalle: "La dirigencia decidió que hasta acá llegaste.",
      cifra: `${pos}°`,
      pie: `en la fecha ${n.fechaActual}`,
    };
  } else if (n.paciencia < 25) {
    n.bitacora.push({ dia: n.dia, marca: "aviso",
      texto: "La dirigencia se reunió de urgencia. El puesto está en discusión." });
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

  void novedades;
  for (const j of PLANTEL) {
    const e = n.plantel[j.id];
    if (e.lesionadoHasta && e.lesionadoHasta <= n.dia) {
      e.lesionadoHasta = null;
      novedades.push(`${j.apellido} se recuperó y ya está a disposición.`);
    }
    if (e.lesionadoHasta) continue;

    // Un día de recuperación, con la misma curva del motor: se recupera casi
    // todo en la primera semana y después se estanca.
    const j2 = { ...j, condicion: e.condicion };
    recuperar(j2, 1 + P.recuperacionDiaPerdido);
    e.condicion = clamp(j2.condicion, 0, 100);

    // El ánimo de cada uno tiende al clima del vestuario: un plantel roto
    // arrastra a todos, uno unido levanta al que está caído.
    // tira al clima del vestuario y, si no pasa nada, al medio: el ánimo no
    // se queda clavado arriba por una racha vieja
    e.animo = clamp(e.animo + (n.ambiente - e.animo) * 0.06 + (70 - e.animo) * 0.04, 0, 100);
    // con el vestuario partido, además se cae solo
    if (n.ambiente < 30) e.animo = clamp(e.animo - 0.8, 0, 100);
  }

  // asuntos que aparecen solos
  const alPartido = diasAlPartido(n);

  // El plan de viaje se decide con tiempo: tres días antes, que es cuando
  // todavía se puede adelantar la delegación.
  if (alPartido === 3 && !n.pendientes.some((a) => a.tipo === "viaje")) {
    const m = partidoDe(n);
    if (m && viajeExigente(m)) {
      const altura = m.ctx.alturaM >= 1500;
      n.pendientes.push({
        id: `via-${n.dia}`, tipo: "viaje", dia: n.dia,
        titulo: altura ? "Viaje a la altura" : "Plan de viaje",
        detalle: altura
          ? `${m.ciudad} está a ${m.ctx.alturaM.toLocaleString("es")} metros. ` +
            "Cuánto antes llegue la delegación cambia lo que se puede correr."
          : `Son ${m.ctx.viajeKm.toLocaleString("es")} km hasta ${m.ciudad}. ` +
            "¿Cuándo se viaja?",
        datos: { altura, km: m.ctx.viajeKm, ciudad: m.ciudad },
      });
    }
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
    const proximo = partidoDe(n);
    const armada = sortearSituacion({
      plantel: plantelDe(n),
      ambiente: n.ambiente,
      hinchada: n.hinchada,
      racha: n.resultados.slice(-3).map((r) =>
        r.golesOlimpia > r.golesRival ? "G" : r.golesOlimpia === r.golesRival ? "E" : "P"),
      posicion: 0,
      // hay situaciones que solo tienen sentido en cierto momento
      esSemanaDeClasico: !!proximo?.ctx.esClasico && (diasAlPartido(n) ?? 99) <= 6,
      faltanDias: diasAlPartido(n),
    }, rng);
    if (armada) {
      n.pendientes.push({
        id: `sit-${n.dia}`, tipo: "evento", dia: n.dia,
        titulo: armada.s.titulo, detalle: armada.s.contexto,
        situacion: armada.s, efectos: armada.efectos,
      });
    }
  }

  // Las oportunidades de estrella. Aparecen poco y duran poco: si fueran
  // frecuentes o esperaran, alcanzaría con ahorrar y no habría decisión.
  if (n.estrella && n.dia > n.estrella.venceEl) {
    const e = ESTRELLAS.find((x) => x.id === n.estrella!.id);
    n.bitacora.push({ dia: n.dia, marca: "aviso",
      texto: `${e?.apellido ?? "El jugador"} firmó en otro club. Se cerró la ventana.` });
    n.estrella = null;
  }
  // Calibrado con el simulador: ~2.5 oportunidades por temporada y una leyenda
  // cada cuatro. Con más, deja de ser una oportunidad y pasa a ser un catálogo
  // donde alcanza con ahorrar.
  if (!n.estrella && !n.pendientes.length && rng.chance(0.018)) {
    const e = sortearEstrella(n.dia, n.estrellasVistas);
    if (e) {
      n.estrella = { id: e.id, venceEl: sumarDias(n.dia, DIAS_DE_VENTANA) };
      n.estrellasVistas.push(e.id);
      novedades.push(`${e.titular}.`);
    }
  }

  // ofertas por los mejores
  if (!n.ofertas.length && rng.chance(0.14)) {
    const o = sortearOferta(plantelDe(n), n.dia);
    if (o) {
      n.ofertas.push({
        id: `of-${n.dia}`, jugadorId: o.jugadorId, club: o.club,
        montoUsd: o.montoUsd, venceEl: sumarDias(n.dia, 4),
        quiereIrse: o.quiereIrse,
      });
      // OJO: en el plantel del JSON no están las estrellas que fichaste, y la
      // oferta puede ser justo por una de ellas
      const j = plantelDe(n).find((x) => x.id === o.jugadorId);
      if (!j) return { partida: n, novedades };
      n.pendientes.push({
        id: `ofp-${n.dia}`, tipo: "oferta", dia: n.dia,
        titulo: "Llegó una oferta",
        detalle: `${o.club} ofrece ${miles(o.montoUsd)} por ${j.apellido}. ` +
          (o.quiereIrse
            ? `${j.apellido} quiere ir: dice que es la chance de su carrera.`
            : `${j.apellido} está cómodo acá y no pidió salir.`),
        datos: { ofertaId: `of-${n.dia}` },
      });
    }
  }

  return { partida: n, novedades };
}

/**
 * Traer al crack. Se paga al contado: si no está la plata, no está el jugador.
 * Ocupa cupo de extranjero como cualquiera, que es parte de lo que duele.
 */
export function ficharEstrella(p: Partida): Partida {
  const n: Partida = estructurado(p);
  const e = ESTRELLAS.find((x) => x.id === n.estrella?.id);
  if (!e || n.dineroUsd < e.precioUsd) return n;

  const usados = new Set([...PLANTEL, ...n.incorporados].map((j) => j.numero));
  let numero = e.categoria === "leyenda" ? 10 : 9;
  while (usados.has(numero)) numero++;

  const j = jugadorDeEstrella(e, numero);
  n.incorporados.push(j);
  n.plantel[j.id] = {
    condicion: j.condicion, amarillas: 0, suspendidoFechas: 0, lesionadoHasta: null,
    golesTorneo: 0, minutos: 0, animo: j.animo, crecimiento: 0,
  };
  n.dineroUsd -= e.precioUsd;

  const imp = impactoDe(e);
  n.hinchada = clamp(n.hinchada + imp.hinchada, 0, 100);
  n.ambiente = clamp(n.ambiente + imp.ambiente, 0, 100);
  n.paciencia = clamp(n.paciencia + imp.prestigio, 0, 100);
  n.estrella = null;

  n.bitacora.push({ dia: n.dia, marca: "titulo",
    texto: `${e.nombre} ${e.apellido} firmó en Olimpia. Asunción es una fiesta.` });
  n.hito = {
    tipo: "fichaje",
    titulo: `${e.apellido} es de Olimpia`,
    detalle: e.historia,
    cifra: String(e.nivel),
    pie: "de nivel",
  };
  return n;
}

/** Dejarla pasar. No vuelve. */
export function rechazarEstrella(p: Partida): Partida {
  const n: Partida = estructurado(p);
  const e = ESTRELLAS.find((x) => x.id === n.estrella?.id);
  n.estrella = null;
  if (e) {
    n.bitacora.push({ dia: n.dia,
      texto: `Olimpia dejó pasar a ${e.apellido}. No había con qué.` });
  }
  return n;
}

/**
 * El pibe que traés del interior sin que nadie lo haya visto.
 *
 * El nivel real se sortea acá, pero queda tapado: la ficha muestra un rango
 * hasta que juegue. Es la única incógnita del juego que se despeja jugando, y
 * por eso bancarlo aunque hoy no rinda tiene sentido.
 */
function sumarPibe(n: Partida, pueblo: string): void {
  const rng = new Rng(`pibe-${pueblo}-${n.dia}`);
  const NOMBRES = [["Aldo", "Ayala"], ["Blas", "Cristaldo"], ["Rodrigo", "Ferreira"],
                   ["Juan", "Ozuna"], ["Marcelo", "Bogado"], ["Diego", "Villalba"]];
  const [nombre, apellido] = rng.elegir(NOMBRES);
  const puestos = ["LI", "DFC", "MCD", "MC", "MCO", "ED", "EI", "DC"] as const;
  const usados = new Set([...PLANTEL, ...n.incorporados].map((j) => j.numero));
  let numero = 34;
  while (usados.has(numero)) numero++;

  // El azar está acá y en ningún otro lado: puede salir crack o del montón.
  const real = rng.entero(54, 74);
  const j: Jugador = {
    id: `pibe-${pueblo}-${n.dia}`,
    numero, nombre, apellido,
    posicion: rng.elegir(puestos as unknown as string[]) as Jugador["posicion"],
    posiciones_secundarias: [],
    edad: 18,
    fecha_nacimiento: "2008-01-01",
    nacionalidad: "PAR",
    extranjero: false,
    nivel: real,
    nivel_incertidumbre: 0,
    condicion: 92,
    animo: 80,
    partidos_internacionales: 0,
    rasgos: [],
    lesionado_hasta: null,
    tarjetas_amarillas: 0,
    suspendido: false,
    valor_comercial: 2,
    aRevelar: true,
    rangoNivel: [54, 74],
  };
  n.incorporados.push(j);
  n.plantel[j.id] = {
    condicion: j.condicion, amarillas: 0, suspendidoFechas: 0, lesionadoHasta: null,
    golesTorneo: 0, minutos: 0, animo: j.animo, crecimiento: 0,
  };
  // arranca en la reserva: es un pibe que vino a probarse
  n.enReserva.push(j.id);
}

// ---------------------------------------------------------------- decisiones

export function resolverAsunto(p: Partida, asuntoId: string, opcionId: string): Partida {
  const n: Partida = estructurado(p);
  const a = n.pendientes.find((x) => x.id === asuntoId);
  if (!a) return n;
  n.pendientes = n.pendientes.filter((x) => x.id !== asuntoId);


  if (a.tipo === "viaje") {
    const PLANES: Record<string, { acl: number; costo: number; texto: string }> = {
      vispera:  { acl: 0,    costo: 0,       texto: "Se viaja la víspera. Se ahorra plata y se llega justo." },
      dosdias:  { acl: 0.55, costo: 60_000,  texto: "La delegación viaja dos días antes." },
      semana:   { acl: 1,    costo: 150_000, texto: "Se arma la concentración con anticipación en destino." },
    };
    const plan = PLANES[opcionId] ?? PLANES.vispera;
    n.aclimatacion = plan.acl;
    n.dineroUsd -= plan.costo;
    // estar lejos de casa varios días desgasta la cabeza, no las piernas
    if (opcionId === "semana") n.ambiente = clamp(n.ambiente - 3, 0, 100);
    n.bitacora.push({ dia: n.dia, texto: plan.texto });
    return n;
  }

  if (a.tipo === "marketing") {
    const precios: Record<string, number> = { barato: 35, normal: 70, caro: 150 };
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
    const j = plantelDe(n).find((x) => x.id === oferta.jugadorId);
    if (!j) return n;
    if (opcionId === "vender") {
      n.dineroUsd += oferta.montoUsd;
      n.plantel[oferta.jugadorId].lesionadoHasta = "2099-01-01"; // sale del plantel
      n.hinchada = clamp(n.hinchada - (j.nivel >= 68 ? 9 : 3), 0, 100);
      n.ambiente = clamp(n.ambiente - 3, 0, 100);
      n.bitacora.push({ dia: n.dia, marca: "plata",
        texto: `${j.apellido} se va a ${oferta.club} por ${miles(oferta.montoUsd)}.` });
    } else {
      n.ambiente = clamp(n.ambiente + 2, 0, 100);
      // solo se enoja el que se quería ir; al que está cómodo le suma quedarse
      const e = n.plantel[oferta.jugadorId];
      e.animo = clamp(e.animo + (oferta.quiereIrse ? -10 : 3), 0, 100);
      n.bitacora.push({ dia: n.dia, texto: oferta.quiereIrse
        ? `Se rechazó la oferta por ${j.apellido} y quedó dolido: quería irse.`
        : `Se rechazó la oferta por ${j.apellido}, que igual quería quedarse.` });
    }
    return n;
  }

  if (a.situacion?.id === "sponsor") n.sponsorConBonus = opcionId === "variable";

  // situación de prensa, vestuario o dirigencia
  let efecto = a.efectos?.[opcionId];

  // Si la opción era una apuesta, acá se tira la moneda. El resultado va en la
  // partida para que la pantalla lo pueda mostrar antes de seguir.
  const apuesta = a.situacion?.opciones.find((o) => o.id === opcionId)?.apuesta;
  if (efecto && apuesta) {
    const rng = new Rng(`apuesta-${a.id}-${opcionId}-${n.dia}`);
    const salioBien = rng.chance(apuesta.exito);
    if (!salioBien && efecto.siSaleMal) efecto = { ...efecto.siSaleMal };
    n.resultadoApuesta = {
      salioBien,
      texto: salioBien ? apuesta.bien : apuesta.mal,
      chance: apuesta.exito,
    };
  }

  if (efecto) {
    if (efecto.ambiente) n.ambiente = clamp(n.ambiente + efecto.ambiente, 0, 100);
    if (efecto.hinchada) n.hinchada = clamp(n.hinchada + efecto.hinchada, 0, 100);
    if (efecto.dineroUsd) n.dineroUsd += efecto.dineroUsd;
    if (efecto.moralDe) {
      const e = n.plantel[efecto.moralDe.id];
      if (e) e.animo = clamp(e.animo + efecto.moralDe.delta, 0, 100);
    }
    if (efecto.condicionTodos) {
      for (const id of Object.keys(n.plantel)) {
        n.plantel[id].condicion = clamp(n.plantel[id].condicion + efecto.condicionTodos, 0, 100);
      }
    }
    // un expulsado o roto se pierde la próxima
    if (efecto.suspendeA && n.plantel[efecto.suspendeA]) {
      n.plantel[efecto.suspendeA].suspendidoFechas = 1;
    }
    if (efecto.traerPibeDe) sumarPibe(n, efecto.traerPibeDe);
    // el texto decía que subía al plantel principal y no lo sacaba de la reserva
    if (efecto.subirDeReserva) {
      n.enReserva = n.enReserva.filter((id) => id !== efecto.subirDeReserva);
    }
    n.bitacora.push({
      dia: n.dia,
      texto: efecto.texto,
      marca: n.resultadoApuesta && !n.resultadoApuesta.salioBien ? "golpe" : undefined,
    });
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
    animo: 70,
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
    golesTorneo: 0, minutos: 0, animo: 78, crecimiento: 0,
  };
  n.ambiente = clamp(n.ambiente + 2, 0, 100);
  n.bitacora.push({ dia: n.dia, texto:
    `Refuerzo: llega ${f.apellido} (${f.posicion}, nivel ${f.nivel}) por ${miles(f.precioUsd)}.` });
  return n;
}

