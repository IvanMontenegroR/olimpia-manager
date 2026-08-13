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
import { colorCondicion, esSub18, nombreCorto, partidosDeOlimpia } from "@/lib/juego.ts";
import RIVALES_COPA from "@/data/rivales_internacionales.json";
import {
  CALENDARIO_COPA, OBJETIVO, TOTAL_FECHAS, borrar, diasAlPartido, esPartidoDeCopa,
  diasEntre, estadoSub18, formatoDia, hayPartidoHoy, miles, ocupacionDe, ovrDe, partidoDe, plantelDe,
  posicionDe, sumarDias,
  tablaDe, type EquipoGuardado, type Partida,
} from "@/lib/temporada.ts";
import Alineador, { type EstadoAlineacion } from "./Alineador.tsx";
import FichaJugador from "./FichaJugador.tsx";
import PantallaEstrella from "./PantallaEstrella.tsx";
import { ESTRELLAS } from "@/engine/estrellas.ts";
import { comoLlega, estadoRival } from "@/lib/rivales.ts";
import { TEXTO_ANIMO, animoDe } from "@/engine/tipos.ts";
import { mejorMolde, MOLDE_DE, repartirEnMolde } from "@/lib/juego.ts";

type Vista = "escritorio" | "plantel" | "fixture" | "mercado" | "bitacora"
  | "copa" | "estrella";
type Ayuda = "ovr" | "estadio" | "vestuario" | "hinchada" | "dirigencia";

/** Qué mide cada barra del encabezado y qué la mueve. */
const AYUDAS: Record<Ayuda, { titulo: string; texto: string; mueve: string[] }> = {
  ovr: {
    titulo: "El OVR del equipo",
    texto: "Lo que rinde tu once tal como llega al próximo partido. No es el " +
      "promedio de las fichas: es el número que de verdad se compara con el del " +
      "rival cuando se juega. Por eso el mismo plantel puede valer 60 un domingo " +
      "y 71 el otro.",
    mueve: [
      "El nivel de los jugadores que ponés: fichar sube el piso",
      "La confianza del plantel, que mueven las decisiones de la semana",
      "Cómo llegan de piernas después de jugar",
      "Jugar fuera de puesto: un lateral de central rinde menos",
      "Adónde se juega: la altura y el viaje descuentan; el Defensores lleno suma",
      "La línea blanca de la barra es el rival del domingo",
    ],
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
  onMoverReserva, onFicharEstrella, onRechazarEstrella, onJugarDirecto,
}: {
  partida: Partida;
  onAvanzar: () => void;
  onDirigir: () => void;
  onResolver: (asuntoId: string, opcionId: string) => void;
  onGuardarEquipos: (e: EquipoGuardado[]) => void;
  onMoverReserva: (id: string, aReserva: boolean) => void;
  onFicharEstrella: () => void;
  onRechazarEstrella: () => void;
  onJugarDirecto: () => void;
  onFichar: (fichajeId: string) => void;
  onReiniciar: () => void;
}) {
  const [vista, setVista] = useState<Vista>("escritorio");
  const [ayuda, setAyuda] = useState<Ayuda | null>(null);
  /** Borrar la partida es irreversible: se pregunta antes. */
  const [reiniciar, setReiniciar] = useState(false);
  /** El jugador que tocaste en la cancha de la pantalla principal. */
  const [fichaHome, setFichaHome] = useState<string | null>(null);
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
    if (!p) return { base: Math.round(ovr.plantel), lista: [] as { etiqueta: string; valor: number }[] };
    const crudos: { etiqueta: string; valor: number }[] = [
      { etiqueta: "confianza", valor: p.animo },
      { etiqueta: "piernas", valor: p.piernas },
      { etiqueta: "puesto", valor: p.puestos },
      { etiqueta: "localía", valor: p.cancha },
      { etiqueta: "viaje", valor: p.viaje },
    ];
    const lista = crudos
      .map((a) => ({ ...a, valor: Math.round(a.valor) }))
      .filter((a) => a.valor !== 0 || a.etiqueta === "confianza");
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
  const colorOvr = ovr.hoy >= 74 ? "#4fc07e" : ovr.hoy >= 66 ? "#e8c25a" : "#e0705f";

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
            <div className="mt-1 h-[3px] overflow-hidden rounded-full" style={{ background: "var(--linea)" }}>
              <div className="barra-llena h-full rounded-full"
                   style={{
                     width: `${(Math.min(partida.fechaActual - 1, TOTAL_FECHAS) / TOTAL_FECHAS) * 100}%`,
                     background: "linear-gradient(90deg, var(--cesped-hondo), var(--cesped))",
                   }} />
            </div>
          </div>
          <Numero valor={partida.dineroUsd} formato={(n) => miles(Math.round(n))}
                  className="num text-[13px]" style={{ color: "var(--cesped)" }} />
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

        <div className="mt-2 flex gap-2">
          <Medidor etiqueta="Vestuario" valor={partida.ambiente} color="#3fa76a"
                   onClick={() => setAyuda("vestuario")} />
          <Medidor etiqueta="Hinchada" valor={partida.hinchada} color="#d9a832"
                   onClick={() => setAyuda("hinchada")} />
          {/* El mercado, a mano y sin ocupar una card entera. */}
          <button onClick={() => setVista("mercado")}
            className="relieve relative flex h-[30px] w-[38px] shrink-0 items-center justify-center rounded-md"
            style={{ background: "var(--carbon)" }} aria-label="Fichajes">
            <IconoModulo clave="pases" color="#e0902a" tam={17} />
            {partida.fichajes.length > 0 && (
              <span className="num absolute -right-1 -top-1 rounded-full px-1 text-[8px] font-extrabold"
                    style={{ background: "#e0902a", color: "#0a120d" }}>
                {partida.fichajes.length}
              </span>
            )}
          </button>
        </div>
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
          const hoy = i === 0;
          return (
            <div key={dia}
              className={`flex w-[38px] shrink-0 flex-col items-center gap-0.5 rounded-md py-1 ${
                hoy ? "pasa-el-dia relieve-alto" : "relieve"}`}
              style={{
                background: hoy ? "var(--blanco)"
                  : copaHoy ? "color-mix(in srgb, #d9a832 30%, var(--carbon))"
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
                {copaHoy ? <Punto color="#d9a832" />
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
              className="relieve-alto relative overflow-hidden rounded-lg px-3 py-2.5 text-left"
              style={{ background: "linear-gradient(160deg, #16201b, #0c120f 70%)" }}>
              <span className="absolute -left-8 -top-10 h-24 w-28 rounded-full" style={{
                background: `radial-gradient(closest-side, color-mix(in srgb, ${colorOvr} 32%, transparent), transparent)`,
                filter: "blur(16px)",
              }} />
              <span className="absolute inset-0 rounded-lg"
                    style={{ boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${colorOvr} 32%, transparent)` }} />

              <span className="relative flex items-start gap-2.5">
                <span className="shrink-0">
                  <Numero valor={ovr.hoy} formato={(n) => String(Math.round(n))}
                          className="apellido block leading-[0.8]"
                          style={{ fontSize: 50, color: colorOvr,
                                   textShadow: `0 0 26px color-mix(in srgb, ${colorOvr} 55%, transparent)` }} />
                  <span className="mt-1.5 flex items-baseline gap-1">
                    <span className="num text-[13px]" style={{ color: "var(--tenue)" }}>
                      {aportes.base}
                    </span>
                    <span className="text-[8px] uppercase tracking-[0.12em]"
                          style={{ color: "var(--apagado)" }}>
                      plantel
                    </span>
                  </span>
                </span>

                <span className="min-w-0 flex-1">
                  {aportes.lista.slice(0, 4).map((a) => (
                    <Aporte key={a.etiqueta} etiqueta={a.etiqueta} valor={a.valor} />
                  ))}
                </span>
              </span>

              {(bajas.length > 0 || !sub18.alcanza) && (
                <span className="relative mt-1.5 flex flex-wrap gap-1">
                  {bajas.length > 0 && (
                    <span className="rounded px-1.5 py-[1px] text-[9px] font-extrabold uppercase"
                          style={{ background: "var(--ladrillo)", color: "var(--blanco)" }}>
                      {bajas.length} baja{bajas.length > 1 ? "s" : ""}
                    </span>
                  )}
                  {!sub18.alcanza && (
                    <span className="rounded px-1.5 py-[1px] text-[9px] font-extrabold uppercase"
                          style={{ background: "#e0902a", color: "#0a120d" }}>
                      Sub-18: {sub18.faltan}'
                    </span>
                  )}
                </span>
              )}
            </button>

            <Modulo titulo="Sudamericana" color="#d9a832" icono="copa" onClick={() => setVista("copa")}
              principal={NOMBRE_RONDA[partida.copa.ronda]}
              pie={rivalCopa ? `vs ${rivalCopa.nombre}` : "sin rival"}
              escudo={partida.copa.ronda !== "eliminado" && partida.copa.ronda !== "campeon"
                ? partida.copa.rivalId : undefined} />
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
              ctx={partido?.ctx ?? ({} as never)}
              animoDe={(j) => Math.round(partida.plantel[j.id]?.animo ?? 70)}
              bajaDe={(j) => j.lesionado_hasta ? "lesionado" : j.suspendido ? "suspendido" : null}
              onTocar={(j) => setFichaHome(j.id)}
              onModificar={() => setVista("plantel")} />
          </div>
        </div>
      )}

      {/* ---------- la acción del día ---------- */}
      {!pendiente && (
        <div className="px-3 pt-2">
          {esHoy && partido ? (
            /* Jugar directo es lo normal: el once sugerido ya es bueno y pasar
               por la pantalla de armado veintidós veces era un trámite. El que
               quiere tocar algo entra por "Armar". */
            <div className="flex gap-1.5">
              <button onClick={onJugarDirecto}
                className="relieve-alto flex min-w-0 flex-1 items-center gap-3 rounded-lg px-3 py-2.5"
                style={{ background: "var(--blanco)", color: "var(--negro)" }}>
                <Escudo id={partido.rivalId} nombre={partido.rivalNombre} tam={30} />
                <span className="min-w-0 flex-1 text-left">
                  <span className="block text-[9px] uppercase tracking-[0.14em] opacity-60">
                    {esPartidoDeCopa(partido) ? partido.etiqueta : "Hoy se juega"}
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
                  Jugar →
                </span>
              </button>
              <button onClick={onDirigir}
                className="relieve shrink-0 rounded-lg px-3 text-[10px] font-bold uppercase tracking-wider"
                style={{ background: "var(--carbon)", color: "var(--tenue)" }}>
                Armar<br />el once
              </button>
            </div>
          ) : partido ? (
            <button onClick={onAvanzar}
              className="relieve flex w-full items-center gap-3 rounded-lg px-3 py-2.5"
              style={{ background: "linear-gradient(160deg, var(--carbon-alto), var(--carbon))" }}>
              <span className="num flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[13px]"
                    style={{ background: "var(--blanco)", color: "var(--negro)" }}>
                +1
              </span>
              <span className="min-w-0 flex-1 text-left">
                <span className="block text-[9px] uppercase tracking-[0.14em]"
                      style={{ color: "var(--apagado)" }}>
                  Avanzar el día
                </span>
                <span className="block truncate text-[12px]" style={{ color: "var(--tenue)" }}>
                  {nombreCorto(partido.rivalId, partido.rivalNombre)} en {faltan} día{faltan === 1 ? "" : "s"}
                </span>
              </span>
              {/* Contra cuánto vas: es lo único del rival que hace falta saber
                  antes de que llegue el día. */}
              {ovr.rival !== null && (
                <span className="shrink-0 text-right">
                  <span className="block text-[8px] uppercase tracking-[0.14em]"
                        style={{ color: "var(--apagado)" }}>ovr</span>
                  <span className="num block text-[17px] leading-none"
                        style={{ color: ovr.hoy >= ovr.rival ? "var(--cesped)" : "var(--ladrillo)" }}>
                    {Math.round(ovr.rival)}
                  </span>
                </span>
              )}
              <Escudo id={partido.rivalId} nombre={partido.rivalNombre} tam={24} />
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
        {([["fixture", "Fixture", "#d9a832"], ["mercado", "Fichajes", "#e0902a"],
           ["bitacora", "Diario", "#8fa396"]] as const).map(([id, texto, color]) => (
          <button key={id} onClick={() => setVista(id)}
            className="rounded-md py-2 text-[9px] font-bold uppercase tracking-wider"
            style={{ background: `color-mix(in srgb, ${color} 14%, var(--carbon))`, color }}>
            {texto}
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
            {ayuda === "ovr" && ovr.partes && (
              <div className="mt-3 rounded-lg p-2.5" style={{ background: "var(--carbon)" }}>
                <ParteOvr etiqueta="El plantel que sale a jugar"
                          valor={Math.round(ovr.partes.base)} base />
                <ParteOvr etiqueta={`Confianza: cómo se sienten (${Math.round(ovr.partes.animoMedio)} de 100)`}
                          valor={ovr.partes.animo} siempre />
                <ParteOvr etiqueta="Piernas: cómo llegan de físico" valor={ovr.partes.piernas} />
                <ParteOvr etiqueta="Puesto: los que juegan fuera del suyo" valor={ovr.partes.puestos} />
                <ParteOvr etiqueta={partido?.ctx.esLocal
                            ? `Localía: el Defensores, ${Math.round(ocupacion * 100)}% lleno`
                            : "Localía: se juega afuera"}
                          valor={ovr.partes.cancha} />
                <ParteOvr etiqueta={partido?.ctx.esLocal ? "El viaje" : `Jugar en ${partido?.ciudad ?? "la de ellos"}`}
                          valor={ovr.partes.viaje} />
                <div className="my-1.5 h-px" style={{ background: "var(--linea)" }} />
                <ParteOvr etiqueta="Así llegás" valor={Math.round(ovr.partes.total)} base fuerte />
              </div>
            )}
            <div className="mt-3 text-[9px] uppercase tracking-[0.16em]" style={{ color: "var(--apagado)" }}>
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
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- piezas

/** Un aporte al OVR, en el costado de la card: etiqueta a la izquierda, cifra a la derecha. */
/**
 * Un aporte al OVR, con su barrita saliendo del centro.
 *
 * La barra existe para que se vea que es un número que se mueve: sale hacia la
 * derecha cuando suma y hacia la izquierda cuando resta, y crece con lo que
 * vale. Una columna de cifras sueltas parece una ficha técnica.
 */
function Aporte({ etiqueta, valor }: { etiqueta: string; valor: number }) {
  const n = Math.round(valor);
  const color = n > 0 ? "#5fd08c" : n < 0 ? "#e8695c" : "var(--apagado)";
  // seis puntos de aporte llenan media barra: es lo máximo que mueve una parte
  const largo = Math.min(50, (Math.abs(n) / 6) * 50);
  return (
    <span className="flex items-center gap-1.5 leading-[1.55]">
      <span className="min-w-0 flex-1 truncate text-[9px]" style={{ color: "var(--apagado)" }}>
        {etiqueta}
      </span>
      <span className="relative block h-[8px] w-[42px] shrink-0 rounded-sm"
            style={{ background: "rgba(255,255,255,0.07)" }}>
        <span className="absolute inset-y-0" style={{ left: "50%", width: 1, background: "rgba(255,255,255,0.22)" }} />
        <span className="absolute inset-y-[1.5px] rounded-[1px]"
              style={{
                left: n >= 0 ? "50%" : `${50 - largo}%`,
                width: `${largo}%`,
                background: color,
                boxShadow: `0 0 6px color-mix(in srgb, ${color} 55%, transparent)`,
                transition: "width 420ms ease-out, left 420ms ease-out",
              }} />
      </span>
      <span className="num w-[22px] shrink-0 text-right text-[11px] font-bold" style={{ color }}>
        {n === 0 ? "0" : `${n > 0 ? "+" : "−"}${Math.abs(n)}`}
      </span>
    </span>
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
        return (
          <div className="mb-2 flex items-baseline justify-between text-[10px]">
            <span style={{ color: "var(--tenue)" }}>
              Primer equipo <span className="num">{activos.length - reserva}</span>
              {reserva > 0 && (
                <> · reserva <span className="num">{reserva}</span></>
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
              <Dorsal numero={j.numero} tam={24} />
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
              <span className="w-10 text-right">
                <span className="num block text-[11px]" style={{ color: colorCondicion(j.condicion) }}>
                  {j.condicion}%
                </span>
                <span className="block text-[8px]"
                      style={{ color: (e?.animo ?? 70) < 45 ? "var(--medio)" : "var(--apagado)" }}>
                  {TEXTO_ANIMO[animoDe(e?.animo ?? 70)].toLowerCase()}
                </span>
              </span>
              <span className="num w-6 text-right text-[15px]"
                    style={{ color: j.aRevelar ? "var(--medio)" : undefined }}>
                {j.aRevelar ? "?" : j.nivel}
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
  const items = (comp === "clausura" ? liga : comp === "copa" ? copa : [...liga, ...copa])
    .sort((a, b) => a.orden.localeCompare(b.orden));

  return (
    <>
      <div className="mb-2 flex gap-1">
        {([["todo", "Todo"], ["clausura", "Clausura"], ["copa", "Copa"], ["tabla", "Tabla"]] as const)
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
  const [estado, setEstado] = useState<EstadoAlineacion>(() => {
    if (equipo) {
      const vivos = equipo.jugadores.map((id) => porId.get(id)!).filter(Boolean);
      return { formacion: equipo.formacion, alineado: repartirEnMolde(vivos, MOLDE_DE(equipo.formacion), ctx) };
    }
    return { formacion: "4-3-3", alineado: new Array(11).fill(null) };
  });

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
              onGuardar([
                ...partida.equipos.filter((e) => e.nombre !== editando),
                { nombre: editando, formacion: estado.formacion, jugadores },
              ]);
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
      const vivos = e.jugadores.map((id) => porId.get(id)!).filter(Boolean);
      setEstado({ formacion: e.formacion, alineado: repartirEnMolde(vivos, MOLDE_DE(e.formacion), ctx) });
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
