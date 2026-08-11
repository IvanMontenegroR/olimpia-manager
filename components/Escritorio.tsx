"use client";

import { useMemo, useState } from "react";
import Escudo from "./Escudo.tsx";
import Asuntos from "./Asuntos.tsx";
import Mercado from "./Mercado.tsx";
import { COLOR_POS } from "./PanelPartido.tsx";
import { colorCondicion, esSub18, nombreCorto, partidosDeOlimpia } from "@/lib/juego.ts";
import {
  CALENDARIO_COPA, OBJETIVO, TOTAL_FECHAS, borrar, diasAlPartido, esPartidoDeCopa,
  formatoDia, hayPartidoHoy, miles, partidoDe, plantelDe, posicionDe, sumarDias,
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

  return (
    <div className="app">
      {/* ---------- cabecera ---------- */}
      <header className="px-4 pb-2 pt-3">
        <div className="flex items-center gap-2.5">
          <Escudo id="olimpia" nombre="Olimpia" tam={38} />
          <div className="min-w-0 flex-1">
            <div className="apellido text-[17px] leading-none">Olimpia</div>
            <div className="text-[10px]" style={{ color: "var(--tenue)" }}>
              {formatoDia(partida.dia)} · Fecha {Math.min(partida.fechaActual, TOTAL_FECHAS)}
            </div>
          </div>
          <div className="text-right">
            <div className="num text-[15px] leading-none">{posicion}° · {yo.pts} pts</div>
            <div className="num text-[10px]" style={{ color: "#22c55e" }}>
              {miles(partida.dineroUsd)}
            </div>
          </div>
        </div>

        {/* medidores */}
        <div className="mt-2 flex gap-2">
          <Medidor etiqueta="Vestuario" valor={partida.ambiente} color="#22c55e" />
          <Medidor etiqueta="Hinchada" valor={partida.hinchada} color="#f59e0b" />
        </div>
      </header>

      {/* ---------- calendario ---------- */}
      <div className="scroll-x flex gap-1.5 px-3 pb-2">
        {Array.from({ length: 12 }, (_, i) => {
          const dia = sumarDias(partida.dia, i);
          const m = partidosDeOlimpia().find((x) => x.ctx.fecha === dia);
          const copaHoy = Object.values(CALENDARIO_COPA).some(
            (r) => (r.ida === dia || r.vuelta === dia)
              && partida.copa.ronda !== "eliminado" && partida.copa.ronda !== "campeon");
          const hoy = i === 0;
          return (
            <div key={dia}
              className="flex w-[52px] shrink-0 flex-col items-center gap-1 rounded-lg py-1.5"
              style={{
                background: hoy ? "var(--blanco)"
                  : copaHoy ? "color-mix(in srgb, #a78bfa 26%, var(--carbon))"
                  : m ? "color-mix(in srgb, #22c55e 20%, var(--carbon))"
                  : "var(--carbon)",
                color: hoy ? "var(--negro)" : "var(--blanco)",
              }}>
              <span className="text-[8px] uppercase tracking-wider"
                    style={{ color: hoy ? "var(--negro)" : "var(--apagado)" }}>
                {formatoDia(dia).slice(0, 3)}
              </span>
              <span className="num text-[15px] leading-none">{dia.slice(8, 10)}</span>
              {copaHoy ? (
                <span className="text-[8px] font-extrabold" style={{ color: "#a78bfa" }}>COPA</span>
              ) : m ? (
                <Escudo id={m.rivalId} nombre={m.rivalNombre} tam={16} />
              ) : (
                <span className="h-4 text-[8px]" style={{ color: "var(--apagado)" }}>
                  {i === 0 && partida.entrenamiento ? "ENT" : ""}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* ---------- lo que hay que hacer hoy ---------- */}
      <div className="min-h-0 flex-1 px-3">
        {pendiente ? (
          <Asuntos asunto={pendiente} partida={partida} onResolver={onResolver} />
        ) : esHoy && partido ? (
          <div className="flex h-full flex-col justify-center rounded-xl p-4"
               style={{ background: "color-mix(in srgb, #22c55e 12%, var(--carbon))" }}>
            <span className="text-center text-[10px] uppercase tracking-[0.18em]"
                  style={{ color: esPartidoDeCopa(partido) ? "#a78bfa" : "#22c55e" }}>
              {esPartidoDeCopa(partido) ? partido.etiqueta : "Hoy se juega"}
            </span>
            <div className="mt-3 flex items-center justify-center gap-4">
              <Escudo id="olimpia" nombre="Olimpia" tam={42} />
              <span className="apellido text-[14px]" style={{ color: "var(--apagado)" }}>vs</span>
              <Escudo id={partido.rivalId} nombre={partido.rivalNombre} tam={42} />
            </div>
            <p className="mt-2 text-center apellido text-[16px]">
              {nombreCorto(partido.rivalId, partido.rivalNombre)}
            </p>
            <p className="text-center text-[11px]" style={{ color: "var(--tenue)" }}>
              {partido.estadio}
            </p>
            <button onClick={onDirigir}
              className="mt-4 w-full rounded-lg py-3.5 text-[15px] font-extrabold uppercase tracking-[0.14em]"
              style={{ background: "var(--blanco)", color: "var(--negro)" }}>
              Dirigir el partido
            </button>
          </div>
        ) : partido ? (
          <div className="flex h-full flex-col gap-2">
            <div className="rounded-xl p-3" style={{ background: "var(--carbon)" }}>
              <div className="flex items-center gap-2.5">
                <Escudo id={partido.rivalId} nombre={partido.rivalNombre} tam={34} />
                <div className="min-w-0 flex-1">
                  <div className="text-[9px] uppercase tracking-[0.14em]"
                       style={{ color: esPartidoDeCopa(partido) ? "#a78bfa" : "var(--apagado)" }}>
                    {esPartidoDeCopa(partido) ? partido.etiqueta + " · " : ""}
                    {partido.ctx.neutral ? "Cancha neutral" : partido.ctx.esLocal ? "Local" : "Visitante"}
                    {" · en "}{faltan} día{faltan === 1 ? "" : "s"}
                  </div>
                  <div className="apellido truncate text-[15px] leading-tight">
                    {nombreCorto(partido.rivalId, partido.rivalNombre)}
                  </div>
                </div>
                {partido.ctx.esClasico && (
                  <span className="rounded px-1.5 py-0.5 text-[9px] font-extrabold uppercase"
                        style={{ background: "#ef4444", color: "#0b0b0c" }}>Clásico</span>
                )}
              </div>
              {partida.entrenamiento && (
                <div className="mt-2 text-[10px]" style={{ color: "var(--tenue)" }}>
                  Trabajo de la semana: {
                    { recuperacion: "recuperación", tactico: "táctico", individual: "individual" }[partida.entrenamiento]}
                </div>
              )}
            </div>

            <div className="scroll-y min-h-0 flex-1 rounded-lg p-2.5" style={{ background: "var(--carbon)" }}>
              <div className="mb-1.5 text-[9px] uppercase tracking-[0.14em]" style={{ color: "var(--apagado)" }}>
                Últimos días
              </div>
              {partida.bitacora.slice(-6).reverse().map((b, i) => (
                <div key={i} className="mb-1 flex gap-2 text-[11px]">
                  <span className="num shrink-0" style={{ color: "var(--apagado)" }}>
                    {b.dia.slice(8, 10)}/{b.dia.slice(5, 7)}
                  </span>
                  <span style={{ color: "var(--tenue)" }}>{b.texto}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 rounded-xl p-6 text-center"
               style={{ background: "var(--carbon)" }}>
            <span className="apellido text-[22px]">Terminó el Clausura</span>
            <span className="text-[13px]" style={{ color: "var(--tenue)" }}>
              Olimpia salió {posicion}° con {yo.pts} puntos.
            </span>
            <button onClick={() => { borrar(); onReiniciar(); }}
              className="mt-2 rounded-lg px-5 py-3 text-[13px] font-extrabold uppercase tracking-wider"
              style={{ background: "var(--blanco)", color: "var(--negro)" }}>
              Empezar de nuevo
            </button>
          </div>
        )}
      </div>

      {/* ---------- avanzar ---------- */}
      {!pendiente && partido && !esHoy && (
        <div className="px-3 pt-2">
          <button onClick={onAvanzar}
            className="w-full rounded-lg py-3 text-[14px] font-extrabold uppercase tracking-[0.14em]"
            style={{ background: "var(--blanco)", color: "var(--negro)" }}>
            Avanzar día
          </button>
        </div>
      )}

      {/* ---------- accesos ---------- */}
      <div className="grid grid-cols-5 gap-1 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
        {([["plantel", "Plantel", "#22c55e"], ["mercado", "Pases", "#22d3ee"],
           ["copa", "Copa", "#a78bfa"], ["tabla", "Tabla", "#3b82f6"],
           ["fixture", "Fixture", "#f59e0b"]] as const).map(([id, texto, color]) => (
          <button key={id} onClick={() => setVista(id)}
            className="rounded-lg py-2.5 text-[9px] font-bold uppercase tracking-wider"
            style={{ background: `color-mix(in srgb, ${color} 16%, var(--carbon))`, color }}>
            {texto}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- piezas

function Medidor({ etiqueta, valor, color }: { etiqueta: string; valor: number; color: string }) {
  return (
    <div className="flex-1">
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-[8px] uppercase tracking-[0.14em]" style={{ color: "var(--apagado)" }}>
          {etiqueta}
        </span>
        <span className="num text-[10px]" style={{ color }}>{Math.round(valor)}</span>
      </div>
      <div className="h-1 overflow-hidden rounded-full" style={{ background: "var(--linea)" }}>
        <div className="h-full rounded-full transition-all duration-500"
             style={{ width: `${valor}%`, background: color }} />
      </div>
    </div>
  );
}

function Sub({ titulo, onVolver, children }: {
  titulo: string; onVolver: () => void; children: React.ReactNode;
}) {
  return (
    <div className="app">
      <header className="flex items-center gap-3 px-4 pb-2 pt-3">
        <button onClick={onVolver} className="rounded-md px-2 py-1 text-[12px] font-bold"
                style={{ background: "var(--carbon)", color: "var(--tenue)" }}>←</button>
        <h1 className="apellido text-[20px] leading-none">{titulo}</h1>
      </header>
      <div className="scroll-y min-h-0 flex-1 px-3 pb-4">{children}</div>
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
        <div className="mt-1.5 h-1 overflow-hidden rounded-full" style={{ background: "var(--linea)" }}>
          <div className="h-full rounded-full"
               style={{ width: `${Math.min(100, (partida.minutosSub18 / 900) * 100)}%`,
                        background: partida.minutosSub18 >= 900 ? "#22c55e" : "#f59e0b" }} />
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
                ? "color-mix(in srgb, #ef4444 16%, var(--carbon))" : "var(--carbon)" }}>
              <span className="num flex h-6 w-7 shrink-0 items-center justify-center rounded text-[12px]"
                    style={{ background: COLOR_POS[j.posicion], color: "#0b0b0c" }}>
                {j.numero}
              </span>
              <span className="min-w-0 flex-1">
                <span className="apellido block truncate text-[12px]">
                  {j.apellido}
                  {esSub18(j) && (
                    <span className="ml-1.5 rounded px-1 text-[8px] font-extrabold"
                          style={{ background: "#22c55e", color: "#0b0b0c" }}>S18</span>
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
                      style={{ background: "#ef4444", color: "#0b0b0c" }}>{fuera}</span>
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
                style={{ color: i < 1 ? "#22c55e" : i >= 10 ? "#ef4444" : "var(--apagado)" }}>{i + 1}</span>
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
          ? r.golesOlimpia > r.golesRival ? "#22c55e"
            : r.golesOlimpia === r.golesRival ? "#8b8b95" : "#ef4444"
          : null;
        return (
          <div key={p.etiqueta} className="mb-1 flex items-center gap-2 rounded-md px-2 py-1.5"
            style={{ background: esProximo
              ? "color-mix(in srgb, #ffffff 15%, var(--carbon))" : "var(--carbon)",
              opacity: r ? 0.75 : 1 }}>
            <span className="num w-5 text-[11px]" style={{ color: "var(--apagado)" }}>{n}</span>
            <span className="w-4 text-center text-[9px] font-bold"
                  style={{ color: p.ctx.esLocal ? "#22c55e" : "#f59e0b" }}>
              {p.ctx.esLocal ? "L" : "V"}
            </span>
            <Escudo id={p.rivalId} nombre={p.rivalNombre} tam={18} />
            <span className="apellido min-w-0 flex-1 truncate text-[11px]">
              {nombreCorto(p.rivalId, p.rivalNombre)}
            </span>
            {r ? (
              <span className="num rounded px-1.5 py-0.5 text-[11px]"
                    style={{ background: color!, color: "#0b0b0c" }}>
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
      <div className="mb-3 rounded-xl p-3" style={{ background: "color-mix(in srgb, #a78bfa 14%, var(--carbon))" }}>
        <div className="text-[9px] uppercase tracking-[0.16em]" style={{ color: "#a78bfa" }}>
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
                 background: actual ? "color-mix(in srgb, #a78bfa 18%, var(--carbon))" : "var(--carbon)",
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
                      style={{ background: "#22c55e", color: "#0b0b0c" }}>Pasó</span>
              )}
              {actual && c.ronda !== "eliminado" && (
                <span className="rounded px-1.5 py-0.5 text-[9px] font-extrabold uppercase"
                      style={{ background: "#a78bfa", color: "#0b0b0c" }}>Ahora</span>
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
