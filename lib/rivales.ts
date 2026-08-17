import equiposJson from "@/data/equipos_2026.json";
import { factorCondicion, P } from "@/engine/motor.ts";
import { calendarioDelAno } from "./calendario.ts";

/**
 * Los rivales también se cansan.
 *
 * Antes cada club era un número fijo de fuerza y llegaba siempre igual, así
 * que daba lo mismo cuándo lo agarrabas. Acá su condición sale de su propio
 * calendario: los partidos que viene de jugar, los días de descanso entre
 * medio y, para los cuatro que juegan copa, los viajes de mitad de semana.
 *
 * Es determinista y se calcula sobre el fixture real, no es un número al azar.
 */

const EQUIPOS = equiposJson as any[];

/**
 * El calendario contra el que se mide el cansancio.
 *
 * Antes era el archivo del Clausura 2026 y punto. Ahora el juego dura varios
 * años, así que hay que decirle cuál: se fija con `usarCalendario` cuando
 * arranca la temporada y todo lo de acá cuelga de eso.
 *
 * Es estado de módulo, que no es lindo, pero la alternativa era pasarle el año
 * y la semilla a `fuerzaBaseAjustada` y a todos sus llamadores, que son el
 * motor de la tabla y el simulador de balance.
 */
let ANO = 2026;
let SEMILLA = "";
let TORNEO: "apertura" | "clausura" = "clausura";
/** Todo el año: es contra esto que se mide cuánto descansó cada uno. */
let FIXTURE = calendarioDelAno(ANO, SEMILLA);
/**
 * Y solo el torneo que se está jugando, que es otra cosa.
 *
 * `factorMedio` normaliza la fuerza de cada club sobre SUS partidos, y tiene
 * que ser sobre los del torneo que se está simulando. Cuando lo hice sobre el
 * año entero el Clausura se movió dos puntos para arriba de los dos lados
 * (campeón de 49.4 a 51.7, Olimpia de 43.2 a 45.1): la normalización quedaba
 * calculada sobre cuarenta y cuatro fechas y aplicada sobre veintidós.
 */
let FIXTURE_TORNEO = FIXTURE.filter((x) => x.torneo === TORNEO);

export function usarCalendario(
  ano: number, semilla: string, torneo: "apertura" | "clausura" = "clausura",
): void {
  if (ano === ANO && semilla === SEMILLA && torneo === TORNEO) return;
  ANO = ano; SEMILLA = semilla; TORNEO = torneo;
  FIXTURE = calendarioDelAno(ano, semilla);
  FIXTURE_TORNEO = FIXTURE.filter((x) => x.torneo === torneo);
  MEDIA_FACTOR.clear();
}

/** Ventanas Conmebol: los que juegan copa tienen partido esas semanas. */
const FECHAS_COPA_2026 = [
  "-08-13", "-08-20", "-09-17", "-09-24", "-10-22", "-10-29", "-11-21",
];

const diasEntre = (a: string, b: string) =>
  Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

/** Partidos de un club antes de una fecha, ordenados. */
function partidosPrevios(clubId: string, hasta: string): { dia: string; km: number }[] {
  const equipo = EQUIPOS.find((e) => e.id === clubId);
  const liga = FIXTURE
    .filter((p) => (p.local === clubId || p.visitante === clubId) && p.dia < hasta)
    .map((p) => ({
      dia: p.dia,
      /*
       * Los partidos de liga no suman viaje, y eso es a propósito.
       *
       * El código viejo leía `km_desde_asuncion` de la FILA del fixture, que no
       * tiene ese campo: daba undefined y quedaba en cero siempre. O sea que la
       * calibración del torneo (campeón 49.4 puntos, Olimpia 43.2) está hecha
       * sobre un desgaste que solo cuenta los viajes de copa. Al pasar el
       * calendario a generarse lo "arreglé" tomando el km del club, y el torneo
       * se movió dos puntos para arriba de los dos lados.
       *
       * Se queda en cero. Paraguay entra en trescientos kilómetros: el viaje
       * más largo de la liga es Pedro Juan Caballero y no se parece a cruzar a
       * Brasil un jueves, que es lo que el modelo quiere castigar.
       */
      km: 0,
    }));

  // los que juegan copa suman partido entre semana, con viaje al exterior
  const copa = equipo?.copa_internacional
    ? FECHAS_COPA_2026.map((d) => `${ANO}${d}`).filter((d) => d < hasta).map((dia, i) => ({
        dia,
        km: i % 2 === 0 ? 1800 : 0, // de visitante la ida, de local la vuelta
      }))
    : [];

  return [...liga, ...copa].sort((a, b) => a.dia.localeCompare(b.dia));
}

/**
 * Con cuánta condición llega un club a un día.
 *
 * Cuenta desde el último partido y no acumula: un plantel que descansó una
 * semana llega entero por más que venga de encadenar, porque rota y se
 * recupera. Lo que sí pesa es el jueves de copa antes del domingo.
 *
 * Acumular era tentador pero rompía el torneo: los cuatro clubes que juegan
 * copa son justo los más fuertes, así que castigarlos partido a partido les
 * hundía el promedio y le despejaba el campeonato a Olimpia. Con desgaste
 * acumulado el título rotando saltaba del 25% al 65%.
 */
// Calibrado con el simulador: más que esto y el desgaste de los rivales le
// terminaba regalando el campeonato a Olimpia, porque los cuatro clubes que
// juegan copa son justamente los que le pelean el torneo.
const DESCANSO_PLENO = 6;
const POR_DIA_FALTANTE = 3.0;

export function condicionRival(clubId: string, dia: string): number {
  const previos = partidosPrevios(clubId, dia);
  const ultimo = previos[previos.length - 1];
  if (!ultimo) return 100;

  const descanso = diasEntre(ultimo.dia, dia);
  const faltante = Math.max(0, DESCANSO_PLENO - descanso);
  const porViaje = descanso <= 4 ? (ultimo.km / 1000) * P.desgasteViajeKm : 0;
  return Math.round(Math.max(45, 100 - faltante * POR_DIA_FALTANTE - porViaje));
}

/**
 * La fuerza base de un club, corregida para que el desgaste no le cambie el
 * promedio de la temporada.
 *
 * Sin esta corrección la mecánica desbalanceaba el torneo: los cuatro que
 * juegan copa son justo los más fuertes, así que restarles fuerza en varias
 * fechas les bajaba el promedio y le regalaba el campeonato a Olimpia, que
 * pasaba del 23% al 36% de títulos. Se divide por el factor medio de sus
 * partidos, de modo que el club vale lo mismo a lo largo del torneo pero
 * llega entero cuando descansó y cargado cuando vino de jugar el jueves.
 *
 * Tiene sentido futbolístico: un club que juega Libertadores tiene plantel
 * más profundo del que dice su número, y por eso aguanta el calendario.
 */
const MEDIA_FACTOR = new Map<string, number>();

function factorMedio(clubId: string): number {
  const guardado = MEDIA_FACTOR.get(clubId);
  if (guardado !== undefined) return guardado;

  const suyos = FIXTURE_TORNEO.filter((p) => p.local === clubId || p.visitante === clubId);
  const media = suyos.length
    ? suyos.reduce((acc, p) => acc + factorCondicion(condicionRival(clubId, p.dia)), 0) / suyos.length
    : 1;
  MEDIA_FACTOR.set(clubId, media);
  return media;
}

export function fuerzaBaseAjustada(clubId: string, fuerza: number): number {
  return fuerza / factorMedio(clubId);
}

export interface EstadoRival {
  condicion: number;
  diasDescanso: number | null;
  /** Jugó por la copa en la semana previa. */
  vieneDeCopa: boolean;
}

export function estadoRival(clubId: string, dia: string): EstadoRival {
  const previos = partidosPrevios(clubId, dia);
  const ultimo = previos[previos.length - 1] ?? null;
  const equipo = EQUIPOS.find((e) => e.id === clubId);
  return {
    condicion: condicionRival(clubId, dia),
    diasDescanso: ultimo ? diasEntre(ultimo.dia, dia) : null,
    vieneDeCopa: !!equipo?.copa_internacional && !!ultimo &&
      FECHAS_COPA_2026.some((d) => ultimo.dia.endsWith(d)) &&
      diasEntre(ultimo.dia, dia) <= 5,
  };
}

/** Cómo se lee el estado del rival en pantalla. */
export function comoLlega(e: EstadoRival): { texto: string; bueno: boolean } {
  if (e.condicion >= 95) return { texto: "Llega entero", bueno: false };
  if (e.condicion >= 88) return { texto: "Llega bien", bueno: false };
  if (e.condicion >= 78) return { texto: "Viene cargado", bueno: true };
  return { texto: "Llega fundido", bueno: true };
}
