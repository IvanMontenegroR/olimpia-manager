import { Rng } from "@/engine/rng.ts";
import type { Participante } from "./copas.ts";

/**
 * El sorteo de las dos copas, como lo hace la Conmebol.
 *
 * Tres cosas lo definen y las tres importan para que el cuadro se sienta real:
 *
 *   1. Las fases previas son eliminación directa y van encadenadas. En la
 *      Libertadores el que entra en la fase 1 tiene que ganar tres llaves para
 *      llegar a los grupos; el de la fase 2, dos.
 *   2. Los grupos se sortean por bombos, de mejor a peor, y no pueden caer dos
 *      del mismo país juntos.
 *   3. Cuando se sortean los grupos las previas todavía no se jugaron, así que
 *      cuatro lugares van con un cartel en vez de un nombre. Ese cartel es lo
 *      que hace que ganar la previa sea entrar a un grupo que ya existe.
 */

/** Un lugar del cuadro que todavía no tiene dueño. */
export interface Placeholder {
  /** "Ganador de la Fase 3 · Llave 2", que es lo que dice el bombo de verdad. */
  rotulo: string;
  /** De qué llave sale, para poder reemplazarlo cuando se juegue. */
  llave: string;
}

export type Casillero = Participante | Placeholder;
export const esPlaceholder = (c: Casillero): c is Placeholder =>
  (c as Placeholder).rotulo !== undefined;

export interface Llave {
  /** "F1-2": fase y número, para poder nombrarla en los placeholders. */
  id: string;
  fase: string;
  local: Casillero;
  visita: Casillero;
}

export interface Grupo {
  /** A, B, C... */
  letra: string;
  equipos: Casillero[];
}

export interface CuadroCopa {
  torneo: "libertadores" | "sudamericana";
  llaves: Llave[];
  grupos: Grupo[];
}

const LETRAS = "ABCDEFGH".split("");

/** Mezcla con el rng de la partida: el sorteo también tiene que ser tuyo. */
function mezclar<T>(xs: T[], rng: Rng): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const k = Math.floor(rng.next() * (i + 1));
    [a[i], a[k]] = [a[k], a[i]];
  }
  return a;
}

/** Empareja de a dos: el primero contra el último, y así. */
function emparejar(xs: Casillero[], fase: string, desde = 1): Llave[] {
  const llaves: Llave[] = [];
  for (let i = 0; i + 1 < xs.length; i += 2) {
    llaves.push({
      id: `${fase}-${desde + i / 2}`,
      fase,
      local: xs[i + 1],
      visita: xs[i],
    });
  }
  return llaves;
}

/**
 * Los grupos, repartiendo por bombos y sin dos del mismo país.
 *
 * Los bombos salen de ordenar por fuerza y cortar en cuatro: el bombo 1 son los
 * ocho mejores, y de cada bombo cae uno en cada grupo. Los placeholders van
 * siempre al último bombo, que es lo que hace la Conmebol con los que vienen de
 * las previas, y no cuentan para la restricción de país porque todavía no se
 * sabe quiénes son.
 */
function sortearGrupos(
  clasificados: Participante[], placeholders: Placeholder[], rng: Rng,
): Grupo[] {
  const cuantos = clasificados.length + placeholders.length;
  const cantidad = cuantos / 4;
  const grupos: Grupo[] = LETRAS.slice(0, cantidad).map((letra) => ({ letra, equipos: [] }));

  const ordenados = [...clasificados].sort((a, b) => b.fuerza - a.fuerza);
  const bombos: Casillero[][] = [];
  for (let b = 0; b < 4; b++) {
    const desde = b * cantidad;
    bombos.push(ordenados.slice(desde, desde + cantidad));
  }
  /* Los que vienen de las previas van al último bombo, como en el sorteo real. */
  if (placeholders.length) {
    bombos[3] = [...bombos[3].slice(0, cantidad - placeholders.length), ...placeholders];
  }

  for (const bombo of bombos) {
    const bolillas = mezclar(bombo, rng);
    for (const bolilla of bolillas) {
      /*
       * Se busca el grupo más vacío donde no haya ya un compatriota. Si no hay
       * ninguno se cae en el más vacío igual: es preferible un grupo con dos
       * del mismo país que un sorteo que no termina, y con estos números casi
       * nunca pasa.
       */
      const libres = grupos
        .filter((g) => g.equipos.length < 4)
        .sort((a, b) => a.equipos.length - b.equipos.length);
      const pais = esPlaceholder(bolilla) ? null : bolilla.pais;
      const elegido = libres.find((g) => !pais ||
        !g.equipos.some((e) => !esPlaceholder(e) && e.pais === pais)) ?? libres[0];
      /* Si no queda lugar es que vinieron más bolillas que casilleros: eso es
         un error de los cupos, no del sorteo, y se ve mejor acá que abajo. */
      if (!elegido) {
        throw new Error(
          `El sorteo recibió ${cuantos} equipos para ${cantidad} grupos de 4`);
      }
      elegido.equipos.push(bolilla);
    }
  }
  return grupos;
}

/**
 * El cuadro de la Libertadores: tres fases previas encadenadas y ocho grupos.
 *
 * Los seis de la fase 1 dejan tres, que se suman a los trece de la fase 2 para
 * armar las ocho llaves de la fase 2. De ahí salen ocho, que juegan la fase 3 y
 * dejan los cuatro que completan los grupos junto a los veintiocho directos.
 */
export function sortearLibertadores(participantes: Participante[], semilla: string): CuadroCopa {
  const rng = new Rng(`sorteo-lib-${semilla}`);
  const de = (f: string) => participantes.filter((p) => p.fase === f);

  const fase1 = emparejar(mezclar(de("fase 1"), rng), "F1");
  /* Los tres que salgan de la fase 1 entran a la fase 2 como carteles. */
  const salenF1: Placeholder[] = fase1.map((l) => ({ rotulo: `Ganador ${l.id}`, llave: l.id }));
  const fase2 = emparejar(mezclar([...de("fase 2"), ...salenF1], rng), "F2");
  const salenF2: Placeholder[] = fase2.map((l) => ({ rotulo: `Ganador ${l.id}`, llave: l.id }));
  const fase3 = emparejar(mezclar(salenF2, rng), "F3");
  const salenF3: Placeholder[] = fase3.map((l) => ({ rotulo: `Ganador ${l.id}`, llave: l.id }));

  return {
    torneo: "libertadores",
    llaves: [...fase1, ...fase2, ...fase3],
    grupos: sortearGrupos(de("grupos"), salenF3, rng),
  };
}

/**
 * El cuadro de la Sudamericana: los play-off nacionales y ocho grupos.
 *
 * La primera fase es entre clubes del MISMO país, a partido único: dos llaves
 * por asociación, y de cada país salen dos a los grupos. Brasil y Argentina no
 * la juegan, entran derecho.
 *
 * Y hay cuatro lugares que no salen de acá: los cuatro que pierden la fase 3 de
 * la Libertadores caen a los grupos de la Sudamericana. Es lo que hace que las
 * dos copas sean una sola cosa y no dos torneos sueltos, y es la única forma de
 * que Olimpia pueda arrancar el año buscando la Libertadores y terminar
 * jugando la otra sin quedarse sin nada.
 */
export function sortearSudamericana(
  participantes: Participante[], semilla: string,
  /** Las llaves de la fase 3 de la Libertadores, de donde bajan los cuatro. */
  faseTresLibertadores: Llave[] = [],
): CuadroCopa {
  const rng = new Rng(`sorteo-suda-${semilla}`);
  const directos = participantes.filter((p) => p.fase === "grupos");
  const previa = participantes.filter((p) => p.fase === "fase previa");

  const llaves: Llave[] = [];
  const salen: Placeholder[] = [];
  const paises = [...new Set(previa.map((p) => p.pais))].sort();
  let n = 1;
  for (const pais of paises) {
    const suyos = mezclar(previa.filter((p) => p.pais === pais), rng);
    for (const l of emparejar(suyos, "PO", n)) {
      llaves.push(l);
      salen.push({ rotulo: `Ganador ${l.id}`, llave: l.id });
    }
    n += Math.floor(suyos.length / 2);
  }

  const bajan: Placeholder[] = faseTresLibertadores.map((l) => ({
    rotulo: `Perdedor ${l.id}`, llave: `perdedor-${l.id}`,
  }));

  return {
    torneo: "sudamericana",
    llaves,
    grupos: sortearGrupos(directos, [...salen, ...bajan], rng),
  };
}

/** El nombre que se muestra de un casillero, tenga dueño o no. */
export const nombreDe = (c: Casillero) =>
  esPlaceholder(c) ? c.rotulo : c.nombre;
