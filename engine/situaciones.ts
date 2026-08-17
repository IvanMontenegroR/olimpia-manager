import { Rng } from "./rng.ts";
import type { TipoEscena } from "@/components/Escena.tsx";
import type { Jugador } from "./tipos.ts";

/**
 * Eventos de prensa, vestuario y dirigencia. Son la parte del juego que no se
 * decide en la cancha: cada uno mueve el ambiente del plantel, el humor de la
 * hinchada o la plata, y ninguno es gratis.
 */

export interface Efecto {
  ambiente?: number;
  hinchada?: number;
  dineroUsd?: number;
  moralDe?: { id: string; delta: number };
  condicionTodos?: number;
  /** Cuánto te banca la dirigencia después de esto. */
  paciencia?: number;
  texto: string;
  /** Si la opción es una apuesta, el otro resultado posible. */
  siSaleMal?: Omit<Efecto, "siSaleMal">;
  /** Deja al jugador afuera del próximo partido (expulsión, lesión). */
  suspendeA?: string;
  /** Cuántas fechas se pierde. Por ahora siempre una. */
  fechasFuera?: number;
  /** Por qué no está: romperse, que lo echen y guardarlo no son lo mismo. */
  motivo?: "lesion" | "suspension" | "descanso";
  /** Suma al plantel un juvenil del pueblo que diga, con el nivel ya sorteado. */
  traerPibe?: { pueblo: string; nivel: number };
  /** Le abre la puerta del mercado a un brasileño del catálogo. */
  ofreceBrasileno?: boolean;
  /** Lo saca de la reserva de verdad, no solo en el texto. */
  subirDeReserva?: string;
}

export interface OpcionSituacion {
  id: string;
  etiqueta: string;
  detalle: string;
  /**
   * Las opciones que son una apuesta lo dicen de frente. Antes el azar estaba
   * escondido dentro del efecto y elegías a ciegas; acá ves la chance y el
   * juego te muestra cómo salió.
   */
  apuesta?: {
    /** Probabilidad de que salga bien, 0 a 1. */
    exito: number;
    bien: string;
    mal: string;
  };
  /**
   * Cuando lo que se sortea no es sí o no sino cuánto: el nivel del pibe que
   * traés a ciegas. El número ya está decidido acá; la pantalla solo lo muestra
   * cayendo.
   */
  rango?: { min: number; max: number; valor: number; unidad: string };
}

export interface Situacion {
  id: string;
  titulo: string;
  contexto: string;
  opciones: OpcionSituacion[];
  /** De qué se trata, para que la pantalla tenga su cara propia. */
  escena: TipoEscena;
}

type Contexto = {
  plantel: Jugador[];
  ambiente: number;
  hinchada: number;
  racha: ("G" | "E" | "P")[];
  posicion: number;
  /** Para las que solo tienen sentido en cierto momento. */
  esSemanaDeClasico?: boolean;
  faltanDias?: number | null;
  /**
   * Las que ya te tocaron esta temporada. Sin esto el sorteo era con
   * reposición y el sponsor te aparecía cuatro veces mientras había doce
   * situaciones que no veías nunca.
   */
  vistas?: string[];
};

type Plantilla = {
  id: string;
  cuando: (c: Contexto) => boolean;
  armar: (c: Contexto, rng: Rng) => { s: Situacion; efectos: Record<string, Efecto> };
};

/*
 * Acá NO van cosas que pasan adentro de un partido.
 *
 * Había una situación de un amonestado que iba a buscar todas, con el texto
 * "quedan treinta minutos", y salía como decisión del día a día: te preguntaba
 * qué hacer con un partido que no se estaba jugando. Eso ya existe como
 * momento del partido (jugador_caliente), que es donde tiene sentido. Estas
 * son decisiones de club: prensa, vestuario, dirigencia, mercado y la gente.
 */
const PLANTILLAS: Plantilla[] = [
  {
    id: "suplente_caliente",
    cuando: (c) => c.plantel.some((j) => j.nivel >= 63),
    armar: (c, rng) => {
      const j = rng.elegir(c.plantel.filter((x) => x.nivel >= 63));
      return {
        s: {
          id: "suplente_caliente",
          escena: "vestuario",
          titulo: "Malestar en el vestuario",
          contexto: `${j.apellido} pidió hablar. Dice que se rompe entrenando y no le llega el minuto.`,
          opciones: [
            { id: "prometer", etiqueta: "Prometerle que juega",
              detalle: "Se levanta él, pero el resto del banco se entera en diez minutos",
              apuesta: { exito: 0.55,
                bien: "Se pone la camiseta y el grupo lo termina aceptando",
                mal: "Lo cuenta en el vestuario y quedás como el que promete cualquier cosa" } },
            { id: "franco", etiqueta: "Decirle la verdad",
              detalle: "A él le cae mal, al grupo le cae bien" },
            { id: "cortar", etiqueta: "Cortarlo en seco",
              detalle: "Nadie vuelve a golpearte la puerta, y eso también se paga" },
          ],
        },
        efectos: {
          /*
           * El ambiente de la promesa tiene que pagar más que la franqueza.
           *
           * El +18 de moral es para un suplente, y la moral de alguien que no
           * está en el once no mueve el nivel del domingo: en pantalla la
           * apuesta salía +0.4 contra un +0.8 seguro, o sea nunca convenía.
           * Lo que de verdad se juega acá es el vestuario, así que ahí está el
           * número.
           */
          prometer: {
            moralDe: { id: j.id, delta: 18 }, ambiente: 10,
            texto: `${j.apellido} se fue conforme y respondió adentro de la cancha.`,
            siSaleMal: { moralDe: { id: j.id, delta: 8 }, ambiente: -12, paciencia: -5,
              texto: "Se supo lo que le prometiste y el resto del banco lo tomó pésimo." },
          },
          franco: { moralDe: { id: j.id, delta: -6 }, ambiente: 7,
            texto: `${j.apellido} lo tomó mal, pero el resto del plantel valoró la franqueza.` },
          cortar: { moralDe: { id: j.id, delta: -14 }, ambiente: -3, paciencia: 5,
            texto: `${j.apellido} salió golpeando la puerta. Arriba les gustó la mano dura.` },
        },
      };
    },
  },
  {
    id: "prensa_racha",
    cuando: (c) => c.racha.length >= 2 && c.racha.slice(-2).every((r) => r !== "G"),
    armar: () => ({
      s: {
        id: "prensa_racha",
        escena: "prensa",
        titulo: "Conferencia de prensa",
        contexto: "Vienen dos partidos sin ganar y te preguntan si el equipo te responde.",
        opciones: [
          { id: "bancar", etiqueta: "Bancar al plantel",
            detalle: "Los jugadores lo escuchan. Arriba esperaban mano dura" },
          { id: "exigir", etiqueta: "Exigir públicamente",
            detalle: "La gente y los dirigentes lo aplauden. El plantel no tanto" },
        ],
      },
      efectos: {
        bancar: { ambiente: 7, hinchada: -3, paciencia: -7,
          texto: "Los jugadores agradecieron el respaldo. Arriba querían otra cosa." },
        exigir: { ambiente: -6, hinchada: 6, paciencia: 9,
          texto: "La hinchada festejó la autocrítica y arriba también. Adentro cayó pesado." },
      },
    }),
  },
  {
    id: "dirigencia_gastos",
    cuando: () => true,
    armar: () => ({
      s: {
        id: "dirigencia_gastos",
        escena: "dirigencia",
        titulo: "La dirigencia pide recortar",
        contexto: "Quieren bajar los gastos de concentración: menos días en el " +
          "predio, comida más barata y viajes en el día.",
        opciones: [
          { id: "aceptar", etiqueta: "Aceptar el recorte",
            detalle: "Entra plata, pero el plantel entrena y descansa peor" },
          { id: "pelear", etiqueta: "Pelear el presupuesto",
            detalle: "Sale plata de la caja y el plantel ve que los bancás" },
        ],
      },
      efectos: {
        aceptar: { dineroUsd: 120_000, condicionTodos: -4, ambiente: -4,
          texto: "Se recortó la concentración: todo el plantel perdió 4 de condición." },
        pelear: { dineroUsd: -90_000, ambiente: 6,
          texto: "Se mantuvo todo. El plantel vio que los banca." },
      },
    }),
  },
  {
    id: "hincha_bandera",
    cuando: (c) => c.hinchada < 55,
    armar: () => ({
      s: {
        id: "hincha_bandera",
        escena: "tribuna",
        titulo: "Bandera en el predio",
        contexto: "Aparecieron banderas contra el plantel en el portón del predio.",
        opciones: [
          { id: "recibir", etiqueta: "Recibir a la barra",
            detalle: "Baja la tensión y arriba lo agradecen. Es un antecedente feo" },
          { id: "ignorar", etiqueta: "Ignorarlo",
            detalle: "No se negocia con presión" },
          { id: "denunciar", etiqueta: "Denunciarlo públicamente",
            detalle: "El plantel se siente protegido. Arriba no querían este quilombo" },
        ],
      },
      efectos: {
        recibir: { hinchada: 8, ambiente: -6, paciencia: 8,
          texto: "Se habló y bajó la tensión. Arriba respiraron." },
        /*
         * El −4 de hinchada y el +2 de vestuario se anulaban en el nivel, así
         * que la opción se mostraba pelada al lado de dos que sí decían algo.
         * Y no es que no pase nada: no atender al que vino a hablar deja el
         * ruido afuera intacto, que es lo único que pasa.
         */
        ignorar: { hinchada: -3, texto: "El club no dijo nada. Siguió el ruido." },
        denunciar: { hinchada: -10, ambiente: 8, paciencia: -11,
          texto: "El club denunció el aprieto. El plantel se sintió protegido y arriba, expuesto." },
      },
    }),
  },
  {
    id: "referente_quiere_irse",
    cuando: (c) => c.ambiente < 32 && c.plantel.some((j) => j.nivel >= 66),
    armar: (c, rng) => {
      const j = rng.elegir(c.plantel.filter((x) => x.nivel >= 66));
      return {
        s: {
          id: "referente_quiere_irse",
          escena: "mercado",
          titulo: "Un referente quiere irse",
          contexto: `${j.apellido} dice que el grupo está roto y pidió permiso para buscar club.`,
          opciones: [
            { id: "retener", etiqueta: "No lo dejo salir",
              detalle: "No sale un peso y no perdés al jugador. Depende de cómo se lo tome",
              apuesta: { exito: 0.45,
                bien: "Lo entendió y se puso el equipo al hombro",
                mal: "Se queda obligado y arrastra a medio vestuario" } },
            { id: "escuchar", etiqueta: "Escucharlo y ceder en algo",
              detalle: "Cuesta plata, pero se recompone el grupo" },
            { id: "listar", etiqueta: "Ponerlo en la lista de transferibles",
              detalle: "Se corta el problema de raíz, la gente no lo va a entender" },
          ],
        },
        efectos: {
          retener: {
            ambiente: 10, moralDe: { id: j.id, delta: 8 },
            texto: `${j.apellido} lo entendió y se puso el equipo al hombro.`,
            siSaleMal: { ambiente: -13, moralDe: { id: j.id, delta: -18 },
              texto: `${j.apellido} se queda obligado. El vestuario quedó peor que antes.` },
          },
          escuchar: { ambiente: 11, dineroUsd: -180_000, moralDe: { id: j.id, delta: 16 },
            texto: `Se habló con ${j.apellido} y se le mejoró el contrato. El grupo respiró.` },
          listar: { ambiente: 6, hinchada: -8, moralDe: { id: j.id, delta: -10 },
            texto: `${j.apellido} quedó afuera del grupo. La hinchada no lo tomó bien.` },
        },
      };
    },
  },
  {
    id: "filtracion",
    cuando: (c) => c.ambiente < 38,
    armar: () => ({
      s: {
        id: "filtracion",
        escena: "prensa",
        titulo: "Se filtró la interna",
        contexto: "Un programa contó lo que se habló puertas adentro. Hay un buchón en el plantel.",
        opciones: [
          { id: "buscar", etiqueta: "Buscar al responsable",
            detalle: "Mientras dure, el plantel entero se siente investigado",
            apuesta: { exito: 0.5,
              bien: "Aparece el buchón y el vestuario se ordena solo",
              mal: "No aparece nadie y quedan todos mirándose feo" } },
          { id: "puertas", etiqueta: "Cerrar el predio a la prensa",
            detalle: "Se corta el goteo. Afuera se van a ensañar toda la semana" },
          { id: "nada", etiqueta: "Dejarlo pasar",
            detalle: "Sigue saliendo, pero arriba agradecen que no armes otro frente" },
        ],
      },
      efectos: {
        buscar: {
          ambiente: 12,
          texto: "Apareció el que filtraba. El vestuario se ordenó solo.",
          siSaleMal: { ambiente: -13,
            texto: "Se buscó al responsable y no apareció. Quedaron todos mirándose feo." },
        },
        puertas: { ambiente: 8, hinchada: -11,
          texto: "Predio cerrado. Adentro bajó la tensión, afuera se ensañaron." },
        nada: { ambiente: -4, hinchada: -3, paciencia: 7,
          texto: "Nadie dijo nada. La interna siguió saliendo, pero arriba no se sumó un quilombo más." },
      },
    }),
  },
  {
    id: "entrenamiento_tenso",
    cuando: (c) => c.ambiente < 28,
    armar: (c, rng) => {
      const dos = [...c.plantel].sort(() => rng.next() - 0.5).slice(0, 2);
      return {
        s: {
          id: "entrenamiento_tenso",
          escena: "predio",
          titulo: "Se agarraron en la práctica",
          contexto: `${dos[0]?.apellido} y ${dos[1]?.apellido} terminaron a los golpes en el entrenamiento.`,
          opciones: [
            { id: "multar", etiqueta: "Multar a los dos",
              detalle: "Entra plata de la multa, el plantel se cierra más" },
            { id: "charla", etiqueta: "Parar todo y hablarlo",
              detalle: "Se pierde el día de trabajo y hay que bancarse lo que salga",
              apuesta: { exito: 0.6,
                bien: "Salió todo a la luz y el grupo se soldó",
                mal: "Se dijeron cosas que no se vuelven atrás" } },
            { id: "tapar", etiqueta: "Que no salga de acá",
              detalle: "No cambia nada, pero nadie se entera" },
          ],
        },
        efectos: {
          multar: { dineroUsd: 60_000, ambiente: -7,
            texto: "Se los multó. El plantel entendió el mensaje pero quedó más frío." },
          charla: {
            ambiente: 14, condicionTodos: -6,
            texto: "Se paró el entrenamiento para hablar. Salió todo y el grupo se soldó.",
            siSaleMal: { ambiente: -10, condicionTodos: -6,
              texto: "Se paró todo para hablar y se dijeron cosas que no se vuelven atrás." },
          },
          tapar: { ambiente: -2, texto: "Quedó puertas adentro. Por ahora." },
        },
      };
    },
  },
  {
    id: "camiseta",
    cuando: (c) => c.plantel.some((j) => (j.valor_comercial ?? 1) >= 3),
    armar: (c, rng) => {
      const caras = c.plantel
        .filter((j) => (j.valor_comercial ?? 1) >= 3)
        .sort((a, b) => (b.valor_comercial ?? 1) - (a.valor_comercial ?? 1));
      const estrella = caras[0];
      const pibe = c.plantel.filter((j) => j.edad <= 22)[0] ?? estrella;
      return {
        s: {
          id: "camiseta",
          escena: "vestuario",
          titulo: "Lanzamiento de la camiseta",
          contexto: `Sale la nueva. Hay que elegir con quién se presenta.`,
          opciones: [
            { id: "estrella", etiqueta: `Con ${estrella.apellido}`,
              detalle: "El nombre que vende afuera" },
            { id: "pibe", etiqueta: `Con ${pibe.apellido}`,
              detalle: "El pibe de la casa. Vende menos, pero arriba lo van a usar de bandera" },
            { id: "hinchada", etiqueta: "Con la hinchada",
              detalle: "Sin caras, todo el club" },
          ],
        },
        efectos: {
          estrella: { dineroUsd: 380_000, hinchada: -2,
            moralDe: { id: estrella.id, delta: 8 },
            texto: `La camiseta se presentó con ${estrella.apellido}. Se vendió muy bien afuera.` },
          pibe: { dineroUsd: 210_000, hinchada: 7, paciencia: 9,
            moralDe: { id: pibe.id, delta: 10 },
            texto: `${pibe.apellido} fue la cara de la camiseta. Arriba lo usaron de bandera de las inferiores.` },
          hinchada: { dineroUsd: 260_000, hinchada: 10,
            texto: "La campaña fue con la hinchada de protagonista. Pegó fuerte." },
        },
      };
    },
  },
  {
    id: "sponsor",
    cuando: () => true,
    armar: () => ({
      s: {
        id: "sponsor",
        escena: "dirigencia",
        titulo: "Contrato de sponsor",
        contexto: "Hay dos ofertas sobre la mesa para la marca del frente.",
        opciones: [
          { id: "fijo", etiqueta: "Contrato fijo",
            detalle: "Plata segura ahora, para gastar en el mercado. Arriba lo ven conservador" },
          { id: "variable", etiqueta: "Menos fijo, bonus por títulos",
            detalle: "Entra bastante menos, y USD 2.50M el día que salgas campeón" },
        ],
      },
      efectos: {
        fijo: { dineroUsd: 720_000, paciencia: -6,
          texto: "Se firmó el contrato fijo. Entró la plata de una." },
        variable: { dineroUsd: 260_000, ambiente: 4, paciencia: 8,
          texto: "Se firmó con bonus por objetivos. Ahora hay que ganar." },
      },
    }),
  },
  {
    id: "amistoso",
    cuando: () => true,
    armar: () => ({
      s: {
        id: "amistoso",
        escena: "cancha",
        titulo: "Ofrecen un amistoso",
        contexto: "Llega una oferta para jugar un amistoso a mitad de semana. Pagan bien.",
        opciones: [
          { id: "jugar", etiqueta: "Aceptar",
            detalle: "Buena plata, pero terminan cansados" },
          { id: "rechazar", etiqueta: "Rechazar",
            detalle: "La semana queda limpia" },
        ],
      },
      efectos: {
        jugar: { dineroUsd: 220_000, condicionTodos: -9, hinchada: 2,
          texto: "Se jugó el amistoso. Entró plata y el plantel quedó cansado." },
        /*
         * Rechazarlo no era "nada". Es una semana entera para entrenar, que es
         * justo lo que el amistoso te saca, y son doscientos mil que arriba ya
         * habían anotado en la planilla. Lo de la condición solo se nota si
         * venís cansado (al empezar la temporada están todos al 100 y el +5 no
         * mueve nada), así que el que hace que la opción SIEMPRE diga algo es
         * el enojo de la dirigencia.
         */
        rechazar: { condicionTodos: 5, paciencia: -4,
          texto: "Se rechazó el amistoso. La semana queda para trabajar." },
      },
    }),
  },
  // ------------------------------------------------------------ la cancha
  {
    id: "cancha_barrial",
    cuando: (c) => (c.faltanDias ?? 9) <= 2,
    armar: (c, rng) => ({
      s: {
        id: "cancha_barrial",
        escena: "cancha",
        titulo: "La cancha es un barrial",
        contexto: "Llueve hace tres días en el interior y el campo de juego está impracticable. " +
          "Se juega igual: el árbitro dijo que la pelota rueda.",
        opciones: [
          { id: "guapos", etiqueta: "Ir con los guapos",
            detalle: "Pelotazo y pierna fuerte. En ese barro no se juega, se sobrevive",
            apuesta: { exito: 0.7,
              bien: "Se la pelearon los noventa y salió bien",
              mal: "Se pasó de revoluciones y hay uno que no llega al próximo" } },
          { id: "jugar", etiqueta: "Jugar igual al fútbol",
            detalle: "Nadie va a poder, y terminan todos reventados. Pero nadie se rompe" },
        ],
      },
      efectos: {
        guapos: {
          ambiente: 6, hinchada: 4,
          texto: "Se salió a pelearla y se la aguantaron los noventa.",
          siSaleMal: { ambiente: -4, suspendeA: rng.elegir(c.plantel).id,
            texto: "Se pasaron de revoluciones y hay uno que se pierde la próxima." },
        },
        jugar: { condicionTodos: -3,
          texto: "Se intentó jugar en el barro y el equipo terminó cansado, pero entero." },
      },
    }),
  },
  {
    id: "arbitro_marcado",
    cuando: (c) => (c.faltanDias ?? 9) <= 3,
    armar: () => ({
      s: {
        id: "arbitro_marcado",
        escena: "prensa",
        titulo: "El árbitro del domingo",
        contexto: "Designaron al mismo que le expulsó dos jugadores a Olimpia el año pasado. " +
          "En la conferencia te preguntan si es casualidad.",
        opciones: [
          { id: "denunciar", etiqueta: "Decirlo con nombre y apellido",
            detalle: "La gente te va a amar. La APF tiene memoria",
            apuesta: { exito: 0.55,
              bien: "Lo cambian de designación y quedás como el que la peleó",
              mal: "Lo dejan igual y el domingo te cobran todo en contra" } },
          { id: "diplomatico", etiqueta: "Decir que confiás en él",
            detalle: "No suma nada afuera, pero arriba se agradece" },
        ],
      },
      efectos: {
        denunciar: {
          hinchada: 12, ambiente: 3,
          texto: "Cambiaron la designación. La hinchada lo festejó como un gol.",
          siSaleMal: { hinchada: 3, paciencia: -12, ambiente: -4,
            texto: "Lo dejaron igual y encima quedó marcado. Arriba se agarraron la cabeza." },
        },
        diplomatico: { hinchada: -2, paciencia: 5,
          texto: "Se esquivó el tema del árbitro." },
      },
    }),
  },

  // ------------------------------------------------------------ el clásico
  {
    id: "palo_del_dt_rival",
    cuando: (c) => !!c.esSemanaDeClasico,
    armar: () => ({
      s: {
        id: "palo_del_dt_rival",
        escena: "clasico",
        titulo: "El DT de Cerro habló",
        contexto: "Dijo en la tele que Olimpia \"juega a los pelotazos y vive del pasado\". " +
          "Todos los micrófonos te están esperando.",
        opciones: [
          { id: "contestar", etiqueta: "Contestarle",
            detalle: "Si la pegás, Asunción entera es tuya toda la semana",
            apuesta: { exito: 0.6,
              bien: "Le contestaste con una frase que va a quedar",
              mal: "Entraste en el juego y quedaste como el que se calienta" } },
          { id: "ignorar", etiqueta: "No entrar",
            detalle: "Queda la sensación de que te la comiste, pero arriba se agradece" },
        ],
      },
      efectos: {
        contestar: {
          hinchada: 14, ambiente: 7,
          texto: "Se le contestó al DT de Cerro. Asunción habla de otra cosa.",
          siSaleMal: { hinchada: -8, paciencia: -8, ambiente: -3,
            texto: "Se entró en la provocación y la semana se fue en eso. Arriba no gustó." },
        },
        ignorar: { hinchada: -5, ambiente: -2, paciencia: 6,
          texto: "No se entró en la provocación. A la gente no le gustó el silencio." },
      },
    }),
  },
  {
    id: "banderazo",
    cuando: (c) => !!c.esSemanaDeClasico && c.hinchada > 55,
    armar: () => ({
      s: {
        id: "banderazo",
        escena: "tribuna",
        titulo: "Banderazo en el predio",
        contexto: "Hay tres mil personas en el portón la noche antes del clásico. " +
          "Quieren que salga el plantel a saludar.",
        opciones: [
          { id: "salir", etiqueta: "Que salgan a saludar",
            detalle: "Salen a la cancha con todo. Se duermen a las dos y arriba lo van a leer como desorden" },
          { id: "dormir", etiqueta: "Que se vayan a dormir",
            detalle: "Descansan bien y la gente se vuelve a su casa fría" },
        ],
      },
      efectos: {
        salir: { ambiente: 13, hinchada: 9, condicionTodos: -7, paciencia: -8,
          texto: "El plantel salió al portón. Se durmió a las dos y arriba se agarraron la cabeza." },
        dormir: { ambiente: -2, hinchada: -4, condicionTodos: 4,
          texto: "El plantel se fue a dormir. Afuera quedó gente cantando sola." },
      },
    }),
  },

  // ------------------------------------------------------------ vestuario
  {
    id: "asado",
    cuando: (c) => c.racha.slice(-1)[0] === "G" && (c.faltanDias ?? 9) <= 4,
    armar: () => ({
      s: {
        id: "asado",
        escena: "vestuario",
        titulo: "El plantel quiere hacer un asado",
        contexto: "Vienen de ganar y piden juntarse en el predio. " +
          "El tema es que se juega en cuatro días.",
        opciones: [
          { id: "asado", etiqueta: "Que lo hagan",
            detalle: "El grupo se une. Llegan pesados y arriba no lo van a entender" },
          { id: "despues", etiqueta: "Después del próximo",
            detalle: "Llegan enteros y el clima se enfría un poco" },
        ],
      },
      efectos: {
        asado: { ambiente: 10, condicionTodos: -6, paciencia: -7,
          texto: "Se hizo el asado en el predio. El grupo quedó unido y arriba pusieron cara." },
        despues: { ambiente: -3,
          texto: "Se postergó el asado. Alguno puso cara." },
      },
    }),
  },
  {
    id: "pelea_practica",
    cuando: (c) => c.ambiente < 55 && c.plantel.length > 4,
    armar: (c, rng) => {
      const a = rng.elegir(c.plantel);
      const b = rng.elegir(c.plantel.filter((x) => x.id !== a.id));
      return {
        s: {
          id: "pelea_practica",
          escena: "predio",
          titulo: "Se agarraron en la práctica",
          contexto: `${a.apellido} y ${b.apellido} terminaron a los golpes en el fútbol del jueves. ` +
            "Los separaron los compañeros.",
          opciones: [
            { id: "multar", etiqueta: "Multar a los dos",
              detalle: "Entra plata de las multas y quedan resentidos" },
            { id: "abrazo", etiqueta: "Que se arreglen entre ellos",
              detalle: "No gastás autoridad, pero no lo manejás vos",
              apuesta: { exito: 0.58,
                bien: "Se dieron la mano delante de todos",
                mal: "No se hablaron más y el vestuario quedó partido" } },
          ],
        },
        efectos: {
          multar: { dineroUsd: 40_000, ambiente: -6,
            moralDe: { id: a.id, delta: -10 },
            texto: `Se multó a ${a.apellido} y ${b.apellido}. El vestuario quedó helado.` },
          abrazo: {
            ambiente: 9, moralDe: { id: a.id, delta: 5 },
            texto: `${a.apellido} y ${b.apellido} se dieron la mano delante de todos.`,
            siSaleMal: { ambiente: -12, moralDe: { id: a.id, delta: -8 },
              texto: `${a.apellido} y ${b.apellido} no se hablaron más. El vestuario quedó partido.` },
          },
        },
      };
    },
  },
  {
    id: "veterano_retiro",
    cuando: (c) => c.plantel.some((j) => j.edad >= 35),
    armar: (c, rng) => {
      const j = rng.elegir(c.plantel.filter((x) => x.edad >= 35));
      return {
        s: {
          id: "veterano_retiro",
          escena: "vestuario",
          titulo: `${j.apellido} piensa en el final`,
          contexto: `Tiene ${j.edad} y dice que este es su último año. ` +
            "Quiere retirarse en Olimpia y jugando, no de traje.",
          opciones: [
            { id: "prometer", etiqueta: "Prometerle que juega",
              detalle: `Te atás a un titular de ${j.edad} años, y arriba lo saben` },
            { id: "verdad", etiqueta: "Decirle que se lo gane",
              detalle: "Queda dolido, el resto ve que nadie tiene el puesto asegurado" },
          ],
        },
        efectos: {
          prometer: { moralDe: { id: j.id, delta: 18 }, ambiente: 5, hinchada: 6, paciencia: -12,
            texto: `${j.apellido} va a cerrar su carrera de titular.` },
          verdad: { moralDe: { id: j.id, delta: -12 }, ambiente: 4, paciencia: 6,
            texto: `A ${j.apellido} le dijeron que se lo tiene que ganar. Se fue callado.` },
        },
      };
    },
  },
  {
    id: "pibe_pide_pista",
    cuando: (c) => c.plantel.some((j) => j.edad <= 20 && j.nivel_incertidumbre > 4),
    armar: (c, rng) => {
      const j = rng.elegir(c.plantel.filter((x) => x.edad <= 20 && x.nivel_incertidumbre > 4));
      return {
        s: {
          id: "pibe_pide_pista",
          escena: "predio",
          titulo: `El técnico de la reserva habló de ${j.apellido}`,
          contexto: `Dice que ya no tiene nada que aprender abajo y que si no juega en primera ` +
            "se lo van a llevar de arriba de la mesa.",
          opciones: [
            { id: "subir", etiqueta: "Que se entrene con el primero",
              detalle: "Tiene 19 años y arriba se juega distinto",
              apuesta: { exito: 0.62,
                bien: "Se acopló como si hubiera estado siempre",
                mal: "Se le vino el grupo encima y no la tocó" } },
            { id: "esperar", etiqueta: "Que siga en reserva",
              detalle: "Nadie se ofende, y el pibe se estanca" },
          ],
        },
        efectos: {
          subir: {
            moralDe: { id: j.id, delta: 16 }, ambiente: -3, hinchada: 4,
            subirDeReserva: j.id,
            texto: `${j.apellido} se entrena con el plantel principal y se acopló de una.`,
            siSaleMal: { moralDe: { id: j.id, delta: -14 }, ambiente: -8, subirDeReserva: j.id,
              texto: `${j.apellido} subió y el grupo se le vino encima. No la tocó en toda la semana.` },
          },
          // la moral de uno de reserva no mueve el nivel del domingo, así que
          // la opción se veía vacía; lo que sí se siente es el grupo, que lo
          // banca y no entiende por qué no sube
          esperar: { moralDe: { id: j.id, delta: -8 }, ambiente: -3,
            texto: `${j.apellido} sigue en la reserva por ahora.` },
        },
      };
    },
  },
  {
    id: "tatuaje",
    cuando: (c) => c.hinchada > 45 && c.plantel.some((j) => j.edad <= 24),
    armar: (c, rng) => {
      const j = rng.elegir(c.plantel.filter((x) => x.edad <= 24));
      return {
        s: {
          id: "tatuaje",
          escena: "tribuna",
          titulo: `${j.apellido} se tatuó el escudo`,
          contexto: "Lo subió a las redes y explotó. La gente lo hizo tendencia en dos horas. " +
            "El representante llamó preocupado: dice que le cierra puertas afuera.",
          opciones: [
            { id: "bancar", etiqueta: "Sacarlo a hablar con la prensa",
              detalle: "Tiene 22 años y nunca dio una nota solo",
              apuesta: { exito: 0.6,
                bien: "Dice justo lo que la gente quería escuchar",
                mal: "Se pone nervioso, larga una burrada y queda pegado" } },
            { id: "bajar", etiqueta: "Pedirle perfil bajo",
              detalle: "No se expone a nada, pero la gente se queda con las ganas" },
          ],
        },
        efectos: {
          bancar: {
            hinchada: 13, moralDe: { id: j.id, delta: 10 },
            texto: `${j.apellido} salió a hablar y se lo comieron a besos.`,
            siSaleMal: { hinchada: -9, ambiente: -4, moralDe: { id: j.id, delta: -12 },
              texto: `${j.apellido} se enredó solo en la nota y ahora lo cargan en todos lados.` },
          },
          bajar: { hinchada: -4, moralDe: { id: j.id, delta: -5 },
            texto: `Se le pidió a ${j.apellido} que no hable del tema.` },
        },
      };
    },
  },

  // ------------------------------------------------------------ la calle
  {
    id: "barra_predio",
    cuando: (c) => c.racha.slice(-3).filter((r) => r === "P").length >= 2,
    armar: () => ({
      s: {
        id: "barra_predio",
        escena: "tribuna",
        titulo: "Vinieron a la práctica",
        contexto: "Aparecieron veinte en el portón del predio después de la tercera derrota. " +
          "Piden hablar con el plantel, dicen que de buena manera.",
        opciones: [
          { id: "recibir", etiqueta: "Recibirlos",
            detalle: "Se calma la calle y el plantel entiende que hay ojos encima" },
          { id: "policia", etiqueta: "No abrir el portón",
            detalle: "El plantel entrena tranquilo y afuera se pudre" },
        ],
      },
      efectos: {
        recibir: { hinchada: 8, ambiente: -7, paciencia: 9,
          texto: "Entraron y hablaron con los referentes. Adentro nadie quedó cómodo, arriba sí." },
        policia: { hinchada: -10, ambiente: 3, paciencia: -6,
          texto: "No se les abrió. Quedaron gritando del otro lado y arriba se comieron el quilombo." },
      },
    }),
  },
  {
    id: "cabala",
    cuando: (c) => c.racha.slice(-2).every((r) => r === "G") && c.racha.length >= 2,
    armar: () => ({
      s: {
        id: "cabala",
        escena: "ruta",
        titulo: "La cábala del micro",
        contexto: "Desde que viajan en el micro viejo no perdieron. " +
          "El de la empresa nueva está listo, con aire y wifi. El plantel no lo quiere ni ver.",
        opciones: [
          { id: "cabala", etiqueta: "Que sigan con el viejo",
            detalle: "El grupo se enchufa. Viajan incómodos y hay que pagar el contrato nuevo igual" },
          { id: "comodo", etiqueta: "Subirlos al nuevo",
            detalle: "Llegan descansados y protestando" },
        ],
      },
      efectos: {
        cabala: { ambiente: 8, condicionTodos: -4, dineroUsd: -45_000,
          texto: "Se viajó en el micro de siempre. Hubo que pagarle igual a la empresa nueva." },
        comodo: { ambiente: -5, condicionTodos: 3,
          texto: "Se viajó en el micro nuevo. Alguno dijo que era mufa." },
      },
    }),
  },

  // ------------------------------------------------------------ mercado
  {
    id: "pibe_del_interior",
    cuando: () => true,
    armar: (c, rng) => {
      const pueblo = rng.elegir(["Concepción", "Encarnación", "Pedro Juan", "Villarrica", "Coronel Oviedo"]);
      // el nivel se sortea acá, cuando aparece la situación, y no cuando el
      // pibe entra: así la pantalla puede mostrarlo cayendo en la barra
      const nivel = rng.entero(54, 74);
      return {
        s: {
          id: "pibe_del_interior",
          escena: "mercado",
          titulo: `Un pibe de ${pueblo}`,
          contexto: `Un veedor habla de un chico de 18 que hace cosas raras en la liga de ${pueblo}. ` +
            "Nadie más lo vio jugar. Piden 90 mil y hay que decidir hoy.",
          opciones: [
            { id: "traer", etiqueta: "Traerlo a probarse",
              detalle: "Nadie sabe lo que es hasta que lo ve. Puede salir cualquier cosa",
              rango: { min: 54, max: 74, valor: nivel, unidad: "NIVEL" } },
            { id: "pasar", etiqueta: "Dejarlo pasar",
              detalle: "No se gasta, y si aparece en otro lado te vas a acordar" },
          ],
        },
        efectos: {
          traer: { dineroUsd: -90_000, hinchada: 2, traerPibe: { pueblo, nivel },
            texto: `Llegó el pibe de ${pueblo} a probarse en el predio.` },
          // dejarlo pasar tiene su precio: en el interior se cuenta, y la
          // gente toma nota de que Olimpia no fue a buscar al pibe
          pasar: { hinchada: -4, texto: `Se dejó pasar al chico de ${pueblo}.` },
        },
      };
    },
  },
  {
    id: "representante_carpeta",
    cuando: () => true,
    armar: () => ({
      s: {
        id: "representante_carpeta",
        escena: "mercado",
        titulo: "La carpeta del representante",
        contexto: "Te trae cuatro minutos editados de un brasileño y te jura que es un fenómeno. " +
          "Pide comisión por adelantado para seguir la charla.",
        opciones: [
          { id: "pagar", etiqueta: "Pagar la comisión",
            detalle: "Cuatro minutos editados pueden ser un jugador o pueden ser humo",
            apuesta: { exito: 0.5,
              bien: "El brasileño existe y queda disponible en el mercado",
              mal: "El representante desapareció con la plata" } },
          { id: "cortar", etiqueta: "Cortar la charla",
            detalle: "No se gasta un peso y se cierra una puerta" },
        ],
      },
      efectos: {
        pagar: {
          dineroUsd: -70_000, ofreceBrasileno: true,
          texto: "El brasileño existe. Ya está sobre la mesa en el mercado.",
          siSaleMal: { dineroUsd: -70_000, ambiente: -2,
            texto: "El representante no atendió más el teléfono. Era humo." },
        },
        // los representantes hablan entre ellos y con los dirigentes: cortarle
        // el teléfono a uno se sabe arriba
        cortar: { paciencia: -3, texto: "Se cortó la charla con el representante." },
      },
    }),
  },
  {
    id: "tv_adelanto",
    cuando: () => true,
    armar: () => ({
      s: {
        id: "tv_adelanto",
        escena: "dirigencia",
        titulo: "La TV ofrece un adelanto",
        contexto: "Proponen adelantar seis meses de derechos de televisión, con quita. " +
          "Plata hoy a cambio de menos plata en total.",
        opciones: [
          { id: "adelanto", etiqueta: "Cobrar ahora con quita",
            detalle: "Entra menos de lo que vale, y la dirigencia lo va a anotar" },
          { id: "esperar", etiqueta: "Esperar el cronograma",
            detalle: "No entra un peso hoy. Arriba lo leen como que manejás bien la caja" },
        ],
      },
      efectos: {
        adelanto: { dineroUsd: 620_000, ambiente: -2, paciencia: -10,
          texto: "Se adelantaron los derechos de TV resignando una parte. Hay caja para el mercado." },
        esperar: { paciencia: 8,
          texto: "Se esperó el cronograma normal de la TV. Arriba lo tomaron bien." },
      },
    }),
  },
  {
    id: "socios",
    cuando: (c) => c.hinchada > 60,
    armar: () => ({
      s: {
        id: "socios",
        escena: "tribuna",
        titulo: "Campaña de socios",
        contexto: "La comisión quiere lanzar una campaña de socios usando el momento del equipo. " +
          "Hay que poner al plantel a grabar y hacer actos.",
        opciones: [
          { id: "campana", etiqueta: "Poner al plantel",
            detalle: "Entra buena plata y se pierden dos días de trabajo" },
          { id: "no", etiqueta: "Dejarlos entrenar",
            detalle: "La semana queda limpia y la comisión se calienta" },
        ],
      },
      efectos: {
        campana: { dineroUsd: 420_000, condicionTodos: -13, hinchada: 5, ambiente: -8,
          texto: "La campaña de socios fue un éxito. El plantel perdió dos días de trabajo." },
        no: { paciencia: -8, condicionTodos: 5, ambiente: 6,
          texto: "Se priorizó el trabajo por encima de la campaña. La comisión se calentó." },
      },
    }),
  },
  // ------------------------------------------------- decisiones que son apuestas,
  {
    id: "tocado_juega",
    cuando: (c) => c.plantel.some((j) => j.nivel >= 66 && j.condicion < 72),
    armar: (c, rng) => {
      const j = rng.elegir(c.plantel.filter((x) => x.nivel >= 66 && x.condicion < 72));
      return {
        s: {
          id: "tocado_juega",
          escena: "sanidad",
          titulo: `${j.apellido} llega tocado`,
          contexto: "El médico dice que puede jugar infiltrado, pero que si se rompe " +
            "es para dos meses. Él quiere estar.",
          opciones: [
            { id: "jugar", etiqueta: "Que juegue infiltrado",
              detalle: "Aprieta los dientes y sale",
              apuesta: { exito: 0.75, bien: "Aguanta el partido", mal: "Se rompe y son dos meses" } },
            { id: "cuidar", etiqueta: "Que se cuide",
              detalle: "Se lo guarda y vuelve entero" },
          ],
        },
        efectos: {
          /*
           * Antes esto era una apuesta sin premio: si salía bien no pasaba
           * nada, y guardarlo tampoco hacía nada, así que no había motivo para
           * arriesgar. Y encima "se pierde este partido" era mentira: cuidarlo
           * no lo sacaba de ningún lado.
           *
           * Ahora las dos hacen lo suyo. Que juegue: se juega la cabeza del
           * plantel entero, porque el que sale tocado por la camiseta levanta
           * al grupo. Que se cuide: lo perdés para la próxima, que es lo que
           * decía el texto y nunca pasaba.
           */
          jugar: {
            moralDe: { id: j.id, delta: 8 }, ambiente: 5,
            texto: `${j.apellido} aguantó los noventa.`,
            siSaleMal: {
              ambiente: -8, moralDe: { id: j.id, delta: -14 },
              suspendeA: j.id, motivo: "lesion",
              texto: `${j.apellido} se rompió. Se pierde lo que viene.`,
            },
          },
          cuidar: {
            moralDe: { id: j.id, delta: -4 }, ambiente: -3,
            suspendeA: j.id, motivo: "descanso",
            texto: `Se guardó a ${j.apellido} para lo que viene.` },
        },
      };
    },
  },
  {
    id: "penal_definido",
    cuando: (c) => c.hinchada < 50,
    armar: () => ({
      s: {
        id: "penal_definido",
        escena: "prensa",
        titulo: "Te piden que salgas a bancar",
        contexto: "La gente está caliente y el periodismo pregunta si el plantel te sigue. " +
          "Podés salir a poner la cara vos solo o mandar a un referente.",
        opciones: [
          { id: "yo", etiqueta: "Poner la cara vos",
            detalle: "Si la gente lo compra te blindás; si no, quedás más expuesto",
            apuesta: { exito: 0.6, bien: "La gente valora que des la cara", mal: "Te comen vivo" } },
          { id: "referente", etiqueta: "Que hable un referente",
            detalle: "Más seguro, pero queda la sensación de que te escondés" },
        ],
      },
      efectos: {
        yo: {
          hinchada: 12, ambiente: 5,
          texto: "Diste la cara y la gente lo valoró.",
          siSaleMal: { hinchada: -9, ambiente: -4, texto: "Saliste a hablar y te comieron vivo." },
        },
        referente: { hinchada: -3, ambiente: 4,
          texto: "Habló un referente del plantel. Adentro se agradeció." },
      },
    }),
  },
  // ------------------------------------------------- las que se juegan al azar
  {
    id: "arbitro_denuncia",
    cuando: (c) => c.racha.includes("P"),
    armar: () => ({
      s: {
        id: "arbitro_denuncia",
        escena: "prensa",
        titulo: "El arbitraje del domingo",
        contexto: "Te cobraron dos penales en contra que no eran. El periodismo te " +
          "pone el micrófono y espera que estalles.",
        opciones: [
          { id: "denunciar", etiqueta: "Salir a denunciarlo",
            detalle: "La gente se prende, pero la APF puede tomarlo como desacato",
            apuesta: { exito: 0.55,
              bien: "La APF aparta al árbitro y quedás como el que la peleó",
              mal: "Te abren expediente y la dirigencia se agarra la cabeza" } },
          { id: "medido", etiqueta: "Marcarlo sin nombrarlo",
            detalle: "Queda dicho y no te expone" },
          { id: "callar", etiqueta: "No hablar del tema",
            detalle: "La gente lo lee como que no bancás. Arriba no querían pelea con la APF" },
        ],
      },
      efectos: {
        denunciar: {
          hinchada: 14, ambiente: 5,
          texto: "Saliste a bancar al plantel y la gente se prendió.",
          siSaleMal: { paciencia: -12, hinchada: 4, dineroUsd: -40_000,
            texto: "Expediente abierto y multa. La dirigencia no lo festejó." },
        },
        medido: { hinchada: 4, texto: "Lo marcaste sin dar nombres. Quedó dicho." },
        callar: { hinchada: -5, ambiente: -2, paciencia: 8,
          texto: "No hablaste del arbitraje. Adentro lo notaron, arriba lo agradecieron." },
      },
    }),
  },
  {
    id: "video_boliche",
    cuando: (c) => c.plantel.some((j) => j.edad <= 24),
    armar: (c, rng) => {
      const j = rng.elegir(c.plantel.filter((x) => x.edad <= 24));
      return {
        s: {
          id: "video_boliche",
          escena: "prensa",
          titulo: `Un video de ${j.apellido}`,
          contexto: `Circula un video de ${j.apellido} de madrugada, tres días antes del ` +
            "partido. Todavía no llegó a la tele pero está en todos los grupos.",
          opciones: [
            { id: "adelantarse", etiqueta: "Adelantarse y contarlo vos",
              detalle: "Si le pegás primero al tema se desactiva; si no, lo agrandás",
              apuesta: { exito: 0.62,
                bien: "Saliste antes que la tele y se murió el tema",
                mal: "Le diste aire y ahora hablan de eso toda la semana" } },
            { id: "multar", etiqueta: "Multarlo puertas adentro",
              detalle: "Entra la multa y queda claro el límite. Él no te lo perdona" },
            { id: "nada", etiqueta: "Hacer como que no viste nada",
              detalle: "El plantel ve que los bancás. Afuera te van a decir que no hacés nada" },
          ],
        },
        efectos: {
          adelantarse: {
            hinchada: 8, ambiente: 6,
            texto: "Lo contaste vos primero y el tema se apagó en un día.",
            siSaleMal: { hinchada: -8, ambiente: -5, moralDe: { id: j.id, delta: -8 },
              texto: `Se habló del video toda la semana. ${j.apellido} quedó marcado.` },
          },
          multar: { ambiente: 1, dineroUsd: 15_000, moralDe: { id: j.id, delta: -22 },
            texto: `Se multó a ${j.apellido}. Quedó claro el límite y él quedó dolido.` },
          /* La diferencia sale del clima del grupo, que siempre toca a los
             once. Apoyada en el ánimo de uno solo, esta decisión se volvía
             dominada o no según si ese día el sorteado era titular. */
          nada: { ambiente: 8, moralDe: { id: j.id, delta: 12 }, hinchada: -7,
            texto: "Puertas adentro no se dijo nada. El plantel vio que los bancás; afuera, que no hacés nada." },
        },
      };
    },
  },
  {
    id: "luz_del_defensores",
    cuando: (c) => (c.faltanDias ?? 99) >= 2 && (c.faltanDias ?? 99) <= 5,
    armar: () => ({
      s: {
        id: "luz_del_defensores",
        escena: "cancha",
        titulo: "Se quemó la iluminación",
        contexto: "Falló un sector de las torres del Defensores. O se arregla a las " +
          "corridas o el partido se juega a las tres de la tarde, con cuarenta grados.",
        opciones: [
          { id: "arreglar", etiqueta: "Pagar el arreglo urgente",
            detalle: "Sale caro y hay que confiar en que llegan a tiempo",
            apuesta: { exito: 0.7,
              bien: "Llegaron y se juega de noche con el estadio lleno",
              mal: "No terminaron: se juega de tarde y encima gastaste" } },
          { id: "tarde", etiqueta: "Jugar a las tres de la tarde",
            detalle: "No se gasta un peso, pero va menos gente y se corre peor" },
        ],
      },
      efectos: {
        arreglar: {
          dineroUsd: -110_000, hinchada: 6,
          texto: "Se arregló a tiempo. Partido de noche y el Defensores lleno.",
          siSaleMal: { dineroUsd: -110_000, hinchada: -6, condicionTodos: -4,
            texto: "No llegaron con el arreglo. Se jugó de tarde y encima se pagó." },
        },
        tarde: { hinchada: -7, condicionTodos: -4,
          texto: "Se juega a las tres de la tarde. Va a haber media cancha vacía." },
      },
    }),
  },
  {
    id: "oferta_al_dt",
    cuando: (c) => c.posicion <= 3 || c.racha.filter((r) => r === "G").length >= 2,
    armar: () => ({
      s: {
        id: "oferta_al_dt",
        escena: "dirigencia",
        titulo: "Te vinieron a buscar",
        contexto: "Un club de afuera pregunta por vos. No es una oferta formal todavía, " +
          "pero la dirigencia ya se enteró y quiere saber qué vas a hacer.",
        opciones: [
          { id: "quedarme", etiqueta: "Decir que te quedás",
            detalle: "La dirigencia y la gente lo agradecen" },
          { id: "usarla", etiqueta: "Usarla para pedir refuerzos",
            detalle: "Si te la compran entra plata; si se ofenden, te quedás sin crédito",
            apuesta: { exito: 0.5,
              bien: "Aflojaron la caja para retenerte",
              mal: "Les cayó pésimo que los aprietes" } },
        ],
      },
      efectos: {
        quedarme: { paciencia: 10, hinchada: 8, ambiente: 4,
          texto: "Dijiste que te quedás y en el club se respiró." },
        usarla: {
          dineroUsd: 500_000, paciencia: 4,
          texto: "Aflojaron la caja con tal de retenerte.",
          siSaleMal: { paciencia: -18, ambiente: -5,
            texto: "Les cayó pésimo el apriete. Quedaste sin crédito arriba." },
        },
      },
    }),
  },
  {
    id: "socio_vitalicio",
    cuando: () => true,
    armar: () => ({
      s: {
        id: "socio_vitalicio",
        escena: "tribuna",
        titulo: "El socio de toda la vida",
        contexto: "Don Ramón tiene ochenta y siete años y es socio desde el 62. Pide " +
          "entrar al vestuario antes del partido a saludar al plantel.",
        opciones: [
          { id: "recibirlo", etiqueta: "Que entre al vestuario",
            detalle: "Puede ser el mejor discurso de la temporada, o una distracción",
            apuesta: { exito: 0.78,
              bien: "Habló tres minutos y los dejó a todos con la piel de gallina",
              mal: "Se emocionó, se puso a llorar y quedó un clima raro" } },
          { id: "cancha", etiqueta: "Homenajearlo en la cancha",
            detalle: "Lo ve toda la tribuna y no toca el vestuario" },
        ],
      },
      efectos: {
        recibirlo: {
          ambiente: 12, hinchada: 5,
          texto: "Don Ramón habló tres minutos y los dejó a todos temblando.",
          siSaleMal: { ambiente: -4, hinchada: 5,
            texto: "Se emocionó de más y quedó un clima raro antes de salir." },
        },
        cancha: { hinchada: 10, ambiente: 3,
          texto: "Se lo homenajeó en el círculo central. El Defensores se puso de pie." },
      },
    }),
  },
  {
    id: "kinesiologo",
    cuando: (c) => c.plantel.filter((j) => j.condicion < 78).length >= 4,
    armar: () => ({
      s: {
        id: "kinesiologo",
        escena: "sanidad",
        titulo: "El cuerpo médico pide refuerzos",
        contexto: "Hay demasiados tocados. El médico quiere sumar un kinesiólogo más " +
          "y equipo de recuperación. Sale plata y no hay garantía.",
        opciones: [
          { id: "invertir", etiqueta: "Traerlo y comprar el equipo",
            detalle: "Si engancha, todo el plantel se recupera mejor",
            apuesta: { exito: 0.72,
              bien: "El plantel entero levantó físicamente",
              mal: "No cambió nada y la plata ya se fue" } },
          { id: "esperar", etiqueta: "Aguantar con lo que hay",
            detalle: "No se gasta, y el que está tocado sigue tocado" },
        ],
      },
      efectos: {
        invertir: {
          dineroUsd: -150_000, condicionTodos: 9, ambiente: 4,
          texto: "Se sumó el kinesiólogo y el plantel levantó físicamente.",
          siSaleMal: { dineroUsd: -150_000, condicionTodos: 1,
            texto: "Se gastó la plata y en la práctica no cambió nada." },
        },
        esperar: { ambiente: -4,
          texto: "No se sumó nadie al cuerpo médico. Los tocados siguen tocados." },
      },
    }),
  },
  {
    id: "banderazo_visitante",
    cuando: (c) => (c.faltanDias ?? 99) <= 3 && c.hinchada >= 45,
    armar: () => ({
      s: {
        id: "banderazo_visitante",
        escena: "ruta",
        titulo: "La gente quiere ir",
        contexto: "Se están organizando micros para acompañar al equipo. Piden que el " +
          "club ponga la mitad del viaje.",
        opciones: [
          { id: "pagar", etiqueta: "Poner los micros",
            detalle: "Sale plata y el aliento se escucha del otro lado",
            apuesta: { exito: 0.8,
              bien: "Coparon la tribuna visitante y se escuchó todo el partido",
              mal: "Hubo incidentes en la ruta y el club quedó pegado" } },
          { id: "no", etiqueta: "Que se arreglen solos",
            detalle: "No se gasta, pero van cuatro gatos locos" },
        ],
      },
      efectos: {
        pagar: {
          dineroUsd: -70_000, hinchada: 13, ambiente: 5,
          texto: "Coparon la visitante. Se escuchó el aliento los noventa minutos.",
          siSaleMal: { dineroUsd: -70_000, hinchada: -6, paciencia: -6,
            texto: "Hubo incidentes en la ruta y el club quedó pegado al quilombo." },
        },
        no: { hinchada: -6,
          texto: "El club no puso nada. Fueron cuatro gatos locos a la visitante." },
      },
    }),
  },
  {
    id: "reserva_golea",
    cuando: (c) => c.plantel.some((j) => j.reserva && j.edad <= 21),
    armar: (c, rng) => {
      const j = rng.elegir(c.plantel.filter((x) => x.reserva && x.edad <= 21));
      return {
        s: {
          id: "reserva_golea",
          escena: "predio",
          titulo: `${j.apellido} la está rompiendo en reserva`,
          contexto: `Lleva cinco goles en tres partidos y el predio habla de él. El ` +
            "técnico de reserva dice que ya no tiene nada más que hacer ahí abajo.",
          opciones: [
            { id: "subir", etiqueta: "Subirlo al plantel principal",
              detalle: "Ocupa lugar, pero si explota es tuyo" },
            { id: "prestamo", etiqueta: "Mandarlo a préstamo a jugar",
              detalle: "Pagan el cargo. Vuelve rodado, o vuelve quemado",
              apuesta: { exito: 0.6,
                bien: "Volvió jugando todo y con otra cabeza",
                mal: "No jugó nada y volvió peor de lo que se fue" } },
          ],
        },
        efectos: {
          subir: { subirDeReserva: j.id, ambiente: 5, moralDe: { id: j.id, delta: 15 },
            texto: `${j.apellido} sube al plantel principal.` },
          prestamo: {
            dineroUsd: 140_000, moralDe: { id: j.id, delta: 10 },
            texto: `${j.apellido} se fue a préstamo. Pagaron el cargo y volvió con otra cabeza.`,
            siSaleMal: { dineroUsd: 140_000, moralDe: { id: j.id, delta: -14 }, ambiente: -4,
              texto: `${j.apellido} no jugó nada en el préstamo. Cobraste el cargo y volvió peor.` },
          },
        },
      };
    },
  },
  {
    id: "escuelita",
    cuando: () => true,
    armar: () => ({
      s: {
        id: "escuelita",
        escena: "predio",
        titulo: "La escuelita del club",
        contexto: "Las inferiores entrenan en una cancha sin pasto y con dos arcos rotos. " +
          "El coordinador te muestra las fotos y te pide que muevas el tema arriba.",
        opciones: [
          { id: "bancar", etiqueta: "Poner plata del club",
            detalle: "La cantera te lo devuelve, tarde o temprano" },
          { id: "campaña", etiqueta: "Pedirle a la gente que ayude",
            detalle: "Si la hinchada se prende sale gratis; si no, quedás como el que no puso",
            apuesta: { exito: 0.65,
              bien: "La gente juntó la plata en cuatro días",
              mal: "No se juntó nada y quedaste como el que pasó la gorra" } },
          { id: "despues", etiqueta: "Ahora no hay plata",
            detalle: "Es verdad, y también es una respuesta" },
        ],
      },
      efectos: {
        bancar: { dineroUsd: -80_000, ambiente: 6, hinchada: 5,
          texto: "El club arregló la cancha de inferiores." },
        campaña: {
          hinchada: 12, ambiente: 4,
          texto: "La gente juntó la plata para la cancha en cuatro días.",
          siSaleMal: { hinchada: -8,
            texto: "No se juntó casi nada. Quedaste como el que pasó la gorra." },
        },
        despues: { ambiente: -4, paciencia: 7,
          texto: "Se le dijo que no al coordinador. Arriba no querían tocar esa plata." },
      },
    }),
  },
  {
    id: "pizarron_filtrado",
    cuando: (c) => (c.faltanDias ?? 99) <= 2,
    armar: () => ({
      s: {
        id: "pizarron_filtrado",
        escena: "predio",
        titulo: "Se filtró el once",
        contexto: "Salió publicado el equipo que ibas a poner, con nombres y todo. " +
          "Alguien de adentro lo pasó.",
        opciones: [
          { id: "cambiar", etiqueta: "Cambiar el equipo",
            detalle: "Sorprendés al rival, pero movés lo que venía funcionando",
            apuesta: { exito: 0.55,
              bien: "El rival se comió el amague y salió bárbaro",
              mal: "Tocaste lo que andaba y se notó adentro de la cancha" } },
          { id: "sostener", etiqueta: "Poner el mismo once",
            detalle: "Que se lo banquen. El rival ya lo sabe" },
          { id: "buscar", etiqueta: "Buscar quién fue",
            detalle: "Es lo que arriba te están pidiendo. Se pudre el vestuario" },
        ],
      },
      efectos: {
        cambiar: {
          ambiente: 9, hinchada: 5,
          texto: "Se cambió el equipo y el rival quedó pagando. Salió redondo.",
          siSaleMal: { ambiente: -7, condicionTodos: -2,
            texto: "Se tocó lo que andaba y se notó adentro de la cancha." },
        },
        sostener: { ambiente: 4, hinchada: 3,
          texto: "Salió el mismo once. No se le movió un pelo a nadie." },
        buscar: { ambiente: -10, paciencia: 9,
          texto: "Se salió a buscar al que filtró. El vestuario quedó mirándose feo, " +
            "pero arriba querían justamente eso." },
      },
    }),
  },
  {
    id: "presidente_promete",
    cuando: (c) => c.posicion <= 4,
    armar: () => ({
      s: {
        id: "presidente_promete",
        escena: "dirigencia",
        titulo: "El presidente quiere anunciar",
        contexto: "Está por salir a decir en la radio que este año salimos campeones. " +
          "Te pregunta si lo firmás con él.",
        opciones: [
          { id: "firmar", etiqueta: "Bancar el anuncio",
            detalle: "Si sale, sos un profeta; si no, sos el que prometió",
            apuesta: { exito: 0.5,
              bien: "La promesa encendió al plantel y a la gente",
              mal: "Quedó la vara altísima y la primera derrota pesa el doble" } },
          { id: "bajar", etiqueta: "Pedirle que baje un cambio",
            detalle: "Menos ruido, menos presión, menos entusiasmo" },
        ],
      },
      efectos: {
        firmar: {
          hinchada: 14, ambiente: 8, paciencia: 5,
          texto: "Se bancó el anuncio y se encendió todo el mundo.",
          siSaleMal: { paciencia: -12, ambiente: -6,
            texto: "Quedó la vara altísima. Cualquier tropiezo ahora pesa el doble." },
        },
        bajar: { paciencia: -4, ambiente: 3,
          texto: "Le pediste al presidente que baje un cambio con los anuncios." },
      },
    }),
  },
  {
    id: "utilero",
    cuando: () => true,
    armar: () => ({
      s: {
        id: "utilero",
        escena: "vestuario",
        titulo: "Se jubila el utilero",
        contexto: "Cuarenta y un años lavando las camisetas del club. Se va en junio y " +
          "el plantel quiere hacerle algo.",
        opciones: [
          { id: "homenaje", etiqueta: "Homenaje en el Defensores",
            detalle: "Lo ve toda la cancha. Hay que armarlo y sale plata" },
          { id: "sueldo", etiqueta: "Pagarle un año más de sueldo",
            detalle: "Cuesta el triple y no se entera nadie afuera, pero adentro no se olvida" },
        ],
      },
      efectos: {
        homenaje: { dineroUsd: -40_000, hinchada: 9, ambiente: 4,
          texto: "Le hicieron el homenaje en el Defensores. Lloró el vestuario entero." },
        sueldo: { dineroUsd: -140_000, ambiente: 13,
          texto: "Se le pagó un año más de sueldo. Adentro no se olvidó." },
      },
    }),
  },
];

export function sortearSituacion(c: Contexto, rng: Rng) {
  const posibles = PLANTILLAS.filter((p) => p.cuando(c));
  if (!posibles.length) return null;
  // primero las que todavía no te tocaron; recién cuando se acaba el mazo se
  // vuelve a repartir
  const vistas = new Set(c.vistas ?? []);
  const frescas = posibles.filter((p) => !vistas.has(p.id));
  return rng.elegir(frescas.length ? frescas : posibles).armar(c, rng);
}

/** Cuántas hay en total, para saber cuándo se dio la vuelta al mazo. */
export const TOTAL_SITUACIONES = PLANTILLAS.length;

/** Todas, para los scripts que las revisan una por una. */
export const TODAS = PLANTILLAS;
