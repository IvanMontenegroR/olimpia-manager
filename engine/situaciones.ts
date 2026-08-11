import { Rng } from "./rng.ts";
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
}

export interface OpcionSituacion {
  id: string;
  etiqueta: string;
  detalle: string;
}

export interface Situacion {
  id: string;
  titulo: string;
  contexto: string;
  opciones: OpcionSituacion[];
}

type Contexto = {
  plantel: Jugador[];
  ambiente: number;
  hinchada: number;
  racha: ("G" | "E" | "P")[];
  posicion: number;
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
        titulo: "La dirigencia pide recortar",
        contexto: "Piden bajar gastos de concentración para ahorrar unos dólares.",
        opciones: [
          { id: "aceptar", etiqueta: "Aceptar el recorte",
            detalle: "Entra plata, se resiente la preparación" },
          { id: "pelear", etiqueta: "Pelear el presupuesto",
            detalle: "Sale plata, el plantel lo nota" },
        ],
      },
      efectos: {
        aceptar: { dineroUsd: 120_000, condicionTodos: -4, ambiente: -4,
          texto: "Se recortó la concentración. El plantel llega más justo." },
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
];

export function sortearSituacion(c: Contexto, rng: Rng) {
  const posibles = PLANTILLAS.filter((p) => p.cuando(c));
  if (!posibles.length) return null;
  return rng.elegir(posibles).armar(c, rng);
}
