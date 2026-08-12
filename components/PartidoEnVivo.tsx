"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Rng } from "@/engine/rng.ts";
import { desgastePorPartido, fuerzas, P } from "@/engine/motor.ts";
import { ambienteDe, relatarTramo, type EventoRelato, type TipoEvento } from "@/engine/relato.ts";
import { colorCondicion, nivelEf, nombreCorto, type PartidoUI } from "@/lib/juego.ts";
import { LINEA_DE, type Actitud, type Alineacion, type Jugador, type Posicion } from "@/engine/tipos.ts";
import type { Salida } from "./ArmarOnce.tsx";
import PanelPartido, { type EstadoJugador } from "./PanelPartido.tsx";
import { onceRival } from "@/engine/rival.ts";
import type { CierrePartido } from "@/lib/temporada.ts";
import MomentoOverlay from "./MomentoOverlay.tsx";
import { resolverMomento, type Momento, type ResueltoMomento } from "@/engine/momentos.ts";
import Escudo from "./Escudo.tsx";
import Dorsal from "./Dorsal.tsx";

const VELOCIDADES = [
  { etiqueta: "▶", ms: 620 },
  { etiqueta: "▶▶", ms: 260 },
  { etiqueta: "▶▶▶", ms: 90 },
];

export const ACTITUD: Record<Actitud, { nombre: string; color: string; sobre: string; nota: string }> = {
  defensivo:   { nombre: "Aguantar",     color: "#4a7fb5", sobre: "#ffffff",
                 nota: "Mucho menos peligro en contra, casi no vas a atacar" },
  equilibrado: { nombre: "Parejo",       color: "#a1a1aa", sobre: "#0a120d",
                 nota: "Sin ventajas ni riesgos extra" },
  ofensivo:    { nombre: "Ir al frente", color: "#e0902a", sobre: "#0a120d",
                 nota: "Presionás arriba: más peligro y más piernas gastadas. " +
                       "Rinde el doble si el rival llega cansado" },
};

/** Cada tipo de evento con su color y su etiqueta, para que se lea de un golpe. */
const ESTILO_EVENTO: Record<string, { color: string; etiqueta?: string; fuerte?: boolean }> = {
  gol:            { color: "#3fa76a", etiqueta: "GOL", fuerte: true },
  gol_rival:      { color: "#c0392b", etiqueta: "GOL RIVAL", fuerte: true },
  ocasion:        { color: "#6aa84f", etiqueta: "OCASIÓN" },
  ocasion_rival:  { color: "#e0902a", etiqueta: "PELIGRO" },
  amarilla:       { color: "#facc15", etiqueta: "AMARILLA" },
  roja:           { color: "#c0392b", etiqueta: "ROJA", fuerte: true },
  lesion:         { color: "#e0902a", etiqueta: "LESIÓN", fuerte: true },
  aviso_condicion:{ color: "#e0902a", etiqueta: "FUNDIDO" },
  cambio:         { color: "#4a7fb5", etiqueta: "CAMBIO" },
  momento:        { color: "#d9a832", etiqueta: "DECISIÓN" },
  entretiempo:    { color: "#8fa396", etiqueta: "DESCANSO" },
  final:          { color: "#ffffff", etiqueta: "FINAL" },
  inicio:         { color: "#8fa396" },
};

export default function PartidoEnVivo({
  partido, salida, onTerminar,
}: { partido: PartidoUI; salida: Salida; onTerminar: (c: CierrePartido) => void }) {
  const { ctx } = partido;

  const [once, setOnce] = useState<Jugador[]>(salida.once);
  const [banco, setBanco] = useState<Jugador[]>(salida.suplentes);
  const [puestos, setPuestos] = useState<Map<string, Posicion>>(salida.puestos);
  const [actitud, setActitud] = useState<Actitud>(salida.actitud);

  const [minuto, setMinuto] = useState(0);
  const [visibles, setVisibles] = useState<EventoRelato[]>([
    { minuto: 0, tipo: "inicio", texto: `Arranca el partido. ${ambienteDe(ctx)}`,
      golesOlimpia: 0, golesRival: 0 },
  ]);
  const [gO, setGO] = useState(0);
  const [gR, setGR] = useState(0);
  const [corriendo, setCorriendo] = useState(true);
  const [vel, setVel] = useState(0);
  const [cambios, setCambios] = useState(3);
  /** Lo que sumó la gente por un golazo, para pasarlo al cierre. */
  const hinchadaPorGolazos = useRef(0);
  const [actitudUsada, setActitudUsada] = useState(false);
  const [panel, setPanel] = useState<"cambio" | "actitud" | null>(null);
  const [terminado, setTerminado] = useState(false);
  const [lesionado, setLesionado] = useState<string | null>(null);
  const [momento, setMomento] = useState<Momento | null>(null);
  const [resueltoMomento, setResuelto] = useState<ResueltoMomento | null>(null);

  // Varios cambios a la vez: se marcan los que salen y se les asigna quién entra.
  const [salen, setSalen] = useState<string[]>([]);
  const [entran, setEntran] = useState<Record<string, string>>({});
  const [eligiendoPara, setEligiendoPara] = useState<string | null>(null);

  const rival11 = useMemo(
    () => onceRival(partido.rivalId, ctx.rivalFuerza), [partido.rivalId, ctx.rivalFuerza]);

  /** Cuándo entró y cuándo salió cada uno, para cerrar los minutos al final. */
  const entradas = useRef<Map<string, number>>(new Map(salida.once.map((j) => [j.id, 0])));
  const salidas = useRef<Map<string, number>>(new Map());

  const semilla = useRef(0);
  const cursor = useRef(0);
  const scroller = useRef<HTMLDivElement>(null);

  const condAhora = (j: Jugador) =>
    Math.max(0, Math.round(
      j.condicion - desgastePorPartido(j, Math.min(minuto, 90), ctx, actitud)));

  const alineacion = useMemo<Alineacion>(
    () => ({ once, suplentes: banco, actitud, puestos }),
    [once, banco, actitud, puestos]);

  const [pendientes, setPendientes] = useState<EventoRelato[]>(() =>
    relatarTramo(
      { once: salida.once, suplentes: salida.suplentes, actitud: salida.actitud, puestos: salida.puestos },
      ctx, new Rng(`${ctx.fecha}-${ctx.rivalNombre}-0`), 0, 90, 0, 0,
      new Set(), onceRival(partido.rivalId, ctx.rivalFuerza)));

  /** Vuelve a simular lo que queda con el equipo que hay ahora. */
  const resimular = (desdeMin: number, nueva: Alineacion) => {
    semilla.current++;
    cursor.current = 0;
    setPendientes(relatarTramo(
      nueva, ctx, new Rng(`${ctx.fecha}-${ctx.rivalNombre}-${semilla.current}`),
      desdeMin, 90, gO, gR, amonestados, rival11));
  };

  useEffect(() => {
    if (!corriendo || terminado) return;
    const t = setTimeout(() => {
      const siguiente = minuto + 1;
      const ahora: EventoRelato[] = [];
      while (cursor.current < pendientes.length &&
             pendientes[cursor.current].minuto <= siguiente) {
        ahora.push(pendientes[cursor.current]);
        cursor.current++;
      }

      if (ahora.length) {
        setVisibles((v) => [...v, ...ahora]);
        const ultimoEv = ahora[ahora.length - 1];
        setGO(ultimoEv.golesOlimpia);
        setGR(ultimoEv.golesRival);

        const conMomento = ahora.find((e) => e.momento);
        if (conMomento?.momento) setMomento(conMomento.momento);

        const les = ahora.find((e) => e.tipo === "lesion");
        if (les?.jugadorId) {
          setLesionado(les.jugadorId);
          if (cambios > 0) {
            setSalen([les.jugadorId]);
            setEligiendoPara(les.jugadorId);
            setPanel("cambio");
          }
        }
        if (ahora.some((e) => e.pausa)) setCorriendo(false);
        if (ultimoEv.tipo === "final") { setTerminado(true); setCorriendo(false); }
      }
      setMinuto(siguiente);
      if (siguiente >= 90 && !ahora.some((e) => e.tipo === "final")) {
        setTerminado(true); setCorriendo(false);
      }
    }, VELOCIDADES[vel].ms);
    return () => clearTimeout(t);
  }, [minuto, corriendo, vel, pendientes, terminado, cambios]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [visibles.length]);

  const cerrarPanel = () => {
    setPanel(null); setSalen([]); setEntran({}); setEligiendoPara(null); setCorriendo(true);
  };

  const confirmarCambios = () => {
    const pares = salen
      .map((sid) => [once.find((j) => j.id === sid), banco.find((j) => j.id === entran[sid])] as const)
      .filter((p): p is readonly [Jugador, Jugador] => !!p[0] && !!p[1]);
    if (!pares.length) return cerrarPanel();

    let nuevoOnce = [...once];
    const nuevosPuestos = new Map(puestos);
    const entrantes = new Set<string>();
    for (const [s, e] of pares) {
      nuevoOnce = nuevoOnce.map((j) => (j.id === s.id ? e : j));
      nuevosPuestos.set(e.id, puestos.get(s.id) ?? e.posicion);
      entrantes.add(e.id);
      salidas.current.set(s.id, minuto);
      entradas.current.set(e.id, minuto);
    }
    const nuevoBanco = banco.filter((j) => !entrantes.has(j.id));

    setOnce(nuevoOnce);
    setPuestos(nuevosPuestos);
    setBanco(nuevoBanco);
    setCambios((c) => c - pares.length);
    if (lesionado && salen.includes(lesionado)) setLesionado(null);

    const detalle = pares.map(([s, e]) => `sale ${s.apellido}, entra ${e.apellido}`).join("; ");
    const encabezado = pares.length === 3 ? "Triple cambio en Olimpia. "
      : pares.length === 2 ? "Doble cambio en Olimpia. "
      : "Cambio en Olimpia. ";
    setVisibles((v) => [...v, {
      minuto, tipo: "cambio",
      texto: encabezado + detalle.charAt(0).toUpperCase() + detalle.slice(1) + ".",
      golesOlimpia: gO, golesRival: gR,
    }]);
    resimular(minuto, { once: nuevoOnce, suplentes: nuevoBanco, actitud, puestos: nuevosPuestos });
    setPanel(null); setSalen([]); setEntran({}); setEligiendoPara(null); setCorriendo(true);
  };

  const elegirEnMomento = (opcionId: string) => {
    if (!momento) return;
    const r = resolverMomento(momento, opcionId, alineacion, ctx,
                              new Rng(`${ctx.fecha}-${momento.minuto}-${opcionId}`));
    setResuelto(r);
    // un golazo se paga aunque el partido ya estuviera resuelto
    if (r.levantaHinchada) hinchadaPorGolazos.current += r.levantaHinchada;

    const nuevoO = gO + (r.golOlimpia ? 1 : 0);
    const nuevoR = gR + (r.golRival ? 1 : 0);
    setGO(nuevoO);
    setGR(nuevoR);

    setVisibles((v) => [...v, {
      minuto: momento.minuto,
      tipo: r.golOlimpia ? "gol" : r.golRival ? "gol_rival" : r.rojaA ? "roja" : "cambio",
      texto: r.texto,
      golesOlimpia: nuevoO, golesRival: nuevoR,
    }]);

    // consecuencias que tocan al equipo
    let nuevoOnce = once;
    let nuevoBanco = banco;
    const nuevosPuestos = new Map(puestos);
    if (r.rojaA) {
      nuevoOnce = once.filter((j) => j.id !== r.rojaA);
      setOnce(nuevoOnce);
    }
    if (r.gastaCambio) {
      const entra = banco.find((j) => j.posicion !== "ARQ");
      if (entra && cambios > 0) {
        nuevoOnce = once.map((j) => (j.id === r.gastaCambio ? entra : j));
        nuevoBanco = banco.filter((j) => j.id !== entra.id);
        nuevosPuestos.set(entra.id, puestos.get(r.gastaCambio) ?? entra.posicion);
        setOnce(nuevoOnce);
        setBanco(nuevoBanco);
        setPuestos(nuevosPuestos);
        setCambios((c) => c - 1);
      }
    }

    // el resto del partido se vuelve a simular con el marcador y el equipo nuevos
    semilla.current++;
    cursor.current = 0;
    setPendientes(relatarTramo(
      { once: nuevoOnce, suplentes: nuevoBanco, actitud, puestos: nuevosPuestos },
      ctx, new Rng(`${ctx.fecha}-${ctx.rivalNombre}-${semilla.current}`),
      momento.minuto, 90, nuevoO, nuevoR, amonestados, rival11));
  };

  const seguirTrasMomento = () => {
    setMomento(null);
    setResuelto(null);
    setCorriendo(true);
  };

  const cambiarActitud = (a: Actitud) => {
    setActitud(a);
    setActitudUsada(true);
    setVisibles((v) => [...v, {
      minuto, tipo: "cambio",
      texto: a === "defensivo" ? "Olimpia se mete atrás a aguantar el resultado."
        : a === "ofensivo" ? "Olimpia se vuelca al ataque. Va a buscarlo."
        : "Olimpia acomoda las líneas y busca equilibrio.",
      golesOlimpia: gO, golesRival: gR,
    }]);
    resimular(minuto, { ...alineacion, actitud: a });
    setPanel(null); setCorriendo(true);
  };

  // Cuánto mejor es Olimpia que el rival hoy, normalizado. Sesga el pulso para
  // que un partido contra Rubio Ñu no se vea igual que uno contra Cerro.
  const tendencia = useMemo(() => {
    const f = fuerzas(alineacion, ctx);
    const localiaRival = ctx.competencia === "sudamericana" ? P.localiaCopaRival : P.localiaLiga;
    const rival = ctx.rivalFuerza + (ctx.esLocal || ctx.neutral ? 0 : localiaRival);
    return Math.max(-1, Math.min(1, ((f.ataque + f.defensa) / 2 - rival) / 12));
  }, [alineacion, ctx]);
  /** Dominio acumulado: la tendencia base movida por lo que fue pasando. */
  const dominio = useMemo(() => {
    let v = 0.5 + tendencia * 0.16;
    for (const e of visibles) {
      if (e.tipo === "gol" || e.tipo === "ocasion") v += 0.035;
      if (e.tipo === "gol_rival" || e.tipo === "ocasion_rival") v -= 0.035;
    }
    return Math.max(0.12, Math.min(0.88, v));
  }, [visibles, tendencia]);

  /** Lo que le pasó a cada jugador en este partido, leído del propio relato. */
  const estadoJugadores = useMemo(() => {
    const m = new Map<string, EstadoJugador>();
    const base = (): EstadoJugador =>
      ({ amarilla: false, goles: 0, lesionado: false, encendido: false, apagado: false });
    // participaciones recientes, para marcar quién está encendido
    const recientes = new Map<string, number>();
    for (const e of visibles) {
      if (!e.jugadorId) continue;
      const st = m.get(e.jugadorId) ?? base();
      if (e.tipo === "amarilla") st.amarilla = true;
      if (e.tipo === "gol") st.goles++;
      if (e.tipo === "lesion") st.lesionado = true;
      m.set(e.jugadorId, st);
      if (e.tipo === "gol" || e.tipo === "ocasion") {
        if (minuto - e.minuto <= 25) recientes.set(e.jugadorId, (recientes.get(e.jugadorId) ?? 0) + 1);
      }
    }
    for (const [id, n] of recientes) {
      const st = m.get(id) ?? base();
      if (n >= 2) st.encendido = true;
      m.set(id, st);
    }
    // apagado: delantero sin una sola participación pasada la media hora
    if (minuto > 35) {
      for (const j of once) {
        const pos = puestos.get(j.id) ?? j.posicion;
        if (LINEA_DE[pos] !== "DEL") continue;
        if (!visibles.some((e) => e.jugadorId === j.id)) {
          const st = m.get(j.id) ?? base();
          st.apagado = true;
          m.set(j.id, st);
        }
      }
    }
    return m;
  }, [visibles, minuto, once, puestos]);

  const amonestados = useMemo(
    () => new Set([...estadoJugadores].filter(([, e]) => e.amarilla).map(([id]) => id)),
    [estadoJugadores]);

  const estadoRival = useMemo(() => {
    const m = new Map<string, { amarilla: boolean; expulsado: boolean }>();
    for (const e of visibles) {
      if (!e.rivalJugadorId) continue;
      const st = m.get(e.rivalJugadorId) ?? { amarilla: false, expulsado: false };
      if (e.tipo === "amarilla_rival") st.amarilla = true;
      if (e.tipo === "roja_rival") st.expulsado = true;
      m.set(e.rivalJugadorId, st);
    }
    return m;
  }, [visibles]);

  /** Lo que hay que devolverle a la temporada cuando termina el partido. */
  const armarCierre = (): CierrePartido => {
    const minutos = new Map<string, number>();
    for (const [id, entra] of entradas.current) {
      const sale = salidas.current.get(id) ?? 90;
      minutos.set(id, Math.max(0, sale - entra));
    }
    return {
      golesOlimpia: gO,
      golesRival: gR,
      minutos,
      amarillas: visibles.filter((e) => e.tipo === "amarilla" && e.jugadorId)
        .map((e) => e.jugadorId!),
      rojas: visibles.filter((e) => e.tipo === "roja" && e.jugadorId).map((e) => e.jugadorId!),
      lesionados: visibles.filter((e) => e.tipo === "lesion" && e.jugadorId)
        .map((e) => ({ id: e.jugadorId!, dias: 7 + Math.floor(Math.random() * 30) })),
      goleadores: visibles.filter((e) => e.tipo === "gol" && e.jugadorId).map((e) => e.jugadorId!),
      // los golazos de los momentos levantan a la gente más allá del resultado
      hinchadaExtra: hinchadaPorGolazos.current,
    };
  };

  const ultimo = visibles[visibles.length - 1];
  const golDe: "olimpia" | "rival" | null =
    ultimo?.tipo === "gol" ? "olimpia" : ultimo?.tipo === "gol_rival" ? "rival" : null;
  const act = ACTITUD[actitud];
  const faltaAsignar = salen.some((s) => !entran[s]);

  return (
    <div className="app">
      {/* ---------- marcador ---------- */}
      <header className="px-4 pb-2 pt-2.5">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.18em]"
             style={{ color: "var(--tenue)" }}>
          <span className="shrink-0">{partido.etiqueta}</span>
          <span className="truncate pl-2">{partido.estadio}</span>
        </div>
        {/* cada equipo de su lado, marcador y reloj en el medio */}
        <div className="mt-1.5 grid items-center" style={{ gridTemplateColumns: "1fr auto 1fr" }}>
          <div className="flex flex-col items-center gap-1">
            <Escudo id="olimpia" nombre="Olimpia" tam={32} />
            <span className="apellido max-w-full truncate text-[12px] leading-none">Olimpia</span>
          </div>

          <div className="px-3 text-center">
            <div className="marcador flex items-baseline justify-center gap-2 text-[38px]">
              <span>{gO}</span>
              <span style={{ color: "var(--apagado)" }}>–</span>
              <span>{gR}</span>
            </div>
            <div className={`num mt-0.5 text-[13px] leading-none ${corriendo ? "latir" : ""}`}
                 style={{ color: "var(--tenue)" }}>
              {Math.min(minuto, 90)}'
            </div>
          </div>

          <div className="flex flex-col items-center gap-1">
            <Escudo id={partido.rivalId} nombre={partido.rivalNombre} tam={32} />
            <span className="apellido max-w-full truncate text-[12px] leading-none">
              {nombreCorto(partido.rivalId, partido.rivalNombre)}
            </span>
          </div>
        </div>
        <div className="mt-1.5 h-0.5 w-full overflow-hidden rounded-full" style={{ background: "var(--linea)" }}>
          <div className="h-full rounded-full transition-all duration-200"
               style={{ width: `${Math.min(minuto / 90, 1) * 100}%`, background: "var(--blanco)" }} />
        </div>
      </header>

      {/* ---------- estado de los once ---------- */}
      <PanelPartido once={once} puestos={puestos} estado={estadoJugadores}
                    condicionDe={condAhora} minuto={minuto} alineacion={alineacion}
                    ctx={ctx} dominio={dominio} rival11={rival11} estadoRival={estadoRival}
                    eventos={visibles} rivalNombre={nombreCorto(partido.rivalId, partido.rivalNombre)}
                    onTocar={(j) => {
                        setCorriendo(false);
                        setSalen([j.id]);
                        setEligiendoPara(j.id);
                      setPanel("cambio");
                    }} />

      {/* ---------- relato: franja de últimas jugadas ---------- */}
      <div ref={scroller} className="scroll-y mt-2 flex min-h-0 flex-1 flex-col border-t px-4 py-2.5"
           style={{ borderColor: "var(--linea)" }}>
        <div>
          {visibles.map((e, i) => {
            const est = ESTILO_EVENTO[e.tipo] ?? { color: "#ffffff" };
            return (
              <div key={i} className="entrar mb-1.5 flex gap-2 rounded-lg py-1.5 pl-2 pr-2"
                   style={{
                     background: est.fuerte
                       ? `color-mix(in srgb, ${est.color} 15%, transparent)`
                       : "transparent",
                     outline: est.fuerte
                       ? `1px solid color-mix(in srgb, ${est.color} 35%, transparent)`
                       : "none",
                   }}>
                <span className="num w-6 shrink-0 pt-0.5 text-right text-[11px]"
                      style={{ color: "var(--apagado)" }}>
                  {e.minuto}'
                </span>
                <span className="min-w-0 flex-1">
                  {est.etiqueta && (
                    <span className="mr-1.5 inline-block rounded px-1 align-middle text-[8px] font-extrabold uppercase tracking-wider"
                          style={{ background: est.color, color: "#0a120d" }}>
                      {est.etiqueta}
                    </span>
                  )}
                  <span className={est.fuerte ? "apellido text-[13px] leading-snug" : "text-[12.5px] leading-snug"}
                        style={{ color: est.fuerte ? est.color : "var(--blanco)" }}>
                    {e.texto}
                  </span>
                </span>
              </div>
            );
          })}
          {!corriendo && !terminado && (
            <div className="mt-1 text-[11px] uppercase tracking-[0.16em]" style={{ color: "var(--medio)" }}>
              Detenido · te toca decidir
            </div>
          )}
        </div>
      </div>

      {/* ---------- controles ---------- */}
      {!terminado && (
        <div className="border-t px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2.5"
             style={{ borderColor: "var(--linea)" }}>
          <div className="flex gap-1.5">
            <button onClick={() => setCorriendo((c) => !c)}
              className="w-12 rounded py-2.5 text-[13px] font-bold"
              style={{ background: "var(--blanco)", color: "var(--negro)" }}>
              {corriendo ? "❚❚" : "▶"}
            </button>
            <button onClick={() => setVel((v) => (v + 1) % VELOCIDADES.length)}
              className="w-12 rounded py-2.5 text-[11px] font-bold"
              style={{ background: "var(--carbon)", color: "var(--tenue)" }}>
              {VELOCIDADES[vel].etiqueta}
            </button>
            <button onClick={() => { setCorriendo(false); setPanel("cambio"); }}
              disabled={cambios === 0}
              className="flex-1 rounded py-2.5 text-[11px] font-bold uppercase tracking-wider"
              style={{ background: "var(--carbon)", color: cambios ? "var(--blanco)" : "var(--apagado)" }}>
              Cambios · {cambios}
            </button>
            {/* muestra la actitud puesta, con su color */}
            <button onClick={() => { if (!actitudUsada) { setCorriendo(false); setPanel("actitud"); } }}
              disabled={actitudUsada}
              className="flex-1 rounded py-2.5 text-[11px] font-bold uppercase tracking-wider"
              style={{ background: act.color, color: act.sobre, opacity: actitudUsada ? 0.5 : 1 }}>
              {act.nombre}
            </button>
          </div>
        </div>
      )}

      {/* ---------- panel de cambios ---------- */}
      {panel === "cambio" && (
        <Panel
          titulo={eligiendoPara
            ? `Entra por ${once.find((j) => j.id === eligiendoPara)?.apellido ?? ""} · ${puestos.get(eligiendoPara) ?? ""}`
            : `¿Quiénes salen? · te quedan ${cambios}`}
          onCerrar={cerrarPanel}>

          {eligiendoPara ? (
            [...banco]
              .filter((j) => !Object.values(entran).includes(j.id))
              .sort((a, b) => {
                const puesto = puestos.get(eligiendoPara);
                const enc = (j: Jugador) =>
                  j.posicion === puesto ? 0 : j.posiciones_secundarias.includes(puesto!) ? 1 : 2;
                return enc(a) - enc(b) || nivelEf(b, b.posicion, ctx) - nivelEf(a, a.posicion, ctx);
              })
              .map((j) => (
              <FilaJugador key={j.id} j={j} puesto={j.posicion} cond={j.condicion} ctx={ctx}
                onClick={() => {
                  setEntran((e) => ({ ...e, [eligiendoPara]: j.id }));
                  setEligiendoPara(null);
                }} />
            ))
          ) : (
            <>
              {[...once]
                .sort((a, b) => (b.id === lesionado ? 1 : 0) - (a.id === lesionado ? 1 : 0) ||
                                condAhora(a) - condAhora(b))
                .map((j) => {
                  const marcado = salen.includes(j.id);
                  const entrante = entran[j.id] ? banco.find((b) => b.id === entran[j.id]) : undefined;
                  return (
                    <FilaJugador key={j.id} j={j} puesto={puestos.get(j.id) ?? j.posicion}
                      cond={condAhora(j)} ctx={ctx} marcado={marcado}
                      lesionado={j.id === lesionado} entrante={entrante}
                      onClick={() => {
                        if (marcado) {
                          setSalen((s) => s.filter((x) => x !== j.id));
                          setEntran((e) => { const n = { ...e }; delete n[j.id]; return n; });
                        } else if (salen.length < cambios) {
                          setSalen((s) => [...s, j.id]);
                          setEligiendoPara(j.id);
                        }
                      }} />
                  );
                })}
            </>
          )}
        </Panel>
      )}

      {panel === "cambio" && !eligiendoPara && salen.length > 0 && (
        <div className="absolute inset-x-0 bottom-0 z-20 px-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button onClick={confirmarCambios} disabled={faltaAsignar}
            className="w-full rounded-lg py-3.5 text-[13px] font-extrabold uppercase tracking-[0.12em]"
            style={{
              background: faltaAsignar ? "var(--carbon)" : "var(--blanco)",
              color: faltaAsignar ? "var(--apagado)" : "var(--negro)",
              boxShadow: "0 -12px 24px rgba(0,0,0,0.6)",
            }}>
            {faltaAsignar ? "Falta elegir quién entra"
              : `Confirmar ${salen.length} cambio${salen.length > 1 ? "s" : ""}`}
          </button>
        </div>
      )}

      {panel === "actitud" && (
        <Panel titulo="Cambio de actitud · una sola vez" onCerrar={() => { setPanel(null); setCorriendo(true); }}>
          {(["defensivo", "equilibrado", "ofensivo"] as Actitud[]).map((a) => {
            const A = ACTITUD[a];
            const activa = a === actitud;
            return (
              <button key={a} onClick={() => cambiarActitud(a)}
                className="mb-1.5 w-full rounded-lg px-3 py-3 text-left"
                style={{
                  background: activa ? A.color : `color-mix(in srgb, ${A.color} 13%, var(--carbon))`,
                  color: activa ? A.sobre : A.color,
                }}>
                <span className="apellido text-[14px]">{A.nombre}</span>
                <span className="block text-[11px] opacity-70">{A.nota}</span>
              </button>
            );
          })}
        </Panel>
      )}

      {momento && (
        <MomentoOverlay momento={momento} resuelto={resueltoMomento}
                        alineacion={alineacion} ctx={ctx}
                        onElegir={elegirEnMomento} onSeguir={seguirTrasMomento} />
      )}

      {/* ---------- final ---------- */}
      {terminado && (
        <div className="border-t px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3"
             style={{ borderColor: "var(--linea)" }}>
          <div className="apellido mb-2 text-center text-[13px]"
               style={{ color: gO > gR ? "var(--ok)" : gO < gR ? "var(--critico)" : "var(--tenue)" }}>
            {gO > gR ? "Victoria" : gO < gR ? "Derrota" : "Empate"}
          </div>
          <button onClick={() => onTerminar(armarCierre())}
            className="w-full rounded-lg py-3.5 text-[15px] font-extrabold uppercase tracking-[0.14em]"
            style={{ background: "var(--blanco)", color: "var(--negro)" }}>
            Siguiente fecha
          </button>
        </div>
      )}
    </div>
  );
}

function FilaJugador({
  j, puesto, cond, ctx, onClick, marcado, lesionado, entrante,
}: {
  j: Jugador; puesto: Posicion; cond: number; ctx: PartidoUI["ctx"];
  onClick: () => void; marcado?: boolean; lesionado?: boolean; entrante?: Jugador;
}) {
  return (
    <button onClick={onClick}
      className="mb-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left"
      style={{
        background: marcado ? "var(--linea)" : "var(--carbon)",
        outline: lesionado ? "1px solid #e0902a" : "none",
      }}>
      <Dorsal numero={j.numero} tam={26} />
      <span className="min-w-0 flex-1">
        <span className="apellido block truncate text-[14px]">{j.apellido}</span>
        <span className="text-[10px]" style={{ color: "var(--tenue)" }}>
          {puesto} · <span style={{ color: colorCondicion(cond) }}>{cond}%</span>
          {lesionado && <span className="ml-1.5 font-bold" style={{ color: "var(--bajo)" }}>LESIONADO</span>}
          {entrante && <span className="ml-1.5" style={{ color: "var(--ok)" }}>→ {entrante.apellido}</span>}
        </span>
      </span>
      <span className="num text-[19px]">{nivelEf(j, puesto, ctx)}</span>
    </button>
  );
}

function Panel({ titulo, onCerrar, children }: {
  titulo: string; onCerrar: () => void; children: React.ReactNode;
}) {
  return (
    <div className="absolute inset-0 z-10 flex flex-col justify-end"
         style={{ background: "rgba(0,0,0,0.72)" }} onClick={onCerrar}>
      <div className="entrar rounded-t-2xl border-t px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3"
           style={{ background: "var(--negro)", borderColor: "var(--linea)", maxHeight: "76%" }}
           onClick={(e) => e.stopPropagation()}>
        <div className="mb-2.5 flex items-center justify-between px-1">
          <span className="text-[11px] uppercase tracking-[0.16em]" style={{ color: "var(--tenue)" }}>
            {titulo}
          </span>
          <button onClick={onCerrar} className="text-[11px]" style={{ color: "var(--apagado)" }}>
            Cerrar
          </button>
        </div>
        <div className="scroll-y" style={{ maxHeight: "54vh" }}>{children}</div>
      </div>
    </div>
  );
}
