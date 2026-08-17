import plantelJson from "@/data/plantel_olimpia_2026.json";
import fixtureJson from "@/data/fixture_clausura2026_final.json";
import equiposJson from "@/data/equipos_2026.json";
import { nivelEfectivo } from "@/engine/motor.ts";
import type { Actitud, ContextoPartido, Jugador, Posicion } from "@/engine/tipos.ts";

export const PLANTEL = plantelJson as unknown as Jugador[];
const EQUIPOS = equiposJson as any[];
const FIXTURE = fixtureJson as any[];

/**
 * El cupo de extranjeros es del torneo local. La Conmebol no lo tiene, así que
 * en copa podés poner a los que quieras: es una de las razones por las que los
 * equipos paraguayos arman planteles con más extranjeros de los que pueden
 * usar el domingo.
 */
export const CUPO_EXTRANJEROS = 4;
export const cupoDe = (competencia: string) =>
  competencia === "sudamericana" ? Infinity : CUPO_EXTRANJEROS;
export const SUB18_DESDE = "2007-01-01";
export const esSub18 = (j: Jugador) => j.fecha_nacimiento >= SUB18_DESDE;

/**
 * Las formaciones se declaran por líneas, que es como se dibujan y como se
 * hablan: el 4-2-3-1 es cuatro atrás, doble cinco, tres por delante y un
 * punta. Antes la posición en la cancha se deducía del puesto de cada
 * jugador, y eso partía las líneas: el enganche de un 4-2-3-1 caía en una
 * franja propia en vez de ir al lado de los extremos, como corresponde.
 *
 * `x` es la profundidad, 0 el arco propio y 100 el rival. Los `y` de cada
 * línea se reparten solos a lo ancho.
 */
export interface Linea { x: number; puestos: Posicion[] }
export interface Formacion {
  nombre: string;
  descripcion: string;
  lineas: Linea[];
}

const ARQUERO: Linea = { x: 4, puestos: ["ARQ"] };

/**
 * Tres formaciones, no nueve.
 *
 * Había ocho y solo seis eran distintas para el motor: un 4-2-3-1 es un 4-3-3
 * (cuatro atrás, tres en el medio, tres arriba) y un 4-3-1-2 es un 4-4-2. Los
 * dibujos cambiaban, los números no, así que elegir entre ellos era elegir
 * entre dos nombres.
 *
 * De las seis que quedaban, estas tres son las que abren el abanico entero: se
 * diferencian en lo único que el motor lee, que es cuántos cuerpos ponés atrás.
 * Cinco, cuatro o tres. Cada una es una manera distinta de jugar el partido y
 * ninguna gana siempre:
 *
 *   5-3-2   mete 1.22   recibe 0.77
 *   4-3-3   mete 1.56   recibe 0.92
 *   3-4-3   mete 1.72   recibe 1.05
 *
 * El 4-4-2 y el 4-5-1 quedaban en el medio del 5-3-2 y el 4-3-3, aportando un
 * matiz que no se siente jugando. Mejor tres que se entienden de un vistazo.
 */
export const MOLDES: Formacion[] = [
  {
    nombre: "4-3-3", descripcion: "El equilibrio",
    lineas: [ARQUERO,
      { x: 25, puestos: ["LI", "DFC", "DFC", "LD"] },
      { x: 53, puestos: ["MC", "MCD", "MC"] },
      { x: 83, puestos: ["EI", "DC", "ED"] }],
  },
  {
    nombre: "5-3-2", descripcion: "Cinco atrás: aguantar y salir",
    lineas: [ARQUERO,
      { x: 23, puestos: ["LI", "DFC", "DFC", "DFC", "LD"] },
      { x: 53, puestos: ["MC", "MCD", "MC"] },
      { x: 85, puestos: ["DC", "DC"] }],
  },
  {
    nombre: "3-4-3", descripcion: "Tres atrás: ir a buscarlo",
    lineas: [ARQUERO,
      { x: 23, puestos: ["DFC", "DFC", "DFC"] },
      { x: 51, puestos: ["MI", "MC", "MC", "MD"] },
      { x: 83, puestos: ["EI", "DC", "ED"] }],
  },
];

/**
 * Las que se sacaron, cada una a la que más se le parece.
 *
 * Una partida guardada de antes puede tener un equipo en 4-4-2. Sin esto caía
 * en el molde por defecto y te encontrabas el once desarmado al abrirlo.
 */
const VIEJAS: Record<string, string> = {
  "4-2-3-1": "4-3-3", "4-3-1-2": "4-3-3",
  "4-4-2": "4-3-3", "4-5-1": "5-3-2", "3-5-2": "3-4-3",
};

/** Los once casilleros de una formación, de atrás hacia adelante. */
export interface Casilla { puesto: Posicion; x: number; y: number }

export function casillasDe(nombre: string): Casilla[] {
  const f = MOLDES.find((m) => m.nombre === (VIEJAS[nombre] ?? nombre)) ?? MOLDES[0];
  const casillas: Casilla[] = [];
  for (const linea of f.lineas) {
    const n = linea.puestos.length;
    // Repartidos parejo a lo ancho, con las bandas bien abiertas cuando son
    // varios y al medio cuando es uno solo.
    const desde = n === 1 ? 50 : n === 2 ? 33 : 12;
    const hasta = n === 1 ? 50 : n === 2 ? 67 : 88;
    linea.puestos.forEach((puesto, i) => {
      casillas.push({
        puesto,
        x: linea.x,
        y: n === 1 ? 50 : desde + (i / (n - 1)) * (hasta - desde),
      });
    });
  }
  return casillas;
}

export interface Asignacion {
  molde: string;
  puestos: Map<string, Posicion>;
  total: number;
  adaptados: Jugador[];
  fueraDePuesto: Jugador[];
}

export const MOLDE_DE = (nombre: string): Posicion[] =>
  casillasDe(nombre).map((c) => c.puesto);

/** Una alineación son once casilleros: el jugador que ocupa cada puesto, o nadie. */
export type Alineado = (string | null)[];

/**
 * Reparte a estos jugadores entre los casilleros de una formación, buscando el
 * mejor encaje global. Los que ya vienen con casillero asignado se respetan:
 * así arrastrar a alguien a un puesto no se deshace al recalcular.
 */
export function repartirEnMolde(
  jugadores: Jugador[], slots: Posicion[], ctx: ContextoPartido,
): Alineado {
  const alineado: Alineado = new Array(slots.length).fill(null);
  const parejas: { id: string; slot: number; valor: number }[] = [];
  for (const j of jugadores) {
    for (let s = 0; s < slots.length; s++) {
      parejas.push({ id: j.id, slot: s, valor: nivelEfectivo(j, slots[s], ctx) });
    }
  }
  parejas.sort((a, b) => b.valor - a.valor);

  const puesto = new Set<string>();
  for (const { id, slot } of parejas) {
    if (puesto.has(id) || alineado[slot]) continue;
    alineado[slot] = id;
    puesto.add(id);
  }
  return alineado;
}

/** La formación que mejor le calza a estos once, con su reparto. */
export function mejorMolde(
  jugadores: Jugador[], ctx: ContextoPartido,
): { formacion: string; alineado: Alineado } {
  const porId = new Map(jugadores.map((j) => [j.id, j]));
  let mejor = { formacion: MOLDES[0].nombre, alineado: [] as Alineado, total: -Infinity };
  for (const { nombre } of MOLDES) {
    const puestos = MOLDE_DE(nombre);
    const alineado = repartirEnMolde(jugadores, puestos, ctx);
    let total = 0;
    alineado.forEach((id, s) => {
      const j = id ? porId.get(id) : null;
      if (j) total += nivelEfectivo(j, puestos[s], ctx);
    });
    if (total > mejor.total) mejor = { formacion: nombre, alineado, total };
  }
  return { formacion: mejor.formacion, alineado: mejor.alineado };
}


export interface PartidoUI {
  ctx: ContextoPartido;
  rivalId: string;
  rivalNombre: string;
  estadio: string;
  ciudad: string;
  etiqueta: string;
}

/** Partidos de Olimpia en el Clausura, en orden. */
export function partidosDeOlimpia(): PartidoUI[] {
  const porId = Object.fromEntries(EQUIPOS.map((e) => [e.id, e]));
  return FIXTURE
    .filter((p) => p.local === "olimpia" || p.visitante === "olimpia")
    .sort((a, b) => a.fecha_numero - b.fecha_numero)
    .map((p) => {
      const esLocal = p.local === "olimpia";
      const rivalId = esLocal ? p.visitante : p.local;
      const rival = porId[rivalId];
      return {
        rivalId,
        rivalNombre: rival.nombre,
        estadio: p.estadio,
        ciudad: p.ciudad,
        etiqueta: `Clausura · Fecha ${p.fecha_numero}`,
        ctx: {
          fecha: p.fecha,
          competencia: "clausura",
          esLocal,
          rivalFuerza: rival.fuerza,
          rivalNombre: rival.nombre,
          viajeKm: p.viaje_km_olimpia ?? 0,
          alturaM: 43,
          diasDescanso: 6,
          esClasico: rivalId === "cerro_porteno",
        } satisfies ContextoPartido,
      };
    });
}

export function nivelEf(j: Jugador, puesto: Posicion, ctx: ContextoPartido): number {
  return Math.round(nivelEfectivo(j, puesto, ctx));
}

export const BANDERA: Record<string, string> = {
  PAR: "🇵🇾", URU: "🇺🇾", ARG: "🇦🇷", CHI: "🇨🇱", NZL: "🇳🇿",
  BRA: "🇧🇷", COL: "🇨🇴", ECU: "🇪🇨", PER: "🇵🇪", BOL: "🇧🇴", VEN: "🇻🇪",
};

/** Nombre corto para los marcadores, donde no entra el nombre completo. */
const CORTOS: Record<string, string> = {
  cerro_porteno: "Cerro",
  recoleta: "Recoleta",
  sportivo_ameliano: "Ameliano",
  sportivo_luqueno: "Luqueño",
  sportivo_trinidense: "Trinidense",
  san_lorenzo: "San Lorenzo",
  "2_de_mayo": "2 de Mayo",
};
export const nombreCorto = (id: string, nombre: string) =>
  CORTOS[id] ?? nombre.replace(/^(Club|Sportivo|Deportivo)\s+/i, "");

export const colorCondicion = (c: number) =>
  c >= 80 ? "var(--ok)" : c >= 60 ? "var(--medio)" : c >= 40 ? "var(--bajo)" : "var(--critico)";

/**
 * Cómo llega un jugador, en una sola cifra de 0 a 1.
 *
 * Es la fracción de su ficha que está rindiendo hoy: junta las piernas, la
 * cabeza, el puesto en el que lo ponés y lo que le pesa la cancha ajena. Un 1
 * es un jugador entero y enchufado jugando de lo suyo; abajo de eso, algo le
 * falta.
 *
 * Existe porque las dos canchas del juego dibujaban el mismo aro con dos
 * cosas distintas adentro: en la pantalla principal se llenaba con el ánimo y
 * en la de armar el once con la condición. Mismo dibujo, dos significados, y
 * como el número de abajo pasó a ser la ficha, cada pantalla te escondía la
 * mitad del estado. Este es el número que las dos muestran ahora.
 */
export function comoLlegaAlPartido(j: Jugador, puesto: Posicion, ctx: ContextoPartido): number {
  if (!j.nivel) return 1;
  return nivelEfectivo(j, puesto, ctx) / j.nivel;
}

/**
 * Cuánto del aro se llena. Abajo de 0.72 no queda nada y arriba de 1.08 está
 * lleno: ese es el rango en el que se mueve de verdad un jugador entre estar
 * fundido y estar en llamas, y estirarlo a 0-100 dejaba todos los aros
 * casi iguales.
 */
export const aroDe = (rinde: number) =>
  Math.max(0, Math.min(1, (rinde - 0.72) / 0.36));

/**
 * El color de cómo llega, en la misma escala que todo lo demás. El verde
 * arranca apenas abajo de 1 a propósito: un jugador entero con el ánimo normal
 * rinde el 99% de lo suyo y no tiene nada de malo, así que no puede verse como
 * una advertencia.
 */
export const colorComoLlega = (rinde: number) =>
  rinde >= 0.97 ? "var(--ok)" : rinde >= 0.90 ? "var(--medio)"
    : rinde >= 0.82 ? "var(--bajo)" : "var(--critico)";

/**
 * Once inicial sugerido: el mejor posible respetando el cupo de extranjeros.
 *
 * El Sub-18 entra solo si hace falta para llegar a los 900 minutos. Antes
 * entraba siempre, y como ninguno de los dos juveniles es titular por mérito
 * (Zarza es el tercer extremo izquierdo del plantel), eso costaba nivel todas
 * las fechas para cumplir una regla que se cumple con diez partidos.
 */
export function autoOnce(
  ctx: PartidoUI["ctx"], plantel: Jugador[], estadoSub18?: EstadoSub18,
): string[] {
  // Se llena el 4-3-3 slot por slot con el mejor de cada uno, en vez de por
  // línea: así no termina un lateral derecho jugando de izquierdo teniendo un
  // izquierdo natural en el banco.
  const slots: Posicion[] =
    ["ARQ", "LD", "DFC", "DFC", "LI", "MCD", "MC", "MC", "ED", "DC", "EI"];
  const elegidos: Jugador[] = [];
  const usado = new Set<string>();
  let ext = 0;

  const meter = (j: Jugador) => {
    elegidos.push(j);
    usado.add(j.id);
    if (j.extranjero) ext++;
  };

  // Solo se mete un Sub-18 si el ritmo no alcanza. Y cuando entra, consume el
  // slot que mejor le calza: si no se descuenta un slot, el molde queda de
  // doce y el último puesto se pierde al recortar.
  if (hacenFaltaMinutosSub18(estadoSub18)) {
    const sub = plantel.filter(esSub18)
      .sort((a, b) => nivelEf(b, b.posicion, ctx) - nivelEf(a, a.posicion, ctx))[0];
    if (sub) {
      meter(sub);
      const suyo = slots.indexOf(sub.posicion);
      slots.splice(suyo >= 0 ? suyo : slots.length - 1, 1);
    }
  }

  // Cada vuelta es un slot: contar por puesto natural saltea slots y deja el
  // once en diez, que es lo que trababa la pantalla.
  for (const puesto of slots) {
    const cand = plantel
      .filter((j) => !usado.has(j.id))
      .sort((a, b) => nivelEf(b, puesto, ctx) - nivelEf(a, puesto, ctx));
    const j = cand.find((c) => !c.extranjero || ext < cupoDe(ctx.competencia));
    if (j) meter(j);
  }

  // Red de seguridad por si el cupo de extranjeros dejó algún hueco.
  for (const j of [...plantel].sort((a, b) => b.nivel - a.nivel)) {
    if (elegidos.length >= 11) break;
    if (usado.has(j.id)) continue;
    if (j.extranjero && ext >= cupoDe(ctx.competencia)) continue;
    meter(j);
  }
  return elegidos.slice(0, 11).map((j) => j.id);
}

/**
 * Los siete del banco: primero un arquero, después los mejores que queden. La
 * reserva no cuenta salvo que la hayas subido a mano.
 */
/**
 * Cuántos van al banco.
 *
 * Eran siete, y eso rompía la promesa de los dos equipos guardados: armabas un
 * Alternativo de once y en el partido solo llegabas a los siete mejores, así
 * que a cuatro de los que habías elegido no los podías poner nunca. Doce es lo
 * que hace falta para que un alternativo completo entre entero, y es del orden
 * de lo que se lleva en las copas. Los cambios siguen siendo cinco: esto no
 * agranda el equipo, agranda de dónde podés elegir.
 */
export const BANCO = 12;

/**
 * Lo que se mueve el nivel de un jugador en un puesto y un contexto.
 *
 * El número que se muestra es SIEMPRE el de la ficha, el mismo con el que lo
 * fichaste. Antes el banco mostraba el nivel efectivo y la cancha el de ficha,
 * así que arrastrabas a alguien de 66 a un casillero y aparecía como 59: el
 * jugador parecía cambiar de valor por moverse de lugar. Ahora el número queda
 * quieto y lo que se mueve es esto, que va al lado y con su signo.
 */
export const deltaNivel = (j: Jugador, puesto: Posicion, ctx: ContextoPartido): number =>
  Math.round(nivelEf(j, puesto, ctx) - j.nivel);

export function bancoSugerido(
  aptos: Jugador[], once: Jugador[], ctx: ContextoPartido,
  /**
   * Los que tienen preferencia para el banco, en general el otro equipo que
   * dejaste guardado. Sin esto el banco se llenaba con los de más nivel a
   * secas, y un jugador que vos pusiste en el Alternativo podía quedar afuera
   * por alguien que ni figura en tus equipos.
   */
  prioridad?: Iterable<string>,
): Jugador[] {
  const dentro = new Set(once.map((j) => j.id));
  const libres = aptos.filter((j) => !dentro.has(j.id) && !j.reserva);
  const porNivel = (a: Jugador, b: Jugador) =>
    nivelEf(b, b.posicion, ctx) - nivelEf(a, a.posicion, ctx);
  const prefe = new Set(prioridad ?? []);
  // el arquero suplente va sí o sí: si se lesiona el titular no hay reemplazo
  const arquero = libres.filter((j) => j.posicion === "ARQ").sort(porNivel)[0];
  const resto = libres
    .filter((j) => j.id !== arquero?.id)
    .sort((a, b) => (prefe.has(b.id) ? 1 : 0) - (prefe.has(a.id) ? 1 : 0) || porNivel(a, b));
  return [
    ...(arquero ? [arquero] : []),
    ...resto.slice(0, BANCO - (arquero ? 1 : 0)),
  ];
}

/**
 * El equipo con el que sale Olimpia si no tocás nada. Lo usan el botón de
 * jugar directo y la pantalla de armado, así que los dos parten de lo mismo.
 */
export interface EstadoSub18 {
  minutos: number;
  partidosRestantes: number;
}

/**
 * Si al ritmo actual no se llega a los 900, ya conviene poner al juvenil. Solo
 * cuentan los partidos completos, así que hacen falta diez.
 */
export function hacenFaltaMinutosSub18(e?: EstadoSub18): boolean {
  if (!e) return false;
  const faltan = Math.max(0, SUB18_META_MINUTOS - e.minutos);
  if (faltan === 0) return false;
  return faltan >= e.partidosRestantes * 60;
}

export const SUB18_META_MINUTOS = 900;

export function salidaAutomatica(
  partido: PartidoUI, plantel: Jugador[], estadoSub18?: EstadoSub18,
) {
  const { ctx } = partido;
  const aptos = plantel.filter((j) => !j.suspendido && !j.lesionado_hasta);
  const porId = new Map(aptos.map((j) => [j.id, j]));

  const elegidos = autoOnce(ctx, aptos.filter((j) => !j.reserva), estadoSub18)
    .map((id) => porId.get(id)!).filter(Boolean);
  const { formacion, alineado } = mejorMolde(elegidos, ctx);
  const slots = MOLDE_DE(formacion);

  const once = alineado.map((id) => (id ? porId.get(id) : null)).filter(Boolean) as Jugador[];
  const puestos = new Map<string, Posicion>();
  alineado.forEach((id, s) => { if (id) puestos.set(id, slots[s]); });

  return {
    once,
    // la formación se devuelve para poder dibujar el once en la cancha
    formacion,
    suplentes: bancoSugerido(aptos, once, ctx),
    actitud: (ctx.esLocal ? "ofensivo" : "equilibrado") as Actitud,
    puestos,
  };
}
