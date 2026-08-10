import { Rng } from "./rng.ts";
import { P, clamp, fuerzas, nivelEfectivo } from "./motor.ts";
import { generarMomento, type Momento } from "./momentos.ts";
import type { Alineacion, ContextoPartido, Jugador, Posicion } from "./tipos.ts";

export type TipoEvento =
  | "inicio" | "gol" | "gol_rival" | "ocasion" | "ocasion_rival"
  | "amarilla" | "roja" | "lesion" | "aviso_condicion"
  | "entretiempo" | "cambio" | "final" | "momento";

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
const LESION = [
  "{j} se toca atrás del muslo y pide el cambio.",
  "Queda tendido {j}. Entra el médico y no puede seguir.",
  "{j} pisó mal y se resintió. No va a poder continuar.",
  "Choque fuerte y {j} queda dolorido en el piso. No sigue.",
  "{j} hace señas al banco agarrándose el gemelo.",
];

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
    const base = p === "DEL" ? 5 : p === "MED" ? 2.2 : p === "DEF" ? 0.6 : 0;
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
): EventoRelato[] {
  const f = fuerzas(a, ctx);
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
      const j = elegirGoleador(a, ctx, rng);
      gO++;
      const p = a.puestos.get(j.id) ?? j.posicion;
      const banco = p === "DEF" ? GOL_DEF : p === "MED" ? GOL_MED
        : j.rasgos.includes("juego_aereo") && rng.chance(0.45) ? GOL_AEREO : GOL_DEL;
      push(m, "gol", "GOL. " + texto(rng, banco, j), { jugadorId: j.id });
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

  for (const j of a.once) {
    const pAm = ((j.posicion === "DEF" ? 0.16 : j.posicion === "MED" ? 0.14 : 0.08)
      * (ctx.esClasico ? 1.5 : 1) * (a.presionAlta ? 1.25 : 1)) * parte;
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
    if (rng.chance(0.006 * parte)) {
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
      const puesto = a.puestos.get(j.id) ?? j.posicion;
      sucesos.push({ min: m, hacer: () =>
        push(m, "lesion", `${texto(rng, LESION, j)} Se queda sin ${puesto}.`,
             { jugadorId: j.id, pausa: true }) });
    }
  }

  // Momentos: decisiones con el reloj corriendo. Poco frecuentes a propósito,
  // para que cuando aparezcan pesen.
  const posibles: [Parameters<typeof generarMomento>[0], number][] = [
    ["penal_favor", 0.09],
    ["penal_contra", 0.08],
    ["tiro_libre", 0.30],
    ["mano_a_mano", 0.22],
  ];
  for (const [tipo, prob] of posibles) {
    if (!rng.chance(prob * parte)) continue;
    const m = rng.entero(desde + 2, Math.max(hasta - 2, desde + 3));
    const momento = generarMomento(tipo, m, a, ctx, rng);
    if (!momento) continue;
    sucesos.push({ min: m, hacer: () =>
      push(m, "momento", momento.titulo, { pausa: true, momento }) });
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
