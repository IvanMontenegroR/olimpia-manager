import fixture2026 from "@/data/fixture_clausura2026_final.json";
import equiposJson from "@/data/equipos_2026.json";
import { Rng } from "@/engine/rng.ts";

/**
 * El calendario del año, que dejó de ser un archivo.
 *
 * El Clausura 2026 es data de verdad: 132 partidos con sus fechas, sus horarios
 * y sus estadios, sacados de Wikipedia. Mientras el juego duraba una sola
 * temporada eso alcanzaba, pero para dirigir varios años hace falta un
 * calendario para 2027, para 2028 y para el que venga, y no existe.
 *
 * Así que se genera: todos contra todos ida y vuelta, veintidós fechas por
 * torneo, con el orden saliendo de la semilla de la partida. Dos cosas de eso
 * importan. Una, que el año paraguayo son DOS torneos, Apertura de febrero a
 * junio y Clausura de julio a noviembre, y los cupos a las copas se reparten
 * por la suma de los dos. Y dos, que el orden cambia en cada partida: la
 * temporada tres no puede ser la temporada uno con otro número arriba.
 *
 * El Clausura 2026 sigue siendo el real. Es el único tramo del juego apoyado en
 * partidos que se jugaron de verdad y no hay razón para tirarlo.
 */

export interface PartidoLiga {
  torneo: "apertura" | "clausura";
  fechaNumero: number;
  /** El día, en YYYY-MM-DD. */
  dia: string;
  local: string;
  visitante: string;
  estadio: string;
  ciudad: string;
  /** Lo que viaja Olimpia para este partido; 0 si es local o si no juega. */
  viajeKm: number;
}

interface Equipo {
  id: string; nombre: string;
  estadio_2026: string; ciudad_2026: string; km_desde_asuncion: number;
}

const EQUIPOS = equiposJson as Equipo[];
export const FECHAS_POR_TORNEO = 22;

/** Cuándo arranca cada torneo y cada cuántos días se juega una fecha. */
const ARRANQUE = { apertura: "-02-06", clausura: "-07-23" };
/*
 * Seis y no siete. Veintidós fechas de domingo a domingo se irían hasta
 * mediados de diciembre, y el Clausura de verdad termina a fin de noviembre
 * porque mete fechas entre semana. Seis días de promedio es esa compresión, y
 * de paso hace que las fechas caigan en días distintos, como pasa.
 */
const DIAS_ENTRE_FECHAS = 6;

const sumar = (dia: string, dias: number) =>
  new Date(Date.parse(dia) + dias * 86400000).toISOString().slice(0, 10);

/**
 * El fixture de un torneo, con el método del círculo.
 *
 * Con doce equipos son once fechas de ida y once de vuelta. Uno se queda quieto
 * y los otros once rotan: así cada uno juega contra todos exactamente una vez
 * por rueda, que es lo que un round robin tiene que garantizar y lo que a mano
 * sale mal.
 */
function rondas(ids: string[], rng: Rng): [string, string][][] {
  /* Se mezcla primero: si no, el orden del JSON sería el orden de todos los años. */
  const mezcla = [...ids];
  for (let i = mezcla.length - 1; i > 0; i--) {
    const k = Math.floor(rng.next() * (i + 1));
    [mezcla[i], mezcla[k]] = [mezcla[k], mezcla[i]];
  }

  const fijo = mezcla[0];
  let giran = mezcla.slice(1);
  const fechas: [string, string][][] = [];

  for (let f = 0; f < ids.length - 1; f++) {
    const partidos: [string, string][] = [];
    /* El fijo alterna localía fecha a fecha para que no juegue siempre en casa. */
    partidos.push(f % 2 === 0 ? [fijo, giran[0]] : [giran[0], fijo]);
    for (let i = 1; i < giran.length / 2 + 0.5; i++) {
      const a = giran[i], b = giran[giran.length - i];
      if (!a || !b) continue;
      partidos.push(f % 2 === 0 ? [a, b] : [b, a]);
    }
    fechas.push(partidos);
    giran = [giran[giran.length - 1], ...giran.slice(0, -1)];
  }
  return fechas;
}

/** Los 132 partidos de un torneo, con día, estadio y kilómetros. */
function generarTorneo(
  ano: number, torneo: "apertura" | "clausura", semilla: string,
): PartidoLiga[] {
  const rng = new Rng(`fixture-${semilla}-${ano}-${torneo}`);
  const ida = rondas(EQUIPOS.map((e) => e.id), rng);
  const arranque = `${ano}${ARRANQUE[torneo]}`;
  const porId = new Map(EQUIPOS.map((e) => [e.id, e]));

  const partidos: PartidoLiga[] = [];
  /* Segunda rueda: los mismos cruces con la localía dada vuelta. */
  const todas = [...ida, ...ida.map((f) => f.map(([l, v]) => [v, l] as [string, string]))];

  todas.forEach((fecha, i) => {
    const dia = sumar(arranque, i * DIAS_ENTRE_FECHAS);
    for (const [local, visitante] of fecha) {
      const casa = porId.get(local)!;
      partidos.push({
        torneo, fechaNumero: i + 1, dia,
        local, visitante,
        estadio: casa.estadio_2026, ciudad: casa.ciudad_2026,
        viajeKm: visitante === "olimpia" ? casa.km_desde_asuncion : 0,
      });
    }
  });
  return partidos;
}

/** El Clausura 2026 tal como se jugó, traducido a la forma de acá. */
function clausura2026(): PartidoLiga[] {
  return (fixture2026 as {
    fecha_numero: number; fecha: string; local: string; visitante: string;
    estadio: string; ciudad: string; viaje_km_olimpia: number | null;
  }[]).map((p) => ({
    torneo: "clausura" as const,
    fechaNumero: p.fecha_numero,
    dia: p.fecha,
    local: p.local, visitante: p.visitante,
    estadio: p.estadio, ciudad: p.ciudad,
    viajeKm: p.viaje_km_olimpia ?? 0,
  }));
}

/*
 * Generar un año entero cuesta un rato y se pide muchas veces por render, así
 * que se guarda. La clave lleva la semilla adentro: dos partidas distintas
 * tienen calendarios distintos y no se pueden pisar.
 */
const CACHE = new Map<string, PartidoLiga[]>();

/** Los 264 partidos del año: Apertura y Clausura. */
export function calendarioDelAno(ano: number, semilla: string): PartidoLiga[] {
  const clave = `${ano}-${semilla}`;
  const guardado = CACHE.get(clave);
  if (guardado) return guardado;

  const partidos = ano === 2026
    ? [...generarTorneo(2026, "apertura", semilla), ...clausura2026()]
    : [...generarTorneo(ano, "apertura", semilla),
       ...generarTorneo(ano, "clausura", semilla)];
  CACHE.set(clave, partidos);
  return partidos;
}

/** Los de un torneo solo, que es como se mira una tabla. */
export function partidosDelTorneo(
  ano: number, torneo: "apertura" | "clausura", semilla: string,
): PartidoLiga[] {
  return calendarioDelAno(ano, semilla).filter((p) => p.torneo === torneo);
}
