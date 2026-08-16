import { Rng } from "./rng.ts";
import { P, clamp, desgasteEnCancha, fuerzas, nivelEfectivo } from "./motor.ts";
import { generarMomento, type Momento } from "./momentos.ts";
import type { JugadorRival } from "./rival.ts";
import { LINEA_DE, type Alineacion, type ContextoPartido, type Jugador, type Posicion , aprieta } from "./tipos.ts";

export type TipoEvento =
  | "inicio" | "gol" | "gol_rival" | "ocasion" | "ocasion_rival"
  | "amarilla" | "roja" | "lesion" | "aviso_condicion"
  | "entretiempo" | "cambio" | "final" | "momento"
  | "amarilla_rival" | "roja_rival" | "tribuna";

export interface EventoRelato {
  minuto: number;
  tipo: TipoEvento;
  texto: string;
  jugadorId?: string;
  golesOlimpia: number;
  golesRival: number;
  /** Corta la reproducción y le pide una decisión al DT. */
  pausa?: boolean;
  /** Decisión con reloj: frena el partido hasta que el DT elige. */
  momento?: Momento;
  /** Para eventos del rival: a qué jugador suyo le pasó. */
  rivalJugadorId?: string;
  /**
   * Cuántos días se pierde el lesionado. Se decide acá, con la semilla del
   * partido, para que el relato pueda contar una molestia como molestia y una
   * rotura como rotura, y para que sea el mismo número que después se guarda.
   */
  diasFuera?: number;
}

// ---------------------------------------------------------------- plantillas
// Texto estático escrito a mano. Nada de generación en runtime.

const GOL_DEL = [
  "{j} la empuja en el área chica. No perdona.",
  "Quedó mano a mano {j} y la picó por encima del arquero.",
  "{j} la paró en el área, se acomodó y la cruzó al segundo palo.",
  "Se la dejaron servida a {j} y la reventó contra la red.",
  "Contra letal y {j} define cruzado. Golazo.",
  "Le queda el rebote a {j} y la manda a guardar.",
  "{j} se la baja al pecho, gira y la clava.",
  "Aparece {j} en el segundo palo. Solo tuvo que empujarla.",
  "{j} le pega de primera desde la puerta del área. Imparable.",
];
const GOL_AEREO = [
  "Centro al área y {j} se eleva por encima de todos. De cabeza, adentro.",
  "Córner, sube {j} y le gana en el salto. Gol de cabeza.",
  "Le colgaron el centro a {j} y la bajó de cabeza contra el palo.",
  "Tiro libre al área, {j} ganó en las alturas y la puso abajo.",
];
const GOL_MED = [
  "{j} llega de atrás y saca el zurdazo. Se metió pegada al palo.",
  "Habilitación para {j}, que entró como un puñal. La define de primera.",
  "Tiro libre de {j}. Se le metió por el ángulo.",
  "{j} la agarró de afuera y la clavó donde no llega nadie.",
  "Le quedó el rebote a {j} en la puerta del área y no lo pensó.",
  "Pared entre líneas y {j} apareció solo por el medio. Gol.",
];
const GOL_DEF = [
  "Pelota parada y aparece {j} entre todos. Cabezazo y adentro.",
  "{j} sube por sorpresa y la manda a guardar. Nadie lo marcó.",
  "Córner, peinada al segundo palo y {j} la empuja.",
  "{j} se metió al área como si fuera delantero y la clavó.",
];
const OCASION = [
  "{j} quedó de frente y le pegó desviado. Se agarra la cabeza.",
  "Gambetea {j}, se saca a dos de encima y la tira afuera.",
  "Tremenda atajada del arquero al remate de {j}.",
  "{j} la tuvo en el área chica y la mandó al córner.",
  "Se la pierde {j} solo frente al arco. No lo puede creer nadie.",
  "Cabezazo de {j} que pega en el travesaño. Estuvo adentro.",
  "{j} le pegó de afuera y se fue lamiendo el palo.",
  "Le quedó a {j} en la puerta del área y le salió mordida.",
  "{j} encaró, tiró el centro atrás y no había nadie. Se pierde una clara.",
  "Contra rápida y {j} definió al cuerpo del arquero.",
  "{j} reclamó penal después de que lo tocaran. El árbitro no cobró nada.",
];
const OCASION_IRREGULAR = [
  "{j} desborda, se saca a dos y define pésimo. Es lo que tiene.",
  "Otra vez {j} generando todo el peligro, y otra vez la manda a la tribuna.",
  "{j} inventa una jugada de otro partido y la termina tirando afuera.",
  "Le queda a {j} de sobrepique y le pega como si le tuviera miedo a la pelota.",
  "{j} hizo lo difícil, gambeteó a tres, y falló lo fácil.",
  "Genialidad de {j} para quedar solo. Definición para el olvido.",
];
const OCASION_RIVAL = [
  "Se salvó Olimpia. Le quedó servida en el área y la tiró arriba.",
  "Tapadón del arquero. Manoteó la pelota abajo del ángulo.",
  "La pelota pegó en el palo y salió. Susto grande.",
  "Contra del rival y la definición se fue apenas ancha.",
  "Se lo perdió el nueve del rival, solo contra el arquero.",
  "Centro pasado y cabezazo que se va rozando el palo.",
  "Le pegó de afuera y la sacó al córner el arquero, con lo justo.",
  "Reclamaron penal en el área de Olimpia. El árbitro dijo que siga.",
  "Quedó mano a mano y le salió bien el arquero. Achicó y se la comió.",
  "Tres pases y quedaron de frente al arco. La tiraron por arriba.",
  "Pelota parada peligrosa. Despejó la defensa como pudo.",
];
const GOL_RIVAL = [
  "Gol del rival. Centro atrás y definición cruzada, no llegó nadie.",
  "Se la pusieron en el ángulo. Nada que hacer.",
  "Error en la salida y lo terminaron pagando. Gol.",
  "Cabezazo tras córner. Olimpia quedó mirando.",
  "Contragolpe letal. La liquidaron de primera.",
  "Rebote en el área y el más vivo la empujó. Gol del rival.",
  "Tiro libre al ángulo. El arquero ni se movió.",
  "Se metieron por la banda y la pusieron atrás. Gol y a empezar de nuevo.",
  "Penal. Lo cambió por gol sin despeinarse.",
  "Le quedó el rebote del palo y no falló. Gol.",
];
const AMARILLA = [
  "Amarilla a {j}. Va sentido con el árbitro.",
  "Falta táctica de {j}. Amarilla y protesta.",
  "{j} llegó tarde y vio la amarilla. Tiene que tener cuidado.",
  "{j} cortó la contra con la mano. Amarilla justa.",
  "Amonestado {j} por protestar. Innecesaria.",
  "Plancha de {j} en mitad de cancha. Amarilla y podría haber sido peor.",
];
const ROJA = [
  "Roja a {j}. Se va a las duchas y deja a Olimpia con diez.",
  "Segunda amarilla para {j}. Cometió una infantilidad.",
];
const AMARILLA_RIVAL = [
  "Amarilla para {r} del rival. Venía cortando todo.",
  "Falta dura de {r} y el árbitro le muestra la amarilla.",
  "{r} agarró de la camiseta y se llevó la amonestación.",
  "Amonestado {r} por reclamar.",
];
const ROJA_RIVAL = [
  "ROJA para {r}. El rival se queda con diez.",
  "Segunda amarilla de {r} y se va expulsado. Hay uno menos del otro lado.",
];
const TRIBUNA_ABAJO = [
  "La tribuna empieza a impacientarse. Se escuchan silbidos.",
  "El Defensores pide que Olimpia vaya al frente de una vez.",
  "Se hace largo el partido y la gente lo hace sentir.",
];
const TRIBUNA_ARRIBA = [
  "La hinchada empuja, se viene una ola desde la popular.",
  "El estadio es una fiesta. Olimpia lo está manejando.",
];
/*
 * Las lesiones por gravedad.
 *
 * Antes había una sola lista y todas decían lo mismo: "se rompió", "no puede
 * seguir". Después el juego lo dejaba afuera una semana y el texto había
 * anunciado una tragedia. Peor todavía, los días se sorteaban recién al
 * terminar el partido y con Math.random, o sea que el relato no podía saber de
 * qué estaba hablando. Ahora la gravedad se decide cuando pasa y el texto sale
 * de ahí.
 */
const MOLESTIA = [
  "{j} siente algo atrás del muslo y pide el cambio por las dudas.",
  "{j} pisó mal y quedó dolorido. Prefiere no arriesgar.",
  "Golpe feo y {j} le hace señas al banco. Puede caminar, pero no seguir.",
  "{j} se toca el gemelo y pide que lo saquen a tiempo.",
];
const DESGARRO = [
  "{j} se agarró el isquiotibial y se tiró al piso. Esta vez es en serio.",
  "Queda tendido {j}. Entra el médico y lo saca del brazo.",
  "{j} quiso arrancar, sintió el tirón y se frenó de golpe. No sigue.",
  "Se le fue el gemelo a {j}. Sale caminando pero con la cara desencajada.",
];
const ROTURA = [
  "{j} quedó en el piso agarrándose la rodilla. No se levanta.",
  "Choque durísimo y {j} sale en camilla. Se teme lo peor.",
  "{j} se dobló el tobillo y se escuchó desde la platea. Sale llorando.",
  "Se le fue la rodilla a {j} sin que nadie lo tocara. Mal asunto.",
];

/** Qué tan grave es, para el relato y para lo que después se pierde. */
export type Gravedad = "molestia" | "desgarro" | "rotura";

export function gravedadDe(dias: number): Gravedad {
  return dias <= 12 ? "molestia" : dias <= 28 ? "desgarro" : "rotura";
}

const POR_GRAVEDAD: Record<Gravedad, string[]> = {
  molestia: MOLESTIA, desgarro: DESGARRO, rotura: ROTURA,
};

// ---------------------------------------------------------------- helpers

const nom = (j: Jugador) => j.apellido;
const texto = (rng: Rng, xs: string[], j?: Jugador) =>
  rng.elegir(xs).replace("{j}", j ? nom(j) : "");

export function ambienteDe(ctx: ContextoPartido): string {
  if (ctx.esClasico) return "Clásico. Se juega más al roce que al fútbol.";
  if (!ctx.esLocal && ctx.alturaM > 1500)
    return "La pelota vuela distinto acá arriba. A Olimpia le está costando respirar.";
  if (!ctx.esLocal && ctx.competencia === "sudamericana")
    return "El estadio es una caldera. No se escucha nada.";
  if (ctx.esLocal && ctx.competencia === "sudamericana")
    return "El Defensores está lleno y empuja. Se siente en la cancha.";
  if (ctx.viajeKm > 300) return "Se nota el viaje en las piernas.";
  return "Olimpia sale a la cancha.";
}

function elegirGoleador(a: Alineacion, ctx: ContextoPartido, rng: Rng): Jugador {
  const peso = (j: Jugador) => {
    const p = a.puestos.get(j.id) ?? j.posicion;
    const base = LINEA_DE[p] === "DEL" ? 5 : LINEA_DE[p] === "MED" ? 2.2
      : LINEA_DE[p] === "DEF" ? 0.6 : 0;
    let w = base * (nivelEfectivo(j, p, ctx) / 65);
    if (j.rasgos.includes("definidor")) w *= 1.25;
    if (j.rasgos.includes("definicion_irregular")) w *= 0.85;
    return Math.max(w, 0.01);
  };
  const total = a.once.reduce((s, j) => s + peso(j), 0);
  let r = rng.next() * total;
  for (const j of a.once) {
    r -= peso(j);
    if (r <= 0) return j;
  }
  return a.once[a.once.length - 1];
}

// ---------------------------------------------------------------- tramos

/**
 * Simula un tramo del partido con la alineación que hay EN ESE MOMENTO.
 * Que sea por tramos es lo que hace que los cambios sirvan: al mover el equipo
 * se vuelve a simular lo que queda, no se destapa un resultado ya escrito.
 */
export function relatarTramo(
  a: Alineacion, ctx: ContextoPartido, rng: Rng,
  desde: number, hasta: number, gOIni: number, gRIni: number,
  /** Quiénes ya vieron amarilla: la segunda cuesta mucho más barata. */
  amonestados: Set<string> = new Set(),
  rival11: JugadorRival[] = [],
  /**
   * Los momentos que ya se jugaron y no se repiten en el mismo partido. El
   * festejo salía en cada gol: en una goleada te frenaba el partido tres veces
   * para decidir lo mismo, y lo que tiene que ser un premio se volvía trámite.
   */
  yaVistos: Set<string> = new Set(),
  /** En qué minuto entró cada uno, para saber cuánto lleva corrido. */
  entradas: Map<string, number> = new Map(),
): EventoRelato[] {
  /*
   * Los once se cansan DENTRO del partido.
   *
   * La condición solo se usaba para dibujar la barrita de cada jugador: la
   * simulación tomaba la del vestuario y no la bajaba nunca. Un titular con
   * ochenta minutos encima rendía como si acabara de entrar, y por eso meter
   * cambios te empeoraba el equipo en vez de mejorarlo: el suplente fresco
   * entraba con su nivel crudo contra un titular que el motor creía entero.
   *
   * Se usa la condición del punto medio del tramo, que es la que representa
   * cómo se juega ese rato. Los que entran de cambio llegan con la suya, que
   * es justamente la ventaja de estar fresco.
   */
  const medio = (desde + Math.max(hasta, desde)) / 2;
  const cansados: Alineacion = {
    ...a,
    once: a.once.map((j) => ({
      ...j,
      condicion: Math.max(5, j.condicion - desgasteEnCancha(j, medio - (entradas.get(j.id) ?? 0), a.actitud)),
    })),
  };
  const f = fuerzas(cansados, ctx);
  const localiaRival = ctx.competencia === "sudamericana" ? P.localiaCopaRival : P.localiaLiga;
  const rival = ctx.rivalFuerza + (ctx.esLocal || ctx.neutral ? 0 : localiaRival);
  const parte = Math.max(hasta - desde, 0) / 90;

  const xgO = clamp(P.xgBase * Math.exp(P.xgK * (f.ataque - rival)), 0.05, 6) * parte;
  const xgR = clamp(P.xgBase * Math.exp(P.xgK * (rival - f.defensa)), 0.05, 6) * parte;

  let gO = gOIni, gR = gRIni;
  const ev: EventoRelato[] = [];
  const push = (minuto: number, tipo: TipoEvento, txt: string, extra?: Partial<EventoRelato>) =>
    ev.push({ minuto, tipo, texto: txt, golesOlimpia: gO, golesRival: gR, ...extra });

  const minutos = (n: number) =>
    Array.from({ length: n }, () => rng.entero(desde + 1, Math.max(hasta, desde + 1)));

  const sucesos: { min: number; hacer: () => void }[] = [];

  for (const m of minutos(rng.poisson(xgO)))
    sucesos.push({ min: m, hacer: () => {
      const j = elegirGoleador(cansados, ctx, rng);
      gO++;
      const p = a.puestos.get(j.id) ?? j.posicion;
      const banco = LINEA_DE[p] === "DEF" ? GOL_DEF : LINEA_DE[p] === "MED" ? GOL_MED
        : j.rasgos.includes("juego_aereo") && rng.chance(0.45) ? GOL_AEREO : GOL_DEL;
      push(m, "gol", "GOL. " + texto(rng, banco, j), { jugadorId: j.id });
      // El gol ya pasaba y vos mirabas. Adónde va a festejar sí es tuyo, y no
      // toca el resultado: mueve a la gente y puede costar una amarilla.
      if (!yaVistos.has("festejo") && rng.chance(0.2 * peso)) {
        const fest = generarMomento("festejo", m, a, ctx, rng, j.id);
        if (fest) push(m, "momento", fest.titulo, { pausa: true, momento: fest, jugadorId: j.id });
      }
    }});

  for (const m of minutos(rng.poisson(xgR)))
    sucesos.push({ min: m, hacer: () => { gR++; push(m, "gol_rival", texto(rng, GOL_RIVAL)); }});

  for (const m of minutos(rng.entero(1, Math.max(1, Math.round(4 * parte)))))
    sucesos.push({ min: m, hacer: () => {
      const j = elegirGoleador(a, ctx, rng);
      const irr = j.rasgos.includes("definicion_irregular") && rng.chance(0.6);
      push(m, "ocasion", texto(rng, irr ? OCASION_IRREGULAR : OCASION, j), { jugadorId: j.id });
    }});

  for (const m of minutos(rng.entero(0, Math.max(1, Math.round(3 * parte)))))
    sucesos.push({ min: m, hacer: () => push(m, "ocasion_rival", texto(rng, OCASION_RIVAL)) });

  for (const j of cansados.once) {
    /*
     * El que va fuerte se lleva más amarillas, y por lo tanto es el que más
     * seguido te obliga a decidir si lo sacás. Antes la amarilla dependía solo
     * de la línea: un lateral que no baja el codo nunca y uno que hace dos
     * faltas por partido se amonestaban igual. El rasgo sale de las faltas por
     * noventa de la temporada 2026, no de mi opinión.
     */
    const pAm = ((LINEA_DE[j.posicion] === "DEF" ? 0.16 : LINEA_DE[j.posicion] === "MED" ? 0.14 : 0.08)
      * (j.rasgos.includes("va_fuerte") ? P.rasgoVaFuerte : 1)
      * (ctx.esClasico ? 1.5 : 1) * (aprieta(a.actitud) ? 1.25 : 1)) * parte;
    if (rng.chance(pAm)) {
      const m = rng.entero(desde + 1, Math.max(hasta, desde + 1));
      sucesos.push({ min: m, hacer: () => push(m, "amarilla", texto(rng, AMARILLA, j), { jugadorId: j.id }) });
      // el amonestado puede seguir caliente y obligar a decidir
      if (m < hasta - 6 && rng.chance(0.28)) {
        const m2 = Math.min(hasta - 1, m + rng.entero(3, 9));
        const caliente = generarMomento("jugador_caliente", m2, a, ctx, rng, j.id);
        if (caliente) {
          sucesos.push({ min: m2, hacer: () =>
            push(m2, "momento", caliente.titulo, { pausa: true, momento: caliente, jugadorId: j.id }) });
        }
      }
    }
    // Con amarilla encima, cualquier entrada fuerte es la segunda. El riesgo se
    // multiplica, y sube más si el equipo va a presionar o el jugador está fundido.
    let pRoja = 0.005;
    if (amonestados.has(j.id)) {
      pRoja = 0.055;
      if (aprieta(a.actitud)) pRoja += 0.025;
      if (a.actitud === "defensivo") pRoja += 0.015;
      if (j.condicion < 55) pRoja += 0.02;
      if (ctx.esClasico) pRoja += 0.02;
    }
    if (rng.chance(pRoja * parte)) {
      const m = rng.entero(desde + 1, Math.max(hasta, desde + 1));
      sucesos.push({ min: m, hacer: () => push(m, "roja", texto(rng, ROJA, j), { jugadorId: j.id }) });
    }
    let pLes = P.lesionBase;
    if (j.condicion < 45) pLes *= P.lesionCond45;
    else if (j.condicion < 60) pLes *= P.lesionCond60;
    if (j.rasgos.includes("fragil")) pLes *= P.lesionFragil;
    if (j.edad >= 33) pLes *= P.lesionVeterano;
    if (rng.chance(pLes * parte)) {
      const m = rng.entero(desde + 1, Math.max(hasta, desde + 1));
      /*
       * Las roturas son las menos, como en el fútbol: la mayoría de las veces
       * es una molestia de una semana y no una temporada perdida.
       */
      const dias = rng.chance(0.55) ? rng.entero(5, 12)
        : rng.chance(0.7) ? rng.entero(14, 28)
        : rng.entero(32, 75);
      const g = gravedadDe(dias);
      sucesos.push({ min: m, hacer: () =>
        push(m, "lesion", texto(rng, POR_GRAVEDAD[g], j),
             { jugadorId: j.id, pausa: true, diasFuera: dias }) });
    }
  }

  // El rival también recibe tarjetas: sirve para leer por dónde está sufriendo.
  for (const r of rival11) {
    const pAm = (LINEA_DE[r.posicion] === "DEF" ? 0.15 : LINEA_DE[r.posicion] === "MED" ? 0.13 : 0.07) * parte;
    if (rng.chance(pAm)) {
      const m = rng.entero(desde + 1, Math.max(hasta, desde + 1));
      sucesos.push({ min: m, hacer: () =>
        push(m, "amarilla_rival", rng.elegir(AMARILLA_RIVAL).replace("{r}", r.apellido),
             { rivalJugadorId: r.id }) });
      if (rng.chance(0.09)) {
        const m2 = Math.min(hasta - 1, m + rng.entero(4, 14));
        if (m2 > m) sucesos.push({ min: m2, hacer: () =>
          push(m2, "roja_rival", rng.elegir(ROJA_RIVAL).replace("{r}", r.apellido),
               { rivalJugadorId: r.id }) });
      }
    }
  }

  // La tribuna reacciona al resultado. Es presión, no información nueva.
  if (desde < 72 && hasta > 72 && ctx.esLocal) {
    const m = rng.entero(70, Math.min(80, Math.max(hasta - 2, 71)));
    sucesos.push({ min: m, hacer: () =>
      push(m, "tribuna", gO < gR ? rng.elegir(TRIBUNA_ABAJO)
        : gO > gR ? rng.elegir(TRIBUNA_ARRIBA)
        : rng.elegir(TRIBUNA_ABAJO)) });
  }

  /*
   * Momentos: decisiones con el reloj corriendo. Poco frecuentes a propósito,
   * para que cuando aparezcan pesen.
   *
   * En la copa y en el clásico aparecen bastante más. Son los partidos que el
   * juego quiere que mires jugada por jugada, y un partido que vale distinto
   * tiene que además pedirte más: si te frena lo mismo que un miércoles contra
   * Rubio Ñú, la diferencia es solo el escudo.
   */
  const peso = ctx.esClasico ? 1.9 : ctx.competencia === "sudamericana" ? 1.7 : 1;
  const posibles: [Parameters<typeof generarMomento>[0], number][] = [
    ["penal_favor", 0.09],
    ["penal_contra", 0.08],
    ["tiro_libre", 0.30],
    ["mano_a_mano", 0.22],
    ["rival_con_diez", 0.10],
  ];
  for (const [tipo, prob] of posibles) {
    if (!rng.chance(Math.min(0.75, prob * peso) * parte)) continue;
    const m = rng.entero(desde + 2, Math.max(hasta - 2, desde + 3));
    const momento = generarMomento(tipo, m, a, ctx, rng);
    if (!momento) continue;
    sucesos.push({ min: m, hacer: () =>
      push(m, "momento", momento.titulo, { pausa: true, momento }) });
  }

  /*
   * Estos dos dependen del marcador y por eso se deciden cuando les toca el
   * turno, no acá arriba: gO y gR todavía valen lo del principio del tramo, y
   * lo que importa es cómo va el partido al minuto 70 o al 90.
   */
  if (desde < 70 && hasta > 70) {
    const m = rng.entero(68, 74);
    sucesos.push({ min: m, hacer: () => {
      // sirve igual arriba que abajo por uno: en los dos casos hay que decidir
      // cómo se juegan los últimos veinte
      if (Math.abs(gO - gR) !== 1 || !rng.chance(Math.min(0.9, 0.5 * peso))) return;
      const cerrar = generarMomento("cerrar_o_seguir", m, a, ctx, rng, undefined, [gO, gR]);
      if (cerrar) push(m, "momento", cerrar.titulo, { pausa: true, momento: cerrar });
    }});
  }

  // El último córner con el arquero subiendo. Solo cuando de verdad es la
  // última pelota y estás uno abajo: si fuera siempre, dejaría de ser eso.
  if (hasta >= 89) {
    sucesos.push({ min: 90, hacer: () => {
      if (gR - gO !== 1 || !rng.chance(Math.min(0.9, 0.5 * peso))) return;
      const corner = generarMomento("arquero_al_area", 90, a, ctx, rng);
      if (corner) push(90, "momento", corner.titulo, { pausa: true, momento: corner });
    }});
  }

  // Penal sobre la hora, solo si el partido está para definirse. Es el momento
  // con más peso del juego y por eso está condicionado, no librado al azar.
  if (hasta >= 88 && Math.abs(gO - gR) <= 1 && rng.chance(0.12 * peso)) {
    const m = rng.entero(88, 90);
    const ultimo = generarMomento("penal_ultima", m, a, ctx, rng);
    if (ultimo) sucesos.push({ min: m, hacer: () =>
      push(m, "momento", ultimo.titulo, { pausa: true, momento: ultimo }) });
  }

  // el que peor llega, avisado una sola vez y solo si de verdad está fundido
  if (desde < 62 && hasta > 62) {
    const peor = [...a.once].sort((x, y) => x.condicion - y.condicion)[0];
    if (peor && peor.condicion < 62) {
      sucesos.push({ min: rng.entero(58, 68), hacer: () =>
        push(Math.min(68, hasta), "aviso_condicion",
          `${nom(peor)} está fundido, camina. Rinde muy por debajo de lo suyo.`,
          { jugadorId: peor.id, pausa: true }) });
    }
  }

  sucesos.sort((x, y) => x.min - y.min);

  // El entretiempo tiene que anunciar el marcador que hay AL MINUTO 45, así que
  // se inserta mientras se recorren los sucesos, no al final.
  const corresponde = desde < 45 && hasta >= 45;
  let entretiempoPuesto = !corresponde;
  const entretiempo = () => {
    ev.push({ minuto: 45, tipo: "entretiempo",
      texto: `Se va al descanso. Olimpia ${gO} - ${gR} ${ctx.rivalNombre}.`,
      golesOlimpia: gO, golesRival: gR, pausa: true });
    entretiempoPuesto = true;
  };

  for (const s of sucesos) {
    if (!entretiempoPuesto && s.min > 45) entretiempo();
    s.hacer();
  }
  if (!entretiempoPuesto) entretiempo();
  if (hasta >= 90) {
    const cierre = gO > gR ? "Ganó Olimpia." : gO < gR ? "Derrota." : "Reparto de puntos.";
    ev.push({ minuto: 90, tipo: "final", texto: `Final del partido. ${cierre}`,
      golesOlimpia: gO, golesRival: gR });
  }

  return ev.sort((x, y) => x.minuto - y.minuto);
}
