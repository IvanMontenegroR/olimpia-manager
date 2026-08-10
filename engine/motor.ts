import { Rng } from "./rng.ts";
import type {
  Actitud, Alineacion, ContextoPartido, Forma, Jugador, Posicion, ResultadoPartido,
} from "./tipos.ts";

/** Todos los números que hay que balancear viven acá y en ningún otro lado. */
export const P = {
  // --- condición física ---
  // Curva con piso: un jugador fundido no rinde la mitad, rinde ~20% menos.
  // El costo real de la fatiga se cobra en el riesgo de lesión, no en el rendimiento.
  condPiso: 0.65,
  condRango: 0.35,
  condExp: 0.6,

  desgaste90: 36,       // puntos de condición que cuesta un partido completo
  desgasteViajeKm: 3.0, // extra cada 1000 km
  desgastePresionAlta: 5,
  desgasteVeterano: 4,  // 33 años o más
  recuperacionPorDia: 4.5,
  recuperacionVeterano: 3.5,

  // --- lesiones ---
  lesionBase: 0.012,    // por partido completo, con condición plena
  lesionCond60: 2.5,    // multiplicador si baja de 60
  lesionCond45: 4.0,
  lesionFragil: 1.8,
  lesionVeterano: 1.4,

  // --- posición ---
  posNatural: 1.0,
  posAdaptado: 0.9,
  posFueraDePuesto: 0.75,
  posArqueroDeCampo: 0.35,

  // --- forma ---
  formaRacha: 1.08,
  formaNeutral: 1.0,
  formaBaja: 0.92,

  // --- contexto ---
  localiaLiga: 3.0,
  localiaCopa: 13.0,     // Olimpia de local en copa: eliminó de local a Flamengo, Fluminense y Atlético Nacional
  localiaCopaRival: 6.0, // el rival de local en copa: pesa, pero no como el Defensores     // el Defensores de noche en Conmebol no es el Defensores de un domingo
  alturaUmbralM: 1500,
  alturaPor1000m: 0.06,
  hostilMax: 0.10,      // pibe sin partidos internacionales
  hostilMin: 0.03,      // veterano curtido
  clasicoRuido: 0.05,

  // --- motor de gol ---
  xgBase: 1.30,
  xgK: 0.055,
  // Meterse atrás tiene que servir de verdad: aguantar en Río y definirla en
  // Asunción es una estrategia legítima, no un suicidio.
  actitudAtaque: { defensivo: -6, equilibrado: 0, ofensivo: 4 } as Record<Actitud, number>,
  actitudDefensa: { defensivo: 7, equilibrado: 0, ofensivo: -4 } as Record<Actitud, number>,
  presionAtaque: 2.5,
  presionDefensa: -1.5,

  // --- rasgos ---
  rasgoDesequilibranteXg: 0.12,   // +12% de situaciones generadas
  rasgoIrregularDesvio: 0.45,     // ruido multiplicativo, misma media
  rasgoDefinidorXg: 0.06,
};

export const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

export function factorCondicion(condicion: number): number {
  return P.condPiso + P.condRango * Math.pow(clamp(condicion, 0, 100) / 100, P.condExp);
}

export function factorForma(f: Forma): number {
  return f === "en_racha" ? P.formaRacha : f === "en_baja" ? P.formaBaja : P.formaNeutral;
}

export function factorPosicion(j: Jugador, puesto: Posicion): number {
  if (j.posicion === puesto) return P.posNatural;
  if (j.posiciones_secundarias.includes(puesto)) return P.posAdaptado;
  if (j.posicion === "ARQ" || puesto === "ARQ") return P.posArqueroDeCampo;
  return P.posFueraDePuesto;
}

/** Vulnerabilidad al ambiente hostil derivada de edad y partidos internacionales.
 *  Sin stats nuevas: es exactamente la regla de la sección 9 del documento. */
export function factorAmbienteHostil(j: Jugador, ctx: ContextoPartido): number {
  if (ctx.esLocal || ctx.competencia !== "sudamericana") return 1;
  const experiencia = clamp(j.partidos_internacionales / 60, 0, 1);
  const madurez = clamp((j.edad - 19) / 15, 0, 1);
  const curtido = 0.65 * experiencia + 0.35 * madurez;
  const pen = P.hostilMax - (P.hostilMax - P.hostilMin) * curtido;
  return 1 - (j.rasgos.includes("veterano_de_copas") ? pen * 0.5 : pen);
}

export function factorAltura(ctx: ContextoPartido): number {
  if (ctx.esLocal || ctx.alturaM <= P.alturaUmbralM) return 1;
  const exceso = (ctx.alturaM - P.alturaUmbralM) / 1000;
  return 1 - exceso * P.alturaPor1000m;
}

export function nivelEfectivo(j: Jugador, puesto: Posicion, ctx: ContextoPartido): number {
  return (
    j.nivel *
    factorCondicion(j.condicion) *
    factorPosicion(j, puesto) *
    factorForma(j.forma) *
    factorAmbienteHostil(j, ctx) *
    factorAltura(ctx)
  );
}

const PESO_ATAQUE: Record<Posicion, number> = { ARQ: 0.0, DEF: 0.5, MED: 2.0, DEL: 3.0 };
const PESO_DEFENSA: Record<Posicion, number> = { ARQ: 2.0, DEF: 3.0, MED: 1.5, DEL: 0.2 };

function media(once: Jugador[], puestos: Map<string, Posicion>, ctx: ContextoPartido,
               pesos: Record<Posicion, number>): number {
  let num = 0, den = 0;
  for (const j of once) {
    const puesto = puestos.get(j.id) ?? j.posicion;
    const w = pesos[puesto];
    num += nivelEfectivo(j, puesto, ctx) * w;
    den += w;
  }
  return den ? num / den : 0;
}

export function fuerzas(a: Alineacion, ctx: ContextoPartido) {
  let ataque = media(a.once, a.puestos, ctx, PESO_ATAQUE);
  let defensa = media(a.once, a.puestos, ctx, PESO_DEFENSA);

  ataque += P.actitudAtaque[a.actitud];
  defensa += P.actitudDefensa[a.actitud];
  if (a.presionAlta) {
    ataque += P.presionAtaque;
    defensa += P.presionDefensa;
  }
  if (ctx.esLocal && !ctx.neutral) {
    const bono = ctx.competencia === "sudamericana" ? P.localiaCopa : P.localiaLiga;
    ataque += bono;
    defensa += bono;
  }
  return { ataque, defensa };
}

function bonoRasgos(once: Jugador[], rng: Rng): number {
  let mult = 1;
  for (const j of once) {
    if (j.rasgos.includes("desequilibrante")) mult += P.rasgoDesequilibranteXg / 3;
    if (j.rasgos.includes("definidor")) mult += P.rasgoDefinidorXg / 3;
    if (j.rasgos.includes("definicion_irregular")) {
      // misma media, mucha más dispersión: hace dos un jueves y erra cuatro el domingo
      mult *= Math.exp(rng.normal(-(P.rasgoIrregularDesvio ** 2) / 2, P.rasgoIrregularDesvio) / 3);
    }
  }
  return mult;
}

export function simularPartido(
  a: Alineacion, ctx: ContextoPartido, rng: Rng,
): ResultadoPartido {
  const f = fuerzas(a, ctx);
  const localiaRival = ctx.competencia === "sudamericana" ? P.localiaCopaRival : P.localiaLiga;
  const rival = ctx.rivalFuerza + (ctx.esLocal || ctx.neutral ? 0 : localiaRival);

  let xgOlimpia = P.xgBase * Math.exp(P.xgK * (f.ataque - rival));
  let xgRival = P.xgBase * Math.exp(P.xgK * (rival - f.defensa));
  xgOlimpia *= bonoRasgos(a.once, rng);

  if (ctx.esClasico) {
    xgOlimpia *= 1 + rng.normal(0, P.clasicoRuido);
    xgRival *= 1 + rng.normal(0, P.clasicoRuido);
  }

  const golesOlimpia = rng.poisson(clamp(xgOlimpia, 0.05, 6));
  const golesRival = rng.poisson(clamp(xgRival, 0.05, 6));

  // minutos: los 11 juegan 90 salvo los tres cambios, que el DT automático
  // resuelve en `temporada.ts`. Acá se registran los 90 y se ajusta afuera.
  const minutos = new Map<string, number>();
  for (const j of a.once) minutos.set(j.id, 90);

  const lesionados: { id: string; dias: number }[] = [];
  const amarillas: string[] = [];
  const rojas: string[] = [];

  for (const j of a.once) {
    let p = P.lesionBase;
    if (j.condicion < 45) p *= P.lesionCond45;
    else if (j.condicion < 60) p *= P.lesionCond60;
    if (j.rasgos.includes("fragil")) p *= P.lesionFragil;
    if (j.edad >= 33) p *= P.lesionVeterano;
    if (a.presionAlta) p *= 1.15;
    if (rng.chance(p)) lesionados.push({ id: j.id, dias: rng.entero(7, 45) });

    const pAmarilla = (j.posicion === "DEF" ? 0.16 : j.posicion === "MED" ? 0.14 : 0.08)
      * (ctx.esClasico ? 1.5 : 1) * (a.presionAlta ? 1.25 : 1);
    if (rng.chance(pAmarilla)) amarillas.push(j.id);
    if (rng.chance(0.006)) rojas.push(j.id);
  }

  return { golesOlimpia, golesRival, minutos, lesionados, amarillas, rojas };
}

// ---------------------------------------------------------------- fatiga

export function desgastePorPartido(j: Jugador, minutos: number, ctx: ContextoPartido,
                                   presionAlta: boolean): number {
  let d = P.desgaste90 * (minutos / 90);
  d += (ctx.viajeKm / 1000) * P.desgasteViajeKm;
  if (presionAlta) d += P.desgastePresionAlta * (minutos / 90);
  if (j.edad >= 33) d += P.desgasteVeterano * (minutos / 90);
  return d;
}

export function recuperar(j: Jugador, dias: number): void {
  const tasa = j.edad >= 33 ? P.recuperacionVeterano : P.recuperacionPorDia;
  j.condicion = clamp(j.condicion + tasa * dias, 0, 100);
}
