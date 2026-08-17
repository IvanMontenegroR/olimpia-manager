"use client";

import {
  MOLDE_DE, PLANTEL, bancoSugerido, cupoDe, esSub18, partidosDeOlimpia,
  repartirEnMolde, salidaAutomatica, type PartidoUI,
} from "./juego.ts";
import {
  P, clamp, desgastePorPartido, desgloseOvr, factorCondicion, ovrDelOnce, recuperar,
  type DesgloseOvr,
} from "@/engine/motor.ts";
import { Rng } from "@/engine/rng.ts";
import equiposJson from "@/data/equipos_2026.json";
import fixtureJson from "@/data/fixture_clausura2026_final.json";
import rivalesJson from "@/data/rivales_internacionales.json";
import { condicionRival, fuerzaBaseAjustada } from "./rivales.ts";
import {
  TOTAL_SITUACIONES, sortearSituacion, type Efecto, type Situacion,
} from "@/engine/situaciones.ts";
import {
  CATALOGO, generarMercado, sortearOferta, type FichajeGenerado,
} from "@/engine/mercado.ts";
import {
  DIAS_DE_VENTANA, ESTRELLAS, impactoDe, jugadorDeEstrella, sortearEstrella,
} from "@/engine/estrellas.ts";
import { LINEA_DE, type Actitud, type ContextoPartido, type Jugador, type Posicion } from "@/engine/tipos.ts";

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
  | "fin_temporada" | "fichaje" | "lesion" | "revelacion"
  /** Ganaste el clásico. */
  | "gana_clasico"
  /** Pasaste de ronda en la copa: cuanto más adentro, más grande. */
  | "pasa_ronda";

/** Un penal de la tanda: quién pateó y si la metió. */
export interface PenalTanda {
  /** Apellido del que patea; vacío si es del rival. */
  quien: string;
  mio: boolean;
  entro: boolean;
}

/** La tanda completa, para poder verla patada por patada. */
export interface Tanda {
  penales: PenalTanda[];
  mios: number;
  suyos: number;
  gana: boolean;
  rival: string;
}

export interface Hito {
  tipo: TipoHito;
  titulo: string;
  detalle: string;
  /** Dato grande de la pantalla: el marcador, la posición, los puntos. */
  cifra?: string;
  pie?: string;
  /**
   * Cuánto pesa, de 0 a 3.
   *
   * Pasar de octavos y meterse en una final no pueden verse igual. La pantalla
   * lo usa para escalar todo: los papelitos, el tamaño del marcador y cuánto
   * dura la entrada. Es lo que hace que la copa se sienta más a medida que
   * avanzás en vez de repetir el mismo cartel cuatro veces.
   */
  intensidad?: number;
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
  /** La tanda de penales recién jugada, hasta que la mirás. */
  tanda?: Tanda | null;
  /** Los que vendiste: se van del plantel y no vuelven. */
  vendidos?: string[];

  /**
   * La oportunidad de fichaje que está sobre la mesa, si hay alguna. Tiene
   * fecha de vencimiento: no es un catálogo donde ahorrar tranquilo.
   */
  estrella: { id: string; venceEl: string } | null;
  /** Las que ya aparecieron, para no repetirlas. */
  estrellasVistas: string[];
  /** Cuándo llegó la última oferta, para que no lluevan una atrás de otra. */
  ultimaOfertaEl?: string;
  /** Las situaciones que ya te tocaron, para no repetirlas hasta agotarlas. */
  situacionesVistas?: string[];

  /**
   * La semilla de ESTA partida.
   *
   * Todo el azar del juego colgaba del día del calendario, así que dos
   * personas distintas jugaban exactamente la misma temporada: los mismos
   * eventos el mismo día, la misma tanda de penales, el mismo pibe del
   * interior. Y volver a empezar te devolvía lo mismo otra vez. Ahora cada
   * partida arranca con una semilla propia y todas las tiradas la llevan
   * adentro, así que reiniciar es una temporada nueva de verdad.
   */
  semilla: string;
  /**
   * Si el DT ya pasó por la pantalla de armar los equipos. Mientras esté en
   * false se entra ahí y no al escritorio.
   */
  arrancada: boolean;

  /** Alineaciones guardadas por el DT: el titular, el equipo de copa, etc. */
  equipos: EquipoGuardado[];
  /**
   * Cuál de esos equipos está puesto ahora mismo.
   *
   * Antes siempre jugaba `equipos[0]`, así que elegir el Alternativo antes de
   * un partido no se recordaba: entrabas a modificar y te aparecía otro once,
   * el primero de la lista. Es una decisión del DT y como tal se guarda.
   */
  equipoActivo?: string;
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
    // el cupo es del torneo local; en copa no hay, así que ahí no saca a nadie
    const cupo = cupoDe(ctx.competencia);
    let ext = 0;
    const elegibles = [...disponibles]
      .sort((a, b) => b.nivel - a.nivel)
      .filter((j) => {
        if (!j.extranjero) return true;
        if (ext >= cupo) return false;
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

/**
 * Una semilla nueva, distinta en cada arranque.
 *
 * `Math.random` sola alcanza; el reloj se suma porque dos pestañas abiertas en
 * el mismo instante pueden salir con el mismo primer número.
 */
export const semillaNueva = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/**
 * Pisa un equipo guardado EN SU LUGAR, o lo agrega si es nuevo.
 *
 * Las dos pantallas que guardan equipos hacían esto por su cuenta y una de las
 * dos lo hacía mal: filtraba el viejo y ponía el nuevo al final, así que
 * guardar el Titular lo mandaba último y el Alternativo pasaba a ser el
 * primero. El primero es el que dibuja la cancha de la pantalla principal y el
 * que sale a jugar, o sea que editabas tu once y salía a la cancha el otro.
 */
export function guardarEquipo(
  equipos: EquipoGuardado[], nuevo: EquipoGuardado,
): EquipoGuardado[] {
  const i = equipos.findIndex((x) => x.nombre === nuevo.nombre);
  return i >= 0 ? equipos.map((x, k) => (k === i ? nuevo : x)) : [...equipos, nuevo];
}

/**
 * Un equipo guardado, de vuelta en los casilleros donde lo dejaste.
 *
 * Este es el bug que se sentía como "no se guarda": al reabrirlo se pasaba la
 * lista por `repartirEnMolde`, que reparte a los once por dónde rinde mejor
 * cada uno. O sea que el orden que guardaste no volvía nunca: ponías a Cáceres
 * de lateral derecho, guardabas, abrías otra vez y estaba en otro lado. Y como
 * después se guardaba lo que había en pantalla, el equipo se iba corriendo
 * solo cada vez que lo mirabas. `jugadores[i]` YA es el casillero `i`.
 */
export function comoLoDejaste(
  eq: EquipoGuardado, hay: (id: string) => boolean,
): (string | null)[] {
  const slots = MOLDE_DE(eq.formacion);
  return slots.map((_, i) => {
    const id = eq.jugadores[i];
    return id && hay(id) ? id : null;
  });
}

export function partidaNueva(semilla: string = semillaNueva()): Partida {
  return {
    version: VERSION,
    semilla,
    arrancada: false,
    incorporados: [],
    dia: DIA_INICIAL,
    fechaActual: 1,
    resultados: [],
    plantel: Object.fromEntries(PLANTEL.map((j) => [j.id, {
      condicion: j.condicion,
      amarillas: 0,
      suspendidoFechas: 0,
      /*
       * El arranque respeta lo que dice el plantel. Antes salían todos con
       * ánimo 70 y enteros, así que un delantero que viene sin meter un gol
       * hace meses y uno que está encendido eran el mismo jugador, y el que
       * está lesionado de verdad aparecía disponible el primer día.
       */
      lesionadoHasta: j.lesionado_hasta ?? null,
      golesTorneo: 0,
      minutos: 0,
      animo: j.animo ?? 70,
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
    estrella: null,
    estrellasVistas: [],
    copa: { ronda: "octavos", rivalId: "vasco_da_gama", globalO: 0, globalR: 0, jugadosEnRonda: 0 },
    ofertas: [],
    fichajes: generarMercado(DIA_INICIAL, 6, [], PLANTEL),
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
    /*
     * Los que fichaste no están en el plantel del JSON, así que el filtro de
     * abajo los tiraba: al recargar perdían condición, ánimo y minutos, y
     * cualquier cosa que después les escribiera encima mataba la app entera
     * ("Cannot set properties of undefined"). Sus ids valen igual que los del
     * JSON.
     */
    for (const j of p.incorporados ?? []) {
      p.plantel[j.id] ??= {
        condicion: j.condicion, amarillas: 0, suspendidoFechas: 0, lesionadoHasta: null,
        golesTorneo: 0, minutos: 0, animo: j.animo, crecimiento: 0,
      };
    }
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
    p.vendidos ??= [];
    p.fichajes ??= [];
    p.pendientes ??= [];
    p.bitacora ??= [];
    p.equipos ??= [];
    // las partidas de antes no tenían semilla: se les da una ahora, así que
    // siguen su temporada pero lo que venga de acá en adelante ya es propio
    p.semilla ??= semillaNueva();
    p.equipoActivo ??= p.equipos[0]?.nombre;
    p.arrancada ??= true;
    p.enReserva ??= PLANTEL.filter((j) => j.reserva).map((j) => j.id);
    p.aclimatacion ??= 0;
    p.hito ??= null;
    p.estrella ??= null;
    p.estrellasVistas ??= [];
    p.incorporados ??= [];
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

/**
 * Le da estado a cualquiera que esté en el plantel y no lo tenga. Es la red
 * abajo del arreglo de `cargar`: una partida vieja guardada con el hueco tiene
 * que poder seguir jugándose, no reventar.
 */
export function completarPlantel(p: Partida): Partida {
  for (const j of plantelDe(p)) {
    p.plantel[j.id] ??= {
      condicion: j.condicion, amarillas: 0, suspendidoFechas: 0, lesionadoHasta: null,
      golesTorneo: 0, minutos: 0, animo: j.animo, crecimiento: 0,
    };
  }
  return p;
}

export function plantelDe(p: Partida): Jugador[] {
  const reserva = new Set(p.enReserva ?? []);
  /*
   * Al que vendiste no lo tenés más.
   *
   * Antes venderlo lo marcaba como lesionado hasta el año 2099 y lo dejaba
   * adentro de la lista: seguía apareciendo en el plantel, le seguías pagando
   * el sueldo, el mercado comparaba contra él para ver si un fichaje te
   * mejoraba, y podía salir sorteado en un evento. De ahí que vendieras a uno
   * y a la semana te contaran que se tatuó el escudo.
   */
  const fuera = new Set(p.vendidos ?? []);
  return [...PLANTEL, ...(p.incorporados ?? [])].filter((j) => !fuera.has(j.id)).map((j) => {
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
  /*
   * La final es a partido único en cancha neutral, como la juega la Conmebol.
   * Se había puesto en el Defensores para que la fantasía fuera esa noche en
   * Asunción, pero eso regalaba el partido más importante del año: llegabas a
   * la final con diez puntos de localía encima y dejaba de ser una final.
   * Neutral significa que ninguno de los dos cobra su cancha.
   */
  const esLocal = !esFinal && c.jugadosEnRonda === 1;
  const nombreRonda = { octavos: "Octavos", cuartos: "Cuartos", semis: "Semifinal",
                        final: "FINAL" }[c.ronda as "octavos"];
  return {
    rivalId: c.rivalId,
    rivalNombre: r.nombre,
    estadio: esFinal ? "Cancha neutral" : esLocal ? "Defensores del Chaco" : r.estadio,
    ciudad: esFinal ? "sede única" : esLocal ? "Asunción" : r.ciudad,
    etiqueta: `Sudamericana · ${nombreRonda}${esFinal ? "" : c.jugadosEnRonda === 0 ? " ida" : " vuelta"}`,
    ctx: {
      fecha: dia,
      competencia: "sudamericana",
      esLocal,
      neutral: esFinal,
      rivalFuerza: r.fuerza,
      rivalNombre: r.nombre,
      // a la final se viaja, pero no a la casa del rival
      viajeKm: esFinal ? 1200 : esLocal ? 0 : r.km_desde_asuncion,
      alturaM: esFinal ? 200 : esLocal ? 43 : r.altura_m,
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
      semilla: p.semilla,
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
  /*
   * El humor de la gente pesa el doble que antes en cuánta viene. Con la
   * pendiente vieja, ganarse a la hinchada movía el estadio cuatro mil
   * personas y el nivel dos décimas: las decisiones que se pagaban con la
   * tribuna no compraban nada. El punto medio quedó donde estaba, así que un
   * club en su humor normal llena igual que siempre y el balance no se corre.
   */
  const porHumor = 0.16 + (p.hinchada / 100) * 1.10;
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
  const rng = new Rng(`liga-${p.semilla}`);
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
  /** Lo que le quedó a cada uno por hacerse cargo de un penal, o por errarlo. */
  animoExtra?: Record<string, number>;
}

const AMARILLAS_PARA_SUSPENSION = 5;

/** Lo que falta de Sub-18 y si el ritmo alcanza para llegar. */
/**
 * Lo que cobra por mes cada jugador.
 *
 * Es la misma fórmula que ya mostraba la pantalla de fichajes, que hasta ahora
 * era decorativa: el sueldo figuraba al lado del precio y no se cobraba nunca.
 * Un club sin costo de funcionamiento no tiene economía: la plata solo se
 * acumula, y ganando la copa juntabas diez millones en una temporada sin
 * vender a nadie, o sea que podías comprar a cualquiera.
 */
export const sueldoDe = (nivel: number) => Math.round((nivel - 40) * 900);

/** Lo que cuesta el plantel entero por mes. */
export function planillaDe(p: Partida): number {
  return plantelDe(p).reduce((s, j) => s + sueldoDe(j.nivel), 0);
}

/** Lo que suelta el sponsor cuando el título llega de verdad. */
const BONUS_TITULO = 1_200_000;
function pagarBonus(n: Partida, que: string) {
  n.dineroUsd += BONUS_TITULO;
  n.bitacora.push({ dia: n.dia, marca: "plata",
    texto: `El sponsor pagó el bonus por objetivos: ${miles(BONUS_TITULO)} por ganar ${que}.` });
}

/**
 * Los dos números que resumen al club.
 *
 * `hoy` es lo que rinde el once tal como llega al próximo partido: se mueve
 * con el ánimo del plantel, las piernas, el viaje y la localía. `plantel` es
 * lo que valen los jugadores en ficha, que solo sube fichando o cuando crece
 * un juvenil, y es la vara con la que te mide la dirigencia.
 *
 * La distancia entre los dos es la historia de tu ciclo: un plantel de 68
 * rindiendo a 60 es un vestuario roto; rindiendo a 71, un equipo volando.
 */
/** Un partido de referencia: en casa, sin viaje, para cuando no hay próximo. */
const CTX_VACIO: ContextoPartido = {
  fecha: DIA_INICIAL, competencia: "clausura", esLocal: true, neutral: false,
  rivalFuerza: 66, rivalNombre: "—", viajeKm: 0, alturaM: 43,
  diasDescanso: 6, esClasico: false,
};

export interface OvrDelClub {
  hoy: number;
  plantel: number;
  rival: number | null;
  /** De dónde sale el número de hoy, para poder abrirlo en pantalla. */
  partes: DesgloseOvr | null;
  /** El once del que sale, para poder dibujarlo sin calcularlo dos veces. */
  once: Jugador[];
  puestos: Map<string, Posicion>;
  formacion: string;
  /** El partido contra el que se midió, para que la cancha use el mismo. */
  ctx: ContextoPartido;
}

export function ovrDe(p: Partida): OvrDelClub {
  const jugadores = plantelDe(p);
  const primeros = jugadores.filter((j) => !j.reserva);
  const mejores = [...primeros].sort((a, b) => b.nivel - a.nivel).slice(0, 11);
  const plantel = mejores.length
    ? mejores.reduce((n, j) => n + j.nivel, 0) / mejores.length : 0;

  /*
   * Se mide contra el próximo partido, que es lo que interesa saber: así vas a
   * llegar el domingo. Terminada la temporada no hay ninguno, y ahí se mide en
   * cancha propia como referencia.
   */
  const partido = partidoDe(p) ?? partidoDe({ ...p, fechaActual: 1, copa: { ...p.copa, ronda: "eliminado" } });
  if (!partido) {
    return { hoy: plantel, plantel, rival: null, partes: null,
             once: [], puestos: new Map(), formacion: "4-3-3", ctx: CTX_VACIO };
  }
  const ctx: ContextoPartido = partidoDe(p) ? partido.ctx
    : { ...partido.ctx, esLocal: true, alturaM: 43, viajeKm: 0 };
  const salida = onceTitular(p, { ...partido, ctx }, jugadores);
  const alineacion = {
    once: salida.once, suplentes: salida.suplentes,
    actitud: "equilibrado" as const, puestos: salida.puestos,
  };
  const partes = salida.once.length ? desgloseOvr(alineacion, ctx) : null;
  const hoy = partes ? partes.total : plantel;

  /*
   * El rival también cuenta con su cancha cuando se juega allá. Sin esto la
   * comparación mentía de un lado: el tuyo bajaba por el viaje y el suyo se
   * quedaba quieto.
   */
  const rival = partidoDe(p)
    ? partido.ctx.rivalFuerza + (ctx.esLocal || ctx.neutral
        ? 0
        : ctx.competencia === "sudamericana" ? P.localiaCopaRival : P.localiaLiga)
    : null;
  return { hoy, plantel, rival, partes, ctx,
           once: salida.once, puestos: salida.puestos, formacion: salida.formacion };
}

/**
 * El once que va a salir: el equipo titular que armó el DT.
 *
 * La pantalla principal mostraba el once automático, así que el equipo que uno
 * se tomaba el trabajo de armar no aparecía en ninguna parte hasta el día del
 * partido. Ahora se muestra ese, y solo los puestos que quedan libres por una
 * lesión o una suspensión se completan solos.
 */
/** El equipo que está puesto, o el primero si nunca se eligió. */
export function equipoPuesto(p: Partida): EquipoGuardado | undefined {
  return p.equipos?.find((e) => e.nombre === p.equipoActivo) ?? p.equipos?.[0];
}

export function onceTitular(p: Partida, partido: PartidoUI, jugadores: Jugador[]) {
  const auto = () => salidaAutomatica(partido, jugadores, estadoSub18Para(p));
  const eq = equipoPuesto(p);
  if (!eq) return auto();

  const disponible = (j: Jugador) => !j.suspendido && !j.lesionado_hasta && !j.reserva;
  const porId = new Map(jugadores.filter(disponible).map((j) => [j.id, j]));
  const slots = MOLDE_DE(eq.formacion);
  const once = eq.jugadores.slice(0, slots.length).map((id) => porId.get(id) ?? null);
  if (once.length < slots.length) return auto();

  // los huecos que dejó una baja se llenan con el mejor que quede
  if (once.some((j) => !j)) {
    const dentro = new Set(once.filter(Boolean).map((j) => j!.id));
    const libres = [...porId.values()].filter((j) => !dentro.has(j.id));
    const huecos = once.map((j, i) => (j ? -1 : i)).filter((i) => i >= 0);
    const relleno = repartirEnMolde(libres, huecos.map((i) => slots[i]), partido.ctx);
    huecos.forEach((slot, k) => {
      const id = relleno[k];
      if (id) once[slot] = porId.get(id) ?? null;
    });
  }
  const completo = once.filter(Boolean) as Jugador[];
  if (completo.length < slots.length) return auto();

  const puestos = new Map<string, Posicion>();
  completo.forEach((j, i) => puestos.set(j.id, slots[i]));
  return {
    once: completo,
    formacion: eq.formacion,
    /*
     * Al banco van, con preferencia, los del OTRO equipo que dejaste guardado.
     * Si sacás el Titular, tu Alternativo entero se sienta atrás: para eso lo
     * armaste. Lo que sobre se completa por nivel.
     */
    suplentes: bancoSugerido([...porId.values()], completo, partido.ctx,
      (p.equipos ?? []).filter((e) => e.nombre !== eq.nombre).flatMap((e) => e.jugadores)),
    actitud: (partido.ctx.esLocal ? "ofensivo" : "equilibrado") as Actitud,
    puestos,
  };
}

/** El estado Sub-18 con la forma que espera `salidaAutomatica`. */
function estadoSub18Para(p: Partida) {
  return {
    minutos: p.minutosSub18,
    partidosRestantes: Math.max(0, TOTAL_FECHAS - p.fechaActual + 1),
  };
}

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
  for (const [id, d] of Object.entries(c.animoExtra ?? {})) {
    if (n.plantel[id]) n.plantel[id].animo = clamp(n.plantel[id].animo + d, 0, 100);
  }
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

  /*
   * El clásico ganado se para y se mira.
   *
   * Era una línea más de la bitácora con otro color, igual que un 1-0 contra
   * el último. Y no es lo mismo: la hinchada se mueve el doble, el vestuario
   * también, y es de lo poco que en Paraguay se recuerda por años.
   */
  if (partido.ctx.esClasico && gano && !esCopa) {
    n.hito = {
      tipo: "gana_clasico",
      titulo: "Le ganamos a Cerro",
      detalle: `${partido.ctx.esLocal ? "En el Defensores" : "De visitante"}, ` +
        `contra ${partido.rivalNombre}.`,
      cifra: `${c.golesOlimpia} - ${c.golesRival}`,
      pie: "el clásico",
      intensidad: 2,
    };
  }

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


    // se terminó el torneo: campeón o no, la temporada merece su pantalla
    if (n.fechaActual > TOTAL_FECHAS) {
      const tabla = tablaDe(n);
      const yo = tabla.findIndex((f) => f.id === "olimpia") + 1;
      const mios = tabla.find((f) => f.id === "olimpia");
      /*
       * El bonus del sponsor pagaba por ganar el último partido de la fecha 22
       * y no por salir campeón, que es lo que dice el contrato. Ahora paga por
       * el título, que es lo que estabas firmando.
       */
      if (n.sponsorConBonus && yo === 1) pagarBonus(n, "el Clausura");
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

/**
 * La tanda, jugada de verdad.
 *
 * Patean los cinco de mejor pie que tenés disponibles, con la misma chance que
 * usa el penal del partido: pesa el nivel, pesa ser definidor y pesan los
 * partidos internacionales, porque en una tanda lo que más falla es la cabeza.
 * Del otro lado el rival convierte según lo que vale.
 */
function tandaDePenales(n: Partida, rng: Rng): Omit<Tanda, "rival"> {
  const disponibles = plantelDe(n)
    .filter((j) => !j.suspendido && !j.lesionado_hasta && !j.reserva);
  const valor = (j: Jugador) =>
    j.nivel + (j.rasgos.includes("definidor") ? 8 : 0)
    + Math.min(6, j.partidos_internacionales * 0.1)
    - (j.posicion === "ARQ" ? 40 : 0);
  const pateadores = [...disponibles].sort((a, b) => valor(b) - valor(a)).slice(0, 5);

  /*
   * En una tanda se convierte alrededor de tres de cada cuatro, de los dos
   * lados. Las diferencias entre pateadores existen pero son chicas: por eso
   * las tandas se parecen a una moneda aunque un equipo sea mejor. Con las
   * pendientes de un penal común Olimpia pasaba el 76%, que no es una tanda,
   * es un trámite.
   */
  const chanceMia = (j: Jugador) => {
    let p = 0.705 + (j.nivel - 65) * 0.004;
    if (j.rasgos.includes("definidor")) p += 0.05;
    if (j.rasgos.includes("definicion_irregular")) p -= 0.05;
    // la experiencia internacional es lo que sostiene en una tanda
    p += Math.min(0.05, j.partidos_internacionales * 0.001);
    if (j.edad <= 21) p -= 0.05;
    return clamp(p, 0.55, 0.90);
  };
  const rival = (RIVALES as { id: string; fuerza: number }[])
    .find((x) => x.id === n.copa.rivalId);
  const chanceSuya = clamp(0.73 + ((rival?.fuerza ?? 72) - 70) * 0.004, 0.60, 0.88);

  const penales: PenalTanda[] = [];
  let mios = 0, suyos = 0;
  for (let i = 0; i < 5; i++) {
    const j = pateadores[i % Math.max(1, pateadores.length)];
    const mia = j ? rng.chance(chanceMia(j)) : false;
    if (mia) mios++;
    penales.push({ quien: j?.apellido ?? "—", mio: true, entro: mia });

    const suya = rng.chance(chanceSuya);
    if (suya) suyos++;
    penales.push({ quien: "", mio: false, entro: suya });
  }
  // muerte súbita hasta que uno falle y el otro no
  let vuelta = 0;
  while (mios === suyos && vuelta < 8) {
    const j = pateadores[(5 + vuelta) % Math.max(1, pateadores.length)];
    const mia = j ? rng.chance(chanceMia(j) * 0.92) : false;
    if (mia) mios++;
    penales.push({ quien: j?.apellido ?? "—", mio: true, entro: mia });
    const suya = rng.chance(chanceSuya * 0.92);
    if (suya) suyos++;
    penales.push({ quien: "", mio: false, entro: suya });
    vuelta++;
  }
  return { penales, mios, suyos, gana: mios > suyos };
}

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

  const rng = new Rng(`copa-${n.semilla}-${copa.ronda}-${n.dia}`);
  const rondaJugada = copa.ronda;
  /*
   * Sin gol de visitante y sin alargue: el global empatado va a penales.
   *
   * La tanda se juega de verdad y se guarda para poder mostrarla. Antes era un
   * rng.chance(0.5) que decidía la temporada adentro de una línea de bitácora:
   * salías de la final empatado y te enterabas de que habías quedado afuera
   * sin ver un solo penal.
   */
  const empatados = copa.globalO === copa.globalR;
  /*
   * La tanda tiene su propia semilla y lleva adentro cómo te fue la temporada.
   * Con la semilla de la llave (ronda y día, iguales para todos) la final del
   * 21 de noviembre daba siempre el mismo 3-4: cualquier partida que llegara
   * empatada perdía la misma tanda, sin importar lo que hubieras hecho.
   */
  const rngTanda = new Rng(
    `penales-${n.semilla}-${copa.ronda}-${n.dia}-${copa.rivalId}-${copa.globalO}-${copa.globalR}` +
    `-${n.resultados.length}-${n.hinchada}-${n.ambiente}-${n.dineroUsd}`);
  const tanda = empatados ? tandaDePenales(n, rngTanda) : null;
  const pasa = copa.globalO > copa.globalR || (tanda ? tanda.gana : false);
  if (tanda) n.tanda = { ...tanda, rival: partido.rivalNombre };

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
  /*
   * Los premios de la copa se recortaron a la mitad larga. Sumaban 7.9 millones
   * de octavos a campeón, más el bonus del sponsor: ganarla te dejaba con
   * quince millones y podías comprar a cualquiera en la primera temporada. Que
   * la copa deje plata está bien; que la deje resuelta para siempre, no.
   */
  n.dineroUsd += copa.ronda === "octavos" ? 300_000
    : copa.ronda === "cuartos" ? 500_000
    : copa.ronda === "semis" ? 800_000 : 2_200_000;

  /*
   * Pasar de ronda tiene pantalla propia y crece con la ronda. Antes solo se
   * paraba el juego al salir campeón o al quedar afuera, así que meterse en
   * una semifinal de América pasaba en una línea de la bitácora.
   */
  const PESO_RONDA: Record<string, number> = { octavos: 0, cuartos: 1, semis: 2 };
  const VA_A: Record<string, string> = {
    octavos: "cuartos de final", cuartos: "semifinales", semis: "LA FINAL",
  };
  const siguiente = SIGUIENTE[copa.ronda];
  if (siguiente !== "campeon" && copa.ronda in PESO_RONDA) {
    n.hito = {
      tipo: "pasa_ronda",
      titulo: copa.ronda === "semis" ? "Olimpia está en la final"
        : `A ${VA_A[copa.ronda]}`,
      detalle: copa.ronda === "semis"
        ? `Olimpia eliminó a ${partido.rivalNombre} y se juega la Copa Sudamericana.`
        : `Olimpia eliminó a ${partido.rivalNombre} en ${NOMBRE_RONDA[rondaJugada]}.`,
      cifra: `${copa.globalO} - ${copa.globalR}`,
      pie: "global",
      intensidad: PESO_RONDA[copa.ronda],
    };
  }
  if (siguiente === "campeon") {
    copa.ronda = "campeon";
    if (n.sponsorConBonus) pagarBonus(n, "la Sudamericana");
    n.bitacora.push({ dia: n.dia, marca: "titulo",
      texto: "Olimpia campeón de la Copa Sudamericana." });
    n.hito = {
      tipo: "campeon_copa",
      titulo: "Campeón de América",
      detalle: `Olimpia le ganó la final a ${partido.rivalNombre} en el Defensores del Chaco.`,
      cifra: `${c.golesOlimpia} - ${c.golesRival}`,
      pie: "la final",
      intensidad: 3,
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
  const rng = new Rng(`dia-${n.semilla}-${n.dia}-${n.fechaActual}`);

  /*
   * El mercado se renueva cada quince días y se arma contra el plantel que
   * tenés HOY. Antes se sorteaba una sola vez al empezar la partida y del
   * catálogo entero: veías los mismos seis nombres toda la temporada, y la
   * mitad eran peores que tu titular de ese puesto.
   */
  if (diasEntre(DIA_INICIAL, n.dia) % 15 === 0) {
    n.fichajes = generarMercado(
      `mercado-${n.dia}`, 6,
      plantelDe(n).map((j) => j.id),
      plantelDe(n).filter((j) => !j.reserva));
  }

  /*
   * El primero de cada mes se paga la planilla. Es lo único que hace que la
   * plata sea una decisión y no un número que sube: traer un crack no se paga
   * una vez, se paga todos los meses hasta que lo vendas.
   */
  if (n.dia.slice(-2) === "01") {
    const planilla = planillaDe(n);
    n.dineroUsd -= planilla;
    n.bitacora.push({ dia: n.dia, marca: "plata",
      texto: `Sueldos del mes: ${miles(planilla)} por ${plantelDe(n).length} jugadores.` });
  }

  void novedades;
  // Los fichados también se recuperan, se cansan y se lesionan. Con PLANTEL a
  // secas quedaban congelados en la condición del día que llegaron.
  for (const j of plantelDe(n)) {
    const e = n.plantel[j.id];
    if (!e) continue;
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

  /*
   * El precio de la entrada se preguntaba antes de cada partido de local: once
   * veces la misma decisión, con las mismas tres opciones. Ahora el precio
   * queda puesto y solo se vuelve a preguntar cuando el partido cambia de peso
   * (el primero, un clásico, o uno de copa), que es cuando de verdad se
   * repiensa.
   */
  if (alPartido === 1 && !n.pendientes.some((a) => a.tipo === "marketing")) {
    const m = partidoDe(n);
    const especial = !!m?.ctx.esClasico || m?.ctx.competencia === "sudamericana";
    if (m?.ctx.esLocal && (especial || n.resultados.length === 0)) {
      n.pendientes.push({
        id: `mkt-${n.dia}`, tipo: "marketing", dia: n.dia,
        titulo: "Precio de la entrada",
        detalle: m.ctx.esClasico
          ? `Mañana es el clásico en ${m.estadio}. La gente va a venir igual. ¿A cuánto se vende?`
          : m.ctx.competencia === "sudamericana"
            ? `Mañana es noche de copa en ${m.estadio}. ¿A cuánto se vende?`
            : `Mañana se juega en ${m.estadio}. Lo que pongas queda para el resto del torneo.`,
      });
    }
  }

  // una situación cada tanto, nunca el día del partido ni el anterior
  if ((alPartido === null || alPartido > 1) && !n.pendientes.length && rng.chance(0.45)) {
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
      vistas: n.situacionesVistas,
    }, rng);
    if (armada) {
      n.situacionesVistas = [...(n.situacionesVistas ?? []), armada.s.id];
      // dada la vuelta al mazo, se vuelve a repartir
      if (n.situacionesVistas.length >= TOTAL_SITUACIONES) n.situacionesVistas = [];
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
  /*
   * Calibrado con el simulador. Subió de 0.018 a 0.026 cuando la lista se
   * limpió: quedaron seis estrellas de verdad en vez de veinticinco nombres
   * de los cuales veintidós no llegaban a 80, así que ahora aparecen más
   * seguido y cada una de las que aparece vale la pena. La ventana sigue
   * siendo corta: si esperaran, alcanzaría con ahorrar y no habría decisión.
   */
  if (!n.estrella && !n.pendientes.length && rng.chance(0.026)) {
    const e = sortearEstrella(n.dia, n.estrellasVistas);
    if (e) {
      n.estrella = { id: e.id, venceEl: sumarDias(n.dia, DIAS_DE_VENTANA) };
      n.estrellasVistas.push(e.id);
      novedades.push(`${e.titular}.`);
    }
  }

  // Ofertas por los mejores. Estaban en 14% diario, o sea una cada semana, y
  // terminaban siendo casi todo lo que pasaba fuera de la cancha.
  const descansoDeOfertas = n.ultimaOfertaEl
    ? diasEntre(n.ultimaOfertaEl, n.dia) < 12 : false;
  if (!n.ofertas.length && !descansoDeOfertas && rng.chance(0.05)) {
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
      n.ultimaOfertaEl = n.dia;
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
  meterEnElOnce(n, j);
  n.plantel[j.id] = {
    condicion: j.condicion, amarillas: 0, suspendidoFechas: 0, lesionadoHasta: null,
    golesTorneo: 0, minutos: 0, animo: j.animo, crecimiento: 0,
  };
  n.dineroUsd -= e.precioUsd;

  const imp = impactoDe(e);
  n.hinchada = clamp(n.hinchada + imp.hinchada, 0, 100);
  // el vestuario que se ve es el ánimo del once, no el clima solo
  aplicarAmbiente(n, imp.ambiente);
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
/**
 * Suma al mercado un brasileño del catálogo que no esté ya ofrecido ni en el
 * plantel. Es el premio de haberle creído al representante.
 */
function ofrecerBrasileno(n: Partida): void {
  const dentro = new Set([...plantelDe(n).map((j) => j.id), ...n.fichajes.map((f) => f.id)]);
  const libres = CATALOGO.filter((f) => f.nacionalidad === "BRA" && !dentro.has(f.id));
  if (!libres.length) return;
  const f = libres[new Rng(`brasileno-${n.semilla}-${n.dia}`).entero(0, libres.length - 1)];
  const [nuevo] = generarMercado(`carpeta-${n.dia}`, 1, [
    ...CATALOGO.filter((x) => x.id !== f.id).map((x) => x.id),
  ]);
  if (!nuevo) return;
  n.fichajes = [nuevo, ...n.fichajes];
  n.bitacora.push({ dia: n.dia, marca: "plata",
    texto: `${nuevo.apellido} quedó disponible en el mercado por ${miles(nuevo.precioUsd)}.` });
}

function sumarPibe(n: Partida, pueblo: string, nivel: number): void {
  const rng = new Rng(`pibe-${n.semilla}-${pueblo}-${n.dia}`);
  const NOMBRES = [["Aldo", "Ayala"], ["Blas", "Cristaldo"], ["Rodrigo", "Ferreira"],
                   ["Juan", "Ozuna"], ["Marcelo", "Bogado"], ["Diego", "Villalba"]];
  const [nombre, apellido] = rng.elegir(NOMBRES);
  const puestos = ["LI", "DFC", "MCD", "MC", "MCO", "ED", "EI", "DC"] as const;
  const usados = new Set([...PLANTEL, ...n.incorporados].map((j) => j.numero));
  let numero = 34;
  while (usados.has(numero)) numero++;

  // El nivel viene sorteado desde la situación, para que la pantalla lo pueda
  // mostrar cayendo en la barra antes de que el pibe entre.
  const real = nivel;
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

/**
 * Cómo sale una apuesta de las del día a día.
 *
 * Está afuera de `resolverAsunto` para que la pantalla pueda preguntarlo antes
 * de aplicar nada y mostrar la bolilla cayendo. Depende solo del asunto, la
 * opción y el día, así que preguntarlo dos veces da lo mismo.
 */
export function salioBienLaApuesta(
  asuntoId: string, opcionId: string, dia: string, exito: number,
): boolean {
  return new Rng(`apuesta-${asuntoId}-${opcionId}-${dia}`).chance(exito);
}

/**
 * Al que traés, si es mejor, lo pone a jugar.
 *
 * Desde que la cancha de la pantalla principal muestra tu once guardado, un
 * fichaje entraba al plantel pero no al equipo: pagabas cuatro millones por un
 * central de 77 y el nivel del club subía dos décimas, porque el domingo
 * seguía jugando el de 64. Lo saca al más flojo de su línea y solo si de
 * verdad es mejor, así que nunca te desarma un once que ya estaba bien.
 */
function meterEnElOnce(n: Partida, nuevo: Jugador) {
  const eq = n.equipos?.[0];
  if (!eq) return;
  const slots = MOLDE_DE(eq.formacion);
  const porId = new Map(plantelDe(n).map((j) => [j.id, j]));
  /*
   * Primero se busca su puesto exacto y recién después cualquiera de su línea.
   * Sin eso, un central podía entrar por el lateral izquierdo solo porque era
   * el más flojo de la defensa, y ahí lo que ganabas en ficha lo perdías
   * jugando fuera de puesto.
   */
  const buscar = (mismoPuesto: boolean) => {
    let peor: { i: number; nivel: number } | null = null;
    for (let i = 0; i < slots.length && i < eq.jugadores.length; i++) {
      const cabe = mismoPuesto
        ? slots[i] === nuevo.posicion
        : LINEA_DE[slots[i]] === LINEA_DE[nuevo.posicion];
      if (!cabe) continue;
      const nivel = porId.get(eq.jugadores[i])?.nivel ?? 0;
      if (!peor || nivel < peor.nivel) peor = { i, nivel };
    }
    return peor;
  };
  const peor = buscar(true) ?? buscar(false);
  if (peor && nuevo.nivel > peor.nivel) eq.jugadores[peor.i] = nuevo.id;
}

/**
 * Todo lo que un efecto mueve y se puede medir: el clima, la gente, la plata,
 * los de arriba, el ánimo de uno y las piernas de todos.
 *
 * Está separado del resto de `resolverAsunto` porque la pantalla necesita
 * poder aplicarlo sobre una copia para saber, antes de que elijas, cuánto
 * nivel te va a mover la decisión. Es lo único que garantiza que el chip diga
 * exactamente lo que después vas a ver en la card.
 */
function aplicarNumeros(n: Partida, efecto: Efecto) {
  if (efecto.ambiente) aplicarAmbiente(n, efecto.ambiente);
  if (efecto.hinchada) n.hinchada = clamp(n.hinchada + efecto.hinchada, 0, 100);
  if (efecto.dineroUsd) n.dineroUsd += efecto.dineroUsd;
  if (efecto.paciencia) n.paciencia = clamp(n.paciencia + efecto.paciencia, 0, 100);
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
}

/**
 * Cuánto nivel mueve una decisión, medido contra el mismo número que muestra
 * la pantalla principal.
 *
 * No hay conversión ni regla de tres: se aplica el efecto sobre una copia y se
 * vuelve a calcular el nivel. Por eso lo que promete el chip no puede
 * diferir de lo que después pasa.
 */
export function nivelSi(p: Partida, efecto: Efecto, seVa?: string): number {
  const antes = ovrDe(p).hoy;
  const copia: Partida = estructurado(p);
  aplicarNumeros(copia, efecto);
  // vender es lo que más nivel te saca, y no sale de ningún efecto: sale de
  // que el domingo tiene que jugar otro
  if (seVa && copia.plantel[seVa]) copia.plantel[seVa].lesionadoHasta = "2099-01-01";
  return ovrDe(copia).hoy - antes;
}

/**
 * Con qué nivel se llegaría al próximo partido si la delegación viajara con
 * tanta anticipación. Existe para que el plan de viaje muestre lo que se gana
 * y no solo lo que se paga: la aclimatación es un número interno, el nivel es
 * el de la card principal.
 */
export function nivelConAclimatacion(p: Partida, aclimatacion: number): number {
  const partido = partidoDe(p);
  if (!partido) return 0;
  const ctx: ContextoPartido = {
    semilla: p.semilla, ...partido.ctx, aclimatacion };
  const s = onceTitular(p, { ...partido, ctx }, plantelDe(p));
  if (!s.once.length) return 0;
  return ovrDelOnce(
    { once: s.once, suplentes: s.suplentes, actitud: "equilibrado", puestos: s.puestos }, ctx);
}

/**
 * Cuánto menos se cansan viajando antes, en porcentaje del desgaste total.
 *
 * El plan ahorra la mitad del desgaste DEL VUELO, pero el vuelo es una parte
 * chica de lo que gasta un partido: jugar noventa minutos gasta 36 y un vuelo
 * a Brasil suma 6.6, o sea el 15%. Así que el ahorro real ronda el 8% y no el
 * 50%, y decir "la mitad del viaje" sería inflarlo. Esto devuelve lo que de
 * verdad se ahorra sobre el total, que es lo que se siente en la cancha.
 */
export function menosCansancioPorViajar(p: Partida, aclimatacion: number): number {
  const partido = partidoDe(p);
  if (!partido) return 0;
  const j = plantelDe(p).find((x) => x.posicion !== "ARQ");
  if (!j) return 0;
  const con = (acl: number) =>
    desgastePorPartido(j, 90, { ...partido.ctx, aclimatacion: acl }, "equilibrado");
  const sin = con(0);
  if (!sin) return 0;
  return Math.round((1 - con(aclimatacion) / sin) * 100);
}

/**
 * Mover el clima del vestuario, que es lo único que el jugador ve.
 *
 * El clima es un número interno; lo que se muestra en la card principal es el
 * ánimo medio del once. Si se toca uno sin el otro, la decisión promete un
 * "+1 vestuario" que después no aparece en ninguna parte. Las ofertas y el
 * viaje hacían justo eso, cada uno por su cuenta.
 */
function aplicarAmbiente(n: Partida, delta: number) {
  if (!delta) return;
  n.ambiente = clamp(n.ambiente + delta, 0, 100);
  for (const id of Object.keys(n.plantel)) {
    n.plantel[id].animo = clamp(n.plantel[id].animo + delta * P.ambienteEnAnimo, 0, 100);
  }
}

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
    if (opcionId === "semana") aplicarAmbiente(n, -3);
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
      // se va de verdad: sale de la lista, del sueldo y de los sorteos
      n.vendidos = [...(n.vendidos ?? []), oferta.jugadorId];
      delete n.plantel[oferta.jugadorId];
      n.enReserva = n.enReserva.filter((id) => id !== oferta.jugadorId);
      for (const eq of n.equipos ?? []) {
        eq.jugadores = eq.jugadores.filter((id) => id !== oferta.jugadorId);
      }
      n.hinchada = clamp(n.hinchada - (j.nivel >= 68 ? 9 : 3), 0, 100);
      aplicarAmbiente(n, -3);
      n.bitacora.push({ dia: n.dia, marca: "plata",
        texto: `${j.apellido} se va a ${oferta.club} por ${miles(oferta.montoUsd)}.` });
    } else {
      /*
       * Al grupo le suma que el club no venda... salvo cuando el que se quería
       * ir se queda de mala gana: ahí no hay nada que festejar, y sumar clima
       * por un lado mientras se lo bajabas por el otro dejaba la decisión con
       * un "+1 vestuario" y un "−1 vestuario" al mismo tiempo.
       */
      aplicarAmbiente(n, oferta.quiereIrse ? 0 : 2);
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

  /*
   * Si la opción era una apuesta, acá se aplica lo que salió. El sorteo en sí
   * lo hace `salioBienLaApuesta`, que la pantalla llama primero para poder
   * animar la bolilla: como la semilla es la misma, las dos ven el mismo
   * resultado y nadie tira el dado dos veces.
   */
  const apuesta = a.situacion?.opciones.find((o) => o.id === opcionId)?.apuesta;
  let salioBien = true;
  if (efecto && apuesta) {
    salioBien = salioBienLaApuesta(a.id, opcionId, n.dia, apuesta.exito);
    if (!salioBien && efecto.siSaleMal) efecto = { ...efecto.siSaleMal };
  }

  if (efecto) {
    aplicarNumeros(n, efecto);
    if (efecto.traerPibe) sumarPibe(n, efecto.traerPibe.pueblo, efecto.traerPibe.nivel);
    // el brasileño de la carpeta, cuando el video no era humo
    if (efecto.ofreceBrasileno) ofrecerBrasileno(n);
    // el texto decía que subía al plantel principal y no lo sacaba de la reserva
    if (efecto.subirDeReserva) {
      n.enReserva = n.enReserva.filter((id) => id !== efecto.subirDeReserva);
    }
    n.bitacora.push({
      dia: n.dia,
      texto: efecto.texto,
      marca: apuesta && !salioBien ? "golpe" : undefined,
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
    // el techo que mostraba el mercado es el que de verdad puede alcanzar
    nivel_incertidumbre: f.potencial ? Math.max(0, f.potencial - f.nivel)
      : f.edad <= 21 ? 8 : 0,
    condicion: 88,
    animo: 70,
    partidos_internacionales: f.extranjero ? 12 : 4,
    rasgos: f.rasgos ?? [],
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
  meterEnElOnce(n, jugador);
  aplicarAmbiente(n, 2);
  /*
   * Un fichaje tapa la pantalla, como una vuelta olímpica. Antes se cerraba el
   * mercado y volvías al escritorio sin ninguna señal de que algo había
   * pasado: pagabas medio millón y no te enterabas de si había entrado.
   */
  const entra = n.equipos?.[0]?.jugadores.includes(jugador.id);
  n.hito = {
    tipo: "fichaje",
    titulo: `${f.nombre} ${f.apellido}`,
    detalle: entra
      ? `Firma con Olimpia por ${miles(f.precioUsd)}. Va derecho al once.`
      : `Firma con Olimpia por ${miles(f.precioUsd)}. Se suma al plantel.`,
    cifra: String(f.nivel),
    pie: `${f.posicion} · ${f.edad} años · viene de ${f.de}`,
  };
  n.bitacora.push({ dia: n.dia, texto:
    `Refuerzo: llega ${f.apellido} (${f.posicion}, nivel ${f.nivel}) por ${miles(f.precioUsd)}.` });
  return n;
}

