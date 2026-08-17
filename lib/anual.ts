import EQUIPOS from "@/data/equipos_2026.json";
import { Rng } from "@/engine/rng.ts";
import { factorCondicion, P } from "@/engine/motor.ts";
import { fuerzaBaseAjustada, usarCalendario } from "./rivales.ts";

/**
 * El año entero, que en Paraguay son dos torneos y no uno.
 *
 * El juego arranca en el Clausura, así que el Apertura ya pasó: es el semestre
 * del técnico anterior, y Olimpia llega con los puntos que sacó ahí. Eso no es
 * decorado, porque los cupos a las copas se reparten por la tabla ACUMULATIVA
 * (Apertura + Clausura): podés salir cuarto en el Clausura y entrar igual a la
 * Libertadores si venías bien del primer semestre, o salir tercero y quedarte
 * afuera si el Apertura fue un desastre.
 *
 * Se simula con el mismo modelo que usa la tabla del Clausura para los partidos
 * entre rivales, y sale de la semilla de la partida: cada partida arranca con
 * un primer semestre distinto, y el mismo save siempre devuelve el mismo.
 *
 * Medido, el Apertura da unos cuatro puntos de más que el Clausura (campeón
 * 52.9 contra 49.4, Olimpia 47.6 contra 43.2). La razón es que en el Clausura
 * los partidos de Olimpia pasan por el motor de verdad, con lesionados,
 * suspendidos y rotación por la copa, y acá todos juegan con su fuerza de
 * ficha. No se corrige porque el desvío es parejo para los doce y lo que
 * reparte los cupos es el ORDEN, no cuántos puntos sacó cada uno.
 */

export interface FilaAnual {
  id: string;
  nombre: string;
  pts: number;
  dg: number;
  gf: number;
}

/** Lo que quedó del primer semestre, y se guarda con la partida. */
export interface PrimerSemestre {
  /** La tabla final del Apertura, ordenada. */
  apertura: FilaAnual[];
  /** Quién lo ganó: se lleva un lugar directo en la fase de grupos. */
  campeonApertura: string;
  /**
   * Quién ganó la Copa Paraguay, que da la fase 1 de la Libertadores.
   *
   * Sale de entre los rivales y nunca es Olimpia. La Copa Paraguay no se juega
   * en este juego, así que hacerte campeón de algo que no jugaste sería
   * regalarte un cupo; que la gane otro es la lectura honesta, y encima es la
   * que más se parece a la realidad, donde ese cupo casi siempre se lo lleva un
   * equipo que no está peleando el torneo.
   */
  campeonCopaParaguay: string;
}

const NOMBRE: Record<string, string> =
  Object.fromEntries((EQUIPOS as { id: string; nombre: string }[]).map((e) => [e.id, e.nombre]));

/** Todos contra todos, ida y vuelta: las mismas 22 fechas que el Clausura. */
export function simularApertura(semilla: string): PrimerSemestre {
  const equipos = (EQUIPOS as { id: string; fuerza: number }[]);
  const rng = new Rng(`apertura-${semilla}`);
  /* La fuerza de cada club se normaliza sobre SU Apertura, no sobre el año. */
  usarCalendario(2026, semilla, "apertura");
  const filas: Record<string, FilaAnual> = Object.fromEntries(
    equipos.map((e) => [e.id, { id: e.id, nombre: NOMBRE[e.id], pts: 0, dg: 0, gf: 0 }]));

  const anotar = (id: string, favor: number, contra: number) => {
    const f = filas[id];
    f.gf += favor; f.dg += favor - contra;
    if (favor > contra) f.pts += 3;
    else if (favor === contra) f.pts += 1;
  };

  for (const local of equipos) {
    for (const visita of equipos) {
      if (local.id === visita.id) continue;
      /*
       * Cada uno llega como llega. Cambia poco, y vale la pena dejar anotado
       * por qué: como el modelo mira la DIFERENCIA de fuerzas, cansar a los dos
       * casi se cancela. Probé sacarlo y da lo mismo; queda porque un torneo
       * donde nadie se cansa nunca no es un torneo.
       */
      const fl = fuerzaBaseAjustada(local.id, local.fuerza)
        * factorCondicion(rng.entre(78, 100));
      const fv = fuerzaBaseAjustada(visita.id, visita.fuerza)
        * factorCondicion(rng.entre(78, 100));
      const xl = P.xgBase * Math.exp(P.xgK * (fl + P.localiaLiga - fv));
      const xv = P.xgBase * Math.exp(P.xgK * (fv - fl - P.localiaLiga));
      const gl = rng.poisson(Math.min(6, Math.max(0.05, xl)));
      const gv = rng.poisson(Math.min(6, Math.max(0.05, xv)));
      anotar(local.id, gl, gv);
      anotar(visita.id, gv, gl);
    }
  }

  const apertura = Object.values(filas).sort(ordenar);

  /*
   * La Copa Paraguay se sortea entre los rivales, con más chance para los
   * mejores pero sin que sea una cuenta cerrada: la gracia del torneo es que a
   * veces la gana el que nadie esperaba.
   */
  const rivales = apertura.filter((f) => f.id !== "olimpia");
  const rngCopa = new Rng(`copa-paraguay-${semilla}`);
  const peso = (f: FilaAnual) => Math.pow(1.6, f.pts / 8);
  const total = rivales.reduce((s, f) => s + peso(f), 0);
  let r = rngCopa.next() * total;
  let campeonCopaParaguay = rivales[rivales.length - 1].id;
  for (const f of rivales) { r -= peso(f); if (r <= 0) { campeonCopaParaguay = f.id; break; } }

  return { apertura, campeonApertura: apertura[0].id, campeonCopaParaguay };
}

/** El mismo desempate que la tabla del Clausura, para que no haya dos criterios. */
function ordenar(a: FilaAnual, b: FilaAnual) {
  return b.pts - a.pts || b.dg - a.dg || b.gf - a.gf || a.nombre.localeCompare(b.nombre);
}

/**
 * La tabla acumulativa: los puntos del Apertura más los del Clausura.
 *
 * Es la que reparte casi todos los cupos, así que es el número que de verdad
 * importa a fin de año.
 */
export function tablaAcumulativa(
  apertura: FilaAnual[], clausura: { id: string; pts: number; dg: number; gf: number }[],
): FilaAnual[] {
  const porId = new Map(apertura.map((f) => [f.id, f]));
  return clausura
    .map((c) => {
      const a = porId.get(c.id);
      return {
        id: c.id, nombre: NOMBRE[c.id] ?? c.id,
        pts: (a?.pts ?? 0) + c.pts,
        dg: (a?.dg ?? 0) + c.dg,
        gf: (a?.gf ?? 0) + c.gf,
      };
    })
    .sort(ordenar);
}

/** A qué torneo va cada uno y por dónde entra. */
export interface Cupo {
  id: string;
  nombre: string;
  torneo: "libertadores" | "sudamericana";
  /** Dónde arranca: fase de grupos, o cuántas llaves tiene que pasar antes. */
  fase: "grupos" | "fase 2" | "fase 1" | "fase previa";
  /** Por qué le tocó. */
  por: string;
}

/**
 * El reparto de cupos de la APF.
 *
 * Libertadores, cuatro lugares: los campeones del Apertura y del Clausura van
 * derecho a la fase de grupos, el mejor del acumulativo que no sea campeón
 * arranca en la fase 2 (una llave antes de los grupos) y el campeón de la Copa
 * Paraguay en la fase 1 (dos llaves).
 *
 * Sudamericana, cuatro lugares: los cuatro que siguen en el acumulativo entre
 * los que no entraron a la Libertadores.
 *
 * Los empalmes están resueltos como los resuelve la APF, corriendo la lista
 * hacia abajo: si el mismo equipo gana los dos torneos sobra un lugar de
 * grupos y lo toma el mejor del acumulativo; si el campeón de la Copa Paraguay
 * ya entró por otro lado, su cupo de fase 1 también corre.
 */
export function repartirCupos(
  acumulada: FilaAnual[], campeonApertura: string, campeonClausura: string,
  campeonCopaParaguay: string, campeonSudamericana?: string,
): Cupo[] {
  const puestos = new Map(acumulada.map((f, i) => [f.id, i + 1]));
  const dados = new Set<string>();
  const cupos: Cupo[] = [];

  const dar = (id: string, torneo: Cupo["torneo"], fase: Cupo["fase"], por: string) => {
    if (!id || dados.has(id)) return false;
    dados.add(id);
    cupos.push({ id, nombre: NOMBRE[id] ?? id, torneo, fase, por });
    return true;
  };
  /** El mejor del acumulativo que todavía no tiene copa. */
  const siguiente = () => acumulada.find((f) => !dados.has(f.id))?.id ?? "";

  /*
   * El campeón de la Sudamericana entra a la Libertadores por la puerta de la
   * Conmebol, no por la de Paraguay: su lugar es EXTRA y no le saca el cupo a
   * nadie. Va primero porque, si además es campeón acá, su cupo paraguayo
   * queda libre y baja por el acumulativo. Sin esto la pantalla te decía que
   * el campeón de América tenía que jugar la fase previa de la Sudamericana.
   */
  if (campeonSudamericana) {
    dar(campeonSudamericana, "libertadores", "grupos", "Campeón de la Copa Sudamericana");
  }

  // los dos campeones del torneo local, derecho a los grupos
  dar(campeonApertura, "libertadores", "grupos", "Campeón del Apertura");
  dar(campeonClausura, "libertadores", "grupos", "Campeón del Clausura");
  /* Si el mismo ganó los dos, el lugar que sobra baja por el acumulativo. */
  const gruposDeParaguay = campeonSudamericana ? 3 : 2;
  while (cupos.filter((c) => c.fase === "grupos").length < gruposDeParaguay) {
    const id = siguiente();
    if (!dar(id, "libertadores", "grupos", `${puestos.get(id)}° del acumulativo`)) break;
  }

  /*
   * La fase 2 va antes que la fase 1 a propósito: si el campeón de la Copa
   * Paraguay es además el mejor del acumulativo, se queda con el camino más
   * corto y el otro cupo corre. Al revés lo estarías perjudicando por ganar.
   */
  const segundo = siguiente();
  dar(segundo, "libertadores", "fase 2", `${puestos.get(segundo)}° del acumulativo`);

  if (!dar(campeonCopaParaguay, "libertadores", "fase 1", "Campeón de la Copa Paraguay")) {
    const id = siguiente();
    dar(id, "libertadores", "fase 1", `${puestos.get(id)}° del acumulativo`);
  }

  // y los cuatro que siguen, a la Sudamericana
  for (let i = 0; i < 4; i++) {
    const id = siguiente();
    if (!dar(id, "sudamericana", "fase previa", `${puestos.get(id)}° del acumulativo`)) break;
  }

  return cupos;
}

/**
 * El cruce de la fase previa de la Sudamericana.
 *
 * Los cuatro paraguayos se sortean entre ellos y juegan un partido único: los
 * dos que ganan entran a la fase de grupos y los otros dos se quedan sin nada.
 * Es lo que hace que entrar cuarto en el acumulativo no sea todavía estar
 * adentro.
 */
export function sorteoSudamericana(cupos: Cupo[], semilla: string) {
  const cuatro = cupos.filter((c) => c.torneo === "sudamericana").map((c) => c.id);
  const rng = new Rng(`sorteo-suda-${semilla}`);
  /* Fisher-Yates con el rng de siempre: el sorteo también tiene que ser tuyo. */
  const bolillero = [...cuatro];
  for (let i = bolillero.length - 1; i > 0; i--) {
    const k = Math.floor(rng.next() * (i + 1));
    [bolillero[i], bolillero[k]] = [bolillero[k], bolillero[i]];
  }
  const llaves: { local: string; visita: string }[] = [];
  for (let i = 0; i + 1 < bolillero.length; i += 2) {
    llaves.push({ local: bolillero[i], visita: bolillero[i + 1] });
  }
  return llaves.map((l) => ({
    local: l.local, visita: l.visita,
    nombreLocal: NOMBRE[l.local] ?? l.local, nombreVisita: NOMBRE[l.visita] ?? l.visita,
  }));
}
