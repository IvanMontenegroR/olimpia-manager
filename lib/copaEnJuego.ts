import { Rng } from "@/engine/rng.ts";
import { clubDe } from "./copas.ts";
import {
  dondeEsta, esPlaceholder, grupoQueEspera, nombreDe, resolverLlave,
  type CuadroCopa, type Grupo, type Llave,
} from "./sorteo.ts";
import type { Participante } from "./copas.ts";

/**
 * El camino de Olimpia por la copa, contra el cuadro sorteado en enero.
 *
 * Antes la copa era una escalera fija de octavos a final con un rival sacado de
 * una lista: no había fases previas, no había grupos, y el cuadro no existía.
 * Ahora el cuadro está sorteado y guardado desde enero, así que este módulo no
 * inventa nada, solo lee: en qué etapa está Olimpia, contra quién le toca y qué
 * día se juega.
 *
 * Todo lo que decide es determinista salvo los resultados de los otros, que
 * salen de la semilla de la partida.
 */

export type EtapaCopa =
  | "fase 1" | "fase 2" | "fase 3" | "grupos"
  | "octavos" | "cuartos" | "semis" | "final"
  | "eliminado" | "campeon";

export const NOMBRE_ETAPA: Record<EtapaCopa, string> = {
  "fase 1": "Fase 1", "fase 2": "Fase 2", "fase 3": "Fase 3", grupos: "Fase de grupos",
  octavos: "Octavos", cuartos: "Cuartos", semis: "Semifinal", final: "FINAL",
  eliminado: "Eliminado", campeon: "Campeón",
};

/**
 * Cuándo se juega cada cosa, en días del año.
 *
 * Es el calendario de la Conmebol: las previas en febrero y marzo, los grupos
 * repartidos entre abril y mayo, y las fases finales del otro lado del
 * invierno. Está hecho para que caiga entre semana y choque con la liga, que es
 * de donde sale la rotación: si la copa se jugara en fechas libres, tener
 * plantel largo no serviría de nada.
 */
const FECHAS: Record<string, string[]> = {
  "fase 1": ["-02-10", "-02-17"],
  "fase 2": ["-02-24", "-03-03"],
  "fase 3": ["-03-10", "-03-17"],
  grupos: ["-04-07", "-04-21", "-05-05", "-05-12", "-05-19", "-05-26"],
  octavos: ["-08-11", "-08-18"],
  cuartos: ["-09-15", "-09-22"],
  semis: ["-10-20", "-10-27"],
  final: ["-11-20"],
};

/** El día de un partido de la copa. */
export function diaDe(ano: number, etapa: EtapaCopa, i: number): string | null {
  const dias = FECHAS[etapa];
  return dias?.[i] ? `${ano}${dias[i]}` : null;
}

/** Las etapas en orden, para saber qué viene después de qué. */
const ORDEN: EtapaCopa[] = ["fase 1", "fase 2", "fase 3", "grupos",
                            "octavos", "cuartos", "semis", "final"];

/** La etapa que sigue a esta. */
export function etapaSiguiente(e: EtapaCopa): EtapaCopa {
  const i = ORDEN.indexOf(e);
  return i < 0 || i + 1 >= ORDEN.length ? "campeon" : ORDEN[i + 1];
}

/**
 * De qué llave de la fase previa es Olimpia en esta etapa.
 *
 * Las llaves del cuadro tienen id "F1-2" o "PO-10", y la etapa se lee del
 * prefijo: F1 es la fase 1, PO es el play-off nacional de la Sudamericana, que
 * hace de fase previa única.
 */
export function llaveDeOlimpia(c: CuadroCopa, etapa: EtapaCopa): Llave | null {
  const prefijo = etapa === "fase 1" ? "F1" : etapa === "fase 2" ? "F2"
    : etapa === "fase 3" ? "F3" : null;
  if (!prefijo) return null;
  const suyas = c.llaves.filter((l) =>
    (l.fase === prefijo || (prefijo === "F1" && l.fase === "PO")) &&
    [l.local, l.visita].some((x) => !esPlaceholder(x) && x.id === "olimpia"));
  return suyas[0] ?? null;
}

/** El grupo de Olimpia, si ya está adentro. */
export function grupoDeOlimpia(c: CuadroCopa): Grupo | null {
  return dondeEsta(c, "olimpia").grupo;
}

/** Por dónde arranca Olimpia en este cuadro. */
export function etapaInicial(c: CuadroCopa): EtapaCopa {
  const d = dondeEsta(c, "olimpia");
  if (d.grupo) return "grupos";
  if (!d.llave) return "eliminado";
  return d.llave.fase === "F1" ? "fase 1"
    : d.llave.fase === "F2" ? "fase 2"
    : d.llave.fase === "PO" ? "fase 1"
    : "fase 3";
}

export interface RivalDeCopa {
  id: string;
  nombre: string;
  fuerza: number;
  km: number;
  altura: number;
  hostil: string;
}

/** Los datos de un rival internacional, o de uno paraguayo si es un play-off. */
export function rivalDeCopa(id: string, fuerza?: number): RivalDeCopa {
  const c = clubDe(id);
  if (c) {
    return { id, nombre: c.nombre, fuerza: c.fuerza, km: c.km_desde_asuncion,
             altura: c.altura_m, hostil: c.ambiente_hostil };
  }
  /* Los paraguayos del play-off no están en el pool de la Conmebol. */
  return { id, nombre: id, fuerza: fuerza ?? 60, km: 0, altura: 43, hostil: "medio" };
}

/**
 * Contra quién juega Olimpia el partido `i` de la etapa.
 *
 * En las llaves siempre es el mismo rival, ida y vuelta. En los grupos son
 * tres rivales, cada uno dos veces: primero las tres de local y después las
 * tres de visitante, que es lo que hace que el tramo de visitante duela.
 */
export function rivalDeLaEtapa(
  c: CuadroCopa, etapa: EtapaCopa, i: number,
): { id: string; esLocal: boolean } | null {
  if (etapa === "grupos") {
    const g = grupoDeOlimpia(c);
    if (!g) return null;
    const otros = g.equipos.filter((x) => esPlaceholder(x) || x.id !== "olimpia");
    const rival = otros[i % 3];
    if (!rival) return null;
    return {
      id: esPlaceholder(rival) ? "" : rival.id,
      esLocal: i < 3,
    };
  }
  const llave = llaveDeOlimpia(c, etapa);
  if (!llave) return null;
  const rival = [llave.local, llave.visita]
    .find((x) => esPlaceholder(x) || x.id !== "olimpia");
  if (!rival || esPlaceholder(rival)) return null;
  /* En las llaves se juega la vuelta de local, como cae el sorteo. */
  return { id: rival.id, esLocal: i === 1 };
}

/**
 * Cómo va el grupo de Olimpia.
 *
 * Los otros tres juegan entre ellos y esos resultados salen de la semilla: no
 * se simulan partido a partido, se resuelven de una con el nivel de cada uno.
 * Alcanza, porque lo único que hace falta saber es si Olimpia entró entre los
 * dos primeros.
 */
export interface FilaGrupo {
  id: string; nombre: string; pj: number; pts: number; dg: number; gf: number;
}

export function tablaDelGrupo(
  c: CuadroCopa, mios: { rivalId: string; gf: number; gc: number }[], semilla: string,
): FilaGrupo[] {
  const g = grupoDeOlimpia(c);
  if (!g) return [];
  const equipos = g.equipos.map((x) => ({
    id: esPlaceholder(x) ? x.llave : x.id,
    nombre: nombreDe(x),
    fuerza: esPlaceholder(x) ? 62 : x.fuerza,
  }));
  const filas = new Map<string, FilaGrupo>(equipos.map((e) =>
    [e.id, { id: e.id, nombre: e.nombre, pj: 0, pts: 0, dg: 0, gf: 0 }]));

  const anotar = (id: string, favor: number, contra: number) => {
    const f = filas.get(id);
    if (!f) return;
    f.pj++; f.gf += favor; f.dg += favor - contra;
    if (favor > contra) f.pts += 3; else if (favor === contra) f.pts += 1;
  };

  for (const m of mios) {
    anotar("olimpia", m.gf, m.gc);
    anotar(m.rivalId, m.gc, m.gf);
  }

  /* Los partidos entre los otros tres, resueltos de una con la semilla. */
  const otros = equipos.filter((e) => e.id !== "olimpia");
  const rng = new Rng(`grupo-${semilla}-${g.letra}`);
  const jugados = mios.length;
  for (let a = 0; a < otros.length; a++) {
    for (let b = 0; b < otros.length; b++) {
      if (a === b) continue;
      /* Van al mismo ritmo que los de Olimpia: dos por fecha jugada. */
      const orden = a * otros.length + b;
      if (orden >= jugados * 2) continue;
      const dif = (otros[a].fuerza + 3) - otros[b].fuerza;
      const ga = rng.poisson(Math.max(0.15, 1.25 + dif * 0.06));
      const gb = rng.poisson(Math.max(0.15, 1.25 - dif * 0.06));
      anotar(otros[a].id, ga, gb);
      anotar(otros[b].id, gb, ga);
    }
  }

  return [...filas.values()].sort(
    (a, b) => b.pts - a.pts || b.dg - a.dg || b.gf - a.gf || a.nombre.localeCompare(b.nombre));
}

/** El rival de una fase final, sorteado entre los que quedan. */
export function rivalDeFaseFinal(
  c: CuadroCopa, etapa: EtapaCopa, semilla: string,
): Participante {
  const rng = new Rng(`final-${semilla}-${c.torneo}-${etapa}`);
  /*
   * Los que siguen en carrera son los de los grupos, sin Olimpia. Cuanto más
   * adentro, mejores: en octavos puede tocar cualquiera y en la final solo los
   * de arriba, que es lo que pasa cuando los malos ya se fueron.
   */
  const piso = { octavos: 0, cuartos: 62, semis: 65, final: 68 }[
    etapa as "octavos" | "cuartos" | "semis" | "final"] ?? 0;
  const vivos = c.grupos
    .flatMap((g) => g.equipos)
    .filter((x): x is Participante => !esPlaceholder(x) && x.id !== "olimpia" && x.fuerza >= piso);
  const pool = vivos.length ? vivos : c.grupos.flatMap((g) => g.equipos)
    .filter((x): x is Participante => !esPlaceholder(x) && x.id !== "olimpia");
  return pool[Math.floor(rng.next() * pool.length)];
}

/**
 * Las previas de los demás, jugadas de una.
 *
 * El cuadro se sortea en enero con carteles, y cuando arranca la fase de grupos
 * esos carteles ya tienen dueño porque las llaves se jugaron. Olimpia juega las
 * suyas partido a partido; las otras treinta se resuelven acá, con el nivel de
 * cada uno y la semilla de la partida.
 *
 * Sin esto el cuadro quedaba con carteles para siempre y pasaba lo peor: cuando
 * a Olimpia le tocaba jugar contra un cartel, el partido directamente no
 * existía y el grupo se quedaba a mitad de camino.
 */
export function simularPrevias(
  c: CuadroCopa, semilla: string,
  /** Solo esta fase, para poder resolverla el día que se juega. */
  soloFase?: string,
): CuadroCopa {
  const rng = new Rng(`previas-${semilla}-${c.torneo}-${soloFase ?? "todas"}`);
  let cuadro = c;

  /*
   * Se pasa varias veces porque las fases están encadenadas: hasta que no se
   * resuelve la fase 1 no se sabe quién juega la 2. Con tres fases alcanzan
   * cuatro vueltas de sobra.
   */
  for (let vuelta = 0; vuelta < 5; vuelta++) {
    let cambio = false;
    for (const l of cuadro.llaves) {
      if (soloFase && l.fase !== soloFase) continue;
      if (esPlaceholder(l.local) || esPlaceholder(l.visita)) continue;
      /* La de Olimpia la juega él, no se resuelve por decreto. */
      if (l.local.id === "olimpia" || l.visita.id === "olimpia") continue;
      /* Si ya se resolvió no queda ningún cartel apuntando a esta llave. */
      const pendiente = [...cuadro.grupos.flatMap((g) => g.equipos),
                         ...cuadro.llaves.flatMap((x) => [x.local, x.visita])]
        .some((x) => esPlaceholder(x) && x.llave === l.id);
      if (!pendiente) continue;

      /* El de casa en la vuelta arranca con ventaja, como en el fútbol. */
      const dif = (l.local.fuerza + 2) - l.visita.fuerza;
      const ganaLocal = rng.next() < 1 / (1 + Math.exp(-dif * 0.14));
      cuadro = resolverLlave(cuadro, l.id, ganaLocal ? l.local : l.visita);
      cambio = true;
    }
    if (!cambio) break;
  }
  return cuadro;
}

/**
 * Los cuatro que perdieron la fase 3 de la Libertadores bajan a la Sudamericana.
 *
 * Es el único lugar donde las dos copas se tocan, y sin esto los grupos de la
 * Sudamericana se quedan con cuatro carteles que no se resuelven nunca: no
 * dependen de una llave de la Sudamericana sino de una de la otra copa.
 */
export function bajarDeLaLibertadores(suda: CuadroCopa, lib: CuadroCopa): CuadroCopa {
  let cuadro = suda;
  for (const l of lib.llaves.filter((x) => x.fase === "F3")) {
    if (esPlaceholder(l.local) || esPlaceholder(l.visita)) continue;
    /* El que perdió es el que NO quedó puesto en el cuadro de la Libertadores. */
    const enGrupos = new Set(lib.grupos.flatMap((g) => g.equipos)
      .filter((x): x is Participante => !esPlaceholder(x)).map((x) => x.id));
    const perdedor = [l.local, l.visita]
      .find((x): x is Participante => !esPlaceholder(x) && !enGrupos.has(x.id));
    if (!perdedor) continue;
    cuadro = resolverLlave(cuadro, `perdedor-${l.id}`, perdedor);
  }
  return cuadro;
}

/**
 * Cómo quedó cada llave de una fase: quién ganó y quién se fue.
 *
 * Es lo que la animación necesita para poder mostrar el cuadro moviéndose y no
 * solo el casillero de Olimpia. Se saca comparando el cuadro antes y después:
 * el que ganó es el que quedó puesto donde estaba el cartel.
 */
export interface ResueltaLlave {
  id: string;
  local: string;
  visita: string;
  ganador: string;
  /** Si Olimpia jugó esta llave. */
  mia: boolean;
}

export function comoQuedoLaFase(
  antes: CuadroCopa, despues: CuadroCopa, fase: string,
): ResueltaLlave[] {
  /*
   * El ganador es el que ocupó el casillero que tenía el cartel de esta llave.
   *
   * La primera versión buscaba a los que aparecían en el cuadro resuelto, y
   * daba mal siempre: la llave jugada SIGUE en el cuadro con sus dos equipos,
   * así que los dos figuraban y ganaba el que estuviera primero. En la pantalla
   * se veía a Olimpia tachada en la llave que acababa de ganar.
   *
   * Mirar el casillero de destino no se puede equivocar: ahí entra uno solo.
   */
  const enElDestino = (llave: string): string | null => {
    for (let g = 0; g < antes.grupos.length; g++) {
      for (let i = 0; i < antes.grupos[g].equipos.length; i++) {
        const x = antes.grupos[g].equipos[i];
        if (esPlaceholder(x) && x.llave === llave) {
          return nombreDe(despues.grupos[g].equipos[i]);
        }
      }
    }
    for (let k = 0; k < antes.llaves.length; k++) {
      for (const lado of ["local", "visita"] as const) {
        const x = antes.llaves[k][lado];
        if (esPlaceholder(x) && x.llave === llave) {
          return nombreDe(despues.llaves[k][lado]);
        }
      }
    }
    return null;
  };

  return antes.llaves.filter((l) => l.fase === fase).map((l) => ({
    id: l.id,
    local: nombreDe(l.local),
    visita: nombreDe(l.visita),
    ganador: enElDestino(l.id) ?? "",
    mia: [l.local, l.visita].some((x) => !esPlaceholder(x) && x.id === "olimpia"),
  }));
}

/** Si al cuadro le quedan lugares sin dueño que no dependan de Olimpia. */
export function faltanPrevias(c: CuadroCopa): boolean {
  return c.grupos.some((g) => g.equipos.some(esPlaceholder));
}

/**
 * El camino entero de Olimpia por la copa, para poder mirarlo de una.
 *
 * Va desde la etapa por donde entró hasta la final: lo jugado con su rival, lo
 * que viene con el rival que ya se sabe, y lo que todavía no tiene nombre
 * porque depende de que pases. Es lo que el fixture necesita para mostrar la
 * copa igual que muestra el torneo local.
 */
export interface PartidoDeCopa {
  etapa: EtapaCopa;
  dia: string;
  /** Vacío cuando todavía no se sabe contra quién. */
  rivalId: string;
  rivalNombre: string;
  esLocal: boolean;
  rotulo: string;
}

/** Los nombres cortos, para donde no entra el largo. */
const CORTO: Partial<Record<EtapaCopa, string>> = {
  "fase 1": "F1", "fase 2": "F2", "fase 3": "F3",
  octavos: "8vos", cuartos: "4tos", semis: "Semi", final: "Final",
};

export function caminoDeCopa(
  c: CuadroCopa, desde: EtapaCopa, ano: number, semilla: string,
): PartidoDeCopa[] {
  const salida: PartidoDeCopa[] = [];
  const desdeI = ORDEN.indexOf(desde);
  if (desdeI < 0) return salida;

  for (const etapa of ORDEN.slice(desdeI)) {
    const dias = FECHAS[etapa] ?? [];
    /* El play-off nacional de la Sudamericana es a partido único. */
    const cuantos = etapa === "grupos" ? 6
      : etapa === "final" ? 1
      : etapa === "fase 1" && c.torneo === "sudamericana" ? 1
      : 2;
    for (let i = 0; i < cuantos; i++) {
      const dia = dias[i] ? `${ano}${dias[i]}` : "";
      if (!dia) continue;
      const cruce = etapa === "octavos" || etapa === "cuartos" ||
                    etapa === "semis" || etapa === "final"
        ? null
        : rivalDeLaEtapa(c, etapa, i);
      const r = cruce?.id ? rivalDeCopa(cruce.id) : null;
      salida.push({
        etapa, dia,
        rivalId: r?.id ?? "",
        rivalNombre: r?.nombre ?? "Por definir",
        esLocal: cruce?.esLocal ?? false,
        /* Corto: en el fixture esto entra en una columna angosta. */
        rotulo: etapa === "grupos"
          ? `${grupoDeOlimpia(c)?.letra ?? ""}-${i + 1}`
          : (CORTO[etapa] ?? NOMBRE_ETAPA[etapa]) +
            (cuantos === 2 ? (i === 0 ? " ida" : " vta") : ""),
      });
    }
  }
  return salida;
}

export { grupoQueEspera, resolverLlave };
