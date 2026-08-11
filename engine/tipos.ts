/**
 * Puestos específicos. El documento original pedía solo ARQ/DEF/MED/DEL, pero
 * con cuatro casilleros el armado del once pierde casi toda su gracia: un
 * lateral y un central no son lo mismo, y el juego se trata justamente de
 * decidir el once.
 */
export type Posicion =
  | "ARQ"
  | "LD" | "DFC" | "LI"
  | "MCD" | "MC" | "MCO" | "MD" | "MI"
  | "ED" | "EI" | "SD" | "DC";

/** Línea a la que pertenece cada puesto, para los pesos del motor. */
export type Linea = "ARQ" | "DEF" | "MED" | "DEL";

export const LINEA_DE: Record<Posicion, Linea> = {
  ARQ: "ARQ",
  LD: "DEF", DFC: "DEF", LI: "DEF",
  MCD: "MED", MC: "MED", MCO: "MED", MD: "MED", MI: "MED",
  ED: "DEL", EI: "DEL", SD: "DEL", DC: "DEL",
};

/**
 * Dónde para cada puesto en la cancha. `x` es profundidad (0 arco propio,
 * 100 arco rival) e `y` es lateralidad (0 izquierda, 100 derecha). Sirve para
 * dos cosas: calcular cuánto pierde un jugador fuera de su puesto, y ubicarlo
 * en la cancha sin tablas aparte.
 */
export const COORD: Record<Posicion, { x: number; y: number }> = {
  ARQ: { x: 3,  y: 50 },
  LD:  { x: 26, y: 88 },
  DFC: { x: 20, y: 50 },
  LI:  { x: 26, y: 12 },
  MCD: { x: 38, y: 50 },
  MC:  { x: 50, y: 50 },
  MCO: { x: 64, y: 50 },
  MD:  { x: 50, y: 86 },
  MI:  { x: 50, y: 14 },
  ED:  { x: 78, y: 86 },
  EI:  { x: 78, y: 14 },
  SD:  { x: 78, y: 50 },
  DC:  { x: 90, y: 50 },
};

export const POSICIONES: Posicion[] =
  ["ARQ", "LD", "DFC", "LI", "MCD", "MC", "MCO", "MD", "MI", "ED", "EI", "SD", "DC"];

export const NOMBRE_POSICION: Record<Posicion, string> = {
  ARQ: "Arquero",
  LD: "Lateral derecho", DFC: "Defensor central", LI: "Lateral izquierdo",
  MCD: "Volante de contención", MC: "Volante central", MCO: "Enganche",
  MD: "Volante por derecha", MI: "Volante por izquierda",
  ED: "Extremo derecho", EI: "Extremo izquierdo",
  SD: "Segundo delantero", DC: "Delantero centro",
};
/** Cómo se lee el ánimo en pantalla. */
export type Animo = "en_racha" | "bien" | "normal" | "bajoneado";

export const animoDe = (n: number): Animo =>
  n >= 78 ? "en_racha" : n >= 60 ? "bien" : n >= 40 ? "normal" : "bajoneado";

export const TEXTO_ANIMO: Record<Animo, string> = {
  en_racha: "En racha", bien: "Bien", normal: "Normal", bajoneado: "Bajoneado",
};
export type Actitud = "defensivo" | "equilibrado" | "ofensivo";

/**
 * Ir al frente es apretar arriba. Antes eran dos decisiones separadas, la
 * actitud y un botón de presión, que en la práctica se tomaban juntas: nadie
 * se mete atrás y presiona en campo rival al mismo tiempo. Ahora salir a
 * buscarlo trae lo suyo y lo que cuesta: más situaciones, más piernas
 * gastadas y más riesgo de que te expulsen a alguien.
 */
export const aprieta = (a: Actitud) => a === "ofensivo";

export type Rasgo =
  | "desequilibrante"
  | "definicion_irregular"
  | "definidor"
  | "juego_aereo"
  | "veterano_de_copas"
  | "proyeccion"
  | "fragil";

export interface Jugador {
  id: string;
  nombre: string;
  apellido: string;
  numero: number;
  posicion: Posicion;
  posiciones_secundarias: Posicion[];
  edad: number;
  fecha_nacimiento: string;
  nacionalidad: string;
  extranjero: boolean;
  nivel: number;
  nivel_incertidumbre: number;
  condicion: number;
  /**
   * Cómo está anímicamente, 0 a 100. Junta lo que antes eran dos cosas
   * separadas, la moral y la forma, que medían lo mismo (si viene bien o mal),
   * se movían con lo mismo (resultados y lo que pasa en el vestuario) y encima
   * se multiplicaban entre sí. Un solo número es un concepto menos que
   * entender y el mismo juego.
   */
  animo: number;
  partidos_internacionales: number;
  rasgos: Rasgo[];
  lesionado_hasta: string | null;
  tarjetas_amarillas: number;
  suspendido: boolean;
  historial_lesion_grave?: boolean;
  /** 0 a 100. Se mueve con lo que le pasa al jugador y al vestuario. */
  /**
   * Está en la reserva: entrena aparte y no aparece en el banco salvo que lo
   * subas. Existe para que la pantalla de armar el equipo no tenga treinta y
   * tres nombres cuando en un partido usás dieciocho.
   */
  reserva?: boolean;
  /**
   * Minutos jugados en las últimas tres semanas. No afecta el rendimiento
   * (para eso está la condición) pero sí el riesgo de romperse: el que juega
   * todo se lesiona más aunque llegue entero al partido, que es como pasa en
   * la realidad y es el costo verdadero de no rotar.
   */
  minutosRecientes?: number;
  /** 1 a 5. No toca la simulación deportiva: es la moneda del marketing. */
  valor_comercial?: number;
}

export interface ContextoPartido {
  fecha: string;
  competencia: "clausura" | "sudamericana";
  esLocal: boolean;
  neutral?: boolean;
  rivalFuerza: number;
  rivalNombre: string;
  viajeKm: number;
  alturaM: number;
  diasDescanso: number;
  esClasico: boolean;
  /** Humor de la hinchada, 0 a 100. Escala el bonus de local. */
  hinchada?: number;
  /** Qué parte del estadio se llenó, 0 a 1. */
  ocupacion?: number;
  /** Solo en copa: la vuelta se juega con el global de la ida. */
  llaveIda?: { golesOlimpia: number; golesRival: number };
  /**
   * Cuánto llegó adaptado el plantel, 0 a 1. Sale del plan de viaje: llegar
   * con días de anticipación recorta el castigo de la altura y del viaje.
   */
  aclimatacion?: number;
  /** Condición del rival, 0 a 100. Viene de su propio calendario. */
  rivalCondicion?: number;
}

export interface Alineacion {
  once: Jugador[];
  /** Los tres que entran. El documento fija tres cambios y ni uno más. */
  suplentes: Jugador[];
  actitud: Actitud;
  /** Puesto efectivo asignado a cada jugador, puede no ser su posición natural. */
  puestos: Map<string, Posicion>;
}

export interface ResultadoPartido {
  golesOlimpia: number;
  golesRival: number;
  minutos: Map<string, number>;
  lesionados: { id: string; dias: number }[];
  amarillas: string[];
  rojas: string[];
}
