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
  texto: string;
  /** Si la opción es una apuesta, el otro resultado posible. */
  siSaleMal?: Omit<Efecto, "siSaleMal">;
  /** Deja al jugador afuera del próximo partido (expulsión, lesión). */
  suspendeA?: string;
  /** Suma al plantel un juvenil de nivel desconocido, del pueblo que diga. */
  traerPibeDe?: string;
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
};

type Plantilla = {
  id: string;
  cuando: (c: Contexto) => boolean;
  armar: (c: Contexto, rng: Rng) => { s: Situacion; efectos: Record<string, Efecto> };
};

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
              detalle: "Se calma, pero si no lo ponés se va a acordar" },
            { id: "franco", etiqueta: "Decirle la verdad",
              detalle: "No le va a gustar, pero es honesto" },
            { id: "cortar", etiqueta: "Cortarlo en seco",
              detalle: "Se impone autoridad y se paga con clima" },
          ],
        },
        efectos: {
          prometer: { moralDe: { id: j.id, delta: 14 }, ambiente: 2,
            texto: `${j.apellido} se fue conforme. Ahora hay que cumplirle.` },
          franco: { moralDe: { id: j.id, delta: -4 }, ambiente: 4,
            texto: `${j.apellido} lo tomó mal, pero el resto del plantel valoró la franqueza.` },
          cortar: { moralDe: { id: j.id, delta: -14 }, ambiente: -5,
            texto: `${j.apellido} salió golpeando la puerta. El vestuario quedó tenso.` },
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
            detalle: "Los jugadores lo escuchan" },
          { id: "exigir", etiqueta: "Exigir públicamente",
            detalle: "La gente lo aplaude, el plantel no tanto" },
          { id: "esquivar", etiqueta: "No entrar en el tema",
            detalle: "No suma ni resta" },
        ],
      },
      efectos: {
        bancar: { ambiente: 7, hinchada: -3,
          texto: "Los jugadores agradecieron el respaldo público." },
        exigir: { ambiente: -6, hinchada: 6,
          texto: "La hinchada festejó la autocrítica. Adentro cayó pesado." },
        esquivar: { ambiente: 0, hinchada: -1, texto: "Respuestas cortas y a otra cosa." },
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
            detalle: "Baja la tensión, es un antecedente feo" },
          { id: "ignorar", etiqueta: "Ignorarlo",
            detalle: "No se negocia con presión" },
          { id: "denunciar", etiqueta: "Denunciarlo públicamente",
            detalle: "Se planta la postura y escala" },
        ],
      },
      efectos: {
        recibir: { hinchada: 8, ambiente: -6, texto: "Se habló y bajó la tensión, por ahora." },
        ignorar: { hinchada: -4, ambiente: 2, texto: "El club no dijo nada. Siguió el ruido." },
        denunciar: { hinchada: -10, ambiente: 8,
          texto: "El club denunció el aprieto. El plantel se sintió protegido." },
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
              detalle: "Se queda a la fuerza y el vestuario empeora" },
            { id: "escuchar", etiqueta: "Escucharlo y ceder en algo",
              detalle: "Cuesta plata, pero se recompone el grupo" },
            { id: "listar", etiqueta: "Ponerlo en la lista de transferibles",
              detalle: "Se corta el problema de raíz, la gente no lo va a entender" },
          ],
        },
        efectos: {
          retener: { ambiente: -9, moralDe: { id: j.id, delta: -18 },
            texto: `${j.apellido} se queda obligado. El vestuario quedó peor que antes.` },
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
            detalle: "El plantel se siente investigado" },
          { id: "puertas", etiqueta: "Cerrar el predio a la prensa",
            detalle: "Se corta la filtración, la prensa se ensaña" },
          { id: "nada", etiqueta: "Dejarlo pasar",
            detalle: "No se hace nada y sigue el goteo" },
        ],
      },
      efectos: {
        buscar: { ambiente: -8, texto: "Se buscó al responsable y no apareció. Quedó todo peor." },
        puertas: { ambiente: 8, hinchada: -6,
          texto: "Predio cerrado. Adentro bajó la tensión, afuera subió." },
        nada: { ambiente: -4, hinchada: -3, texto: "Nadie dijo nada y la interna siguió saliendo." },
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
            { id: "charla", etiqueta: "Charla de grupo",
              detalle: "Se pierde un día de trabajo, se recompone algo" },
            { id: "tapar", etiqueta: "Que no salga de acá",
              detalle: "No cambia nada, pero nadie se entera" },
          ],
        },
        efectos: {
          multar: { dineroUsd: 60_000, ambiente: -7,
            texto: "Se los multó. El plantel entendió el mensaje pero quedó más frío." },
          charla: { ambiente: 12, condicionTodos: -3,
            texto: "Se paró el entrenamiento para hablar. Salió bien." },
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
              detalle: "El pibe de la casa. A la gente le gusta" },
            { id: "hinchada", etiqueta: "Con la hinchada",
              detalle: "Sin caras, todo el club" },
          ],
        },
        efectos: {
          estrella: { dineroUsd: 380_000, hinchada: -2,
            moralDe: { id: estrella.id, delta: 8 },
            texto: `La camiseta se presentó con ${estrella.apellido}. Se vendió muy bien afuera.` },
          pibe: { dineroUsd: 210_000, hinchada: 7,
            moralDe: { id: pibe.id, delta: 10 },
            texto: `${pibe.apellido} fue la cara de la camiseta. La gente lo festejó.` },
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
            detalle: "Plata segura ahora, sin premios" },
          { id: "variable", etiqueta: "Menos fijo, bonus por títulos",
            detalle: "Entra menos hoy, mucho más si salís campeón" },
        ],
      },
      efectos: {
        fijo: { dineroUsd: 700_000,
          texto: "Se firmó el contrato fijo. Entró la plata de una." },
        variable: { dineroUsd: 250_000, ambiente: 3,
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
            detalle: "Buena plata, cuesta piernas" },
          { id: "rechazar", etiqueta: "Rechazar",
            detalle: "La semana queda limpia" },
        ],
      },
      efectos: {
        jugar: { dineroUsd: 220_000, condicionTodos: -9, hinchada: 2,
          texto: "Se jugó el amistoso. Entró plata y el plantel quedó cansado." },
        rechazar: { dineroUsd: 0, texto: "Se rechazó el amistoso. La semana queda para trabajar." },
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
            detalle: "Pelotazo y pierna fuerte. Se emparejan los niveles y sube el riesgo de expulsión" },
          { id: "jugar", etiqueta: "Jugar igual al fútbol",
            detalle: "Nadie se adapta y todos terminan reventados" },
        ],
      },
      efectos: {
        guapos: { ambiente: 3, texto: "Se salió a pelearla. En ese barro no se juega, se sobrevive." },
        jugar: { condicionTodos: -7, ambiente: -2,
          texto: "Se intentó jugar en el barro y el equipo terminó fundido." },
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
            detalle: "La gente te ama, pero el domingo te cobran todo en contra" },
          { id: "diplomatico", etiqueta: "Decir que confiás en él",
            detalle: "No pasa nada, ni bueno ni malo" },
        ],
      },
      efectos: {
        denunciar: { hinchada: 9, ambiente: 3,
          texto: "Se habló fuerte del arbitraje. La hinchada lo festejó, la APF no." },
        diplomatico: { hinchada: -2,
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
            detalle: "El vestuario y la gente se encienden, pero si perdés el clásico es el doble de golpe" },
          { id: "ignorar", etiqueta: "No entrar",
            detalle: "Queda la sensación de que te la comiste" },
        ],
      },
      efectos: {
        contestar: { hinchada: 11, ambiente: 6,
          texto: "Se le contestó al DT de Cerro. Asunción habla de otra cosa." },
        ignorar: { hinchada: -5, ambiente: -2,
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
            detalle: "Se van a dormir a las dos de la mañana, pero salen a la cancha con todo" },
          { id: "dormir", etiqueta: "Que se vayan a dormir",
            detalle: "Descansan bien y la gente se vuelve a su casa fría" },
        ],
      },
      efectos: {
        salir: { ambiente: 9, hinchada: 8, condicionTodos: -5,
          texto: "El plantel salió al portón. Se durmió tarde, pero nadie se lo va a olvidar." },
        dormir: { ambiente: -2, hinchada: -4,
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
            detalle: "El grupo se une, pero llegan más pesados al partido" },
          { id: "despues", etiqueta: "Después del próximo",
            detalle: "Llegan enteros y el clima se enfría un poco" },
        ],
      },
      efectos: {
        asado: { ambiente: 10, condicionTodos: -6,
          texto: "Se hizo el asado en el predio. El grupo quedó más unido que nunca." },
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
              detalle: "Si funciona el grupo se suelda, y si no la interna sigue" },
          ],
        },
        efectos: {
          multar: { dineroUsd: 40_000, ambiente: -6,
            moralDe: { id: a.id, delta: -10 },
            texto: `Se multó a ${a.apellido} y ${b.apellido}. El vestuario quedó helado.` },
          abrazo: { ambiente: 7, moralDe: { id: a.id, delta: 5 },
            texto: `${a.apellido} y ${b.apellido} se dieron la mano delante de todos.` },
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
              detalle: "Se entrega entero, pero te atás a un jugador de su edad" },
            { id: "verdad", etiqueta: "Decirle que se lo gane",
              detalle: "Queda dolido, el resto ve que nadie tiene el puesto asegurado" },
          ],
        },
        efectos: {
          prometer: { moralDe: { id: j.id, delta: 18 }, ambiente: 5, hinchada: 4,
            texto: `${j.apellido} va a cerrar su carrera de titular.` },
          verdad: { moralDe: { id: j.id, delta: -12 }, ambiente: 3,
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
              detalle: "El pibe crece y algún grande se calienta por perder su lugar" },
            { id: "esperar", etiqueta: "Que siga en reserva",
              detalle: "Nadie se ofende, y el pibe se estanca" },
          ],
        },
        efectos: {
          subir: { moralDe: { id: j.id, delta: 16 }, ambiente: -3, hinchada: 3,
            texto: `${j.apellido} se entrena con el plantel principal.` },
          esperar: { moralDe: { id: j.id, delta: -8 },
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
              detalle: "La hinchada lo adopta, y si después juega mal la caída es peor" },
            { id: "bajar", etiqueta: "Pedirle perfil bajo",
              detalle: "Se cuida su mercado y la gente se queda con las ganas" },
          ],
        },
        efectos: {
          bancar: { hinchada: 10, moralDe: { id: j.id, delta: 10 },
            texto: `${j.apellido} salió a hablar y se lo comieron a besos.` },
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
        recibir: { hinchada: 8, ambiente: -7,
          texto: "Entraron al predio y hablaron con los referentes. Adentro nadie quedó cómodo." },
        policia: { hinchada: -10, ambiente: 3,
          texto: "No se les abrió. Quedaron gritando del otro lado del portón." },
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
            detalle: "El grupo se enchufa, viajan cuatro horas incómodos" },
          { id: "comodo", etiqueta: "Subirlos al nuevo",
            detalle: "Llegan descansados y protestando" },
        ],
      },
      efectos: {
        cabala: { ambiente: 8, condicionTodos: -4,
          texto: "Se viajó en el micro de siempre. La cábala manda." },
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
      return {
        s: {
          id: "pibe_del_interior",
          escena: "mercado",
          titulo: `Un pibe de ${pueblo}`,
          contexto: `Un veedor habla de un chico de 18 que hace cosas raras en la liga de ${pueblo}. ` +
            "Nadie más lo vio jugar. Piden 90 mil y hay que decidir hoy.",
          opciones: [
            // No es una apuesta con dos resultados: es una incógnita que se
            // despeja cuando el pibe debuta, así que el rango va en el detalle.
            { id: "traer", etiqueta: "Traerlo a probarse",
              detalle: "Puede salir cualquier cosa entre 54 y 74 de nivel. " +
                "No lo vas a saber hasta que juegue" },
            { id: "pasar", etiqueta: "Dejarlo pasar",
              detalle: "No se gasta, y si aparece en otro lado te vas a acordar" },
          ],
        },
        efectos: {
          traer: { dineroUsd: -90_000, hinchada: 2, traerPibeDe: pueblo,
            texto: `Llegó el pibe de ${pueblo} a probarse en el predio.` },
          pasar: { texto: `Se dejó pasar al chico de ${pueblo}.` },
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
            detalle: "Se abre la negociación, y el video puede ser humo" },
          { id: "cortar", etiqueta: "Cortar la charla",
            detalle: "No se gasta un peso y se cierra una puerta" },
        ],
      },
      efectos: {
        pagar: { dineroUsd: -70_000,
          texto: "Se pagó la comisión. El representante prometió traer al jugador la semana que viene." },
        cortar: { texto: "Se cortó la charla con el representante." },
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
          { id: "adelanto", etiqueta: "Cobrar ahora",
            detalle: "Entra plata para el mercado, se resigna una parte" },
          { id: "esperar", etiqueta: "Esperar el cronograma",
            detalle: "Se cobra todo, pero llega tarde para fichar" },
        ],
      },
      efectos: {
        adelanto: { dineroUsd: 900_000, ambiente: -2,
          texto: "Se adelantaron los derechos de TV con quita. Hay caja para el mercado." },
        esperar: { texto: "Se esperó el cronograma normal de la TV." },
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
        campana: { dineroUsd: 650_000, condicionTodos: -4, hinchada: 5,
          texto: "La campaña de socios fue un éxito. El plantel perdió dos días." },
        no: { texto: "Se priorizó el trabajo por encima de la campaña." },
      },
    }),
  },
  // ------------------------------------------------- decisiones que son apuestas
  {
    id: "amonestado_caliente",
    cuando: (c) => c.plantel.some((j) => j.tarjetas_amarillas > 0),
    armar: (c, rng) => {
      const j = rng.elegir(c.plantel.filter((x) => x.tarjetas_amarillas > 0));
      return {
        s: {
          id: "amonestado_caliente",
          escena: "cancha",
          titulo: `${j.apellido} está caliente`,
          contexto: `Lleva amarilla y va a buscar todas. El banco dice que en cualquier ` +
            "momento se hace expulsar. Quedan treinta minutos.",
          opciones: [
            { id: "hablar", etiqueta: "Ir a hablarle",
              detalle: "No gastás cambio, pero puede no entender",
              apuesta: { exito: 0.7, bien: "Se calma y termina el partido", mal: "Se hace expulsar igual" } },
            { id: "cambiar", etiqueta: "Sacarlo ya",
              detalle: "Seguro, pero gastás un cambio y sale caliente" },
          ],
        },
        efectos: {
          hablar: {
            moralDe: { id: j.id, delta: 4 },
            texto: `${j.apellido} entendió el mensaje y bajó un cambio.`,
            siSaleMal: {
              ambiente: -6, moralDe: { id: j.id, delta: -12 }, suspendeA: j.id,
              texto: `${j.apellido} se hizo expulsar. Se pierde la próxima fecha.`,
            },
          },
          cambiar: { moralDe: { id: j.id, delta: -8 },
            texto: `Salió ${j.apellido} antes de tiempo. No le gustó nada.` },
        },
      };
    },
  },
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
              detalle: "Tenés a tu jugador, con riesgo de que se rompa en serio",
              apuesta: { exito: 0.75, bien: "Aguanta el partido", mal: "Se rompe y son dos meses" } },
            { id: "cuidar", etiqueta: "Que se cuide",
              detalle: "Se pierde este partido y vuelve entero" },
          ],
        },
        efectos: {
          jugar: {
            moralDe: { id: j.id, delta: 8 },
            texto: `${j.apellido} aguantó los noventa.`,
            siSaleMal: {
              ambiente: -8, moralDe: { id: j.id, delta: -14 }, suspendeA: j.id,
              texto: `${j.apellido} se rompió. Se pierde lo que viene.`,
            },
          },
          cuidar: { moralDe: { id: j.id, delta: -4 }, condicionTodos: 0,
            texto: `Se cuidó a ${j.apellido} para lo que viene.` },
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
];

export function sortearSituacion(c: Contexto, rng: Rng) {
  const posibles = PLANTILLAS.filter((p) => p.cuando(c));
  if (!posibles.length) return null;
  return rng.elegir(posibles).armar(c, rng);
}
