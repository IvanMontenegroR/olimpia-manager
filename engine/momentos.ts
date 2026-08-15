import { Rng } from "./rng.ts";
import { P, nivelEfectivo } from "./motor.ts";
import { LINEA_DE, type Actitud, type Alineacion, type ContextoPartido, type Jugador } from "./tipos.ts";

/**
 * Momentos: el partido se detiene y hay que decidir con el reloj corriendo.
 *
 * La regla de diseño es que ponen a prueba la DECISIÓN del DT, no el pulso del
 * jugador. Quién patea importa; con qué precisión tocás la pantalla, no. Si el
 * resultado dependiera de reflejos, el Nivel del plantel dejaría de importar y
 * se caería la premisa del juego.
 */

export type TipoMomento =
  | "penal_favor" | "penal_contra" | "tiro_libre" | "jugador_caliente" | "mano_a_mano"
  | "penal_ultima" | "rival_con_diez"
  // los que aprovechan lo que hasta ahora pasaba solo en el relato
  | "festejo" | "arquero_al_area" | "cerrar_o_seguir";

export interface OpcionMomento {
  id: string;
  etiqueta: string;
  detalle: string;
  jugadorId?: string;
}

/**
 * Lo que puede salir mal de una opción, además de no salir bien.
 *
 * Sin esto las decisiones del partido estaban dominadas: las tres opciones
 * producían el mismo resultado (gol o no gol) y solo cambiaba la
 * probabilidad, así que siempre elegías la del número más alto y no había
 * nada que decidir. Ahora la opción de más chance también es la que más
 * expone, y cuál conviene depende del minuto y del marcador.
 */
export interface RiesgoOpcion {
  /** Probabilidad de que además termine en gol del rival. */
  contra: number;
  texto: string;
  /**
   * De cuál de los dos desenlaces se descuenta. Casi siempre del fallo: si no
   * entra, además te matan de contra. El penal en contra es al revés: el
   * rebote sale de una atajada, no de un gol.
   */
  sobre: "exito" | "fallo";
}

export interface Momento {
  tipo: TipoMomento;
  minuto: number;
  titulo: string;
  contexto: string;
  segundos: number;
  opciones: OpcionMomento[];
  /** Qué pasa si se acaba el tiempo: siempre la opción conservadora. */
  porDefecto: string;
}

export interface ResueltoMomento {
  texto: string;
  exito: boolean;
  /** Un golazo levanta a la gente, más allá del gol. */
  levantaHinchada?: number;
  golOlimpia?: boolean;
  golRival?: boolean;
  rojaA?: string;
  amarillaA?: string;
  gastaCambio?: string;
  /** Cambia cómo se para el equipo por lo que queda de partido. */
  cambiaActitud?: Actitud;
  /**
   * Pasó lo que avisaba la franja oscura de la barra, y no el fallo común.
   * La pantalla lo necesita para frenar la bolilla en el tramo que
   * corresponde: sin esto podía caer sobre "te matan de contra" y después
   * contar que la pelota se fue larga y no pasó nada.
   */
  porElRiesgo?: boolean;
  /**
   * Lo que le queda al que se hizo cargo y falló. Errar un penal no es solo no
   * hacer el gol: el que la manda afuera juega el resto del partido con eso
   * encima, y si era tu mejor jugador lo vas a pagar.
   */
  golpeAnimo?: { id: string; delta: number };
  /**
   * Lo que enciende a todo el once. El festejo pagaba solo en hinchada, que
   * medida contra el nivel vale dos décimas por un partido de local: no había
   * forma de que se notara y por eso no se entendía para qué servía. Un festejo
   * que se pudre levanta al equipo, que es lo que sí se ve.
   */
  enciendeAlEquipo?: number;
  /**
   * Dónde pegó la pelota, de palo a palo (0 a 1). Solo en el penal en contra:
   * la barra es el arco y la bolilla tiene que frenar exactamente donde fue el
   * remate, no en un tramo abstracto de "atajada" o "gol".
   */
  dondeFue?: number;
  /**
   * Lo que le sacás de piernas al rival por el resto del partido. Hacerlo
   * correr con un hombre menos lo funde, y eso baja su nivel de verdad.
   */
  cansaAlRival?: number;
}

/*
 * Cuánto pesa el que ejecuta.
 *
 * Las pendientes estaban tan planas que veinte puntos de nivel valían doce de
 * chance, menos que el rasgo definidor: un 86 pateaba igual que un 71. Se
 * duplicaron, y las bases se bajaron para que en el nivel medio del plantel
 * (65) den lo mismo que antes. O sea: la media del juego no se mueve, lo que
 * cambia es que ahora se nota a quién ponés.
 */
const apellido = (j: Jugador) => j.apellido;

const acotar = (p: number, min: number, max: number) => Math.max(min, Math.min(max, p));

/**
 * La chance de que salga bien cada opción, sin tirar el dado.
 *
 * Existe para poder mostrarla antes de elegir. Sin esto el azar estaba dentro
 * de la resolución y desde afuera parecía que daba igual a quién ponías a
 * patear, cuando en realidad un definidor suma nueve puntos y un juvenil
 * pierde nueve en la última pelota del partido.
 *
 * Los rasgos irregulares se muestran con su media: son los únicos donde el
 * número que ves no es exactamente el que se juega, y por eso el detalle
 * avisa que es impredecible.
 */
/**
 * El mejor de la cancha por arriba, y cuánto vale ese centro.
 *
 * Antes esto solo miraba si en el once había alguien con juego aéreo: un
 * central de 78 que la baja de cabeza valía lo mismo que un lateral que la
 * tiene marcada de casualidad. Ahora pesa quién es.
 */
function cabeceador(a: Alineacion, ctx: ContextoPartido) {
  const nivel = (j: Jugador) => nivelEfectivo(j, a.puestos.get(j.id) ?? j.posicion, ctx);
  const decampo = a.once.filter((j) => (a.puestos.get(j.id) ?? j.posicion) !== "ARQ");
  const valor = (j: Jugador) => nivel(j) + (j.rasgos.includes("juego_aereo") ? 12 : 0);
  const j = [...decampo].sort((x, y) => valor(y) - valor(x))[0];
  if (!j) return null;
  // el 65 es el nivel medio del once: ahí el centro vale lo que valía antes
  const chance = acotar(0.16 + (valor(j) - 65) * 0.006, 0.08, 0.34);
  return { j, chance };
}

export function chanceDe(
  m: Momento, opcionId: string, a: Alineacion, ctx: ContextoPartido,
): number | null {
  const buscar = (id?: string) => a.once.find((j) => j.id === id);
  const nivel = (j: Jugador) => nivelEfectivo(j, a.puestos.get(j.id) ?? j.posicion, ctx);

  switch (m.tipo) {
    case "penal_favor": {
      const j = buscar(opcionId);
      if (!j) return null;
      let p = 0.54 + (nivel(j) - 55) * 0.010;
      if (j.rasgos.includes("definidor")) p += 0.09;
      if (j.rasgos.includes("definicion_irregular")) p -= 0.03; // media del ruido
      if (j.condicion < 50) p -= 0.07;
      return acotar(p, 0.32, 0.93);
    }
    case "penal_ultima": {
      const j = buscar(opcionId);
      if (!j) return null;
      let p = 0.48 + (nivel(j) - 55) * 0.009;
      p += Math.min(0.12, j.partidos_internacionales * 0.002);
      if (j.edad <= 21) p -= 0.09;
      if (j.rasgos.includes("definidor")) p += 0.08;
      if (j.rasgos.includes("definicion_irregular")) p -= 0.06;
      return acotar(p, 0.25, 0.92);
    }
    case "penal_contra": {
      const z = zonaDelArquero(a, ctx, opcionId);
      // la chance ES el pedazo de arco que tapás: la barra no miente
      return z ? z.hasta - z.desde : null;
    }
    case "tiro_libre": {
      if (opcionId === "arco") {
        const j = buscar(m.opciones[0].jugadorId);
        return j ? acotar(0.08 + (nivel(j) - 60) * 0.008, 0.05, 0.6) : null;
      }
      return cabeceador(a, ctx)?.chance ?? 0.13;
    }
    case "mano_a_mano": {
      const j = buscar(m.opciones[0].jugadorId);
      if (!j) return null;
      const base = (nivel(j) - 55) * 0.010;
      // buscar al compañero es lo que más gol da, pero es lo que más expone
      let p = opcionId === "cruzar" ? 0.48 + base
        : opcionId === "picar" ? 0.34 + base
        : 0.58 + base;
      if (j.rasgos.includes("definidor")) p += 0.08;
      if (j.rasgos.includes("definicion_irregular")) p -= 0.04;
      return acotar(p, 0.15, 0.9);
    }
    case "festejo": {
      // acá no se juega el gol, que ya está: se juega zafar de la amarilla
      if (opcionId === "banco") return null;
      return opcionId === "tribuna" ? 0.82 : 0.62;
    }
    case "arquero_al_area": {
      // el arquero suma un cuerpo, pero el que la va a cabecear sigue siendo
      // el mejor que tengas por arriba
      const c = cabeceador(a, ctx)?.chance ?? 0.13;
      return opcionId === "arquero" ? acotar(c * 1.35, 0.1, 0.4) : acotar(c * 0.6, 0.04, 0.2);
    }
    case "jugador_caliente": {
      if (opcionId === "sacar") return null;      // no es una apuesta: es seguro
      if (opcionId === "hablar") return 0.58 + 0.42 * 0.65; // se calma, o zafa igual
      return 0.68;                                 // dejarlo: no lo expulsan
    }
    default:
      return null;
  }
}

/**
 * El arco, y qué pedazo tapa el arquero según adónde se tire.
 *
 * La barra del penal en contra pasó a ser el arco entero, de palo a palo, y la
 * zona verde es lo que de verdad cubrís. La pelota cae en algún lugar de esa
 * barra: si cae adentro de tu zona, la atajás.
 *
 * Antes cada opción tenía su propio porcentaje y su propia ruleta, y elegir un
 * palo era elegir un número abstracto. Así el arquero se ve: un 78 tapa una
 * franja ancha y un 60 una rendija, sobre el mismo arco.
 */
export function zonaDelArquero(a: Alineacion, ctx: ContextoPartido, opcionId: string) {
  const arq = a.once.find((j) => (a.puestos.get(j.id) ?? j.posicion) === "ARQ");
  if (!arq) return null;
  const nivel = nivelEfectivo(arq, "ARQ", ctx);
  /*
   * Cuánto del arco alcanza a cubrir. Un arquero del montón llega a poco más
   * de una quinta parte; uno de selección, a un tercio largo. Quedarse en el
   * medio cubre menos superficie pero no hay que adivinar hacia dónde va: por
   * eso su zona es más angosta y la de los palos más ancha.
   */
  const alcance = acotar(0.20 + (nivel - 60) * 0.009, 0.10, 0.42);
  const ancho = opcionId === "centro" ? alcance * 0.72 : alcance;
  const centroDe = opcionId === "izq" ? 0.17 : opcionId === "der" ? 0.83 : 0.5;
  return {
    desde: Math.max(0, centroDe - ancho / 2),
    hasta: Math.min(1, centroDe + ancho / 2),
    arquero: arq,
  };
}

/**
 * El riesgo de cada opción: qué puede salir mal además de no entrar.
 *
 * Es lo que rompe el empate entre opciones que si no serían la misma cosa con
 * distinta probabilidad. Al minuto veinte tomás lo seguro; al ochenta y ocho
 * perdiendo, arriesgás.
 */
export function riesgoDe(m: Momento, opcionId: string): RiesgoOpcion | null {
  if (m.tipo === "mano_a_mano" && opcionId === "aguantar") {
    return { contra: 0.24, texto: "si la pierde, sale de contra", sobre: "fallo" };
  }
  if (m.tipo === "tiro_libre" && opcionId === "centro") {
    return { contra: 0.14, texto: "si la rechazan, contra con todos arriba", sobre: "fallo" };
  }
  if (m.tipo === "arquero_al_area" && opcionId === "arquero") {
    return { contra: 0.3, texto: "el arco tuyo queda vacío", sobre: "fallo" };
  }
  return null;
}

/**
 * Cuánto le pesa a cada uno errar un penal, de 0 a 1.
 *
 * Es lo que rompe el empate: el que mejor patea suele ser el mejor jugador que
 * tenés, y si la manda afuera lo arrastra por el resto del partido. Un
 * veterano de mil partidos internacionales se lo sacude; un pibe de veinte
 * años no.
 */
export function pesoDeFallar(j: Jugador, mediaDelOnce = 66): number {
  /*
   * Lo que pesa no es la experiencia sino cuánto se apoya el equipo en él.
   *
   * La primera versión descontaba por partidos internacionales, y como el que
   * mejor patea en Olimpia es justo el veterano de mil partidos, terminaba
   * teniendo la mejor chance Y el menor costo: seguía sin haber decisión. Al
   * que la rompe todos los domingos, errar un penal le pega distinto que al
   * quinto suplente, y al resto también.
   */
  let p = 0.45 + (j.nivel - mediaDelOnce) * 0.045;
  if (j.edad <= 21) p += 0.22;             // al pibe le queda grande
  p -= Math.min(0.12, j.partidos_internacionales * 0.002);
  if (j.rasgos.includes("definidor")) p -= 0.08;
  if (j.rasgos.includes("definicion_irregular")) p += 0.08;
  return acotar(p, 0.15, 0.95);
}

/**
 * Los tres que se pueden hacer cargo, y qué es cada uno.
 *
 * El de más chance, el que menos lo sufre si la erra, y el pibe. Si dos de
 * esos son el mismo jugador se completa con el siguiente de la lista, así
 * siempre hay tres caminos distintos.
 */
export function candidatosAlPenal(a: Alineacion, ctx: ContextoPartido) {
  const orden = pateadores(a, ctx);
  const media = a.once.reduce((s, j) => s + j.nivel, 0) / Math.max(1, a.once.length);
  const elegidos: { j: Jugador; papel: string }[] = [];
  const meter = (j: Jugador | undefined, papel: string) => {
    if (!j || elegidos.some((e) => e.j.id === j.id)) return;
    elegidos.push({ j, papel });
  };
  const libre = (j: Jugador) => !elegidos.some((e) => e.j.id === j.id);

  /*
   * El costo va en el texto, con su número, y en NIVEL del equipo.
   *
   * Antes decía "−25 de ánimo", que es un número interno que no aparece en
   * ninguna pantalla del juego. Ahora dice lo que va a bajar el nivel del
   * equipo, que durante el partido está a la vista al lado del escudo: podés
   * verlo caer cuando pasa.
   */
  const cuestaEnNivel = (j: Jugador) => {
    const golpe = 45 * pesoDeFallar(j, media);
    // lo que ese ánimo perdido le saca al promedio de los once
    return (j.nivel * golpe * P.animoPorPunto) / Math.max(1, a.once.length);
  };
  const bajada = (j: Jugador) => cuestaEnNivel(j).toFixed(1);
  meter(orden[0], `En él se apoya el equipo. Si la erra, −${bajada(orden[0])} de nivel`);
  // el que menos lo sufre: uno que puede patear y no carga con el equipo encima
  const frio = [...orden].slice(0, 7).filter(libre)
    .sort((x, y) => pesoDeFallar(x, media) - pesoDeFallar(y, media))[0];
  if (frio) meter(frio, `Patea peor, pero errarlo casi no le queda: −${bajada(frio)} de nivel`);
  // el pibe: la peor chance y lo que más se lleva si la mete
  const pibe = [...orden].slice(0, 8).filter((j) => libre(j) && j.edad <= 23)
    .sort((x, y) => y.nivel - x.nivel)[0];
  if (pibe) meter(pibe, `Se ofrece. Si la mete no se olvida más; si la erra, −${bajada(pibe)} de nivel`);
  for (const j of orden) {
    if (elegidos.length >= 3) break;
    meter(j, `Nivel ${Math.round(nivelEfectivo(j, a.puestos.get(j.id) ?? j.posicion, ctx))}. ` +
      `Si la erra, −${bajada(j)} de nivel`);
  }
  return elegidos.slice(0, 3);
}

/**
 * Lo que sube el nivel del equipo si se le levanta el ánimo a los once.
 *
 * Es la misma cuenta que hace la pantalla principal, para poder prometer el
 * beneficio en la moneda que se ve arriba en el marcador y no en ánimo, que no
 * se muestra en ninguna parte.
 */
function enciende(a: Alineacion, deAnimo: number): string {
  const media = a.once.reduce((s, x) => s + x.nivel, 0) / Math.max(1, a.once.length);
  return (media * deAnimo * P.animoPorPunto).toFixed(1);
}

/**
 * Cuánto cambia el peligro al cambiar cómo te parás, en porcentaje.
 *
 * Meterse atrás y tirarse encima no mueven el nivel del equipo, así que no
 * tenían un solo número a la vista: eran tres frases y elegías por intuición.
 * Esto es lo que de verdad hacen, que es multiplicar las ocasiones de cada
 * lado.
 */
const cuantoMenos = (puntos: number) =>
  Math.round((1 - Math.exp(-P.xgK * Math.abs(puntos))) * 100);

/** Ordena a los del once por lo bien que patearían. */
function pateadores(a: Alineacion, ctx: ContextoPartido): Jugador[] {
  const valor = (j: Jugador) => {
    const p = a.puestos.get(j.id) ?? j.posicion;
    let v = nivelEfectivo(j, p, ctx);
    const l = LINEA_DE[p];
    if (l === "DEL") v += 6;
    else if (l === "MED") v += 3;
    else if (l === "ARQ") v -= 40;
    if (j.rasgos.includes("definidor")) v += 8;
    if (j.rasgos.includes("definicion_irregular")) v -= 2;
    return v;
  };
  return [...a.once].sort((x, y) => valor(y) - valor(x));
}

// ---------------------------------------------------------------- generación

export function generarMomento(
  tipo: TipoMomento, minuto: number, a: Alineacion, ctx: ContextoPartido,
  rng: Rng, jugadorId?: string,
  /** Cómo va el partido, para los momentos que dependen del resultado. */
  marcador?: [number, number],
): Momento | null {
  switch (tipo) {
    case "penal_favor": {
      /*
       * Los tres candidatos no son los tres de más nivel.
       *
       * Elegir al mejor pateador no era una decisión: mirabas el porcentaje más
       * alto y tocabas. Ahora se ofrece el que mejor patea, el que mejor se
       * banca fallarlo, y el pibe. Y lo que cambia entre ellos no es solo la
       * chance sino lo que cuesta errarlo: al que se hace cargo y la manda
       * afuera le queda, y si es tu mejor jugador lo vas a pagar el resto del
       * partido.
       */
      const tres = candidatosAlPenal(a, ctx);
      if (tres.length < 2) return null;
      return {
        tipo, minuto, segundos: 9,
        titulo: "PENAL A FAVOR",
        contexto: "Lo derribaron en el área. ¿Quién se hace cargo?",
        opciones: tres.map(({ j, papel }) => ({
          id: j.id,
          etiqueta: `${j.numero} ${apellido(j)}`,
          detalle: papel,
          jugadorId: j.id,
        })),
        porDefecto: tres[0].j.id,
      };
    }

    case "penal_contra": {
      const arq = a.once.find((j) => (a.puestos.get(j.id) ?? j.posicion) === "ARQ");
      if (!arq) return null;
      return {
        tipo, minuto, segundos: 7,
        titulo: "PENAL EN CONTRA",
        contexto: `${apellido(arq)} espera. ¿Para qué lado se tira?`,
        opciones: [
          { id: "izq", etiqueta: "Al palo izquierdo",
            detalle: "Tapa más arco, pero hay que acertar el lado" },
          { id: "centro", etiqueta: "Quedarse parado",
            detalle: "Menos arco, pero no hay que adivinar nada" },
          { id: "der", etiqueta: "Al palo derecho",
            detalle: "Tapa más arco, pero hay que acertar el lado" },
        ],
        porDefecto: "centro",
      };
    }

    case "tiro_libre": {
      const aereo = a.once.filter((j) => j.rasgos.includes("juego_aereo"));
      const tirador = pateadores(a, ctx)[0];
      return {
        tipo, minuto, segundos: 8,
        titulo: "TIRO LIBRE PELIGROSO",
        contexto: "Al borde del área, de frente al arco.",
        opciones: [
          { id: "arco", etiqueta: "Al arco",
            detalle: `La pega ${apellido(tirador)}. Si entra es un golazo`,
            jugadorId: tirador.id },
          { id: "centro", etiqueta: "Centro al área",
            detalle: (aereo.length ? `${apellido(aereo[0])} gana arriba` : "Sin nadie fuerte de cabeza")
              + ". Van todos, y si la rechazan quedás abierto" },
        ],
        porDefecto: "arco",
      };
    }

    case "jugador_caliente": {
      const j = a.once.find((x) => x.id === jugadorId);
      if (!j) return null;
      return {
        tipo, minuto, segundos: 8,
        titulo: "VA CALIENTE",
        contexto: `${apellido(j)} ya tiene amarilla y sigue yendo fuerte. Te lo van a echar.`,
        /*
         * Las tres dicen su número. "Si aguanta la cancha se prende" no decía
         * nada: la única cifra a la vista era el porcentaje de zafar, así que
         * dejarlo parecía todo riesgo y ninguna ganancia.
         */
        opciones: [
          { id: "sacar", etiqueta: "Sacarlo",
            detalle: `Te gasta un cambio y perdés a ${apellido(j)} el resto del partido`,
            jugadorId: j.id },
          { id: "hablar", etiqueta: "Hablarle",
            detalle: `Puede que se calme. Si responde, +${enciende(a, 6)} de nivel`,
            jugadorId: j.id },
          { id: "dejar", etiqueta: "Dejarlo",
            detalle: `Si la aguanta, +${enciende(a, 12)} de nivel. Si no, te quedás con diez`,
            jugadorId: j.id },
        ],
        porDefecto: "hablar",
      };
    }

    case "penal_ultima": {
      const tres = pateadores(a, ctx).slice(0, 3);
      if (tres.length < 2) return null;
      return {
        tipo, minuto, segundos: 10,
        titulo: "PENAL SOBRE LA HORA",
        contexto: "Último minuto. Esto define el partido. ¿Quién se hace cargo?",
        opciones: tres.map((j) => ({
          id: j.id,
          etiqueta: `${j.numero} ${apellido(j)}`,
          detalle: j.partidos_internacionales > 40 ? "Jugó mil partidos, no le tiembla"
            : j.edad <= 21 ? "Es un pibe, nunca pateó una así"
            : j.rasgos.includes("definidor") ? "Definidor"
            : `Nivel ${Math.round(nivelEfectivo(j, a.puestos.get(j.id) ?? j.posicion, ctx))}`,
          jugadorId: j.id,
        })),
        porDefecto: tres[0].id,
      };
    }

    case "rival_con_diez": {
      return {
        tipo, minuto, segundos: 8,
        titulo: "EL RIVAL SE QUEDÓ CON DIEZ",
        contexto: "Hay un hombre de más. ¿Qué hacés con la ventaja?",
        /*
         * Las tres cambian cómo te parás y nada más, así que el detalle es lo
         * único que informa: sin números eran tres frases bonitas y elegías por
         * intuición.
         */
        opciones: [
          { id: "ahogar", etiqueta: "Ahogarlo arriba",
            detalle: `Llegás ${cuantoMenos(P.actitudAtaque.ofensivo)}% más y le sacás 8 de ` +
              `condición. Te dejás abierto: te llegan ${cuantoMenos(P.actitudDefensa.ofensivo)}% más` },
          { id: "abrir", etiqueta: "Abrir la cancha",
            detalle: "Sin exponerte, pero corriendo con diez se funden: le sacás 16 de condición" },
          { id: "sostener", etiqueta: "No cambiar nada",
            detalle: `Administrás con el hombre de más: te llegan ` +
              `${cuantoMenos(P.actitudDefensa.defensivo)}% menos` },
        ],
        porDefecto: "sostener",
      };
    }

    case "festejo": {
      const j = a.once.find((x) => x.id === jugadorId);
      if (!j) return null;
      return {
        tipo, minuto, segundos: 6,
        titulo: "EL FESTEJO",
        contexto: `Lo metió ${apellido(j)} y sale corriendo. ¿Adónde va?`,
        opciones: [
          { id: "tribuna", etiqueta: "A la tribuna",
            detalle: `La cancha se prende: +${enciende(a, 4)} de nivel. Amarilla si el árbitro se pone duro`,
            jugadorId: j.id },
          { id: "provocar", etiqueta: "Callarle la boca al rival",
            detalle: `Enciende al equipo como nada: +${enciende(a, 7)} de nivel. Y esta suele costar amarilla`,
            jugadorId: j.id },
          { id: "banco", etiqueta: "Correr al banco",
            detalle: `Se lo dedica a los compañeros: +${enciende(a, 2)} de nivel, y no lo amonesta nadie`,
            jugadorId: j.id },
        ],
        porDefecto: "banco",
      };
    }

    case "arquero_al_area": {
      const arq = a.once.find((j) => (a.puestos.get(j.id) ?? j.posicion) === "ARQ");
      if (!arq) return null;
      return {
        tipo, minuto, segundos: 7,
        titulo: "ÚLTIMO CÓRNER",
        contexto: "Se termina el partido y hay uno de esquina. Es la última pelota.",
        opciones: [
          { id: "arquero", etiqueta: `Que suba ${apellido(arq)}`,
            detalle: "Un cuerpo más ahí adentro. Y tu arco, vacío" },
          { id: "normal", etiqueta: "Centro y a rezar",
            detalle: "Lo de siempre. Si la rechazan no pasa nada" },
        ],
        porDefecto: "normal",
      };
    }

    case "cerrar_o_seguir": {
      const arriba = (marcador?.[0] ?? 1) > (marcador?.[1] ?? 0);
      return {
        tipo, minuto, segundos: 8,
        titulo: arriba ? "GANÁS POR UNO" : "PERDÉS POR UNO",
        contexto: arriba
          ? "Quedan veinte minutos con la mínima. Cómo te parés de acá al final " +
            "vale para todo lo que viene."
          : "Quedan veinte minutos y estás uno abajo. Hay tiempo, pero no tanto.",
        opciones: [
          { id: "cerrar", etiqueta: "Meterse atrás",
            detalle: `Te llegan ${cuantoMenos(P.actitudDefensa.defensivo)}% menos, ` +
              `y llegás ${cuantoMenos(P.actitudAtaque.defensivo)}% menos` },
          { id: "seguir", etiqueta: "No cambiar nada",
            detalle: "Se sigue jugando igual que hasta acá: 0% para los dos lados" },
          { id: "matarlo", etiqueta: arriba ? "Ir por el segundo" : "Tirarse encima",
            detalle: `Llegás ${cuantoMenos(P.actitudAtaque.ofensivo)}% más, pero te llegan ` +
              `${cuantoMenos(P.actitudDefensa.ofensivo)}% más y gastás piernas` },
        ],
        porDefecto: "seguir",
      };
    }

    case "mano_a_mano": {
      const del = pateadores(a, ctx)[0];
      return {
        tipo, minuto, segundos: 6,
        titulo: "MANO A MANO",
        contexto: `${apellido(del)} quedó solo contra el arquero.`,
        opciones: [
          { id: "cruzar", etiqueta: "Cruzarla",
            detalle: "Definición segura. Si falla, no pasa nada", jugadorId: del.id },
          { id: "picar", etiqueta: "Picarla",
            detalle: "Difícil. Si entra, el Defensores se viene abajo",
            jugadorId: del.id },
          { id: "aguantar", etiqueta: "Aguantar y asistir",
            detalle: "El que llega la tiene más fácil, pero si la pierde te matan de contra",
            jugadorId: del.id },
        ],
        porDefecto: "cruzar",
      };
    }
  }
}

// ---------------------------------------------------------------- resolución

export function resolverMomento(
  m: Momento, opcionId: string, a: Alineacion, ctx: ContextoPartido, rng: Rng,
): ResueltoMomento {
  const buscar = (id?: string) => a.once.find((j) => j.id === id);
  const nivel = (j: Jugador) =>
    nivelEfectivo(j, a.puestos.get(j.id) ?? j.posicion, ctx);

  switch (m.tipo) {
    case "penal_favor": {
      const j = buscar(opcionId) ?? buscar(m.porDefecto)!;
      let p = 0.54 + (nivel(j) - 55) * 0.010;
      if (j.rasgos.includes("definidor")) p += 0.09;
      if (j.rasgos.includes("definicion_irregular")) p += rng.entre(-0.16, 0.10);
      if (j.condicion < 50) p -= 0.07;
      const mete = rng.chance(Math.max(0.32, Math.min(0.93, p)));
      const media = a.once.reduce((s, x) => s + x.nivel, 0) / Math.max(1, a.once.length);
      if (mete) {
        return {
          exito: true, golOlimpia: true,
          // al que se hacía cargo y la mete le queda para bien, y al pibe más
          golpeAnimo: { id: j.id, delta: Math.round(14 * pesoDeFallar(j, media)) },
          texto: j.edad <= 23
            ? `GOL. Se hizo cargo ${apellido(j)}, con todo el estadio mirándolo. No se olvida más.`
            : `GOL. ${apellido(j)} lo cambió por gol sin dudarlo.`,
        };
      }
      const peso = pesoDeFallar(j, media);
      return {
        exito: false,
        /*
         * Errarlo pega fuerte y a propósito. Con un castigo chico el mejor
         * pateador seguía siendo la respuesta obvia siempre; así, el que la
         * manda afuera baja su propio nivel efectivo y la próxima vez que haya
         * un penal ya no es el de más chance. La decisión no está solo en este
         * penal: está en lo que le dejás encima al resto de la temporada.
         */
        golpeAnimo: { id: j.id, delta: -Math.round(45 * peso) },
        texto: peso >= 0.6
          ? `${apellido(j)} lo tiró afuera y se quedó mirando el piso. No se va a reponer hoy.`
          : `${apellido(j)} lo tiró afuera. Levanta la mano y sigue como si nada.`,
      };
    }

    case "penal_contra": {
      const z = zonaDelArquero(a, ctx, opcionId);
      if (!z) return { exito: false, golRival: true, texto: "Gol del rival." };
      /*
       * Adónde va la pelota, de palo a palo. No se sortea si la ataja: se
       * sortea dónde pega y se mira si eso cae adentro de lo que el arquero
       * tapó. Es lo mismo que ve el jugador en la barra.
       */
      const donde = rng.next();
      const ataja = donde >= z.desde && donde <= z.hasta;
      const cerca = !ataja && Math.min(Math.abs(donde - z.desde), Math.abs(donde - z.hasta)) < 0.07;
      return {
        exito: ataja,
        golRival: !ataja,
        dondeFue: donde,
        texto: ataja
          ? `¡LA ATAJÓ! ${apellido(z.arquero)} llegó y la sacó. Se salvó Olimpia.`
          : cerca
            ? `${apellido(z.arquero)} la rozó con los dedos y se metió igual. Gol del rival.`
            : `${apellido(z.arquero)} se tiró para el otro lado. Gol del rival.`,
      };
    }

    case "tiro_libre": {
      if (opcionId === "arco") {
        const j = buscar(m.opciones[0].jugadorId)!;
        const mete = rng.chance(Math.max(0.05, 0.08 + (nivel(j) - 60) * 0.008));
        return {
          exito: mete, golOlimpia: mete,
          levantaHinchada: mete ? 8 : undefined,
          texto: mete
            ? `GOLAZO. ${apellido(j)} la puso en el ángulo. No hay arquero.`
            : `${apellido(j)} la mandó a la barrera.`,
        };
      }
      {
        const c = cabeceador(a, ctx);
        const mete = rng.chance(c?.chance ?? 0.13);
        if (mete && c) {
          return { exito: true, golOlimpia: true,
            texto: `GOL. Centro al área y ${apellido(c.j)} le ganó a todos de cabeza.` };
        }
        const r = riesgoDe(m, "centro");
        if (r && rng.chance(r.contra)) {
          return { exito: false, golRival: true, porElRiesgo: true,
            texto: "Rechazaron el centro y salieron de contra con todos arriba. Gol del rival." };
        }
        return { exito: false, texto: "El centro pasó largo y no llegó nadie." };
      }
    }

    case "jugador_caliente": {
      const j = buscar(m.opciones[0].jugadorId)!;
      if (opcionId === "sacar") {
        return { exito: true, gastaCambio: j.id,
          texto: `Sale ${apellido(j)} antes de que sea tarde. Decisión fría.` };
      }
      if (opcionId === "hablar") {
        const calma = rng.chance(0.58);
        if (calma) {
          return { exito: true, enciendeAlEquipo: 6,
            texto: `${apellido(j)} escuchó, bajó un cambio y siguió metiendo.` };
        }
        const roja = rng.chance(0.35);
        return { exito: !roja, rojaA: roja ? j.id : undefined,
          texto: roja
            ? `ROJA. ${apellido(j)} no entendió nada y se fue expulsado. Olimpia con diez.`
            : `${apellido(j)} dijo que sí y siguió igual de caliente. Por ahora zafó.` };
      }
      const roja = rng.chance(0.32);
      return { exito: !roja, rojaA: roja ? j.id : undefined,
        levantaHinchada: roja ? undefined : 10,
        enciendeAlEquipo: roja ? undefined : 12,
        texto: roja
          ? `ROJA. Era cuestión de tiempo. ${apellido(j)} se va y quedan diez.`
          : `${apellido(j)} siguió al límite, metió otra y la tribuna se vino abajo.` };
    }

    case "penal_ultima": {
      const j = buscar(opcionId) ?? buscar(m.porDefecto)!;
      // sobre la hora pesa la experiencia, no solo el pie
      let p = 0.48 + (nivel(j) - 55) * 0.009;
      p += Math.min(0.12, j.partidos_internacionales * 0.002);
      if (j.edad <= 21) p -= 0.09;
      if (j.rasgos.includes("definidor")) p += 0.08;
      if (j.rasgos.includes("definicion_irregular")) p += rng.entre(-0.20, 0.08);
      const mete = rng.chance(Math.max(0.25, Math.min(0.92, p)));
      return {
        exito: mete, golOlimpia: mete,
        texto: mete
          ? `¡GOL! ${apellido(j)} lo definió sobre la hora. Se lo dio vuelta al partido.`
          : `${apellido(j)} la mandó afuera en la última. No lo va a olvidar.`,
      };
    }

    case "rival_con_diez": {
      /*
       * Las tres hacen algo. Antes devolvían un texto y nada más: tres
       * opciones, cero consecuencias, la decisión más falsa del juego.
       */
      if (opcionId === "ahogar") {
        return { exito: true, cambiaActitud: "ofensivo", cansaAlRival: 8,
          texto: "Olimpia se va con todo arriba. El rival no puede salir de su área." };
      }
      if (opcionId === "abrir") {
        return { exito: true, cambiaActitud: "equilibrado", cansaAlRival: 16,
          texto: "Olimpia abre la cancha y lo hace correr de lado a lado. Los diez ya no llegan." };
      }
      return { exito: true, cambiaActitud: "defensivo",
        texto: "Olimpia administra la ventaja sin apurarse." };
    }

    case "festejo": {
      const j = buscar(m.opciones[0].jugadorId);
      if (!j) return { exito: true, texto: "Lo festejó el equipo entero." };
      if (opcionId === "banco") {
        return { exito: true, levantaHinchada: 4, enciendeAlEquipo: 2,
          texto: `${apellido(j)} corrió al banco a abrazarse con los suplentes.` };
      }
      const zafa = rng.chance(opcionId === "tribuna" ? 0.82 : 0.62);
      const premio = opcionId === "tribuna" ? 10 : 16;
      if (zafa) {
        return { exito: true, levantaHinchada: premio,
          enciendeAlEquipo: opcionId === "tribuna" ? 4 : 7,
          texto: opcionId === "tribuna"
            ? `${apellido(j)} se fue a la popular y el Defensores se vino abajo.`
            : `${apellido(j)} lo gritó de cara a la hinchada rival. Se pudrió todo, pero zafó.` };
      }
      return {
        exito: false, amarillaA: j.id, levantaHinchada: Math.round(premio * 0.6),
        // la amarilla enfría lo que el festejo había prendido
        enciendeAlEquipo: opcionId === "tribuna" ? 1 : 2,
        texto: opcionId === "tribuna"
          ? `${apellido(j)} se sacó la camiseta y vio la amarilla. Valió la pena igual.`
          : `Amarilla a ${apellido(j)} por provocar. Ahora juega condicionado.`,
      };
    }

    case "arquero_al_area": {
      const arq = a.once.find((j) => (a.puestos.get(j.id) ?? j.posicion) === "ARQ")!;
      const c = cabeceador(a, ctx)?.chance ?? 0.13;
      if (opcionId === "arquero") {
        if (rng.chance(acotar(c * 1.35, 0.1, 0.4))) {
          return { exito: true, golOlimpia: true, levantaHinchada: 20,
            texto: `¡LA METIÓ ${apellido(arq).toUpperCase()}! El arquero, en la última pelota. ` +
              "Esto no se olvida más." };
        }
        const r = riesgoDe(m, "arquero");
        if (r && rng.chance(r.contra)) {
          return { exito: false, golRival: true, porElRiesgo: true,
            texto: `Rechazaron el córner y la mandaron al arco vacío. ${apellido(arq)} ` +
              "todavía estaba volviendo." };
        }
        return { exito: false, texto: "Se despejó el córner y ahí nomás sonó el final." };
      }
      const mete = rng.chance(acotar(c * 0.6, 0.04, 0.2));
      return { exito: mete, golOlimpia: mete,
        levantaHinchada: mete ? 12 : undefined,
        texto: mete
          ? "GOL EN LA ÚLTIMA. Centro, cabezazo y adentro. No lo puede creer nadie."
          : "El centro se fue largo y ahí terminó todo." };
    }

    case "cerrar_o_seguir": {
      if (opcionId === "cerrar") {
        return { exito: true, cambiaActitud: "defensivo",
          texto: "Olimpia se mete atrás a defender el resultado." };
      }
      if (opcionId === "matarlo") {
        return { exito: true, cambiaActitud: "ofensivo",
          texto: "Olimpia va a buscar el segundo para liquidarlo." };
      }
      return { exito: true, cambiaActitud: "equilibrado",
        texto: "No se toca nada. Se sigue igual que hasta acá." };
    }

    case "mano_a_mano": {
      const j = buscar(m.opciones[0].jugadorId)!;
      const base = (nivel(j) - 55) * 0.010;
      let p = opcionId === "cruzar" ? 0.48 + base
        : opcionId === "picar" ? 0.34 + base
        : 0.58 + base;
      if (j.rasgos.includes("definidor")) p += 0.08;
      if (j.rasgos.includes("definicion_irregular")) p += rng.entre(-0.18, 0.10);
      const mete = rng.chance(Math.max(0.15, Math.min(0.9, p)));
      const textos: Record<string, [string, string]> = {
        cruzar: [`GOL. ${apellido(j)} la cruzó al segundo palo. Impecable.`,
                 `${apellido(j)} la cruzó y se fue a centímetros del palo.`],
        picar: [`GOLAZO. ${apellido(j)} se la picó al arquero. Una obra de arte.`,
                `${apellido(j)} quiso picarla y se la comió el arquero.`],
        aguantar: [`GOL. ${apellido(j)} aguantó, esperó al que llegaba y se la dejó servida.`,
                   `${apellido(j)} esperó demasiado y lo terminaron cerrando.`],
      };
      const [ok, mal] = textos[opcionId] ?? textos.cruzar;
      if (mete) {
        return { exito: true, golOlimpia: true, texto: ok,
          levantaHinchada: opcionId === "picar" ? 9 : undefined };
      }
      // lo que se arriesgó al elegir: si salió mal, puede terminar en contra
      const r = riesgoDe(m, opcionId);
      if (r && rng.chance(r.contra)) {
        return { exito: false, golRival: true, porElRiesgo: true,
          texto: `${mal} Y el rival salió de contra: gol en contra.` };
      }
      return { exito: false, texto: mal };
    }
  }
}
