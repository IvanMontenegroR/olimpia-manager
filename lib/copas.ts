import clubesJson from "@/data/clubes_conmebol.json";
import { Rng } from "@/engine/rng.ts";

/**
 * Quiénes juegan las copas este año.
 *
 * La versión honesta de esto sería simular las diez ligas de Sudamérica para
 * saber quién clasifica, y no vale la pena: al DT de Olimpia le importa contra
 * quién juega y que el cuadro tenga la forma de verdad, no si Huachipato salió
 * quinto en Chile. Así que hay un pool de noventa clubes reales con su país,
 * su ciudad y su fuerza, y cada año se sortea quién entra usando los cupos que
 * de verdad tiene cada asociación.
 *
 * El sorteo pesa por fuerza, no es parejo: Flamengo y River están casi todos
 * los años y Guabirá aparece cada tanto, que es lo que pasa. Y sale de la
 * semilla de la partida, así que dos temporadas no traen el mismo cuadro.
 *
 * Los paraguayos no se sortean: salen de tu propia tabla anual, que para eso
 * se juega el torneo.
 */

export interface ClubCopa {
  id: string;
  nombre: string;
  pais: string;
  ciudad: string;
  km_desde_asuncion: number;
  altura_m: number;
  fuerza: number;
  ambiente_hostil: string;
}

export const CLUBES = clubesJson as ClubCopa[];
const POR_ID = new Map(CLUBES.map((c) => [c.id, c]));
export const clubDe = (id: string) => POR_ID.get(id);

/**
 * Los cupos de cada asociación, y por dónde entra cada uno.
 *
 * Es la tabla real de la CONMEBOL. Brasil y Argentina meten cinco directo a
 * grupos y el resto arranca en las fases previas; los seis países chicos son
 * los únicos que ponen un equipo en la fase 1, que es la más larga.
 *
 * En total son 45 por cupo de país: 26 a grupos, 13 a la fase 2 y 6 a la fase
 * 1. Los 47 salen de sumar a los dos campeones defensores, el de la
 * Libertadores y el de la Sudamericana, que entran a grupos y NO le sacan el
 * lugar a su país. Es el mismo mecanismo por el que Olimpia campeón de América
 * entra a la Libertadores sin gastar un cupo paraguayo.
 *
 * La Sudamericana se lleva cuatro por país de los ocho que no son Brasil ni
 * Argentina, más seis de cada uno de esos dos que entran directo a los grupos.
 */
export const CUPOS: Record<string, { grupos: number; fase2: number; fase1: number; suda: number }> = {
  BRA: { grupos: 5, fase2: 2, fase1: 0, suda: 6 },
  ARG: { grupos: 5, fase2: 1, fase1: 0, suda: 6 },
  CHI: { grupos: 2, fase2: 2, fase1: 0, suda: 4 },
  COL: { grupos: 2, fase2: 2, fase1: 0, suda: 4 },
  BOL: { grupos: 2, fase2: 1, fase1: 1, suda: 4 },
  ECU: { grupos: 2, fase2: 1, fase1: 1, suda: 4 },
  PAR: { grupos: 2, fase2: 1, fase1: 1, suda: 4 },
  PER: { grupos: 2, fase2: 1, fase1: 1, suda: 4 },
  URU: { grupos: 2, fase2: 1, fase1: 1, suda: 4 },
  VEN: { grupos: 2, fase2: 1, fase1: 1, suda: 4 },
};

/** Por dónde entra un club a la copa. */
export type FaseEntrada = "grupos" | "fase 2" | "fase 1" | "fase previa";

export interface Participante {
  id: string;
  nombre: string;
  pais: string;
  fuerza: number;
  fase: FaseEntrada;
}

/** Un club del pool convertido en participante. */
const participante = (c: ClubCopa, fase: FaseEntrada): Participante =>
  ({ id: c.id, nombre: c.nombre, pais: c.pais, fuerza: c.fuerza, fase });

/**
 * Elige `cuantos` clubes de una lista, con más chance para los mejores.
 *
 * El peso es exponencial en la fuerza para que la diferencia se note: entre un
 * 78 y un 55 hay que ver al 78 casi siempre. Sin peso, la Libertadores de cada
 * año sería una lista al azar y Flamengo faltaría la mitad de las veces.
 */
function elegir(pool: ClubCopa[], cuantos: number, rng: Rng): ClubCopa[] {
  const quedan = [...pool];
  const salen: ClubCopa[] = [];
  for (let i = 0; i < cuantos && quedan.length; i++) {
    const pesos = quedan.map((c) => Math.pow(1.28, c.fuerza - 50));
    let r = rng.next() * pesos.reduce((a, b) => a + b, 0);
    let k = quedan.length - 1;
    for (let j = 0; j < quedan.length; j++) { r -= pesos[j]; if (r <= 0) { k = j; break; } }
    salen.push(quedan[k]);
    quedan.splice(k, 1);
  }
  /* Los mejores primero: el que sale mejor rankeado entra más adelante. */
  return salen.sort((a, b) => b.fuerza - a.fuerza);
}

/** Los cupos paraguayos, que salen de tu temporada y no de un sorteo. */
export interface CupoParaguayo { id: string; nombre: string; fase: FaseEntrada; torneo: "libertadores" | "sudamericana" }

/**
 * El cuadro de participantes del año.
 *
 * Los paraguayos vienen de afuera porque son los tuyos: los cuatro de la
 * Libertadores y los cuatro de la Sudamericana salieron de la tabla anual que
 * jugaste. Los otros noventa lugares se sortean acá.
 */
export function participantesDelAno(
  semilla: string, ano: number, paraguayos: CupoParaguayo[],
  /**
   * Los campeones que vuelven a defender el título. El de la Sudamericana
   * puede ser Olimpia, y en ese caso ya viene adentro de `paraguayos`.
   */
  campeonSudamericana?: string,
): { libertadores: Participante[]; sudamericana: Participante[] } {
  const rng = new Rng(`copas-${semilla}-${ano}`);
  const libertadores: Participante[] = [];
  const sudamericana: Participante[] = [];

  for (const [pais, cupo] of Object.entries(CUPOS)) {
    if (pais === "PAR") {
      for (const p of paraguayos) {
        const destino = p.torneo === "libertadores" ? libertadores : sudamericana;
        destino.push({ id: p.id, nombre: p.nombre, pais: "PAR", fuerza: fuerzaParaguaya(p.id), fase: p.fase });
      }
      continue;
    }
    const pool = CLUBES.filter((c) => c.pais === pais);
    const total = cupo.grupos + cupo.fase2 + cupo.fase1 + cupo.suda;
    const salen = elegir(pool, total, rng);

    let i = 0;
    for (let k = 0; k < cupo.grupos; k++) libertadores.push(participante(salen[i++], "grupos"));
    for (let k = 0; k < cupo.fase2; k++) libertadores.push(participante(salen[i++], "fase 2"));
    for (let k = 0; k < cupo.fase1; k++) libertadores.push(participante(salen[i++], "fase 1"));
    for (let k = 0; k < cupo.suda; k++) {
      const c = salen[i++];
      if (!c) break;
      /* Brasil y Argentina entran directo a los grupos de la Sudamericana. */
      sudamericana.push(participante(c, pais === "BRA" || pais === "ARG" ? "grupos" : "fase previa"));
    }
  }

  /*
   * Y los dos campeones defensores, que entran de arriba.
   *
   * El de la Libertadores se sortea entre los grandes, porque esa copa todavía
   * no se juega en el juego. El de la Sudamericana es el que la ganó de verdad
   * el año pasado: si fue Olimpia ya está adentro de `paraguayos`, así que solo
   * hay que agregar el que falte para llegar a los 47.
   */
  const yaEstan = new Set(libertadores.map((p) => p.id));
  const candidatos = CLUBES
    .filter((c) => !yaEstan.has(c.id) && c.fuerza >= 66)
    .sort((a, b) => b.fuerza - a.fuerza);
  const campeonLib = elegir(candidatos, 1, rng)[0];
  if (campeonLib) {
    libertadores.push(participante(campeonLib, "grupos"));
    yaEstan.add(campeonLib.id);
  }
  if (!campeonSudamericana || !yaEstan.has(campeonSudamericana)) {
    const suda = campeonSudamericana ? clubDe(campeonSudamericana) : undefined;
    const elegido = suda && !yaEstan.has(suda.id)
      ? suda
      : elegir(CLUBES.filter((c) => !yaEstan.has(c.id) && c.fuerza >= 64), 1, rng)[0];
    if (elegido) libertadores.push(participante(elegido, "grupos"));
  }

  return { libertadores, sudamericana };
}

/**
 * La fuerza de un club paraguayo.
 *
 * Están en el JSON de la liga local y no en el de la Conmebol, así que se
 * busca ahí. Olimpia no aparece: su fuerza es la de tu plantel, que la calcula
 * el motor con los once que pongas.
 */
import equiposJson from "@/data/equipos_2026.json";
const LOCALES = equiposJson as { id: string; fuerza: number }[];
function fuerzaParaguaya(id: string): number {
  return LOCALES.find((e) => e.id === id)?.fuerza ?? 60;
}
