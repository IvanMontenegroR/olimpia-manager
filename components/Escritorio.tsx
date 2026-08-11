"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Escudo from "./Escudo.tsx";
import Numero from "./Numero.tsx";
import Dorsal from "./Dorsal.tsx";
import Asuntos from "./Asuntos.tsx";
import Mercado from "./Mercado.tsx";
import { colorDe } from "./Dorsal.tsx";
import { colorCondicion, esSub18, nombreCorto, partidosDeOlimpia } from "@/lib/juego.ts";
import RIVALES_COPA from "@/data/rivales_internacionales.json";
import {
  CALENDARIO_COPA, OBJETIVO, TOTAL_FECHAS, borrar, diasAlPartido, esPartidoDeCopa,
  estadoSub18, formatoDia, hayPartidoHoy, miles, ocupacionDe, partidoDe, plantelDe,
  posicionDe, sumarDias,
  tablaDe, type Partida,
} from "@/lib/temporada.ts";

type Vista = "escritorio" | "plantel" | "tabla" | "fixture" | "mercado" | "bitacora" | "copa";

export default function Escritorio({
  partida, onAvanzar, onDirigir, onResolver, onFichar, onReiniciar,
}: {
  partida: Partida;
  onAvanzar: () => void;
  onDirigir: () => void;
  onResolver: (asuntoId: string, opcionId: string) => void;
  onFichar: (fichajeId: string) => void;
  onReiniciar: () => void;
}) {
  const [vista, setVista] = useState<Vista>("escritorio");
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

  if (vista !== "escritorio") {
    return (
      <Sub titulo={{
        plantel: "Plantel", tabla: "Tabla", fixture: "Fixture",
        mercado: "Mercado", bitacora: "Bitácora", copa: "Sudamericana",
      }[vista]} onVolver={() => setVista("escritorio")}>
        {vista === "plantel" && <VistaPlantel plantel={plantel} partida={partida} />}
        {vista === "tabla" && <VistaTabla tabla={tabla} />}
        {vista === "fixture" && <VistaFixture partida={partida} />}
        {vista === "mercado" && <Mercado partida={partida} onFichar={onFichar} />}
        {vista === "bitacora" && <VistaBitacora partida={partida} />}
        {vista === "copa" && <VistaCopa partida={partida} />}
      </Sub>
    );
  }

  const bajas = plantel.filter((j) => j.suspendido || j.lesionado_hasta);
  const condMedia = Math.round(
    plantel.reduce((a, j) => a + j.condicion, 0) / Math.max(plantel.length, 1));
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
        </div>

        <div className="mt-2 flex gap-2">
          <Medidor etiqueta="Vestuario" valor={partida.ambiente} color="#3fa76a" />
          <Medidor etiqueta="Hinchada" valor={partida.hinchada} color="#d9a832" />
          <Medidor etiqueta="Dirigencia" valor={partida.paciencia}
                   color={partida.paciencia < 25 ? "#c0392b" : "#4a7fb5"} />
          <div className="w-[58px] shrink-0">
            <div className="mb-1 flex items-baseline justify-between">
              <span className="text-[8px] uppercase tracking-[0.14em]" style={{ color: "var(--apagado)" }}>
                Estadio
              </span>
              <Numero valor={ocupacion * 100} formato={(n) => `${Math.round(n)}%`}
                      className="num text-[10px]"
                      style={{ color: ocupacion > 0.8 ? "var(--cesped)" : "var(--tenue)" }} />
            </div>
            <div className="h-1.5 overflow-hidden rounded-full relieve" style={{ background: "var(--linea)" }}>
              <div className="barra-llena h-full rounded-full"
                   style={{ width: `${ocupacion * 100}%`,
                            background: "linear-gradient(90deg, #7a5a1e, var(--oro))" }} />
            </div>
          </div>
        </div>
      </header>

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
            <Modulo titulo="Plantel" color="#3fa76a" onClick={() => setVista("plantel")}
              numero={condMedia} sufijo="%" pie="condición media"
              alerta={
                !sub18.alcanza ? `Sub-18: faltan ${sub18.faltan}'`
                : bajas.length ? `${bajas.length} baja${bajas.length > 1 ? "s" : ""}`
                : undefined} />

            <Modulo titulo="Sudamericana" color="#d9a832" onClick={() => setVista("copa")}
              principal={NOMBRE_RONDA[partida.copa.ronda]}
              pie={rivalCopa ? `vs ${rivalCopa.nombre}` : "sin rival"}
              escudo={partida.copa.ronda !== "eliminado" && partida.copa.ronda !== "campeon"
                ? partida.copa.rivalId : undefined} />

            <Modulo titulo="Tabla" color="#4a7fb5" onClick={() => setVista("tabla")}
              numero={posicion} sufijo="°"
              pie={difLider === 0 ? "puntero" : `a ${difLider} del líder`} />

            <Modulo titulo="Pases" color="#e0902a" onClick={() => setVista("mercado")}
              numero={partida.fichajes.length} pie="disponibles"
              alerta={partida.ofertas.length ? `${partida.ofertas.length} oferta` : undefined} />
          </div>

          {/* último movimiento */}
          <div key={partida.bitacora.length}
               className="scroll-y relieve mt-1.5 min-h-0 flex-1 rounded-lg p-2.5"
               style={{ background: "var(--carbon)" }}>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[9px] uppercase tracking-[0.14em]" style={{ color: "var(--apagado)" }}>
                Últimos días
              </span>
              <button onClick={() => setVista("bitacora")} className="text-[9px]"
                      style={{ color: "var(--apagado)" }}>ver todo</button>
            </div>
            <div className="escalona">
            {[...partida.bitacora].reverse().slice(0, 12).map((b, i) => (
              <div key={i} className="mb-1 flex gap-2 text-[11px]">
                <span className="num shrink-0" style={{ color: "var(--apagado)" }}>
                  {b.dia.slice(8, 10)}/{b.dia.slice(5, 7)}
                </span>
                <span style={{ color: "var(--tenue)" }}>{b.texto}</span>
              </div>
            ))}
            </div>
          </div>
        </div>
      )}

      {/* ---------- la acción del día ---------- */}
      {!pendiente && (
        <div className="px-3 pt-2">
          {esHoy && partido ? (
            <button onClick={onDirigir}
              className="relieve-alto flex w-full items-center gap-3 rounded-lg px-3 py-2.5"
              style={{ background: "var(--blanco)", color: "var(--negro)" }}>
              <Escudo id={partido.rivalId} nombre={partido.rivalNombre} tam={30} />
              <span className="min-w-0 flex-1 text-left">
                <span className="block text-[9px] uppercase tracking-[0.14em] opacity-60">
                  {esPartidoDeCopa(partido) ? partido.etiqueta : "Hoy se juega"}
                </span>
                <span className="apellido block truncate text-[14px] leading-tight">
                  {nombreCorto(partido.rivalId, partido.rivalNombre)}
                </span>
              </span>
              <span className="shrink-0 text-[11px] font-extrabold uppercase tracking-wider">
                Dirigir →
              </span>
            </button>
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
        {([["fixture", "Fixture", "#d9a832"], ["plantel", "Plantel", "#3fa76a"],
           ["bitacora", "Diario", "#8fa396"]] as const).map(([id, texto, color]) => (
          <button key={id} onClick={() => setVista(id)}
            className="rounded-md py-2 text-[9px] font-bold uppercase tracking-wider"
            style={{ background: `color-mix(in srgb, ${color} 14%, var(--carbon))`, color }}>
            {texto}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- piezas

function Punto({ color }: { color: string }) {
  return <span className="block h-2 w-2 rounded-full" style={{ background: color }} />;
}

/** Tarjeta del tablero: un dato grande, un pie y, si hace falta, una alerta. */
function Modulo({ titulo, color, principal, numero, sufijo, pie, alerta, escudo, onClick }: {
  titulo: string; color: string; principal?: string; numero?: number; sufijo?: string;
  pie: string; alerta?: string; escudo?: string; onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="relieve rounded-lg p-2.5 text-left"
            style={{
              background: `linear-gradient(160deg,
                color-mix(in srgb, ${color} 20%, var(--carbon-alto)),
                color-mix(in srgb, ${color} 8%, var(--carbon)))`,
            }}>
      <div className="flex items-center justify-between">
        <span className="text-[9px] uppercase tracking-[0.14em]" style={{ color }}>{titulo}</span>
        {escudo && <Escudo id={escudo} nombre={titulo} tam={16} />}
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

function Medidor({ etiqueta, valor, color }: { etiqueta: string; valor: number; color: string }) {
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
    <div className="relative flex-1">
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
    </div>
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

function VistaPlantel({ plantel, partida }: { plantel: ReturnType<typeof plantelDe>; partida: Partida }) {
  const orden = ["ARQ", "DEF", "MED", "DEL"];
  return (
    <>
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

      {[...plantel]
        .filter((j) => partida.plantel[j.id]?.lesionadoHasta !== "2099-01-01")
        .sort((a, b) => orden.indexOf(a.posicion) - orden.indexOf(b.posicion) || b.nivel - a.nivel)
        .map((j) => {
          const e = partida.plantel[j.id];
          const fuera = j.suspendido ? "SUSPENDIDO" : j.lesionado_hasta ? "LESIONADO" : null;
          return (
            <div key={j.id} className="mb-1 flex items-center gap-2 rounded-md px-2 py-1.5"
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
                <span className="block text-[8px]" style={{ color: "var(--apagado)" }}>
                  moral {Math.round(e?.moral ?? 70)}
                </span>
              </span>
              <span className="num w-6 text-right text-[15px]">{j.nivel}</span>
            </div>
          );
        })}
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

function VistaFixture({ partida }: { partida: Partida }) {
  return (
    <>
      {partidosDeOlimpia().map((p, i) => {
        const n = i + 1;
        const r = partida.resultados.find((x) => x.fechaNumero === n);
        const esProximo = n === partida.fechaActual;
        const color = r
          ? r.golesOlimpia > r.golesRival ? "#3fa76a"
            : r.golesOlimpia === r.golesRival ? "#8fa396" : "#c0392b"
          : null;
        return (
          <div key={p.etiqueta} className="mb-1 flex items-center gap-2 rounded-md px-2 py-1.5"
            style={{ background: esProximo
              ? "color-mix(in srgb, #ffffff 15%, var(--carbon))" : "var(--carbon)",
              opacity: r ? 0.75 : 1 }}>
            <span className="num w-5 text-[11px]" style={{ color: "var(--apagado)" }}>{n}</span>
            <span className="w-4 text-center text-[9px] font-bold"
                  style={{ color: p.ctx.esLocal ? "#3fa76a" : "#d9a832" }}>
              {p.ctx.esLocal ? "L" : "V"}
            </span>
            <Escudo id={p.rivalId} nombre={p.rivalNombre} tam={18} />
            <span className="apellido min-w-0 flex-1 truncate text-[11px]">
              {nombreCorto(p.rivalId, p.rivalNombre)}
            </span>
            {r ? (
              <span className="num rounded px-1.5 py-0.5 text-[11px]"
                    style={{ background: color!, color: "#0a120d" }}>
                {r.golesOlimpia}-{r.golesRival}
              </span>
            ) : (
              <span className="text-[10px]" style={{ color: "var(--apagado)" }}>
                {p.ctx.fecha.slice(8, 10)}/{p.ctx.fecha.slice(5, 7)}
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

function VistaBitacora({ partida }: { partida: Partida }) {
  return (
    <>
      {[...partida.bitacora].reverse().map((b, i) => (
        <div key={i} className="mb-1 flex gap-2 rounded-md px-2 py-1.5 text-[11px]"
             style={{ background: "var(--carbon)" }}>
          <span className="num shrink-0" style={{ color: "var(--apagado)" }}>
            {b.dia.slice(8, 10)}/{b.dia.slice(5, 7)}
          </span>
          <span style={{ color: "var(--tenue)" }}>{b.texto}</span>
        </div>
      ))}
    </>
  );
}
