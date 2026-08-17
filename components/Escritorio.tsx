"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Escudo from "./Escudo.tsx";
import IconoModulo, { type ClaveIcono } from "./IconoModulo.tsx";
import Numero from "./Numero.tsx";
import Dorsal from "./Dorsal.tsx";
import Asuntos from "./Asuntos.tsx";
import CanchaHome from "./CanchaHome.tsx";
import Mercado from "./Mercado.tsx";
import { colorDe } from "./Dorsal.tsx";
import {
  aroDe, colorComoLlega, comoLlegaAlPartido, deltaNivel, esSub18, nombreCorto,
  partidosDeOlimpia,
} from "@/lib/juego.ts";
import Delta from "./Delta.tsx";
import RIVALES_COPA from "@/data/rivales_internacionales.json";
import {
  CALENDARIO_COPA, OBJETIVO, TOTAL_FECHAS, borrar, diasAlPartido, esPartidoDeCopa,
  diasEntre, estadoSub18, formatoDia, hayPartidoHoy, miles, ocupacionDe, ovrDe, partidoDe, plantelDe,
  posicionDe, sumarDias,
  tablaDe, type EquipoGuardado, type Partida,
  comoLoDejaste, guardarEquipo,
} from "@/lib/temporada.ts";
import { useAtras } from "@/lib/atras.ts";
import Alineador, { type EstadoAlineacion } from "./Alineador.tsx";
import FichaJugador from "./FichaJugador.tsx";
import PantallaEstrella from "./PantallaEstrella.tsx";
import { ESTRELLAS } from "@/engine/estrellas.ts";
import { comoLlega, estadoRival } from "@/lib/rivales.ts";
import { mejorMolde, MOLDE_DE, repartirEnMolde } from "@/lib/juego.ts";

type Vista = "escritorio" | "plantel" | "fixture" | "mercado" | "bitacora"
  | "copa" | "estrella";
type Ayuda = "ovr" | "estadio" | "vestuario" | "hinchada" | "dirigencia";

/** Qué mide cada barra del encabezado y qué la mueve. */
const AYUDAS: Record<Ayuda, { titulo: string; texto: string; mueve: string[] }> = {
  ovr: {
    titulo: "El nivel de tu equipo",
    texto: "Qué tan fuerte sale Olimpia al partido. Se compara con el del rival: " +
      "el que tiene más tiene más chance de ganar. Sale de sumar seis cosas, y " +
      "cada una se sube de una manera distinta.",
    mueve: [],
  },
  estadio: {
    titulo: "Estadio",
    texto: "Qué parte del Defensores del Chaco se llena cuando jugás de local. " +
      "No es decoración: la cancha llena empuja al equipo y la vacía lo deja solo.",
    mueve: [
      "Precio de la entrada: es lo que más pesa. Popular llena, cara vacía",
      "Humor de la hinchada: si venís mal, no vienen aunque sea barato",
      "Clásico: contra Cerro se llena igual, +25%",
      "Efecto en cancha: de 0.55 con el estadio vacío a 1.35 con el estadio lleno",
      "Cada partido de local, las entradas entran a la caja del club",
    ],
  },
  vestuario: {
    titulo: "Vestuario",
    texto: "El clima interno del plantel. Es el promedio de cómo están los jugadores " +
      "con vos, y se contagia: si baja mucho, empiezan los problemas solos.",
    mueve: [
      "Resultados: ganar suma, perder resta",
      "Cómo resolvés los asuntos del plantel",
      "Rechazar una oferta por un jugador que se quería ir",
      "Abajo de 38 se filtra a la prensa, abajo de 28 hay pelea en la práctica",
      "Efecto en cancha: la moral de cada jugador multiplica su nivel entre 0.94 y 1.06",
    ],
  },
  hinchada: {
    titulo: "Hinchada",
    texto: "El humor de la gente. Se nota en la taquilla y adentro de la cancha.",
    mueve: [
      "Resultados: ganar +5, empatar −2, perder −8",
      "Precios populares la mantienen contenta",
      "Vender a un ídolo la enoja",
      "Arrastra al vestuario: si la gente está caliente, adentro se siente",
    ],
  },
  dirigencia: {
    titulo: "Prestigio",
    texto: "Cuánto te bancan. Si llega a cero, te echan y se termina la partida.",
    mueve: [
      "Resultados y posición en la tabla",
      "Avanzar en la Sudamericana la sube fuerte",
      "Perder el clásico la baja fuerte",
      "Si la hinchada está por debajo de 40, te bancan menos",
      "Abajo de 25 aparece el aviso de que evalúan tu continuidad",
    ],
  },
};

export default function Escritorio({
  partida, onAvanzar, onDirigir, onResolver, onFichar, onReiniciar, onGuardarEquipos,
  onMoverReserva, onFicharEstrella, onRechazarEstrella,
}: {
  partida: Partida;
  onAvanzar: () => void;
  onDirigir: () => void;
  onResolver: (asuntoId: string, opcionId: string) => void;
  onGuardarEquipos: (e: EquipoGuardado[]) => void;
  onMoverReserva: (id: string, aReserva: boolean) => void;
  onFicharEstrella: () => void;
  onRechazarEstrella: () => void;
  onFichar: (fichajeId: string) => void;
  onReiniciar: () => void;
}) {
  const [vista, setVista] = useState<Vista>("escritorio");
  const [ayuda, setAyuda] = useState<Ayuda | null>(null);
  /** Borrar la partida es irreversible: se pregunta antes. */
  const [reiniciar, setReiniciar] = useState(false);
  /** El jugador que tocaste en la cancha de la pantalla principal. */
  const [fichaHome, setFichaHome] = useState<string | null>(null);

  /*
   * Cada capa que se puede cerrar avisa al historial, así el atrás del
   * navegador (y el gesto de deslizar en el celular) cierra una sola.
   */
  useAtras(vista !== "escritorio", () => setVista("escritorio"));
  useAtras(ayuda !== null, () => setAyuda(null));
  useAtras(reiniciar, () => setReiniciar(false));
  useAtras(fichaHome !== null, () => setFichaHome(null));

  const tabla = useMemo(() => tablaDe(partida), [partida]);
  const plantel = useMemo(() => plantelDe(partida), [partida]);
  const posicion = useMemo(() => posicionDe(partida), [partida]);
  const yo = tabla.find((f) => f.id === "olimpia")!;
  const partido = partidoDe(partida);
  const faltan = diasAlPartido(partida);
  const esHoy = hayPartidoHoy(partida);
  const pendiente = partida.pendientes[0] ?? null;
  const ocupacion = ocupacionDe(partida, partido?.ctx.esClasico);
  const sub18 = estadoSub18(partida);

  if (partida.despedido) {
    return (
      <div className="app pantalla">
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <Escudo id="olimpia" nombre="Olimpia" tam={64} />
          <h1 className="apellido text-[26px] leading-tight" style={{ color: "#c0392b" }}>
            Te agradecieron los servicios
          </h1>
          <p className="text-[13px] leading-snug" style={{ color: "var(--tenue)" }}>
            {partida.despedido}
          </p>
          <div className="mt-2 w-full rounded-lg p-3" style={{ background: "var(--carbon)" }}>
            {[
              ["Partidos dirigidos", String(partida.resultados.length)],
              ["Puntos", String(yo.pts)],
              ["Posición final", `${posicion}°`],
              ["Copa Sudamericana", partida.copa.ronda === "campeon" ? "Campeón"
                : partida.copa.ronda === "eliminado" ? "Eliminado" : "En carrera"],
            ].map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between py-0.5 text-[12px]">
                <span style={{ color: "var(--tenue)" }}>{k}</span>
                <span className="num">{v}</span>
              </div>
            ))}
          </div>
          <button onClick={() => { borrar(); onReiniciar(); }}
            className="mt-3 w-full rounded-lg py-3.5 text-[14px] font-extrabold uppercase tracking-[0.14em]"
            style={{ background: "var(--blanco)", color: "var(--negro)" }}>
            Empezar de nuevo
          </button>
        </div>
      </div>
    );
  }

  // La oportunidad de un crack tiene pantalla completa propia, pero no bloquea
  // el juego: podés salir, vender a alguien y volver con la plata.
  if (vista === "estrella" && partida.estrella) {
    return (
      <PantallaEstrella partida={partida}
        onVolver={() => setVista("escritorio")}
        onFichar={() => { onFicharEstrella(); setVista("escritorio"); }}
        onRechazar={() => { onRechazarEstrella(); setVista("escritorio"); }} />
    );
  }

  if (vista !== "escritorio") {
    return (
      <Sub titulo={{
        plantel: "Plantel", fixture: "Fixture",
        mercado: "Fichajes", bitacora: "Bitácora", copa: "Sudamericana",
        estrella: "Mercado",
      }[vista]} onVolver={() => setVista("escritorio")}>
        {/*
          * Sin pestañas. El plantel y el mercado eran dos solapas de la misma
          * pantalla porque el plantel no tenía puerta propia; ahora tiene su
          * botón en la home, así que entrar a ver a los tuyos ya no pasa por
          * la vidriera de los que no son tuyos.
          */}
        {vista === "plantel" && (
          <VistaPlantel plantel={plantel} partida={partida} onGuardarEquipos={onGuardarEquipos}
                        onMoverReserva={onMoverReserva} />
        )}
        {vista === "fixture" && <VistaFixture partida={partida} tabla={tabla} />}
        {vista === "mercado" && <Mercado partida={partida} onFichar={onFichar} />}
        {vista === "bitacora" && <VistaBitacora partida={partida} />}
        {vista === "copa" && <VistaCopa partida={partida} />}
      </Sub>
    );
  }

  const ovr = ovrDe(partida);
  /*
   * Los aportes que se muestran al lado del número. La base sale por
   * diferencia contra el total para que la columna sume exactamente lo que
   * dice el dorsal: si cada parte se redondeara por su cuenta, la cuenta no
   * cerraría y el número grande parecería estar mal.
   */
  const aportes = (() => {
    const p = ovr.partes;
    if (!p) {
      return { base: Math.round(ovr.plantel),
               lista: [] as { etiqueta: string; valor: number; lleno?: number; fijo?: boolean }[] };
    }
    const crudos: { etiqueta: string; valor: number; lleno?: number; fijo?: boolean }[] = [
      { etiqueta: "vestuario", valor: p.animo, lleno: p.animoMedio / 100, fijo: true },
      { etiqueta: "hinchada", valor: p.cancha, lleno: partida.hinchada / 100, fijo: true },
      { etiqueta: "físico", valor: p.piernas, lleno: p.condicionMedia / 100 },
      { etiqueta: "puesto", valor: p.puestos, lleno: (11 - p.fueraDePuesto) / 11 },
      { etiqueta: "viaje", valor: p.viaje },
    ];
    const lista = crudos
      .map((a) => ({ ...a, valor: Math.round(a.valor) }))
      .filter((a) => a.valor !== 0 || a.fijo);
    const suma = lista.reduce((n, a) => n + a.valor, 0);
    return { base: Math.round(p.total) - suma, lista };
  })();
  /** El once nunca baja de 45 ni pasa de 85: ahí se estira la barra. */
  const escalaOvr = (n: number) => Math.max(0, Math.min(100, ((n - 45) / 40) * 100));
  /*
   * El color del número sale de cuánto vale el equipo en términos absolutos,
   * no de contra quién juega el domingo. Así el número es algo que se quiere
   * subir y no una comparación que cambia sola cada fecha. Contra el rival ya
   * se compara en el botón de avanzar el día.
   */
  /** La misma vara para todo lo que se mida en nivel: rojo, amarillo, verde. */
  const colorEscala = (n: number) => (n >= 74 ? "#4fc07e" : n >= 66 ? "#e8c25a" : "#e0705f");
  /*
   * El color cambia EXACTAMENTE donde cambia el juego.
   *
   * Estaba en 55 y 35, que no eran nada: los umbrales de verdad son 40 (abajo
   * de ahí aparece el aviso de que arriba esperan más) y 25 (abajo de ahí te
   * dicen que están evaluando tu continuidad). Así el amarillo empieza el día
   * que aparece el aviso y el rojo el día que te avisan, y las dos rayitas de
   * la barra caen justo donde el color cambia en vez de en otro lado.
   */
  const colorDirigencia = (n: number) => (n >= 40 ? "#4fc07e" : n >= 25 ? "#e8c25a" : "#e0705f");
  const colorOvr = colorEscala(ovr.hoy);

  const bajas = plantel.filter((j) => j.suspendido || j.lesionado_hasta);
  const lider = tabla[0];
  const difLider = lider.id === "olimpia" ? 0 : lider.pts - yo.pts;
  const rivalCopa = (RIVALES_COPA as any[]).find((r) => r.id === partida.copa.rivalId);
  const NOMBRE_RONDA: Record<string, string> = {
    octavos: "Octavos", cuartos: "Cuartos", semis: "Semifinal", final: "Final",
    eliminado: "Eliminado", campeon: "Campeón",
  };

  return (
    <div className="app pantalla-atras">
      <span className="marca-agua" style={{ backgroundImage: "url(escudos/olimpia.png)" }} />

      {/* ---------- club ---------- */}
      <header className="px-4 pb-2 pt-3">
        <div className="flex items-center gap-2.5">
          <Escudo id="olimpia" nombre="Olimpia" tam={34} />
          <div className="min-w-0 flex-1">
            <div className="apellido text-[16px] leading-none">Olimpia</div>
            <div className="text-[10px]" style={{ color: "var(--tenue)" }}>
              {formatoDia(partida.dia)} · fecha {Math.min(partida.fechaActual, TOTAL_FECHAS)} de {TOTAL_FECHAS}
            </div>
            {/*
              * La barra es la dirigencia, no el avance del torneo.
              *
              * Acá había una regla de progreso del Clausura, y como el bloque
              * termina pegado al número de la dirigencia todo el mundo la leía
              * como si fuera suya. En vez de separarlos, se le dio la razón a
              * la lectura: la barra pasó a ser lo que parecía. El avance del
              * torneo no se pierde, sigue escrito arriba en "fecha 8 de 22",
              * que además es más preciso que una barrita de tres píxeles.
              *
              * Las dos rayitas son los umbrales que el juego ya usa: abajo de
              * 40 aparece el aviso, abajo de 25 evalúan tu continuidad. Están
              * para que se vea cuánto margen queda sin una línea de texto más.
              */}
            <button onClick={() => setAyuda("dirigencia")}
                    className="relative mt-1 block h-[3px] w-full overflow-hidden rounded-full"
                    style={{ background: "var(--linea)" }}
                    aria-label="Dirigencia">
              <span className="barra-llena absolute inset-y-0 left-0 rounded-full"
                    style={{ width: `${Math.max(0, Math.min(100, partida.paciencia))}%`,
                             background: colorDirigencia(partida.paciencia) }} />
              {[25, 40].map((x) => (
                <span key={x} className="absolute inset-y-0"
                      style={{ left: `${x}%`, width: 1, background: "var(--negro)" }} />
              ))}
            </button>
          </div>
          {/*
            * La plata y la dirigencia, que son las dos cosas del club que no
            * dependen del domingo. La dirigencia estaba escondida hasta que se
            * ponía fea, así que las decisiones que prometían "+5 dirigencia"
            * hablaban de un número que no existía en ninguna pantalla.
            */}
          <button onClick={() => setAyuda("dirigencia")} className="shrink-0 text-right">
            <Numero valor={partida.dineroUsd} formato={(n) => miles(Math.round(n))}
                    className="num block text-[13px]" style={{ color: "var(--cesped)" }} />
            <span className="mt-0.5 flex items-center justify-end gap-1">
              <span className="text-[8px] uppercase tracking-[0.14em]" style={{ color: "var(--apagado)" }}>
                dirigencia
              </span>
              <Numero valor={partida.paciencia} formato={(n) => String(Math.round(n))}
                      className="num text-[12px] font-extrabold"
                      style={{ color: colorDirigencia(partida.paciencia) }} />
            </span>
          </button>
          {/* Empezar de nuevo estaba solo al terminar la temporada, así que si
              te ibas al descenso no había forma de arrancar otra vez. */}
          <button onClick={() => setReiniciar(true)}
                  className="shrink-0 rounded px-1.5 py-1 text-[13px] leading-none"
                  style={{ background: "var(--carbon)", color: "var(--apagado)" }}
                  aria-label="Empezar de nuevo">
            ⟲
          </button>
        </div>

        {/* La dirigencia solo habla cuando hay algo que decir. */}
        {partida.paciencia < 40 && (
          <button onClick={() => setAyuda("dirigencia")}
            className="mt-2 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left"
            style={{ background: partida.paciencia < 20
              ? "color-mix(in srgb, #c0392b 26%, var(--carbon))"
              : "color-mix(in srgb, #e0902a 20%, var(--carbon))" }}>
            <span className="text-[13px] leading-none">{partida.paciencia < 20 ? "🔥" : "⚠"}</span>
            <span className="text-[10px] leading-snug" style={{ color: "var(--blanco)" }}>
              {partida.paciencia < 20
                ? "La dirigencia está por cortar el ciclo"
                : `Arriba esperan más de un plantel de ${Math.round(ovr.plantel)}`}
            </span>
          </button>
        )}

      </header>

      {partida.estrella && (() => {
        const e = ESTRELLAS.find((x) => x.id === partida.estrella!.id);
        if (!e) return null;
        const dias = Math.max(0, diasEntre(partida.dia, partida.estrella.venceEl));
        const alcanza = partida.dineroUsd >= e.precioUsd;
        return (
          <button onClick={() => setVista("estrella")}
            className="relieve-alto respirar mx-3 mb-2 flex items-center gap-2.5 rounded-lg px-3 py-2"
            style={{
              background: `linear-gradient(160deg,
                color-mix(in srgb, #e8c25a 30%, var(--carbon-alto)),
                color-mix(in srgb, #e8c25a 10%, var(--carbon)))`,
            }}>
            <span className="num shrink-0 rounded-md px-2 py-1 text-[15px] leading-none"
                  style={{ background: "#e8c25a", color: "#0a120d" }}>
              {e.nivel}
            </span>
            <span className="min-w-0 flex-1 text-left">
              <span className="block text-[8px] uppercase tracking-[0.16em]" style={{ color: "#e8c25a" }}>
                {dias === 0 ? "Se define hoy" : dias === 1 ? "Queda un día" : `Quedan ${dias} días`}
              </span>
              <span className="apellido block truncate text-[13px] leading-tight">{e.titular}</span>
              <span className="block text-[9px]" style={{ color: alcanza ? "var(--cesped)" : "var(--medio)" }}>
                {alcanza ? `Podés pagarlo: ${miles(e.precioUsd)}` : `Faltan ${miles(e.precioUsd - partida.dineroUsd)}`}
              </span>
            </span>
            <span className="shrink-0 text-[10px] font-extrabold uppercase tracking-wider"
                  style={{ color: "#e8c25a" }}>Ver →</span>
          </button>
        );
      })()}

      {partida.paciencia < 25 && !partida.despedido && (
        <div className="respirar mx-3 mb-2 rounded-md px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider"
             style={{ background: "color-mix(in srgb, #c0392b 24%, var(--carbon))", color: "#c0392b" }}>
          La dirigencia está evaluando tu continuidad
        </div>
      )}

      {/* ---------- la semana ---------- */}
      <div key={partida.dia} className="correr-tira scroll-x flex gap-1 px-3 pb-2">
        {Array.from({ length: 14 }, (_, i) => {
          const dia = sumarDias(partida.dia, i);
          const m = partidosDeOlimpia().find((x) => x.ctx.fecha === dia);
          const copaHoy = Object.values(CALENDARIO_COPA).some(
            (r) => (r.ida === dia || r.vuelta === dia)
              && partida.copa.ronda !== "eliminado" && partida.copa.ronda !== "campeon");
          /*
           * El día de copa se pintaba de amarillo con un puntito amarillo, o
           * sea con la gama de la Libertadores y sin decir contra quién. Ahora
           * usa el azul de la Sudamericana, el mismo de la card de al lado, y
           * muestra el escudo del rival igual que los partidos de liga.
           */
          const azul = COPAS.sudamericana.acento;
          const hoy = i === 0;
          return (
            <div key={dia}
              className={`flex w-[38px] shrink-0 flex-col items-center gap-0.5 rounded-md py-1 ${
                hoy ? "pasa-el-dia relieve-alto" : "relieve"}`}
              style={{
                background: hoy ? "var(--blanco)"
                  : copaHoy ? `color-mix(in srgb, ${azul} 30%, var(--carbon))`
                  : m ? "color-mix(in srgb, #3fa76a 24%, var(--carbon))"
                  : "var(--carbon)",
                color: hoy ? "var(--negro)" : "var(--blanco)",
              }}>
              <span className="text-[7px] uppercase tracking-wider"
                    style={{ color: hoy ? "var(--negro)" : "var(--apagado)" }}>
                {formatoDia(dia).slice(0, 3)}
              </span>
              <span className="num text-[13px] leading-none">{dia.slice(8, 10)}</span>
              <span className="flex h-3.5 items-center">
                {copaHoy && rivalCopa
                  ? <Escudo id={rivalCopa.id} nombre={rivalCopa.nombre} tam={13} />
                  : copaHoy ? <Punto color={azul} />
                  : m ? <Escudo id={m.rivalId} nombre={m.rivalNombre} tam={13} />
                  : null}
              </span>
            </div>
          );
        })}
      </div>

      {/* ---------- lo que pasa si hay algo que decidir ---------- */}
      {pendiente ? (
        <div key={pendiente.id} className="llega-asunto relative min-h-0 flex-1 px-3">
          <Asuntos asunto={pendiente} partida={partida} onResolver={onResolver} />
          <span className="golpe-de-luz absolute inset-0 rounded-xl"
                style={{ background: "radial-gradient(60% 40% at 50% 40%, rgba(255,255,255,0.28), transparent 70%)" }} />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col px-3">
          {/* tablero del club */}
          <div className="escalona grid shrink-0 grid-cols-2 gap-1.5">
            {/*
              * El OVR, en el lugar donde estaba la condición media del plantel.
              * Es el número más importante de la pantalla, así que ocupa una
              * card entera y no un renglón del encabezado.
              */}
            {/*
              * El OVR. El número manda y es el que lleva el color; el fondo se
              * queda quieto y oscuro para no competir. A la derecha, cada cosa
              * que lo sube o lo baja con su barrita, que es lo que hace ver
              * que son números que se pueden mover.
              */}
            <button onClick={() => setAyuda("ovr")}
              className="relieve-alto relative overflow-hidden rounded-lg px-2.5 py-2 text-left"
              style={{ background: "linear-gradient(160deg, #16201b, #0c120f 70%)",
                       boxShadow: `inset 0 0 0 1.5px color-mix(in srgb, ${colorOvr} 55%, transparent),
                                   0 0 20px color-mix(in srgb, ${colorOvr} 16%, transparent)` }}>
              {/* el rótulo arriba, para que el número no quede sin nombre */}
              <span className="mb-0.5 block text-[9px] uppercase tracking-[0.2em]"
                    style={{ color: colorOvr }}>
                nivel
              </span>
              <span className="flex items-baseline gap-2">
                <Numero valor={ovr.hoy} formato={(n) => String(Math.round(n))}
                        className="apellido block leading-[0.8]"
                        style={{ fontSize: 34, color: colorOvr,
                                 textShadow: `0 0 26px color-mix(in srgb, ${colorOvr} 50%, transparent)` }} />
                <span className="flex items-baseline gap-1">
                  {/* el plantel se pinta con la misma vara que el OVR: así se ve
                      si el problema son los jugadores o cómo llegan */}
                  <span className="num text-[13px]" style={{ color: colorEscala(aportes.base) }}>
                    {aportes.base}
                  </span>
                  <span className="text-[8px] uppercase tracking-[0.12em]"
                        style={{ color: "var(--apagado)" }}>
                    plantel
                  </span>
                </span>
              </span>

              {/* cada cosa que lo mueve, en su propia fichita del color que le toca */}
              <span className="mt-1.5 flex gap-1">
                {aportes.lista.slice(0, 3).map((a) => (
                  <Aporte key={a.etiqueta} etiqueta={a.etiqueta} valor={a.valor} />
                ))}
              </span>

              {/* Las bajas se fueron al botón de Plantel: son un dato que se
                  mira cuando vas a mirar el plantel, no cada vez que abrís el
                  juego. Lo del Sub-18 se queda porque tiene fecha de
                  vencimiento y si te lo pasás son tres puntos menos. */}
              {!sub18.alcanza && (
                <span className="mt-1.5 flex flex-wrap gap-1">
                  <span className="rounded px-1.5 py-[1px] text-[9px] font-extrabold uppercase"
                        style={{ background: "#e0902a", color: "#0a120d" }}>
                    Sub-18: {sub18.faltan}'
                  </span>
                </span>
              )}
            </button>

            <CardCopa copa="sudamericana"
              ronda={NOMBRE_RONDA[partida.copa.ronda]}
              rival={rivalCopa ? rivalCopa.nombre : null}
              escudo={partida.copa.ronda !== "eliminado" && partida.copa.ronda !== "campeon"
                ? partida.copa.rivalId : undefined}
              onClick={() => setVista("copa")} />
          </div>

          {/*
            * El once que va a salir, con el ánimo de cada uno. Acá estaba el
            * diario, que era texto para leer y nada para hacer; el ánimo, en
            * cambio, es lo que mueve el OVR y no se veía en ninguna parte
            * salvo entrando a la ficha de a uno. El diario sigue completo en
            * su propio botón.
            */}
          <div className="mt-1.5 flex min-h-0 flex-1 flex-col">
            <CanchaHome
              once={ovr.once}
              puestos={ovr.puestos}
              formacion={ovr.formacion}
              ctx={ovr.ctx}
              bajaDe={(j) => j.lesionado_hasta ? "lesionado" : j.suspendido ? "suspendido" : null}
              onTocar={(j) => setFichaHome(j.id)}
              onModificar={onDirigir} />
          </div>

          {/*
            * Lo último que pasó, en un renglón.
            *
            * El diario se fue de la home y con él la única forma de enterarse
            * de algo sin entrar a otra pantalla. Esto es el titular del día:
            * el resultado del domingo, la plata que entró, el que se lesionó.
            * Lo demás sigue completo adentro del fixture.
            */}
          {(() => {
            const u = partida.bitacora[partida.bitacora.length - 1];
            if (!u) return null;
            const m = u.marca ? MARCA[u.marca] : null;
            return (
              <button onClick={() => setVista("bitacora")}
                className="mt-1.5 flex shrink-0 items-center gap-2 rounded-md px-2.5 py-1.5 text-left"
                style={{ background: m
                  ? `color-mix(in srgb, ${m.color} 14%, var(--carbon))` : "var(--carbon)" }}>
                {m && (
                  <span className="shrink-0 text-[10px] font-extrabold leading-none"
                        style={{ color: m.color }}>{m.icono}</span>
                )}
                <span className="min-w-0 flex-1 truncate text-[10px]"
                      style={{ color: "var(--tenue)" }}>
                  {u.texto}
                </span>
                {u.cifra && (
                  <span className="num shrink-0 text-[11px] font-extrabold"
                        style={{ color: m?.color ?? "var(--blanco)" }}>{u.cifra}</span>
                )}
              </button>
            );
          })()}
        </div>
      )}

      {/* ---------- la acción del día ---------- */}
      {!pendiente && (
        <div className="px-3 pt-2">
          {esHoy && partido ? (
            /*
             * Un solo botón, y siempre pasa por armar el once.
             *
             * Había dos: "Jugar" saltaba directo al partido y "Armar el once"
             * al costado. O sea que el camino principal salteaba la única
             * pantalla donde se decide el equipo, y el que quería mirar quién
             * llegaba cansado tenía que acordarse de entrar por el botón
             * chico. Antes de un partido siempre se para a ver el equipo.
             */
            <div className="flex gap-1.5">
              <button onClick={onDirigir}
                className="relieve-alto flex min-w-0 flex-1 items-center gap-3 rounded-lg px-3 py-2.5"
                style={{
                  /*
                   * Los dos botones son blancos y del mismo tamaño. Lo único
                   * que separa al del domingo es el aro verde, y alcanza:
                   * antes probé con una animación (llama la atención una vez y
                   * después cansa) y con una franja gruesa y más alto (dos
                   * cosas gritando para decir lo mismo).
                   */
                  background: "var(--blanco)", color: "var(--negro)",
                  boxShadow: "0 0 0 2px var(--cesped)",
                }}>
                <Escudo id={partido.rivalId} nombre={partido.rivalNombre} tam={30} />
                <span className="min-w-0 flex-1 text-left">
                  {/* Siempre "Hoy se juega". Con la etiqueta de la copa el
                      rótulo se iba a dos renglones y estiraba el botón, y
                      además ya lo dice la card de la Sudamericana de arriba. */}
                  <span className="block text-[9px] uppercase tracking-[0.14em] opacity-60">
                    Hoy se juega
                  </span>
                  <span className="apellido block truncate text-[14px] leading-tight">
                    {nombreCorto(partido.rivalId, partido.rivalNombre)}
                  </span>
                  {/* Cómo llega el rival es la información que más cambia el
                      partido, así que va acá: antes solo se veía entrando a
                      armar el once, que ya no es el camino principal. */}
                  {(() => {
                    if (partido.ctx.competencia !== "clausura") return null;
                    const e = estadoRival(partido.rivalId, partido.ctx.fecha);
                    const l = comoLlega(e);
                    if (!l.bueno) return null;
                    return (
                      <span className="block text-[9px] font-bold" style={{ color: "#1a7a44" }}>
                        {l.texto.toLowerCase()}
                        {e.vieneDeCopa ? ", jugó la copa el jueves" : ""} · apretalo
                      </span>
                    );
                  })()}
                </span>
                <span className="shrink-0 text-[11px] font-extrabold uppercase tracking-wider">
                  Armar el once →
                </span>
              </button>
            </div>
          ) : partido ? (
            /*
             * El mismo botón que el día de partido, sin el aro.
             *
             * Tenían el mismo blanco pero distinta anatomía: este arrancaba
             * con un "+1" en una cajita y terminaba con la flecha adentro de
             * un círculo, así que aunque compartieran color se leían como dos
             * cosas distintas. Ahora los dos son escudo, rótulo, rival y la
             * acción a la derecha. Lo único que cambia entre un domingo y un
             * martes es el aro verde, que es exactamente lo que tiene que
             * cambiar.
             */
            <button onClick={onAvanzar}
              className="relieve-alto flex w-full items-center gap-3 rounded-lg px-3 py-2.5"
              style={{ background: "var(--blanco)", color: "var(--negro)" }}>
              <Escudo id={partido.rivalId} nombre={partido.rivalNombre} tam={30} />
              <span className="min-w-0 flex-1 text-left">
                <span className="block text-[9px] uppercase tracking-[0.14em] opacity-60">
                  En {faltan} día{faltan === 1 ? "" : "s"}
                </span>
                <span className="apellido block truncate text-[14px] leading-tight">
                  {nombreCorto(partido.rivalId, partido.rivalNombre)}
                </span>
              </span>
              <span className="shrink-0 text-[11px] font-extrabold uppercase tracking-wider">
                Avanzar →
              </span>
            </button>
          ) : (
            <div className="rounded-lg p-3 text-center" style={{ background: "var(--carbon)" }}>
              <div className="apellido text-[15px]">Terminó el Clausura</div>
              <div className="mt-0.5 text-[11px]" style={{ color: "var(--tenue)" }}>
                {posicion}° con {yo.pts} puntos
              </div>
              <button onClick={() => { borrar(); onReiniciar(); }}
                className="mt-2 rounded-md px-4 py-2 text-[11px] font-extrabold uppercase tracking-wider"
                style={{ background: "var(--blanco)", color: "var(--negro)" }}>
                Empezar de nuevo
              </button>
            </div>
          )}
        </div>
      )}

      {/* ---------- resto ---------- */}
      <div className="grid grid-cols-3 gap-1 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-1.5">
        {/*
          * Plantel en vez de Diario. El diario es texto para leer y estaba a un
          * toque de la home, mientras que el plantel (donde se ve a los treinta,
          * se sube gente de reserva y se arman los equipos) vivía escondido
          * adentro de Fichajes. Se cambió el que se usa todos los días por el
          * que se lee de vez en cuando: el diario ahora vive adentro del
          * fixture, que es la otra pantalla de consulta.
          */}
        {([["fixture", "Fixture", "#d9a832"], ["mercado", "Fichajes", "#e0902a"],
           ["plantel", "Plantel", "#8fa396"]] as const).map(([id, texto, color]) => (
          <button key={id} onClick={() => setVista(id)}
            className="relieve relative rounded-md py-2.5 text-[10px] font-bold uppercase tracking-[0.14em]"
            style={{ background: "var(--carbon)", color: "var(--tenue)" }}>
            {texto}
            {/*
              * Cuántos hay para mirar, sin tener que entrar. Las bajas vivían
              * en la card del nivel, que es la de arriba de todo y la que más
              * aire necesita: acá ocupan cero y están al lado del botón que
              * lleva justo adonde se ven.
              */}
            {(() => {
              const n = id === "mercado" ? partida.fichajes.length
                : id === "plantel" ? bajas.length : 0;
              if (!n) return null;
              return (
                <span className="num absolute right-1.5 top-1 rounded-full px-[5px] text-[8px] font-extrabold"
                      style={{ background: id === "plantel" ? "var(--ladrillo)" : color,
                               color: id === "plantel" ? "var(--blanco)" : "#0a120d" }}>
                  {n}
                </span>
              );
            })()}
          </button>
        ))}
      </div>

      {fichaHome && (() => {
        const j = plantel.find((x) => x.id === fichaHome);
        if (!j) return null;
        return (
          <FichaJugador jugador={j} estado={partida.plantel[j.id]}
                        ctx={partido?.ctx ?? ({} as never)}
                        onCerrar={() => setFichaHome(null)} />
        );
      })()}

      {reiniciar && (
        <div className="fixed inset-0 z-40 flex flex-col justify-end"
             style={{ background: "rgba(0,0,0,0.7)" }} onClick={() => setReiniciar(false)}>
          <div className="entra-abajo rounded-t-2xl px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4"
               style={{ background: "var(--negro)", borderTop: "1px solid var(--linea)",
                        boxShadow: "0 -12px 40px rgba(0,0,0,0.75)" }}
               onClick={(e) => e.stopPropagation()}>
            <h2 className="apellido text-[19px]">¿Empezar de nuevo?</h2>
            <p className="mt-1.5 text-[12px] leading-relaxed" style={{ color: "var(--tenue)" }}>
              Se borra todo: los {partida.resultados.length} partidos dirigidos, los
              refuerzos que trajiste y lo que juntaste en caja. No hay vuelta atrás.
            </p>
            <button onClick={() => { borrar(); onReiniciar(); }}
              className="mt-4 w-full rounded-lg py-3.5 text-[13px] font-extrabold uppercase tracking-[0.14em]"
              style={{ background: "var(--ladrillo)", color: "var(--blanco)" }}>
              Borrar y empezar de nuevo
            </button>
            <button onClick={() => setReiniciar(false)}
              className="mt-1.5 w-full rounded-lg py-3 text-[12px] font-bold uppercase tracking-[0.12em]"
              style={{ background: "var(--carbon)", color: "var(--blanco)" }}>
              Seguir con esta
            </button>
          </div>
        </div>
      )}

      {ayuda && (
        <div className="fixed inset-0 z-40 flex flex-col justify-end"
             style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setAyuda(null)}>
          <div className="entra-abajo rounded-t-2xl px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3"
               style={{ background: "var(--negro)", borderTop: "1px solid var(--linea)",
                        maxHeight: "82vh", overflowY: "auto",
                        boxShadow: "0 -12px 40px rgba(0,0,0,0.75)" }}
               onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="apellido text-[17px]">{AYUDAS[ayuda].titulo}</h2>
              <button onClick={() => setAyuda(null)} className="rounded px-2 py-0.5 text-[11px]"
                      style={{ background: "var(--carbon)" }}>✕</button>
            </div>
            <p className="text-[12px] leading-relaxed" style={{ color: "var(--tenue)" }}>
              {AYUDAS[ayuda].texto}
            </p>

            {/* De dónde sale el número, sumando. Acá es donde se ve el ánimo
                del plantel, que no aparecía en ninguna otra parte. */}
            {/*
              * Cada parte con su número Y cómo se sube ESA.
              *
              * Antes había un desglose por un lado y una lista suelta de
              * consejos por el otro, así que "llenar la cancha" no estaba
              * pegado al renglón de la hinchada y había que atar los cabos
              * solo. Ahora cada cosa que mueve el nivel dice, ahí mismo,
              * cuánto está poniendo hoy y qué hay que hacer para moverla.
              */}
            {ayuda === "ovr" && ovr.partes && (
              <div className="mt-3">
                <ParteConComo etiqueta="Plantel" valor={Math.round(ovr.partes.base)} base
                  como="Lo que valen en ficha los once que van a jugar. Se sube fichando mejor, y con los pibes de 21 o menos, que crecen si les das minutos." />
                <ParteConComo etiqueta="Vestuario" valor={ovr.partes.animo} siempre
                  como="Cómo está el plantel con vos. Ganar suma, perder resta, y cómo resolvés los asuntos del vestuario es lo que más lo mueve." />
                <ParteConComo etiqueta="Hinchada" valor={ovr.partes.cancha} siempre
                  como="Cuánta gente entra al Defensores. Se llena bajando el precio de la entrada y ganando; de visitante no cuenta." />
                <ParteConComo etiqueta="Físico" valor={ovr.partes.piernas}
                  como="Con cuánto cansancio llegan. Se sube rotando: el que juega jueves y domingo llega fundido al segundo." />
                <ParteConComo etiqueta="Fuera de puesto" valor={ovr.partes.puestos}
                  como="Lo que perdés por poner gente donde no juega. Se arregla armando el once con la formación que le calza al plantel." />
                <ParteConComo etiqueta="El viaje" valor={ovr.partes.viaje}
                  como="El vuelo y la altura cuando jugás afuera. Se recorta viajando con días de anticipación, que se elige antes del partido." />
                <div className="mt-2 flex items-baseline justify-between rounded-lg px-2.5 py-2"
                     style={{ background: "var(--carbon-alto)" }}>
                  <span className="text-[11px] font-bold">Nivel para el partido</span>
                  <span className="num text-[16px] font-extrabold">
                    {Math.round(ovr.partes.total)}
                  </span>
                </div>
              </div>
            )}
            {AYUDAS[ayuda].mueve.length > 0 && (<>
              <div className="mt-3 text-[9px] uppercase tracking-[0.16em]"
                   style={{ color: "var(--apagado)" }}>
                Qué la mueve
              </div>
              <ul className="mt-1.5">
                {AYUDAS[ayuda].mueve.map((m, i) => (
                  <li key={i} className="mb-1 flex gap-2 text-[11px] leading-snug"
                      style={{ color: "var(--tenue)" }}>
                    <span style={{ color: "var(--apagado)" }}>·</span>{m}
                  </li>
                ))}
              </ul>
            </>)}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- piezas

/** Un aporte al OVR, en el costado de la card: etiqueta a la izquierda, cifra a la derecha. */
/**
 * Una de las cosas que mueven el OVR, en su propia fichita.
 *
 * El color de la ficha es el signo: verde si suma, roja si resta, apagada si
 * no mueve nada. Así se ve de un golpe qué está tirando para arriba y qué
 * para abajo, sin tener que leer cada número.
 */
function Aporte({ etiqueta, valor }: { etiqueta: string; valor: number }) {
  const n = Math.round(valor);
  const color = n > 0 ? "#5fd08c" : n < 0 ? "#e8695c" : "#8a9a92";
  return (
    <span className="min-w-0 flex-1 rounded-md px-1 py-1 text-center"
          style={{
            background: `color-mix(in srgb, ${color} 15%, transparent)`,
            boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${color} 35%, transparent)`,
          }}>
      <span className="block truncate text-[8px] uppercase tracking-[0.06em]"
            style={{ color: "var(--apagado)" }}>
        {etiqueta}
      </span>
      <span className="num block text-[14px] font-extrabold leading-tight" style={{ color }}>
        {n === 0 ? "0" : `${n > 0 ? "+" : "−"}${Math.abs(n)}`}
      </span>
    </span>
  );
}

/**
 * Una parte del nivel: cuánto pone hoy y cómo se sube.
 *
 * El número solo no sirve de nada si no viene con qué hacer al respecto, y la
 * respuesta es distinta para cada uno: la hinchada se sube con el precio de la
 * entrada y el físico rotando. Son dos cosas que no tienen nada que ver, y
 * antes estaban en la misma lista suelta.
 */
function ParteConComo({ etiqueta, valor, como, base, siempre }: {
  etiqueta: string; valor: number; como: string; base?: boolean; siempre?: boolean;
}) {
  const n = Math.round(valor * 10) / 10;
  if (!base && !siempre && Math.abs(n) < 0.05) return null;
  const color = base ? "var(--blanco)"
    : n > 0 ? "#5fd08c" : n < 0 ? "#e8695c" : "var(--apagado)";
  return (
    <div className="mb-1 rounded-lg px-2.5 py-2" style={{ background: "var(--carbon)" }}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[12px] font-bold">{etiqueta}</span>
        <span className="num shrink-0 text-[14px] font-extrabold" style={{ color }}>
          {base ? n : n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0"}
        </span>
      </div>
      <p className="mt-0.5 text-[10px] leading-snug" style={{ color: "var(--tenue)" }}>
        {como}
      </p>
    </div>
  );
}

/** Un renglón del desglose del OVR: el que suma, en verde; el que resta, rojo. */
function ParteOvr({ etiqueta, valor, base, fuerte, siempre }: {
  etiqueta: string; valor: number; base?: boolean; fuerte?: boolean; siempre?: boolean;
}) {
  const redondo = Math.round(valor * 10) / 10;
  // el ánimo se muestra aunque no mueva nada: saber que está en 70 es el dato
  if (!base && !siempre && Math.abs(redondo) < 0.05) return null;
  return (
    <div className="flex items-baseline justify-between py-[3px]">
      <span className="text-[11px]" style={{ color: fuerte ? "var(--blanco)" : "var(--tenue)" }}>
        {etiqueta}
      </span>
      <span className="num text-[13px]"
            style={{ color: base ? "var(--blanco)"
              : redondo > 0 ? "var(--cesped)" : "var(--ladrillo)",
              fontWeight: fuerte ? 800 : 400 }}>
        {base ? redondo : `${redondo > 0 ? "+" : "−"}${Math.abs(redondo).toFixed(1)}`}
      </span>
    </div>
  );
}

function Punto({ color }: { color: string }) {
  return <span className="block h-2 w-2 rounded-full" style={{ background: color }} />;
}

/** Tarjeta del tablero: un dato grande, un pie y, si hace falta, una alerta. */
/**
 * Cada copa tiene su color, como en la tele: la Sudamericana es azul y la
 * Libertadores es negra y dorada. Una card genérica para las dos haría que
 * llegar a la Libertadores no se sintiera distinto.
 */
const COPAS = {
  sudamericana: {
    nombre: "Sudamericana",
    acento: "#5fb0e8",
    fondo: "linear-gradient(155deg, #1b3f63, #10233a 58%, #0a1523)",
    halo: "rgba(120,190,255,0.30)",
  },
  libertadores: {
    nombre: "Libertadores",
    acento: "#e8c25a",
    fondo: "linear-gradient(155deg, #2c2412, #14110a 58%, #0b0906)",
    halo: "rgba(240,210,130,0.30)",
  },
} as const;

function CardCopa({ copa, ronda, rival, escudo, onClick }: {
  copa: keyof typeof COPAS;
  ronda: string; rival: string | null; escudo?: string;
  onClick: () => void;
}) {
  const c = COPAS[copa];
  return (
    <button onClick={onClick}
      className="relieve relative flex items-center gap-2 overflow-hidden rounded-lg px-2.5 py-2 text-left"
      style={{ background: c.fondo, boxShadow: `inset 0 0 0 1px ${c.halo}` }}>
      <span className="absolute -left-8 -top-10 h-24 w-28 rounded-full"
            style={{ background: `radial-gradient(closest-side, ${c.halo}, transparent)`,
                     filter: "blur(14px)" }} />
      <span className="relative min-w-0 flex-1">
        <span className="block text-[9px] uppercase tracking-[0.14em]" style={{ color: c.acento }}>
          {c.nombre}
        </span>
        <span className="apellido mt-1 block truncate text-[17px] leading-none">{ronda}</span>
        <span className="mt-0.5 block truncate text-[10px]" style={{ color: "var(--tenue)" }}>
          {rival ? `vs ${rival}` : "sin rival"}
        </span>
      </span>
      {/* el escudo del rival, grande y al medio: es la cara del cruce */}
      {escudo && (
        <span className="relative shrink-0">
          <Escudo id={escudo} nombre={rival ?? ""} tam={44} />
        </span>
      )}
    </button>
  );
}

function Modulo({ titulo, color, icono, principal, numero, sufijo, pie, alerta, escudo, onClick }: {
  titulo: string; color: string; icono: ClaveIcono; principal?: string;
  numero?: number; sufijo?: string;
  pie: string; alerta?: string; escudo?: string; onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="relieve rounded-lg p-2.5 text-left"
            style={{
              background: `linear-gradient(160deg,
                color-mix(in srgb, ${color} 20%, var(--carbon-alto)),
                color-mix(in srgb, ${color} 8%, var(--carbon)))`,
            }}>
      <div className="flex items-start justify-between gap-1">
        <span className="text-[9px] uppercase tracking-[0.14em]" style={{ color }}>{titulo}</span>
        {escudo
          ? <Escudo id={escudo} nombre={titulo} tam={34} />
          : <IconoModulo clave={icono} color={color} tam={30} />}
      </div>
      <div className="apellido mt-1 truncate text-[19px] leading-none">
        {numero !== undefined
          ? <><Numero valor={numero} className="num" />{sufijo}</>
          : principal}
      </div>
      <div className="mt-0.5 truncate text-[10px]" style={{ color: "var(--tenue)" }}>{pie}</div>
      {alerta && (
        <div className="respirar mt-1.5 inline-block rounded px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wider"
             style={{ background: "#c0392b", color: "#ffffff" }}>
          {alerta}
        </div>
      )}
    </button>
  );
}

function Medidor({ etiqueta, valor, color, onClick }: {
  etiqueta: string; valor: number; color: string; onClick?: () => void;
}) {
  // Cuánto se movió desde la última vez, para mostrarlo al lado del número.
  const previo = useRef(valor);
  const [delta, setDelta] = useState<number | null>(null);
  useEffect(() => {
    const d = Math.round(valor) - Math.round(previo.current);
    previo.current = valor;
    if (!d) return;
    setDelta(d);
    const t = setTimeout(() => setDelta(null), 1500);
    return () => clearTimeout(t);
  }, [valor]);

  return (
    <button className="relative flex-1 text-left" onClick={onClick}>
      {delta !== null && (
        <span className="delta num absolute right-0 top-3 text-[11px]"
              style={{ color: delta > 0 ? "var(--cesped)" : "var(--ladrillo)" }}>
          {delta > 0 ? `+${delta}` : `−${Math.abs(delta)}`}
        </span>
      )}
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-[8px] uppercase tracking-[0.14em]" style={{ color: "var(--apagado)" }}>
          {etiqueta}
        </span>
        <Numero valor={valor} className="num text-[10px]" style={{ color }} />
      </div>
      <div className="h-1.5 overflow-hidden rounded-full relieve" style={{ background: "var(--linea)" }}>
        <div className="barra-llena h-full rounded-full"
             style={{ width: `${valor}%`,
                      background: `linear-gradient(90deg, color-mix(in srgb, ${color} 55%, #000), ${color})` }} />
      </div>
    </button>
  );
}

function Sub({ titulo, onVolver, children }: {
  titulo: string; onVolver: () => void; children: React.ReactNode;
}) {
  return (
    <div className="app pantalla">
      <header className="flex items-center gap-3 px-4 pb-2 pt-3">
        <button onClick={onVolver} className="rounded-md px-2 py-1 text-[12px] font-bold"
                style={{ background: "var(--carbon)", color: "var(--tenue)" }}>←</button>
        <h1 className="apellido text-[20px] leading-none">{titulo}</h1>
      </header>
      <div className="scroll-y escalona min-h-0 flex-1 px-3 pb-4">{children}</div>
    </div>
  );
}

const SECCIONES = [
  { clave: "primero", titulo: "Primer equipo", pie: "compiten cada fecha" },
  { clave: "reserva", titulo: "Reserva", pie: "subilos con ↑ para poder usarlos" },
] as const;

function VistaPlantel({ plantel, partida, onGuardarEquipos, onMoverReserva }: {
  plantel: ReturnType<typeof plantelDe>;
  partida: Partida;
  onGuardarEquipos: (e: EquipoGuardado[]) => void;
  onMoverReserva: (id: string, aReserva: boolean) => void;
}) {
  const orden = ["ARQ", "DEF", "MED", "DEL"];
  const [pestana, setPestana] = useState<"lista" | "equipos">("lista");
  const [ficha, setFicha] = useState<string | null>(null);
  useAtras(pestana === "equipos", () => setPestana("lista"));
  useAtras(ficha !== null, () => setFicha(null));

  // contexto neutro: la ficha muestra en qué puestos rinde, no simula un partido
  const ctxFicha = useMemo(() => partidoDe(partida)?.ctx ?? {
    fecha: partida.dia, competencia: "clausura" as const, esLocal: true,
    rivalFuerza: 62, rivalNombre: "—", viajeKm: 0, alturaM: 43,
    diasDescanso: 6, esClasico: false,
  }, [partida]);

  if (pestana === "equipos") {
    return (
      <VistaEquipos partida={partida} plantel={plantel}
        onGuardar={onGuardarEquipos} onVolver={() => setPestana("lista")} />
    );
  }

  return (
    <>
      <div className="mb-2 flex gap-1">
        <button className="flex-1 rounded-md py-1.5 text-[10px] font-bold uppercase tracking-wider"
                style={{ background: "var(--blanco)", color: "var(--negro)" }}>
          Plantel
        </button>
        <button onClick={() => setPestana("equipos")}
                className="flex-1 rounded-md py-1.5 text-[10px] font-bold uppercase tracking-wider"
                style={{ background: "var(--carbon)", color: "var(--tenue)" }}>
          Equipos{partida.equipos.length ? ` · ${partida.equipos.length}` : ""}
        </button>
      </div>
      <div className="mb-2 rounded-lg px-3 py-2" style={{ background: "var(--carbon)" }}>
        <div className="flex items-baseline justify-between text-[11px]">
          <span style={{ color: "var(--tenue)" }}>Minutos Sub-18</span>
          <span className="num">{partida.minutosSub18} / 900</span>
        </div>
        <div className="mt-0.5 text-[9px]"
             style={{ color: estadoSub18(partida).alcanza ? "var(--apagado)" : "var(--ladrillo)" }}>
          {estadoSub18(partida).cumplido
            ? "Cumplido"
            : estadoSub18(partida).alcanza
              ? `Alcanza si juegan seguido`
              : `No llegás: la APF descuenta 3 puntos al final`}
        </div>
        <div className="mt-1.5 h-1 overflow-hidden rounded-full" style={{ background: "var(--linea)" }}>
          <div className="h-full rounded-full"
               style={{ width: `${Math.min(100, (partida.minutosSub18 / 900) * 100)}%`,
                        background: partida.minutosSub18 >= 900 ? "#3fa76a" : "#d9a832" }} />
        </div>
      </div>

      {(() => {
        const activos = plantel.filter(
          (j) => partida.plantel[j.id]?.lesionadoHasta !== "2099-01-01");
        const reserva = activos.filter((j) => j.reserva).length;
        // los mismos que cuenta la insignia del botón, para que el número cierre
        const fuera = activos.filter((j) => j.suspendido || j.lesionado_hasta).length;
        return (
          <div className="mb-2 flex items-baseline justify-between text-[10px]">
            <span style={{ color: "var(--tenue)" }}>
              Primer equipo <span className="num">{activos.length - reserva}</span>
              {reserva > 0 && (
                <> · reserva <span className="num">{reserva}</span></>
              )}
              {fuera > 0 && (
                <span style={{ color: "var(--ladrillo)" }}>
                  {" · "}<span className="num">{fuera}</span> {fuera === 1 ? "baja" : "bajas"}
                </span>
              )}
            </span>
            <span style={{ color: "var(--apagado)" }}>tocá a uno para ver su ficha</span>
          </div>
        );
      })()}

      {SECCIONES.map(({ clave, titulo, pie }) => {
        const js = [...plantel]
          .filter((j) => partida.plantel[j.id]?.lesionadoHasta !== "2099-01-01")
          .filter((j) => (clave === "reserva" ? j.reserva : !j.reserva))
          .sort((a, b) => orden.indexOf(a.posicion) - orden.indexOf(b.posicion) || b.nivel - a.nivel);
        if (!js.length) return null;
        return (
          <div key={clave} className="mb-3">
            <div className="mb-1 flex items-baseline justify-between">
              <span className="text-[9px] uppercase tracking-[0.16em]"
                    style={{ color: clave === "reserva" ? "var(--apagado)" : "var(--tenue)" }}>
                {titulo}
              </span>
              <span className="text-[9px]" style={{ color: "var(--apagado)" }}>{pie}</span>
            </div>
            {js.map((j) => {
          const e = partida.plantel[j.id];
          const fuera = j.suspendido ? "SUSPENDIDO" : j.lesionado_hasta ? "LESIONADO" : null;
          return (
            <button key={j.id} onClick={() => setFicha(j.id)}
              className="mb-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left"
              style={{ background: fuera
                ? "color-mix(in srgb, #c0392b 16%, var(--carbon))" : "var(--carbon)" }}>
              {/*
                * El mismo aro que las canchas: cómo llega, de un vistazo.
                *
                * Acá había un tercer idioma para decir lo mismo que ya se dice
                * en otras dos pantallas: "100%" y "bien" por un lado, el aro
                * por otro y el nivel efectivo por otro. Ahora es uno solo en
                * todo el juego: el aro dice cómo llega y el número al lado del
                * nivel dice cuánto vale eso en puntos.
                */}
              <span className="relative flex shrink-0 items-center justify-center"
                    style={{ width: 30, height: 30 }}>
                <span className="absolute inset-0 rounded-full"
                      style={{
                        background: `conic-gradient(from -90deg, ${
                          colorComoLlega(comoLlegaAlPartido(j, j.posicion, ctxFicha))} ${
                          aroDe(comoLlegaAlPartido(j, j.posicion, ctxFicha)) * 360}deg,
                          rgba(255,255,255,0.14) ${
                          aroDe(comoLlegaAlPartido(j, j.posicion, ctxFicha)) * 360}deg)`,
                      }} />
                <span className="absolute rounded-full"
                      style={{ inset: 3, background: "var(--carbon)" }} />
                <span className="relative"><Dorsal numero={j.numero} tam={22} /></span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="apellido block truncate text-[12px]">
                  {j.apellido}
                  {esSub18(j) && (
                    <span className="ml-1.5 rounded px-1 text-[8px] font-extrabold"
                          style={{ background: "#3fa76a", color: "#0a120d" }}>S18</span>
                  )}
                </span>
                <span className="text-[9px]" style={{ color: "var(--apagado)" }}>
                  {j.edad} años · {e?.minutos ?? 0} min
                  {(e?.golesTorneo ?? 0) > 0 && ` · ${e.golesTorneo}g`}
                  {(e?.amarillas ?? 0) > 0 && ` · ${e.amarillas}🟨`}
                </span>
              </span>
              {fuera && (
                <span className="rounded px-1 text-[8px] font-extrabold uppercase"
                      style={{ background: "#c0392b", color: "#0a120d" }}>{fuera}</span>
              )}
              {/* El de la ficha, quieto, y al lado lo que se mueve hoy. */}
              <span className="flex shrink-0 items-baseline gap-1">
                <span className="num text-[15px]"
                      style={{ color: j.aRevelar ? "var(--medio)" : undefined }}>
                  {j.aRevelar ? "?" : j.nivel}
                </span>
                {!j.aRevelar && <Delta valor={deltaNivel(j, j.posicion, ctxFicha)} tam={9} />}
              </span>
              <span
                role="button" tabIndex={0}
                onClick={(ev) => { ev.stopPropagation(); onMoverReserva(j.id, !j.reserva); }}
                className="shrink-0 rounded px-1.5 py-1 text-[9px] font-bold"
                style={{ background: "var(--linea)", color: "var(--tenue)" }}>
                {j.reserva ? "↑" : "↓"}
              </span>
            </button>
          );
        })}
          </div>
        );
      })}

      {ficha && (() => {
        const j = plantel.find((x) => x.id === ficha);
        return j ? (
          <FichaJugador jugador={j} estado={partida.plantel[j.id]} ctx={ctxFicha}
                        onCerrar={() => setFicha(null)} />
        ) : null;
      })()}
    </>
  );
}

function VistaTabla({ tabla }: { tabla: ReturnType<typeof tablaDe> }) {
  return (
    <>
      <div className="mb-1 flex items-center gap-2 px-2 text-[9px] uppercase tracking-wider"
           style={{ color: "var(--apagado)" }}>
        <span className="w-4" /><span className="flex-1">Equipo</span>
        <span className="w-6 text-center">PJ</span>
        <span className="w-7 text-center">DG</span>
        <span className="w-7 text-center">Pts</span>
      </div>
      {tabla.map((f, i) => (
        <div key={f.id} className="mb-1 flex items-center gap-2 rounded-md px-2 py-1.5"
          style={{ background: f.id === "olimpia"
            ? "color-mix(in srgb, #ffffff 15%, var(--carbon))" : "var(--carbon)" }}>
          <span className="num w-4 text-[11px]"
                style={{ color: i < 1 ? "#3fa76a" : i >= 10 ? "#c0392b" : "var(--apagado)" }}>{i + 1}</span>
          <Escudo id={f.id} nombre={f.nombre} tam={18} />
          <span className="apellido min-w-0 flex-1 truncate text-[11px]">
            {nombreCorto(f.id, f.nombre)}
          </span>
          <span className="num w-6 text-center text-[11px]" style={{ color: "var(--tenue)" }}>{f.pj}</span>
          <span className="num w-7 text-center text-[11px]" style={{ color: "var(--tenue)" }}>
            {f.dg > 0 ? `+${f.dg}` : f.dg}
          </span>
          <span className="num w-7 text-center text-[13px]">{f.pts}</span>
        </div>
      ))}
    </>
  );
}

/**
 * El fixture con las dos competencias: el Clausura fecha a fecha y el camino
 * de la Sudamericana, que antes solo se veía entrando a la copa.
 */
function VistaFixture({ partida, tabla }: {
  partida: Partida; tabla: ReturnType<typeof tablaDe>;
}) {
  /* La tabla vivía en una card propia del tablero. Está mejor acá: el que
     mira el fixture es el que quiere saber cómo va el torneo. */
  const [comp, setComp] = useState<"todo" | "clausura" | "copa" | "tabla">("todo");

  const liga = partidosDeOlimpia().map((p, i) => ({
    clave: `liga-${i}`,
    orden: p.ctx.fecha,
    competencia: "clausura" as const,
    etiqueta: `F${i + 1}`,
    fecha: p.ctx.fecha,
    esLocal: p.ctx.esLocal,
    rivalId: p.rivalId,
    rivalNombre: p.rivalNombre,
    resultado: partida.resultados.find((x) => x.fechaNumero === i + 1) ?? null,
    esProximo: i + 1 === partida.fechaActual,
  }));

  const RONDAS = ["octavos", "cuartos", "semis", "final"] as const;
  const NOMBRE: Record<string, string> = {
    octavos: "8vos", cuartos: "4tos", semis: "Semi", final: "Final",
  };
  const indiceActual = RONDAS.indexOf(partida.copa.ronda as "octavos");

  const copa = RONDAS.flatMap((r) => {
    const cal = CALENDARIO_COPA[r];
    const esActual = partida.copa.ronda === r;
    const yaPaso = partida.copa.ronda === "campeon" || indiceActual > RONDAS.indexOf(r);
    // el rival solo se conoce en la ronda que se está jugando; más adelante se
    // sabe la fecha pero todavía no contra quién
    const rival = esActual
      ? (RIVALES_COPA as any[]).find((x) => x.id === partida.copa.rivalId)
      : null;
    // en la final se juega un partido solo, en el resto ida y vuelta
    const patas = r === "final"
      ? [{ dia: cal.ida, mano: "único" }]
      : [{ dia: cal.ida, mano: "ida" }, { dia: cal.vuelta, mano: "vuelta" }];
    return patas.map((pata, k) => ({
      clave: `copa-${r}-${k}`,
      orden: pata.dia,
      competencia: "copa" as const,
      etiqueta: NOMBRE[r],
      fecha: pata.dia,
      // de local en la vuelta, que es como cayó el sorteo
      esLocal: r === "final" ? false : pata.mano === "vuelta",
      neutral: r === "final",
      rivalId: esActual ? partida.copa.rivalId : "",
      rivalNombre: r === "final" && !rival
        ? "Final en Barranquilla"
        : rival?.nombre ?? "Por definir",
      resultado: null,
      esProximo: esActual,
      mano: pata.mano,
      yaPaso,
    }));
  });

  const eliminado = partida.copa.ronda === "eliminado";
  const items = (comp === "clausura" ? liga : comp === "copa" ? copa
    : comp === "tabla" ? [] : [...liga, ...copa])
    .sort((a, b) => a.orden.localeCompare(b.orden));

  return (
    <>
      <div className="mb-2 flex gap-1">
        {/* El diario ya no es una pestaña de acá: se abre tocando la última
            noticia de la pantalla principal, que es de donde uno quiere
            enterarse del resto. */}
        {([["todo", "Todo"], ["clausura", "Clausura"], ["copa", "Copa"],
           ["tabla", "Tabla"]] as const)
          .map(([id, texto]) => (
            <button key={id} onClick={() => setComp(id)}
              className="flex-1 rounded-md py-1.5 text-[10px] font-bold uppercase tracking-wider"
              style={{
                background: comp === id ? "var(--blanco)" : "var(--carbon)",
                color: comp === id ? "var(--negro)" : "var(--tenue)",
              }}>
              {texto}
            </button>
          ))}
      </div>

      {comp === "tabla" && <VistaTabla tabla={tabla} />}

      {comp !== "tabla" && comp !== "clausura" && eliminado && (
        <div className="mb-2 rounded-md px-2.5 py-2 text-[11px]"
             style={{ background: "var(--carbon)", color: "var(--tenue)" }}>
          Olimpia quedó afuera de la Sudamericana.
        </div>
      )}

      {comp !== "tabla" && items.map((p) => {
        const r = p.resultado;
        const color = r
          ? r.golesOlimpia > r.golesRival ? "#3fa76a"
            : r.golesOlimpia === r.golesRival ? "#8fa396" : "#c0392b"
          : null;
        const esCopa = p.competencia === "copa";
        return (
          <div key={p.clave} className="mb-1 flex items-center gap-2 rounded-md px-2 py-1.5"
            style={{
              background: p.esProximo
                ? "color-mix(in srgb, #ffffff 15%, var(--carbon))"
                : esCopa ? "color-mix(in srgb, #d9a832 10%, var(--carbon))" : "var(--carbon)",
              opacity: r ? 0.75 : esCopa && eliminado ? 0.4 : 1,
            }}>
            <span className="num w-8 shrink-0 text-[10px]"
                  style={{ color: esCopa ? "#d9a832" : "var(--apagado)" }}>
              {p.etiqueta}
            </span>
            <span className="w-4 shrink-0 text-center text-[9px] font-bold"
                  style={{ color: "neutral" in p && p.neutral ? "var(--apagado)"
                    : p.esLocal ? "#3fa76a" : "#d9a832" }}>
              {"neutral" in p && p.neutral ? "N" : p.esLocal ? "L" : "V"}
            </span>
            {p.rivalId
              ? <Escudo id={p.rivalId} nombre={p.rivalNombre} tam={18} />
              : <span className="h-[18px] w-[18px] shrink-0 rounded-full"
                      style={{ background: "var(--linea)" }} />}
            <span className="apellido min-w-0 flex-1 truncate text-[11px]">
              {p.rivalId
                ? nombreCorto(p.rivalId, p.rivalNombre)
                : p.rivalNombre}
              {esCopa && "mano" in p && p.mano !== "único" && (
                <span className="ml-1 text-[9px] font-normal" style={{ color: "var(--apagado)" }}>
                  {p.mano}
                </span>
              )}
            </span>
            {r ? (
              <span className="num rounded px-1.5 py-0.5 text-[11px]"
                    style={{ background: color!, color: "#0a120d" }}>
                {r.golesOlimpia}-{r.golesRival}
              </span>
            ) : (
              <span className="text-[10px]" style={{ color: "var(--apagado)" }}>
                {p.fecha.slice(8, 10)}/{p.fecha.slice(5, 7)}
              </span>
            )}
          </div>
        );
      })}
    </>
  );
}

function VistaCopa({ partida }: { partida: Partida }) {
  const c = partida.copa;
  const rondas = ["octavos", "cuartos", "semis", "final"] as const;
  const nombres: Record<string, string> = {
    octavos: "Octavos de final", cuartos: "Cuartos de final",
    semis: "Semifinal", final: "Final en Barranquilla",
  };
  const indiceActual = rondas.indexOf(c.ronda as "octavos");

  return (
    <>
      <div className="mb-3 rounded-xl p-3" style={{ background: "color-mix(in srgb, #d9a832 14%, var(--carbon))" }}>
        <div className="text-[9px] uppercase tracking-[0.16em]" style={{ color: "#d9a832" }}>
          Copa Sudamericana 2026
        </div>
        <div className="apellido mt-1 text-[18px]">
          {c.ronda === "campeon" ? "OLIMPIA CAMPEÓN"
            : c.ronda === "eliminado" ? "Eliminado"
            : nombres[c.ronda]}
        </div>
        {c.ronda !== "campeon" && c.ronda !== "eliminado" && c.jugadosEnRonda === 1 && (
          <div className="num mt-1 text-[13px]" style={{ color: "var(--tenue)" }}>
            Global: {c.globalO} - {c.globalR}
          </div>
        )}
      </div>

      {rondas.map((r, i) => {
        const pasada = c.ronda === "campeon" || indiceActual > i;
        const actual = c.ronda === r;
        const cal = CALENDARIO_COPA[r];
        return (
          <div key={r} className="mb-1.5 rounded-lg p-2.5"
               style={{
                 background: actual ? "color-mix(in srgb, #d9a832 18%, var(--carbon))" : "var(--carbon)",
                 opacity: !actual && !pasada && c.ronda !== "eliminado" ? 0.55 : 1,
               }}>
            <div className="flex items-center gap-2">
              {actual && <Escudo id={c.rivalId} nombre={c.rivalId} tam={22} />}
              <span className="min-w-0 flex-1">
                <span className="apellido block text-[13px]">{nombres[r]}</span>
                <span className="text-[10px]" style={{ color: "var(--apagado)" }}>
                  {r === "final" ? cal.ida.slice(8, 10) + "/" + cal.ida.slice(5, 7)
                    : `${cal.ida.slice(8, 10)}/${cal.ida.slice(5, 7)} y ${cal.vuelta.slice(8, 10)}/${cal.vuelta.slice(5, 7)}`}
                </span>
              </span>
              {pasada && (
                <span className="rounded px-1.5 py-0.5 text-[9px] font-extrabold uppercase"
                      style={{ background: "#3fa76a", color: "#0a120d" }}>Pasó</span>
              )}
              {actual && c.ronda !== "eliminado" && (
                <span className="rounded px-1.5 py-0.5 text-[9px] font-extrabold uppercase"
                      style={{ background: "#d9a832", color: "#0a120d" }}>Ahora</span>
              )}
            </div>
          </div>
        );
      })}

      <p className="mt-3 px-2 text-[10px] leading-relaxed" style={{ color: "var(--apagado)" }}>
        Ida y vuelta, sin gol de visitante y sin alargue: si el global termina empatado, se define
        por penales. La final es a partido único en el Metropolitano de Barranquilla.
      </p>
    </>
  );
}

/** Cómo se ve cada cosa que pasa. Lo importante no puede leerse como el resto. */
const MARCA: Record<string, { color: string; icono: string; etiqueta: string }> = {
  victoria: { color: "#3fa76a", icono: "✔", etiqueta: "Ganó" },
  empate:   { color: "#8fa396", icono: "=", etiqueta: "Empató" },
  derrota:  { color: "#c0392b", icono: "✕", etiqueta: "Perdió" },
  titulo:   { color: "#e8c25a", icono: "★", etiqueta: "Título" },
  golpe:    { color: "#c0392b", icono: "!", etiqueta: "Golpe" },
  plata:    { color: "#e0902a", icono: "$", etiqueta: "Caja" },
  aviso:    { color: "#d9a832", icono: "!", etiqueta: "Atención" },
};

function VistaBitacora({ partida }: { partida: Partida }) {
  return (
    <>
      {[...partida.bitacora].reverse().map((b, i) => {
        const m = b.marca ? MARCA[b.marca] : null;

        // Lo que pasó de verdad va en tarjeta, con su color y su marcador.
        if (m) {
          return (
            <div key={i} className="relieve mb-1.5 flex items-center gap-2.5 rounded-lg px-2.5 py-2"
                 style={{
                   background: `linear-gradient(160deg,
                     color-mix(in srgb, ${m.color} 22%, var(--carbon-alto)),
                     color-mix(in srgb, ${m.color} 7%, var(--carbon)))`,
                 }}>
              {b.cifra ? (
                <span className="num shrink-0 rounded-md px-2 py-1 text-[15px] leading-none"
                      style={{ background: m.color, color: "#0a120d" }}>
                  {b.cifra}
                </span>
              ) : (
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[13px] font-extrabold"
                      style={{ background: m.color, color: "#0a120d" }}>
                  {m.icono}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block text-[8px] uppercase tracking-[0.16em]" style={{ color: m.color }}>
                  {m.etiqueta}
                </span>
                <span className="block text-[11px] leading-snug">{b.texto}</span>
              </span>
              <span className="num shrink-0 text-[9px]" style={{ color: "var(--apagado)" }}>
                {b.dia.slice(8, 10)}/{b.dia.slice(5, 7)}
              </span>
            </div>
          );
        }

        return (
          <div key={i} className="mb-1 flex gap-2 rounded-md px-2 py-1.5 text-[11px]"
               style={{ background: "var(--carbon)" }}>
            <span className="num shrink-0" style={{ color: "var(--apagado)" }}>
              {b.dia.slice(8, 10)}/{b.dia.slice(5, 7)}
            </span>
            <span style={{ color: "var(--tenue)" }}>{b.texto}</span>
          </div>
        );
      })}
    </>
  );
}


/**
 * Equipos guardados: armar un once con calma fuera del día de partido y
 * ponerlo después de un toque. Sirve para tener listo el equipo alternativo
 * del Clausura sin desarmar el titular que va a jugar la copa.
 */
function VistaEquipos({ partida, plantel, onGuardar, onVolver }: {
  partida: Partida;
  plantel: ReturnType<typeof plantelDe>;
  onGuardar: (e: EquipoGuardado[]) => void;
  onVolver: () => void;
}) {
  const [editando, setEditando] = useState<string | null>(null);
  const [nombreNuevo, setNombreNuevo] = useState("");
  useAtras(editando !== null, () => setEditando(null));

  // Se arma con todo el plantel, no solo con los disponibles hoy: un equipo
  // guardado es un plan, y para cuando lo uses el lesionado ya puede estar bien.
  const porId = useMemo(() => new Map(plantel.map((j) => [j.id, j])), [plantel]);

  // Contexto neutro: sirve para ordenar y valorar puestos, no para jugar.
  const ctx = useMemo(() => {
    const m = partidoDe(partida);
    return m?.ctx ?? {
      fecha: partida.dia, competencia: "clausura" as const, esLocal: true,
      rivalFuerza: 62, rivalNombre: "—", viajeKm: 0, alturaM: 43,
      diasDescanso: 6, esClasico: false,
    };
  }, [partida]);

  const equipo = partida.equipos.find((e) => e.nombre === editando);
  const [estado, setEstado] = useState<EstadoAlineacion>(() =>
    equipo
      ? { formacion: equipo.formacion,
          alineado: comoLoDejaste(equipo, (id) => porId.has(id)) }
      : { formacion: "4-3-3", alineado: new Array(11).fill(null) });

  if (editando !== null) {
    const once = estado.alineado.filter(Boolean).length;
    return (
      // h-full porque el contenedor de las subvistas scrollea: sin altura
      // propia la cancha, que crece con flex-1, colapsaría a cero
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <div className="mb-1 flex items-center justify-between">
          <span className="apellido text-[14px]">{editando}</span>
          <span className="num text-[12px]"
                style={{ color: once === 11 ? "var(--cesped)" : "var(--medio)" }}>
            {once}/11
          </span>
        </div>
        <Alineador aptos={plantel} ctx={ctx} estado={estado} onCambio={setEstado} />
        <div className="flex gap-1.5 pb-2 pt-1.5">
          <button onClick={() => setEditando(null)}
            className="flex-1 rounded-lg py-2.5 text-[11px] font-bold uppercase tracking-wider"
            style={{ background: "var(--carbon)", color: "var(--tenue)" }}>
            Cancelar
          </button>
          <button
            disabled={once !== 11}
            onClick={() => {
              const jugadores = estado.alineado.filter(Boolean) as string[];
              onGuardar(guardarEquipo(partida.equipos,
                { nombre: editando, formacion: estado.formacion, jugadores }));
              setEditando(null);
            }}
            className="flex-1 rounded-lg py-2.5 text-[11px] font-extrabold uppercase tracking-wider"
            style={{
              background: once === 11 ? "var(--blanco)" : "var(--carbon)",
              color: once === 11 ? "var(--negro)" : "var(--apagado)",
            }}>
            {once === 11 ? "Guardar" : `Faltan ${11 - once}`}
          </button>
        </div>
      </div>
    );
  }

  const abrir = (nombre: string) => {
    const e = partida.equipos.find((x) => x.nombre === nombre);
    if (e) {
      // exactamente como lo dejaste, casillero por casillero
      setEstado({ formacion: e.formacion, alineado: comoLoDejaste(e, (id) => porId.has(id)) });
    } else {
      // arranca con el mejor once posible, que es más útil que once huecos
      const mejores = [...plantel].sort((a, b) => b.nivel - a.nivel).slice(0, 11);
      setEstado(mejorMolde(mejores, ctx));
    }
    setEditando(nombre);
  };

  return (
    <>
      <div className="mb-2 flex gap-1">
        <button onClick={onVolver}
                className="flex-1 rounded-md py-1.5 text-[10px] font-bold uppercase tracking-wider"
                style={{ background: "var(--carbon)", color: "var(--tenue)" }}>
          Plantel
        </button>
        <button className="flex-1 rounded-md py-1.5 text-[10px] font-bold uppercase tracking-wider"
                style={{ background: "var(--blanco)", color: "var(--negro)" }}>
          Equipos
        </button>
      </div>

      <p className="mb-2 text-[11px] leading-relaxed" style={{ color: "var(--tenue)" }}>
        Dejá armados los onces que más usás y ponelos de un toque antes de cada
        partido. Un titular para la copa y un alternativo para el Clausura es la
        forma más rápida de rotar sin rearmar todo cada fecha.
      </p>

      {partida.equipos.map((e) => {
        const nivel = Math.round(
          e.jugadores.reduce((s, id) => s + (porId.get(id)?.nivel ?? 0), 0) /
          Math.max(1, e.jugadores.length));
        return (
          <div key={e.nombre} className="mb-1 flex items-center gap-2 rounded-md px-2.5 py-2"
               style={{ background: "var(--carbon)" }}>
            <span className="min-w-0 flex-1">
              <span className="apellido block truncate text-[13px] leading-tight">{e.nombre}</span>
              <span className="text-[9px] uppercase tracking-wider" style={{ color: "var(--apagado)" }}>
                {e.formacion} · nivel medio {nivel}
              </span>
            </span>
            <button onClick={() => abrir(e.nombre)}
              className="rounded px-2 py-1 text-[9px] font-bold uppercase tracking-wider"
              style={{ background: "var(--linea)", color: "var(--blanco)" }}>
              Editar
            </button>
            <button onClick={() => onGuardar(partida.equipos.filter((x) => x.nombre !== e.nombre))}
              className="rounded px-2 py-1 text-[9px] font-bold uppercase tracking-wider"
              style={{ background: "color-mix(in srgb, #c0392b 30%, var(--carbon))", color: "#e88" }}>
              Borrar
            </button>
          </div>
        );
      })}

      <div className="mt-2 flex gap-1.5">
        <input value={nombreNuevo} onChange={(e) => setNombreNuevo(e.target.value)}
          placeholder={partida.equipos.length === 0 ? "Titular" : "Nombre del equipo"}
          className="min-w-0 flex-1 rounded-lg px-3 py-2.5 text-[12px] outline-none"
          style={{ background: "var(--carbon)", color: "var(--blanco)" }} />
        <button
          onClick={() => {
            const nombre = nombreNuevo.trim() ||
              (partida.equipos.length === 0 ? "Titular" : `Equipo ${partida.equipos.length + 1}`);
            setNombreNuevo("");
            abrir(nombre);
          }}
          className="shrink-0 rounded-lg px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em]"
          style={{ background: "var(--blanco)", color: "var(--negro)" }}>
          Armar
        </button>
      </div>
    </>
  );
}
