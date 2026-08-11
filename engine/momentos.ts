import { Rng } from "./rng.ts";
import { nivelEfectivo } from "./motor.ts";
import { LINEA_DE, type Alineacion, type ContextoPartido, type Jugador } from "./tipos.ts";

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
  | "penal_ultima" | "rival_con_diez";

export interface OpcionMomento {
  id: string;
  etiqueta: string;
  detalle: string;
  jugadorId?: string;
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
  golOlimpia?: boolean;
  golRival?: boolean;
  rojaA?: string;
  amarillaA?: string;
  gastaCambio?: string;
}

const apellido = (j: Jugador) => j.apellido;

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
): Momento | null {
  switch (tipo) {
    case "penal_favor": {
      const tres = pateadores(a, ctx).slice(0, 3);
      if (tres.length < 2) return null;
      return {
        tipo, minuto, segundos: 9,
        titulo: "PENAL A FAVOR",
        contexto: "Lo derribaron en el área. ¿Quién lo patea?",
        opciones: tres.map((j) => ({
          id: j.id,
          etiqueta: `${j.numero} ${apellido(j)}`,
          detalle: j.rasgos.includes("definidor") ? "Definidor, no falla estas"
            : j.rasgos.includes("definicion_irregular") ? "Habilidoso, pero irregular"
            : `Nivel ${Math.round(nivelEfectivo(j, a.puestos.get(j.id) ?? j.posicion, ctx))}`,
          jugadorId: j.id,
        })),
        porDefecto: tres[0].id,
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
          { id: "izq", etiqueta: "Izquierda", detalle: "Se juega a adivinar" },
          { id: "centro", etiqueta: "Quedarse", detalle: "Menos común, sorprende" },
          { id: "der", etiqueta: "Derecha", detalle: "Se juega a adivinar" },
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
            detalle: `La pega ${apellido(tirador)}`, jugadorId: tirador.id },
          { id: "centro", etiqueta: "Centro al área",
            detalle: aereo.length ? `${apellido(aereo[0])} gana arriba` : "Sin nadie fuerte de cabeza" },
          { id: "corta", etiqueta: "Jugarla corta",
            detalle: "Poco riesgo, poca chance" },
        ],
        porDefecto: "corta",
      };
    }

    case "jugador_caliente": {
      const j = a.once.find((x) => x.id === jugadorId);
      if (!j) return null;
      return {
        tipo, minuto, segundos: 8,
        titulo: "VA CALIENTE",
        contexto: `${apellido(j)} ya tiene amarilla y sigue yendo fuerte. Te lo van a echar.`,
        opciones: [
          { id: "sacar", etiqueta: "Sacarlo", detalle: "Te gasta un cambio", jugadorId: j.id },
          { id: "hablar", etiqueta: "Hablarle", detalle: "Puede que se calme", jugadorId: j.id },
          { id: "dejar", etiqueta: "Dejarlo", detalle: "Riesgo de roja", jugadorId: j.id },
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
        opciones: [
          { id: "ahogar", etiqueta: "Ahogarlo arriba",
            detalle: "Máxima presión, desgasta mucho" },
          { id: "abrir", etiqueta: "Abrir la cancha",
            detalle: "Cansarlo moviendo la pelota" },
          { id: "sostener", etiqueta: "No cambiar nada",
            detalle: "Administrar sin regalar nada" },
        ],
        porDefecto: "sostener",
      };
    }

    case "mano_a_mano": {
      const del = pateadores(a, ctx)[0];
      return {
        tipo, minuto, segundos: 6,
        titulo: "MANO A MANO",
        contexto: `${apellido(del)} quedó solo contra el arquero.`,
        opciones: [
          { id: "cruzar", etiqueta: "Cruzarla", detalle: "Lo más probable", jugadorId: del.id },
          { id: "picar", etiqueta: "Picarla", detalle: "Si sale, es golazo", jugadorId: del.id },
          { id: "aguantar", etiqueta: "Aguantar y asistir", detalle: "Busca al que llega", jugadorId: del.id },
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
      let p = 0.58 + (nivel(j) - 55) * 0.006;
      if (j.rasgos.includes("definidor")) p += 0.09;
      if (j.rasgos.includes("definicion_irregular")) p += rng.entre(-0.16, 0.10);
      if (j.condicion < 50) p -= 0.07;
      const mete = rng.chance(Math.max(0.32, Math.min(0.93, p)));
      return {
        exito: mete,
        golOlimpia: mete,
        texto: mete
          ? `GOL. ${apellido(j)} lo cambió por gol sin dudarlo.`
          : `${apellido(j)} lo tiró afuera. Se agarra la cabeza.`,
      };
    }

    case "penal_contra": {
      const arq = a.once.find((j) => (a.puestos.get(j.id) ?? j.posicion) === "ARQ")!;
      const lado = rng.elegir(["izq", "centro", "der"]);
      const acerto = lado === opcionId;
      let p = acerto ? 0.34 + (nivel(arq) - 60) * 0.008 : 0.05;
      if (opcionId === "centro" && acerto) p += 0.08;
      const ataja = rng.chance(Math.max(0.02, Math.min(0.7, p)));
      return {
        exito: ataja,
        golRival: !ataja,
        texto: ataja
          ? `¡LA ATAJÓ! ${apellido(arq)} adivinó y la sacó. Se salvó Olimpia.`
          : acerto
            ? `${apellido(arq)} llegó a rozarla pero se metió igual. Gol del rival.`
            : `${apellido(arq)} se tiró para el otro lado. Gol del rival.`,
      };
    }

    case "tiro_libre": {
      if (opcionId === "arco") {
        const j = buscar(m.opciones[0].jugadorId)!;
        const mete = rng.chance(Math.max(0.05, 0.10 + (nivel(j) - 60) * 0.004));
        return {
          exito: mete, golOlimpia: mete,
          texto: mete
            ? `GOLAZO. ${apellido(j)} la puso en el ángulo. No hay arquero.`
            : `${apellido(j)} la mandó a la barrera.`,
        };
      }
      if (opcionId === "centro") {
        const aereo = a.once.filter((x) => x.rasgos.includes("juego_aereo"));
        const cabeceador = aereo.length
          ? aereo.sort((x, y) => nivel(y) - nivel(x))[0]
          : [...a.once].filter((x) => (a.puestos.get(x.id) ?? x.posicion) !== "ARQ")
              .sort((x, y) => nivel(y) - nivel(x))[0];
        const mete = rng.chance(aereo.length ? 0.20 : 0.11);
        return {
          exito: mete, golOlimpia: mete,
          texto: mete
            ? `GOL. Centro al área y ${apellido(cabeceador)} le ganó a todos de cabeza.`
            : `El centro pasó largo y no llegó nadie.`,
        };
      }
      const mete = rng.chance(0.07);
      return {
        exito: mete, golOlimpia: mete,
        texto: mete
          ? `GOL. La jugaron corta, sorprendieron a la defensa y la metieron.`
          : `La jugaron corta y terminaron perdiendo la pelota. Sin riesgo, sin premio.`,
      };
    }

    case "jugador_caliente": {
      const j = buscar(m.opciones[0].jugadorId)!;
      if (opcionId === "sacar") {
        return { exito: true, gastaCambio: j.id,
          texto: `Sale ${apellido(j)} antes de que sea tarde. Decisión fría.` };
      }
      if (opcionId === "hablar") {
        const calma = rng.chance(0.58);
        if (calma) return { exito: true, texto: `${apellido(j)} escuchó y bajó un cambio.` };
        const roja = rng.chance(0.35);
        return { exito: !roja, rojaA: roja ? j.id : undefined,
          texto: roja
            ? `ROJA. ${apellido(j)} no entendió nada y se fue expulsado. Olimpia con diez.`
            : `${apellido(j)} dijo que sí y siguió igual de caliente. Por ahora zafó.` };
      }
      const roja = rng.chance(0.32);
      return { exito: !roja, rojaA: roja ? j.id : undefined,
        texto: roja
          ? `ROJA. Era cuestión de tiempo. ${apellido(j)} se va y quedan diez.`
          : `${apellido(j)} siguió al límite y aguantó. Salió bien la apuesta.` };
    }

    case "penal_ultima": {
      const j = buscar(opcionId) ?? buscar(m.porDefecto)!;
      // sobre la hora pesa la experiencia, no solo el pie
      let p = 0.52 + (nivel(j) - 55) * 0.005;
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
      const textos: Record<string, string> = {
        ahogar: "Olimpia se va con todo arriba. El rival no puede salir de su área.",
        abrir: "Olimpia abre la cancha y lo hace correr de lado a lado.",
        sostener: "Olimpia administra la ventaja sin apurarse.",
      };
      return { exito: true, texto: textos[opcionId] ?? textos.sostener };
    }

    case "mano_a_mano": {
      const j = buscar(m.opciones[0].jugadorId)!;
      const base = (nivel(j) - 55) * 0.006;
      let p = opcionId === "cruzar" ? 0.52 + base
        : opcionId === "picar" ? 0.38 + base
        : 0.44 + base;
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
      return { exito: mete, golOlimpia: mete, texto: mete ? ok : mal };
    }
  }
}
