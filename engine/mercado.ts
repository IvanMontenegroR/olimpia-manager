import fichajesJson from "@/data/fichajes.json";
import { Rng } from "./rng.ts";
import { LINEA_DE, type Jugador, type Posicion, type Rasgo } from "./tipos.ts";

/**
 * Mercado de pases, versión mínima del documento: comprar, vender y nada de
 * scouting. El condimento regional obligatorio es el cupo de extranjeros, que
 * se controla al armar el once, así que fichar a un extranjero tiene costo de
 * oportunidad además de precio.
 */

const CLUBES_COMPRADORES = [
  "Racing", "Vélez", "Cruzeiro", "Talleres", "Athletico Paranaense",
  "Independiente", "Peñarol", "Universidad Católica", "Bahia", "Estudiantes",
];

/**
 * A quién podés traer.
 *
 * Antes eran nombres inventados y daba lo mismo cualquiera: fichabas un número.
 * Estos existen, se reconocen y cada uno trae lo suyo, que es lo que hace que
 * la decisión tenga cara.
 */
interface FichajeDelCatalogo {
  id: string;
  nombre: string;
  apellido: string;
  posicion: Posicion;
  edad: number;
  nacionalidad: string;
  nivel: number;
  /** Hasta dónde puede llegar, en los que todavía crecen. */
  potencial?: number;
  de: string;
  rasgos: Rasgo[];
  nota: string;
}

export const CATALOGO = fichajesJson as FichajeDelCatalogo[];

/**
 * Cada cuántos niveles el precio se multiplica por diez.
 *
 * Es la única perilla que decide cuánto separa a un bueno de un crack: con 15,
 * tres niveles de diferencia son un 58% más caro y seis niveles son el triple.
 */
export const NIVELES_POR_DECADA = 20;

/**
 * Cuánto descuenta o encarece la edad, como curva y no como escalón.
 *
 * Esto era una escalera de cinco tramos que iba de 1.3 a 0.5, y tenía dos
 * problemas grandes. El primero: los saltos caían en cualquier lado, así que
 * cumplir 33 años te bajaba el precio un 24% de un día para el otro y Gómez
 * (77 años, digo, nivel 77 y 33 años) salía más barato que Almirón, que es uno
 * menos y un año más joven.
 *
 * El segundo es peor. Entre la punta joven y la vieja había 2.6 veces de
 * diferencia, y como quince niveles multiplican por diez, 2.6 veces son casi
 * cinco niveles: la edad le ganaba al nivel y el mercado quedaba desordenado
 * de verdad, con jugadores de 77 más baratos que otros de 74.
 *
 * Ahora es continua y va de 1.07 a 0.86, o sea 1.24 veces de punta a punta,
 * que es MENOS que lo que valen dos niveles (10^(2/20) = 1.26). Así el orden
 * por nivel no se puede dar vuelta salvo entre vecinos, y eso lo chequea
 * `scripts/plantillas.ts` para que no se rompa al cargar un jugador nuevo.
 *
 * Que sea tan achatada no es que la edad no importe: importa muchísimo, pero
 * en otro lado. Un veterano se rompe más, rinde menos cada año y se retira, y
 * todo eso ya está en el juego y a la vista. Meterlo otra vez en el precio era
 * cobrarlo dos veces, y encima al precio de romper el orden del mercado.
 */
const CURVA_EDAD: [edad: number, factor: number][] = [
  [20, 1.03], [24, 1.07], [28, 1.04], [31, 0.99],
  [34, 0.94], [37, 0.90], [40, 0.87], [43, 0.86],
];

export function factorEdad(edad: number): number {
  const c = CURVA_EDAD;
  if (edad <= c[0][0]) return c[0][1];
  for (let i = 1; i < c.length; i++) {
    const [e0, v0] = c[i - 1], [e1, v1] = c[i];
    if (edad <= e1) return v0 + ((v1 - v0) * (edad - e0)) / (e1 - e0);
  }
  return c[c.length - 1][1];
}

/**
 * Precio de referencia, en escala logarítmica sobre el nivel.
 *
 * Es la misma curva para todo el juego: el refuerzo del mercado, la estrella
 * que aparece una vez al año y lo que te ofrecen por los tuyos. Antes las
 * estrellas tenían el precio escrito a mano en el JSON y quedó cualquier cosa:
 * Enciso, que juega en la Premier y tiene veintidós años, salía seis millones,
 * menos que Neymar y casi lo mismo que Icardi, que le lleva once años.
 */
export const precioDe = (nivel: number, edad: number) =>
  Math.round(
    (150_000 * Math.pow(10, (nivel - 45) / NIVELES_POR_DECADA) * factorEdad(edad)) / 10_000,
  ) * 10_000;

export interface FichajeGenerado {
  id: string;
  nombre: string;
  apellido: string;
  posicion: Posicion;
  edad: number;
  nacionalidad: string;
  extranjero: boolean;
  nivel: number;
  /**
   * Hasta dónde puede llegar, si es de los que todavía crecen. Un pibe de
   * veinte a 64 no se ve atractivo al lado de un veterano a 71, y sin embargo
   * es el mejor negocio del mercado: lo que lo hace atractivo es el techo, así
   * que hay que mostrarlo.
   */
  potencial?: number;
  precioUsd: number;
  sueldoUsd: number;
  valorComercial: number;
  /** Lo que sabe hacer, para que no sean todos el mismo número. */
  rasgos: Rasgo[];
  /** De dónde viene y por qué te suena. */
  de: string;
  nota: string;
}

/** Cuántos de cada línea juegan, para saber a quién le tiene que ganar. */
const TITULARES_POR_LINEA: Record<string, number> = { ARQ: 1, DEF: 4, MED: 3, DEL: 3 };

/**
 * Solo los que te mejoran el once.
 *
 * El mercado sorteaba del catálogo entero, así que la mitad de lo que te
 * ofrecía era peor que tu titular de ese puesto: nadie paga dos millones por
 * un central que va a mirar el partido desde el banco.
 *
 * La vara es ganarle al más flojo de los que hoy juegan en su línea, no al
 * mejor. Contra el mejor sería imposible: si tenés un nueve de 74, no habría
 * un solo delantero del catálogo que pase, y el mercado se quedaría sin
 * delanteros para siempre. Ganarle a uno de los once es lo que lo convierte en
 * un refuerzo de verdad.
 */
function mejoraAlPlantel(f: { posicion: Posicion; nivel: number }, plantel: PlantelBase): boolean {
  const linea = LINEA_DE[f.posicion];
  const suyos = plantel.filter((j) => LINEA_DE[j.posicion] === linea)
    .sort((a, b) => b.nivel - a.nivel);
  if (!suyos.length) return true;
  const cuantos = TITULARES_POR_LINEA[linea] ?? 3;
  const masFlojoQueJuega = suyos[Math.min(cuantos, suyos.length) - 1].nivel;
  return f.nivel > masFlojoQueJuega;
}

type PlantelBase = { posicion: Posicion; nivel: number }[];

export function generarMercado(
  semilla: string, cantidad = 6, yaEstan: string[] = [], plantel: PlantelBase = [],
): FichajeGenerado[] {
  const rng = new Rng(`mercado-${semilla}`);
  const dentro = new Set(yaEstan);
  const utiles = CATALOGO.filter((f) => !dentro.has(f.id) && mejoraAlPlantel(f, plantel));
  /*
   * Si ya sos tan bueno que nadie del catálogo te mejora, el mercado no queda
   * vacío: se muestra lo mejor que hay, que es la señal de que a esta altura
   * los refuerzos ya no vienen de acá sino de una estrella.
   */
  const libres = utiles.length >= cantidad ? utiles
    : [...CATALOGO.filter((f) => !dentro.has(f.id))]
        .sort((a, b) => b.nivel - a.nivel).slice(0, Math.max(cantidad, 8));
  const lista: FichajeGenerado[] = [];
  const usados = new Set<string>();

  /*
   * Los buenos salen más seguido.
   *
   * Antes se elegían seis al azar parejo, y como el grueso del catálogo está
   * entre 70 y 73, los de 74 para arriba casi no aparecían: abrías fichajes y
   * te ofrecían gente del nivel de tus suplentes, así que no daban ganas de
   * comprar a nadie. El peso es el cubo de cuánto sobresale sobre el más
   * flojo de la lista, que sube fuerte sin dejar afuera a los demás: un 77
   * aparece bastante más que un 70, pero el 70 sigue existiendo.
   */
  const piso = Math.min(...libres.map((f) => f.nivel));
  const peso = (f: { nivel: number }) => Math.pow(f.nivel - piso + 1, 3);
  const total = libres.reduce((n, f) => n + peso(f), 0);
  const sortear = () => {
    let t = rng.next() * total;
    for (const f of libres) { t -= peso(f); if (t <= 0) return f; }
    return libres[libres.length - 1];
  };

  let vueltas = 0;
  while (lista.length < cantidad && usados.size < libres.length && vueltas < 400) {
    vueltas++;
    const f = sortear();
    if (usados.has(f.id)) continue;
    usados.add(f.id);
    const extranjero = f.nacionalidad !== "PAR";
    lista.push({
      id: f.id,
      nombre: f.nombre,
      apellido: f.apellido,
      posicion: f.posicion,
      edad: f.edad,
      nacionalidad: f.nacionalidad,
      extranjero,
      nivel: f.nivel,
      potencial: f.potencial,
      precioUsd: precioDe(f.nivel, f.edad),
      sueldoUsd: Math.round((f.nivel - 40) * 900),
      valorComercial: extranjero && f.edad <= 28 ? 3 : f.edad <= 31 ? 2 : 1,
      rasgos: f.rasgos,
      de: f.de,
      nota: f.nota,
    });
  }
  return lista;
}

const clampNivel = (n: number) => Math.max(50, Math.min(78, n));

/** Llegan ofertas por los mejores, que es cuando duele decidir. */
/** Cuánto más lo llaman al que pusiste en la lista. */
export const PESO_TRANSFERIBLE = 4;

export function sortearOferta(plantel: Jugador[], semilla: string, transferibles: string[] = []) {
  const rng = new Rng(`oferta-${semilla}`);
  const enLista = new Set(transferibles);
  /*
   * Al de la lista lo llaman aunque no sea de los mejores: ese es el punto de
   * ponerlo. Sin esta excepción, listar a un suplente de 61 no servía para
   * nada porque el corte de nivel lo dejaba afuera del sorteo igual.
   */
  const candidatos = plantel.filter(
    (j) => (j.nivel >= 63 || enLista.has(j.id)) && !j.lesionado_hasta);
  if (!candidatos.length) return null;

  /*
   * Y pesa cuatro veces más. Cuatro y no cien: ofrecerlo hace que suene el
   * teléfono por él, no que el mercado se olvide de que existe el resto.
   */
  const peso = (j: Jugador) =>
    Math.pow(2, (j.nivel - 60) / 4) * (enLista.has(j.id) ? PESO_TRANSFERIBLE : 1);
  const total = candidatos.reduce((s, j) => s + peso(j), 0);
  let r = rng.next() * total;
  let elegido = candidatos[candidatos.length - 1];
  for (const j of candidatos) { r -= peso(j); if (r <= 0) { elegido = j; break; } }

  /**
   * Que el jugador quiera irse o no es lo que decide si rechazar la oferta le
   * cae mal. Antes se enojaban todos por igual, que no tiene sentido: al que
   * está cómodo en el club le da lo mismo, y al que está caliente o es joven
   * con una vidriera afuera sí le duele quedarse.
   */
  const joven = elegido.edad <= 24;
  const dolido = (elegido.animo ?? 70) < 55;
  /* Al que pusiste en la lista ya le dijiste que sobra: casi siempre quiere ir. */
  const chanceDeQuererse = (joven ? 0.35 : 0.15) + (dolido ? 0.35 : 0)
    + (enLista.has(elegido.id) ? 0.45 : 0);
  const quiereIrse = rng.chance(Math.min(0.9, chanceDeQuererse));

  const base = precioDe(elegido.nivel, elegido.edad);
  return {
    jugadorId: elegido.id,
    club: rng.elegir(CLUBES_COMPRADORES),
    montoUsd: Math.round((base * rng.entre(0.75, 1.6)) / 10_000) * 10_000,
    quiereIrse,
  };
}
