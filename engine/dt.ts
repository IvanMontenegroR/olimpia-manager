import { nivelEfectivo } from "./motor.ts";
import type { Alineacion, ContextoPartido, Jugador, Posicion } from "./tipos.ts";

export const MOLDE: Record<Posicion, number> = { ARQ: 1, DEF: 4, MED: 3, DEL: 3 };
export const CUPO_EXTRANJEROS = 4;
export const SUB18_DESDE = "2007-01-01";
export const SUB18_META_MINUTOS = 900;

/**
 * `once_fijo`   el DT ingenuo: ordena por Nivel nominal y pone siempre a los
 *               mismos, mire como mire la condición. Solo cambia por lesión o
 *               suspensión. Es la estrategia contra la que hay que ganar.
 * `rotacion`    mira el Nivel efectivo y además cuida al que llega fundido.
 */
export type Estrategia = "once_fijo" | "rotacion";

export interface EstadoDT {
  minutosSub18: number;
  partidosRestantes: number;
}

export const esSub18 = (j: Jugador) => j.fecha_nacimiento >= SUB18_DESDE;

export function disponible(j: Jugador, fecha: string): boolean {
  if (j.suspendido) return false;
  if (j.lesionado_hasta && j.lesionado_hasta > fecha) return false;
  return true;
}

/**
 * Arma el once. Respeta el molde 1-4-3-3, el cupo de 4 extranjeros en cancha y,
 * si hace falta, mete un Sub-18 para no quedarse corto con los 900 minutos.
 *
 * `rotacion` descansa a los que llegan fundidos cuando el partido lo permite:
 * rival flojo, o un compromiso más importante cerca.
 */
export function armarOnce(
  plantel: Jugador[], ctx: ContextoPartido, estrategia: Estrategia, estado: EstadoDT,
): Alineacion {
  const aptos = plantel.filter((j) => disponible(j, ctx.fecha));
  const puestos = new Map<string, Posicion>();

  const valor = (j: Jugador, puesto: Posicion) => {
    // El DT ingenuo ni mira la condición: para él el jugador es su Nivel.
    if (estrategia === "once_fijo") {
      return j.nivel * (j.posicion === puesto ? 1 : j.posiciones_secundarias.includes(puesto) ? 0.9 : 0.75);
    }
    let v = nivelEfectivo(j, puesto, ctx);
    // Cuánto pesa este partido. Contra Rubio Ñu conviene guardar gente; en la
    // copa se juega con lo mejor que haya aunque llegue tocado.
    const peso = ctx.competencia === "sudamericana" ? 1
      : ctx.esClasico ? 0.8
      : ctx.rivalFuerza >= 60 ? 0.55
      : 0.3;
    // penalizar al fundido, pero solo en la medida en que el partido lo permita
    if (j.condicion < 55) v -= 14 * (1 - peso);
    else if (j.condicion < 70) v -= 6 * (1 - peso);
    // en copa se prioriza al que aguanta el ambiente
    if (ctx.competencia === "sudamericana" && !ctx.esLocal &&
        j.rasgos.includes("veterano_de_copas")) v += 3;
    return v;
  };

  const once: Jugador[] = [];
  let extranjeros = 0;
  const usado = new Set<string>();

  // Urgencia Sub-18: hay que juntar 900 minutos en la temporada y solo cuentan
  // los partidos donde el pibe juega 90 efectivos. Si el ritmo necesario supera
  // los 30 minutos por partido restante, ya conviene meterlo de titular.
  const minutosFaltantes = SUB18_META_MINUTOS - estado.minutosSub18;
  const urgenciaSub18 = minutosFaltantes > estado.partidosRestantes * 30;

  const meter = (j: Jugador, puesto: Posicion) => {
    once.push(j);
    usado.add(j.id);
    puestos.set(j.id, puesto);
    if (j.extranjero) extranjeros++;
  };

  if (urgenciaSub18) {
    const sub = aptos.filter(esSub18)
      .sort((a, b) => valor(b, b.posicion) - valor(a, a.posicion))[0];
    if (sub) meter(sub, sub.posicion);
  }

  for (const puesto of ["ARQ", "DEF", "MED", "DEL"] as Posicion[]) {
    const yaEnPuesto = once.filter((j) => puestos.get(j.id) === puesto).length;
    const faltan = MOLDE[puesto] - yaEnPuesto;
    if (faltan <= 0) continue;
    const candidatos = aptos
      .filter((j) => !usado.has(j.id))
      .sort((a, b) => valor(b, puesto) - valor(a, puesto));
    let puestos_ = 0;
    for (const j of candidatos) {
      if (puestos_ >= faltan) break;
      if (j.extranjero && extranjeros >= CUPO_EXTRANJEROS) continue;
      meter(j, puesto);
      puestos_++;
    }
  }

  // por si el molde no se llenó (plantel diezmado), completar con lo que haya
  for (const j of aptos) {
    if (once.length >= 11) break;
    if (usado.has(j.id)) continue;
    if (j.extranjero && extranjeros >= CUPO_EXTRANJEROS) continue;
    meter(j, j.posicion);
  }

  // los tres cambios: los mejores que quedaron afuera, respetando el cupo
  const suplentes: Jugador[] = [];
  const restantes = aptos
    .filter((j) => !usado.has(j.id) && j.posicion !== "ARQ")
    .sort((a, b) => valor(b, b.posicion) - valor(a, a.posicion));
  for (const j of restantes) {
    if (suplentes.length >= 3) break;
    if (j.extranjero && extranjeros >= CUPO_EXTRANJEROS) continue;
    suplentes.push(j);
    puestos.set(j.id, j.posicion);
    if (j.extranjero) extranjeros++;
  }

  // De visitante en copa se aguanta y se define en casa. De local en copa se sale
  // a buscarlo, que es donde el Defensores pesa.
  const actitud = ctx.competencia === "sudamericana"
    ? (ctx.esLocal ? "ofensivo" : "defensivo")
    : (ctx.esLocal ? "ofensivo" : "equilibrado");

  return {
    once,
    suplentes,
    actitud,
    presionAlta: ctx.esLocal && ctx.rivalFuerza < 66,
    puestos,
  };
}
