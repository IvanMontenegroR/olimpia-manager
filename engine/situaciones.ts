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
