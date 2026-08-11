export type Posicion = "ARQ" | "DEF" | "MED" | "DEL";
export type Forma = "en_racha" | "neutral" | "en_baja";
export type Actitud = "defensivo" | "equilibrado" | "ofensivo";

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
  forma: Forma;
  partidos_internacionales: number;
  rasgos: Rasgo[];
  lesionado_hasta: string | null;
  tarjetas_amarillas: number;
  suspendido: boolean;
  historial_lesion_grave?: boolean;
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
  /** Solo en copa: la vuelta se juega con el global de la ida. */
  llaveIda?: { golesOlimpia: number; golesRival: number };
}

export interface Alineacion {
  once: Jugador[];
  /** Los tres que entran. El documento fija tres cambios y ni uno más. */
  suplentes: Jugador[];
  actitud: Actitud;
  presionAlta: boolean;
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
