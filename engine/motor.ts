import { Rng } from "./rng.ts";
import {
  COORD, LINEA_DE,
  aprieta,
  type Actitud, type Alineacion, type ContextoPartido, type Jugador,
  type Linea, type Posicion, type ResultadoPartido,
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
  /**
   * Lo que le cuesta a un arquero, comparado con uno de campo. Un arquero
   * corre en un partido una fracción de lo que corre un volante: por eso los
   * arqueros juegan todos los partidos del año y los de campo no.
   */
  desgasteArquero: 0.35,
  desgasteViajeKm: 3.0, // extra cada 1000 km
  desgasteVeterano: 4,  // 33 años o más
  /**
   * Lo que cuesta cada actitud, en condición. Meterse atrás cansa menos que
   * salir a presionar, y eso es lo que le da sentido a aguantar incluso
   * cuando sos el mejor: guardás piernas para el partido que importa.
   */
  desgasteActitud: { defensivo: -5, equilibrado: 0, ofensivo: 6 } as Record<Actitud, number>,

  /**
   * La recuperación va hacia 100 con rendimientos decrecientes, como en la
   * vida real: los primeros días se recupera casi todo y después se estanca.
   *
   * Antes era lineal a 4.5 por día, y como un partido cuesta 36, con siete
   * días entre fechas se perdían 4.5 por semana sin parar: un titular llegaba
   * a la fecha 12 con 15% de condición y había que inventar equipos con gente
   * fuera de puesto. Con esta curva, una semana completa te deja entero y lo
   * que cansa de verdad es jugar dos veces en la misma semana, que es
   * exactamente cuando cansa en el fútbol.
   */
  recuperacionTau: 1.9,
  recuperacionTauVeterano: 2.6,
  /**
   * El día siguiente a un partido no se recupera nada: es el día de descanso.
   * Sin esto, jugar jueves y domingo casi no se notaba, que es justo lo único
   * que tiene que cansar.
   */
  recuperacionDiaPerdido: 0,
  /**
   * Por encima de esto se completa a 100.
   *
   * La fatiga dejó de ser algo que se administra semana a semana: con una
   * semana entre partidos el plantel vuelve entero y no hay nada que mirar. Lo
   * único que queda es el resto de jugar dos veces en cuatro días, que es
   * cuando de verdad se siente.
   */
  recuperacionCompleta: 96,

  // --- lesiones ---
  lesionBase: 0.012,    // por partido completo, con condición plena
  lesionCond60: 2.5,    // multiplicador si baja de 60
  lesionCond45: 4.0,
  lesionFragil: 1.8,
  lesionVeterano: 1.4,
  /**
   * Cuánto multiplica el riesgo la carga acumulada. Este es el precio real de
   * no rotar: no que el titular llegue arrastrándose (eso no pasa en el fútbol
   * con una semana entre partidos), sino que jugando todo termina rompiéndose.
   */
  // Jugar todas las fechas ya son 270 minutos en tres semanas: ese es el ritmo
  // normal y no tiene que castigar nada. Lo que rompe es lo que viene por
  // encima, o sea las semanas con partido entre semana.
  lesionCargaDesde: 300,
  lesionCargaPorTanda: 120,
  lesionPorCarga: 1.6,

  // --- posición ---
  // La pérdida ya no es un escalón sino una función de cuán lejos queda el
  // jugador de su puesto natural en la cancha.
  posPiso: 0.62,           // lo peor que puede rendir un jugador de campo
  posCaidaPorDistancia: 0.62,
  posBonoSecundaria: 0.07, // lo que recupera si es un puesto que sabe jugar
  posArqueroDeCampo: 0.3,

  // --- ánimo ---
  // Reemplaza a los dos factores que había antes, forma y moral, que medían lo
  // mismo y se multiplicaban entre sí. Se centra en 70, que es donde arranca
  // todo el mundo y donde el factor vale exactamente 1: así el ánimo no regala
  // ni descuenta rendimiento por existir, solo por moverse.
  /** Cuánto del golpe al vestuario se siente enseguida en el plantel. */
  ambienteEnAnimo: 0.5,
  animoNeutro: 70,
  animoPorPunto: 0.003, // 100 de ánimo rinde +9%, 40 rinde -9%
  animoMinimo: 0.88,

  // --- la gente ---
  // Cuánto del bonus de local se cobra según cómo esté el estadio. Con la
  // cancha vacía y la hinchada enojada, jugar de local casi no sirve.
  alientoMin: 0.55,
  alientoMax: 1.35,
  /**
   * Cuántos puntos de nivel vale el aliento, de punta a punta. Es el mismo
   * número en la liga y en la copa: llenar el Defensores vale lo que vale, y
   * lo que hace especial la noche de Conmebol es el ambiente de base.
   */
  alientoPeso: 5.0,

  // --- contexto ---
  /**
   * Cuánta ventaja se le da al rival, en puntos de fuerza. Existe para calibrar
   * la dificultad sin tocar los datos de cada club. Pasó a negativo cuando se
   * topeó la ventaja máxima para sacar las goleadas: con el tope, la
   * superioridad de Olimpia sobre los equipos flojos dejó de convertirse en
   * goles y el torneo se volvió mucho más difícil de lo que era.
   *
   * Subió medio punto cuando los niveles del plantel se corrigieron con el
   * rendimiento real de la temporada: el equipo quedó medio punto mejor, así
   * que se le devolvió ese medio punto al resto del torneo. Sin eso el título
   * local saltaba de 21% a 24% por un cambio que era de datos y no de
   * dificultad.
   */
  ajusteRival: -1.5,

  localiaLiga: 3.0,
  // El Defensores de noche en Conmebol pesa el triple que un domingo. Subió un
  // punto cuando la visita se puso más dura de verdad: la copa se juega
  // aguantando afuera y definiendo en casa, y si afuera cuesta más, casa tiene
  // que valer más. Sin eso el título internacional caía a 7.8%.
  localiaCopa: 10.0,
  localiaCopaRival: 4.0, // el rival de local en copa: pesa, pero no como el Defensores     // el Defensores de noche en Conmebol no es el Defensores de un domingo
  alturaUmbralM: 1500,
  // La altura es EL problema del fútbol sudamericano. Ir a La Paz o a Cusco
  // sin preparar el viaje tiene que doler.
  alturaPor1000m: 0.085,
  /** Cuánto del castigo de altura se puede recortar llegando con días. */
  alturaAclimataMax: 0.6,
  /** Y cuánto del desgaste del viaje se ahorra por lo mismo. */
  viajeAclimataMax: 0.5,
  /** Cuánto del ambiente hostil recorta llegar con tiempo. */
  aclimatacionHostil: 0.5,
  hostilMax: 0.10,      // pibe sin partidos internacionales
  hostilMin: 0.03,      // veterano curtido
  clasicoRuido: 0.05,

  // --- motor de gol ---
  xgBase: 1.22,
  xgK: 0.055,
  /**
   * Dónde deja de contar entera la diferencia de nivel. Sin esto, contra los
   * equipos más flojos la diferencia de veinte puntos se convertía en cuatro
   * goles esperados y salían goleadas de 5-0 todo el tiempo: había 13% de
   * partidos con cuatro o más de diferencia cuando en el fútbol real son 3%.
   *
   * Hasta acá no se toca nada, así que todo el Clausura, donde las diferencias
   * son chicas, se juega con la diferencia real.
   */
  ventajaMaxima: 9,
  /**
   * Qué pasa más allá del codo. Antes se cortaba en seco y toda diferencia
   * mayor valía lo mismo; ahora sigue creciendo, pero aplastada.
   *
   * Los dos lados no se aplastan igual, y es a propósito. Cuando la ventaja es
   * de Olimpia se aplana del todo, que es lo que el tope vino a resolver.
   * Cuando es del rival se deja respirar: con el corte en seco, de visitante
   * un 74 y un 82 eran el mismo partido (ganabas 10% contra los dos), y peor
   * todavía, contra el 82 aguantar y viajar aclimatado no cambiaba nada porque
   * estabas cortado de los dos lados. O sea que el juego no te pagaba por
   * hacer las cosas bien justo contra el rival donde más importaba.
   */
  aplastaAFavor: 0,
  aplastaEnContra: 0.22,
  /**
   * Corrección de Dixon-Coles para los marcadores bajos. Dos Poisson
   * independientes dan pocos empates (salían 19% cuando en el fútbol real son
   * 26%), porque en un partido real los equipos se condicionan: si está 0-0 a
   * los ochenta, los dos se cuidan. Con rho negativo suben el 0-0 y el 1-1.
   */
  rhoEmpates: -0.28,
  // Meterse atrás tiene que servir de verdad: aguantar en Río y definirla en
  // Asunción es una estrategia legítima, no un suicidio.
  actitudAtaque: { defensivo: -7, equilibrado: 0, ofensivo: 5 } as Record<Actitud, number>,
  actitudDefensa: { defensivo: 9, equilibrado: 0, ofensivo: -6 } as Record<Actitud, number>,
  presionAtaque: 2.5,
  presionDefensa: -1.5,
  /**
   * Lo que suma apretar arriba a un rival que llega gastado. Es lo que hace
   * que enterarse de cómo llega el rival sirva para algo: si viene de jugar
   * el jueves conviene ahogarlo, y si llega entero la presión te desgasta a
   * vos sin ganancia.
   */
  presionContraCansado: 4.5,

  // --- rasgos ---
  rasgoDesequilibranteXg: 0.12,   // +12% de situaciones generadas
  rasgoIrregularDesvio: 0.45,     // ruido multiplicativo, misma media
  rasgoDefinidorXg: 0.06,
};

export const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

export function factorCondicion(condicion: number): number {
  return P.condPiso + P.condRango * Math.pow(clamp(condicion, 0, 100) / 100, P.condExp);
}

/**
 * Ánimo 0..100 a multiplicador. Reemplaza a los dos factores que había antes,
 * moral y forma, que se multiplicaban entre sí: el rango de este es el
 * producto de aquellos, así que el juego rinde igual con un concepto menos.
 */
export function factorAnimo(animo: number): number {
  const f = 1 + (clamp(animo, 0, 100) - P.animoNeutro) * P.animoPorPunto;
  return Math.max(P.animoMinimo, f);
}

/**
 * Cuánto pesa el aliento. Sale del humor de la hinchada y de cuán llena esté
 * la cancha: una popular a precio accesible con la gente contenta multiplica
 * el bonus de local; un estadio a medio llenar y silbando lo achica.
 */
export function factorAliento(hinchada: number, ocupacion: number): number {
  const base = 0.45 * (clamp(hinchada, 0, 100) / 100) + 0.55 * clamp(ocupacion, 0, 1);
  return P.alientoMin + base * (P.alientoMax - P.alientoMin);
}

/** Distancia entre dos puestos, normalizada a 0..1. */
export function distanciaPuestos(a: Posicion, b: Posicion): number {
  const p = COORD[a], q = COORD[b];
  // la lateralidad pesa un poco menos que la profundidad: un lateral derecho
  // se arregla mejor de lateral izquierdo que de delantero
  const dx = (p.x - q.x) / 100;
  const dy = ((p.y - q.y) / 100) * 0.75;
  return Math.min(1, Math.hypot(dx, dy));
}

export function factorPosicion(j: Jugador, puesto: Posicion): number {
  if (j.posicion === puesto) return 1;
  // el arco es otro deporte
  if (j.posicion === "ARQ" || puesto === "ARQ") return P.posArqueroDeCampo;

  /*
   * Un mediocampista es un mediocampista. Adelantar a un cinco o atrasar a un
   * enganche unos metros es cosa de todos los partidos y no lo convierte en
   * otro jugador; la distancia en la cancha castigaba eso como si lo fuera.
   */
  if (LINEA_DE[j.posicion] === "MED" && LINEA_DE[puesto] === "MED") return 1;

  const d = distanciaPuestos(j.posicion, puesto);
  let f = 1 - d * P.posCaidaPorDistancia;
  if (j.posiciones_secundarias.includes(puesto)) f += P.posBonoSecundaria;
  return clamp(f, P.posPiso, 1);
}

/** Vulnerabilidad al ambiente hostil derivada de edad y partidos internacionales.
 *  Sin stats nuevas: es exactamente la regla de la sección 9 del documento. */
export function factorAmbienteHostil(j: Jugador, ctx: ContextoPartido): number {
  if (ctx.esLocal || ctx.competencia !== "sudamericana") return 1;
  const experiencia = clamp(j.partidos_internacionales / 60, 0, 1);
  const madurez = clamp((j.edad - 19) / 15, 0, 1);
  const curtido = 0.65 * experiencia + 0.35 * madurez;
  let pen = P.hostilMax - (P.hostilMax - P.hostilMin) * curtido;
  /*
   * Llegar antes también sirve donde no hay altura: el plantel se acostumbra
   * al calor, a la comida y al quilombo de afuera. Antes la aclimatación solo
   * entraba en el factor de altura, así que pagar la concentración para ir a
   * Brasil no hacía absolutamente nada.
   */
  pen *= 1 - P.aclimatacionHostil * clamp(ctx.aclimatacion ?? 0, 0, 1);
  return 1 - (j.rasgos.includes("veterano_de_copas") ? pen * 0.5 : pen);
}

/**
 * El castigo por jugar en altura, que se puede recortar llegando antes. Un
 * plantel que viajó cinco días antes a La Paz no es el mismo que bajó del
 * avión la noche anterior.
 */
export function factorAltura(ctx: ContextoPartido): number {
  if (ctx.esLocal || ctx.alturaM <= P.alturaUmbralM) return 1;
  const exceso = (ctx.alturaM - P.alturaUmbralM) / 1000;
  const aclimatado = clamp(ctx.aclimatacion ?? 0, 0, 1);
  return 1 - exceso * P.alturaPor1000m * (1 - P.alturaAclimataMax * aclimatado);
}

export function nivelEfectivo(j: Jugador, puesto: Posicion, ctx: ContextoPartido): number {
  return (
    j.nivel *
    factorCondicion(j.condicion) *
    factorPosicion(j, puesto) *
    factorAnimo(j.animo) *
    factorAmbienteHostil(j, ctx) *
    factorAltura(ctx)
  );
}

const PESO_ATAQUE: Record<Linea, number> = { ARQ: 0.0, DEF: 0.5, MED: 2.0, DEL: 3.0 };
const PESO_DEFENSA: Record<Linea, number> = { ARQ: 2.0, DEF: 3.0, MED: 1.5, DEL: 0.2 };

function media(once: Jugador[], puestos: Map<string, Posicion>, ctx: ContextoPartido,
               pesos: Record<Linea, number>): number {
  let num = 0, den = 0;
  for (const j of once) {
    const puesto = puestos.get(j.id) ?? j.posicion;
    const w = pesos[LINEA_DE[puesto]];
    num += nivelEfectivo(j, puesto, ctx) * w;
    den += w;
  }
  return den ? num / den : 0;
}

/**
 * El OVR del once: lo que rinde tu equipo tal como llega hoy.
 *
 * Es el promedio del nivel efectivo, o sea el mismo número que ya decide los
 * partidos ahí abajo, solo que puesto en pantalla. Por eso se mueve con todo:
 * el nivel de los jugadores, cómo están de ánimo, cómo llegan de piernas, si
 * juegan fuera de puesto y adónde se viaja.
 *
 * Promediar el nivel de ficha en cambio da un número casi quieto: se movía
 * dos puntos en una temporada entera, contra los once que se mueve este.
 */
export function ovrDelOnce(a: Alineacion, ctx: ContextoPartido): number {
  if (!a.once.length) return 0;
  const suma = a.once.reduce(
    (n, j) => n + nivelEfectivo(j, a.puestos.get(j.id) ?? j.posicion, ctx), 0);
  // el empujón de jugar en casa es el factor más grande del juego: sin esto el
  // número marcaba lo mismo en el Defensores que en Brasil
  return suma / a.once.length + bonoLocalia(ctx);
}

/**
 * De dónde sale el OVR, parte por parte.
 *
 * El número solo no alcanza: si dice 70 y tu plantel vale 68, hace falta saber
 * qué son esos dos puntos. Acá se separa lo que ponen los jugadores de lo que
 * pone el momento, y así el ánimo del plantel deja de ser un dato invisible.
 */
export interface DesgloseOvr {
  /** Lo que valen en ficha los once que van a jugar. */
  base: number;
  /** Cuánto suma o resta cómo está el plantel de cabeza. */
  animo: number;
  /** Las piernas. */
  piernas: number;
  /** Jugar a alguien fuera de su puesto. */
  puestos: number;
  /** El Defensores, con la gente que haya. */
  cancha: number;
  /** El viaje: la altura y jugar afuera. */
  viaje: number;
  total: number;
  /*
   * Los valores crudos de cada cosa, que son los que el DT puede subir. El
   * aporte al OVR dice cuánto rinde; esto dice de cuánto viene y cuánto le
   * falta, que es lo que hace que uno quiera moverlo.
   */
  animoMedio: number;
  condicionMedia: number;
  fueraDePuesto: number;
}

export function desgloseOvr(a: Alineacion, ctx: ContextoPartido): DesgloseOvr {
  const n = Math.max(1, a.once.length);
  const media = (f: (j: Jugador, puesto: Posicion) => number) =>
    a.once.reduce((s, j) => s + f(j, a.puestos.get(j.id) ?? j.posicion), 0) / n;

  const base = media((j) => j.nivel);
  // cada factor se mide solo, sobre la base, para que las partes sumen el todo
  const conAnimo = media((j) => j.nivel * factorAnimo(j.animo));
  const conPiernas = media((j) => j.nivel * factorCondicion(j.condicion));
  const conPuestos = media((j, p) => j.nivel * factorPosicion(j, p));
  const conViaje = media((j) => j.nivel * factorAmbienteHostil(j, ctx) * factorAltura(ctx));
  // jugar en casa con tu gente es una sola cosa: la cancha sin aliento no es
  // el Defensores, y el aliento sin cancha no existe
  const cancha = bonoLocalia(ctx);
  const total = ovrDelOnce(a, ctx);

  const animo = conAnimo - base;
  const piernas = conPiernas - base;
  const puestos = conPuestos - base;
  const viaje = conViaje - base;
  return {
    base, animo, piernas, puestos, cancha, viaje, total,
    animoMedio: media((j) => j.animo),
    condicionMedia: media((j) => j.condicion),
    fueraDePuesto: a.once.filter((j) => (a.puestos.get(j.id) ?? j.posicion) !== j.posicion).length,
  };
}

/**
 * Lo que suma jugar en tu cancha, con la gente que tengas y como esté.
 *
 * El aliento SUMA, no multiplica. Multiplicando, la misma hinchada pesaba tres
 * veces más en la copa que en la liga solo porque la base es más grande: de
 * local en Sudamericana, ir de la peor hinchada a la mejor valía casi seis
 * puntos de nivel y veintiún puntos de probabilidad de ganar, más que
 * cualquier otra palanca del juego. Un estadio lleno vale más o menos lo mismo
 * un jueves de Conmebol que un domingo; lo que cambia entre las dos es el
 * ambiente de base, y eso ya está en localiaCopa.
 */
export function bonoLocalia(ctx: ContextoPartido): number {
  if (!ctx.esLocal || ctx.neutral) return 0;
  const base = ctx.competencia === "sudamericana" ? P.localiaCopa : P.localiaLiga;
  const aliento = factorAliento(ctx.hinchada ?? 70, ctx.ocupacion ?? 0.7);
  return Math.max(0, base + (aliento - 1) * P.alientoPeso);
}

export function fuerzas(a: Alineacion, ctx: ContextoPartido) {
  let ataque = media(a.once, a.puestos, ctx, PESO_ATAQUE);
  let defensa = media(a.once, a.puestos, ctx, PESO_DEFENSA);

  ataque += P.actitudAtaque[a.actitud];
  defensa += P.actitudDefensa[a.actitud];
  if (aprieta(a.actitud)) {
    // apretar arriba rinde de verdad contra piernas cansadas
    const gastado = clamp((92 - (ctx.rivalCondicion ?? 100)) / 25, 0, 1);
    ataque += P.presionAtaque + P.presionContraCansado * gastado;
    defensa += P.presionDefensa;
  }
  const bono = bonoLocalia(ctx);
  ataque += bono;
  defensa += bono;
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

/**
 * Saca el marcador de la distribución conjunta, no de dos Poisson sueltas.
 *
 * El ajuste de Dixon-Coles sube la probabilidad de los resultados bajos y
 * parejos, que es lo que pasa en el fútbol: los equipos se miran, y un 0-0 o
 * un 1-1 son mucho más comunes de lo que predice el azar puro.
 */
function marcador(lambda: number, mu: number, rng: Rng): [number, number] {
  const MAX = 8;
  const pois = (l: number, k: number) => {
    let p = Math.exp(-l);
    for (let i = 1; i <= k; i++) p = (p * l) / i;
    return p;
  };
  const tau = (x: number, y: number) => {
    if (x === 0 && y === 0) return 1 - lambda * mu * P.rhoEmpates;
    if (x === 0 && y === 1) return 1 + lambda * P.rhoEmpates;
    if (x === 1 && y === 0) return 1 + mu * P.rhoEmpates;
    if (x === 1 && y === 1) return 1 - P.rhoEmpates;
    return 1;
  };

  const celdas: { x: number; y: number; p: number }[] = [];
  let total = 0;
  for (let x = 0; x <= MAX; x++) {
    for (let y = 0; y <= MAX; y++) {
      const p = Math.max(0, pois(lambda, x) * pois(mu, y) * tau(x, y));
      celdas.push({ x, y, p });
      total += p;
    }
  }

  let r = rng.next() * total;
  for (const c of celdas) { r -= c.p; if (r <= 0) return [c.x, c.y]; }
  return [0, 0];
}

export function simularPartido(
  a: Alineacion, ctx: ContextoPartido, rng: Rng,
): ResultadoPartido {
  const f = fuerzas(a, ctx);
  const localiaRival = ctx.competencia === "sudamericana" ? P.localiaCopaRival : P.localiaLiga;
  // El rival también viene de jugar: si tuvo copa entre semana o encadenó
  // partidos, llega gastado igual que vos. Su fuerza ya está en la escala de
  // nivel efectivo, así que se le aplica la misma curva de condición.
  /*
   * El ajuste calibra la escala del torneo local, donde las fuerzas del JSON
   * no están en la misma vara que el plantel de Olimpia. Los rivales de copa
   * traen su nivel real, así que ahí no se toca: si se les aplicara, subir el
   * tope de ventaja para que el rival importe hundía la copa al 3%.
   */
  const rival =
    ctx.rivalFuerza * factorCondicion(ctx.rivalCondicion ?? 100) +
    (ctx.esLocal || ctx.neutral ? 0 : localiaRival) +
    (ctx.competencia === "sudamericana" ? 0 : P.ajusteRival);

  /*
   * La diferencia no se corta: se dobla.
   *
   * Antes cualquier ventaja de más de nueve puntos valía nueve, y como de
   * visitante Olimpia arranca muy por debajo, un rival de 74 y uno de 82
   * quedaban los dos del otro lado del corte: ganabas 10% contra los dos y el
   * rival dejaba de importar. Ahora hasta el codo no cambia nada (o sea, todo
   * el Clausura queda igual) y más allá la diferencia sigue creciendo, pero
   * aplastada.
   *
   * Los dos lados no se aplastan igual, y es a propósito. Cuando la ventaja es
   * de Olimpia se aplana del todo, que es lo que evita las goleadas de
   * escándalo. Cuando es del rival se deja respirar, para que se note la
   * diferencia entre pasar por Santa Fe y pasar por el Mineiro.
   */
  const doblar = (d: number, pendiente: number) => {
    const k = P.ventajaMaxima;
    if (Math.abs(d) <= k) return d;
    return Math.sign(d) * (k + (Math.abs(d) - k) * pendiente);
  };
  const dOlimpia = f.ataque - rival;
  const dRival = rival - f.defensa;
  let xgOlimpia = P.xgBase * Math.exp(P.xgK *
    doblar(dOlimpia, dOlimpia > 0 ? P.aplastaAFavor : P.aplastaEnContra));
  let xgRival = P.xgBase * Math.exp(P.xgK *
    doblar(dRival, dRival > 0 ? P.aplastaEnContra : P.aplastaAFavor));
  xgOlimpia *= bonoRasgos(a.once, rng);

  if (ctx.esClasico) {
    xgOlimpia *= 1 + rng.normal(0, P.clasicoRuido);
    xgRival *= 1 + rng.normal(0, P.clasicoRuido);
  }

  const [golesOlimpia, golesRival] = marcador(
    clamp(xgOlimpia, 0.05, 6), clamp(xgRival, 0.05, 6), rng);

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
    // lo que viene arrastrando de las últimas tres semanas
    const exceso = Math.max(0, (j.minutosRecientes ?? 0) - P.lesionCargaDesde);
    p *= 1 + (exceso / P.lesionCargaPorTanda) * P.lesionPorCarga;
    if (j.rasgos.includes("fragil")) p *= P.lesionFragil;
    if (j.edad >= 33) p *= P.lesionVeterano;
    if (aprieta(a.actitud)) p *= 1.15;
    if (rng.chance(p)) lesionados.push({ id: j.id, dias: rng.entero(7, 45) });

    const linea = LINEA_DE[j.posicion];
    const pAmarilla = (linea === "DEF" ? 0.16 : linea === "MED" ? 0.14 : 0.08)
      * (ctx.esClasico ? 1.5 : 1) * (aprieta(a.actitud) ? 1.25 : 1);
    if (rng.chance(pAmarilla)) amarillas.push(j.id);
    if (rng.chance(0.006)) rojas.push(j.id);
  }

  return { golesOlimpia, golesRival, minutos, lesionados, amarillas, rojas };
}

// ---------------------------------------------------------------- fatiga

export function desgastePorPartido(j: Jugador, minutos: number, ctx: ContextoPartido,
                                   actitud: Actitud): number {
  let d = P.desgaste90 * (minutos / 90);
  // el arquero no corre lo que corre un volante, y por eso juega todo el año
  if (j.posicion === "ARQ") d *= P.desgasteArquero;
  // viajar con tiempo también ahorra piernas, no solo pulmón
  const aclimatado = clamp(ctx.aclimatacion ?? 0, 0, 1);
  d += (ctx.viajeKm / 1000) * P.desgasteViajeKm * (1 - P.viajeAclimataMax * aclimatado);
  d += P.desgasteActitud[actitud] * (minutos / 90);
  if (j.edad >= 33) d += P.desgasteVeterano * (minutos / 90);
  return d;
}

export function recuperar(j: Jugador, dias: number): void {
  const utiles = dias - P.recuperacionDiaPerdido;
  if (utiles <= 0) return;
  const tau = j.edad >= 33 ? P.recuperacionTauVeterano : P.recuperacionTau;
  const falta = 100 - j.condicion;
  const nueva = 100 - falta * Math.exp(-utiles / tau);
  j.condicion = clamp(nueva >= P.recuperacionCompleta ? 100 : nueva, 0, 100);
}
