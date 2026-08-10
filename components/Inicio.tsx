"use client";

import { useMemo, useState } from "react";
import Escudo from "./Escudo.tsx";
import { COLOR_POS } from "./PanelPartido.tsx";
import { colorCondicion, esSub18, nombreCorto, partidosDeOlimpia } from "@/lib/juego.ts";
import {
  OBJETIVO, TOTAL_FECHAS, borrar, plantelDe, posicionDe, tablaDe,
  type Partida,
} from "@/lib/temporada.ts";
import type { PartidoUI } from "@/lib/juego.ts";

type Vista = "inicio" | "plantel" | "tabla" | "calendario";

export default function Inicio({
  partida, partido, onDirigir, onReiniciar,
}: {
  partida: Partida;
  partido: PartidoUI | null;
  onDirigir: () => void;
  onReiniciar: () => void;
}) {
  const [vista, setVista] = useState<Vista>("inicio");
  const tabla = useMemo(() => tablaDe(partida), [partida]);
  const plantel = useMemo(() => plantelDe(partida), [partida]);
  const posicion = useMemo(() => posicionDe(partida), [partida]);
  const yo = tabla.find((f) => f.id === "olimpia")!;

  const bajas = plantel.filter((j) => j.suspendido || j.lesionado_hasta);

  const racha = [...partida.resultados].slice(-5).map((r) =>
    r.golesOlimpia > r.golesRival ? "G" : r.golesOlimpia === r.golesRival ? "E" : "P");

  if (vista !== "inicio") {
    return (
      <div className="app">
        <header className="flex items-center gap-3 px-4 pb-2 pt-3">
          <button onClick={() => setVista("inicio")}
            className="rounded-md px-2 py-1 text-[12px] font-bold"
            style={{ background: "var(--carbon)", color: "var(--tenue)" }}>
            ←
          </button>
          <h1 className="apellido text-[20px] leading-none">
            {vista === "plantel" ? "Plantel" : vista === "tabla" ? "Tabla" : "Calendario"}
          </h1>
        </header>
        <div className="scroll-y min-h-0 flex-1 px-3 pb-4">
          {vista === "plantel" && <VistaPlantel plantel={plantel} partida={partida} />}
          {vista === "tabla" && <VistaTabla tabla={tabla} />}
          {vista === "calendario" && <VistaCalendario partida={partida} />}
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      {/* ---------- club ---------- */}
      <header className="flex items-center gap-3 px-4 pb-3 pt-4">
        <Escudo id="olimpia" nombre="Olimpia" tam={52} />
        <div className="min-w-0 flex-1">
          <h1 className="apellido text-[26px] leading-none">Olimpia</h1>
          <p className="mt-0.5 text-[11px]" style={{ color: "var(--tenue)" }}>
            Clausura 2026 · Fecha {Math.min(partida.fechaActual, TOTAL_FECHAS)} de {TOTAL_FECHAS}
          </p>
        </div>
        <div className="text-right">
          <div className="num text-[30px] leading-none">{posicion}°</div>
          <div className="text-[9px] uppercase tracking-wider" style={{ color: "var(--apagado)" }}>
            {yo.pts} pts
          </div>
        </div>
      </header>

      {/* ---------- racha ---------- */}
      <div className="flex items-center gap-2 px-4 pb-3">
        <span className="text-[9px] uppercase tracking-[0.14em]" style={{ color: "var(--apagado)" }}>
          Racha
        </span>
        {racha.length === 0 && (
          <span className="text-[11px]" style={{ color: "var(--apagado)" }}>
            Todavía no jugaste
          </span>
        )}
        {racha.map((r, i) => (
          <span key={i}
            className="num flex h-5 w-5 items-center justify-center rounded text-[10px]"
            style={{
              background: r === "G" ? "#22c55e" : r === "E" ? "#8b8b95" : "#ef4444",
              color: "#0b0b0c",
            }}>
            {r}
          </span>
        ))}
        <span className="ml-auto text-[10px]" style={{ color: "var(--apagado)" }}>
          {yo.g}G {yo.e}E {yo.p}P
        </span>
      </div>

      {/* ---------- próximo partido ---------- */}
      <div className="min-h-0 flex-1 px-3">
        {partido ? (
          <div className="flex h-full flex-col gap-2">
          <div className="rounded-xl p-4" style={{ background: "var(--carbon)" }}>
            <span className="text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--apagado)" }}>
              Próximo partido · {partido.ctx.esLocal ? "Local" : "Visitante"}
            </span>

            <div className="mt-3 flex items-center justify-center gap-4">
              <div className="flex flex-col items-center gap-1.5">
                <Escudo id="olimpia" nombre="Olimpia" tam={44} />
                <span className="apellido text-[12px]">Olimpia</span>
              </div>
              <span className="apellido text-[15px]" style={{ color: "var(--apagado)" }}>vs</span>
              <div className="flex flex-col items-center gap-1.5">
                <Escudo id={partido.rivalId} nombre={partido.rivalNombre} tam={44} />
                <span className="apellido max-w-[110px] truncate text-[12px]">
                  {nombreCorto(partido.rivalId, partido.rivalNombre)}
                </span>
              </div>
            </div>

            <p className="mt-3 text-center text-[11px]" style={{ color: "var(--tenue)" }}>
              {partido.estadio} · {partido.ciudad}
            </p>
            {partido.ctx.esClasico && (
              <p className="mt-2 text-center apellido text-[13px]" style={{ color: "#ef4444" }}>
                Clásico
              </p>
            )}

            <button onClick={onDirigir}
              className="mt-4 w-full rounded-lg py-3.5 text-[15px] font-extrabold uppercase tracking-[0.14em]"
              style={{ background: "var(--blanco)", color: "var(--negro)" }}>
              Dirigir el partido
            </button>
          </div>

          {/* bajas y punta de la tabla, para no dejar aire muerto */}
          <div className="scroll-y min-h-0 flex-1">
            {bajas.length > 0 && (
              <div className="mb-2 rounded-lg p-2.5"
                   style={{ background: "color-mix(in srgb, #ef4444 12%, var(--carbon))" }}>
                <div className="mb-1.5 text-[9px] uppercase tracking-[0.14em]" style={{ color: "#ef4444" }}>
                  Bajas para esta fecha
                </div>
                {bajas.map((j) => (
                  <div key={j.id} className="flex items-center gap-2 py-0.5">
                    <span className="num w-6 text-[11px]">{j.numero}</span>
                    <span className="apellido flex-1 truncate text-[11px]">{j.apellido}</span>
                    <span className="text-[9px] font-bold uppercase" style={{ color: "#ef4444" }}>
                      {j.suspendido ? "Suspendido" : "Lesionado"}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-lg p-2.5" style={{ background: "var(--carbon)" }}>
              <div className="mb-1.5 text-[9px] uppercase tracking-[0.14em]"
                   style={{ color: "var(--apagado)" }}>
                Tabla
              </div>
              {tabla.slice(0, 5).map((f, i) => (
                <div key={f.id} className="flex items-center gap-2 py-0.5">
                  <span className="num w-4 text-[10px]"
                        style={{ color: i === 0 ? "#22c55e" : "var(--apagado)" }}>{i + 1}</span>
                  <Escudo id={f.id} nombre={f.nombre} tam={15} />
                  <span className={`flex-1 truncate text-[11px] ${f.id === "olimpia" ? "apellido" : ""}`}
                        style={{ color: f.id === "olimpia" ? "var(--blanco)" : "var(--tenue)" }}>
                    {nombreCorto(f.id, f.nombre)}
                  </span>
                  <span className="num text-[11px]">{f.pts}</span>
                </div>
              ))}
            </div>
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

      {/* ---------- accesos ---------- */}
      <div className="grid grid-cols-3 gap-1.5 px-3 pb-2 pt-3">
        {([["plantel", "Plantel", "#22c55e"], ["tabla", "Tabla", "#3b82f6"],
           ["calendario", "Fixture", "#f59e0b"]] as const).map(([id, texto, color]) => (
          <button key={id} onClick={() => setVista(id)}
            className="rounded-lg py-3 text-[11px] font-bold uppercase tracking-wider"
            style={{ background: `color-mix(in srgb, ${color} 16%, var(--carbon))`, color }}>
            {texto}
          </button>
        ))}
      </div>

      <div className="px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <p className="text-center text-[10px]" style={{ color: "var(--apagado)" }}>
          Objetivo de la dirigencia: {OBJETIVO}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- vistas

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
        .sort((a, b) => orden.indexOf(a.posicion) - orden.indexOf(b.posicion) || b.nivel - a.nivel)
        .map((j) => {
          const e = partida.plantel[j.id];
          const fuera = j.suspendido ? "SUSPENDIDO" : j.lesionado_hasta ? "LESIONADO" : null;
          return (
            <div key={j.id}
              className="mb-1 flex items-center gap-2 rounded-md px-2 py-1.5"
              style={{
                background: fuera
                  ? "color-mix(in srgb, #ef4444 16%, var(--carbon))"
                  : "var(--carbon)",
              }}>
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
                  {(e?.golesTorneo ?? 0) > 0 && ` · ${e.golesTorneo} gol${e.golesTorneo > 1 ? "es" : ""}`}
                  {(e?.amarillas ?? 0) > 0 && ` · ${e.amarillas} amarilla${e.amarillas > 1 ? "s" : ""}`}
                </span>
              </span>
              {fuera && (
                <span className="rounded px-1 text-[8px] font-extrabold uppercase"
                      style={{ background: "#ef4444", color: "#0b0b0c" }}>{fuera}</span>
              )}
              <span className="num w-8 text-right text-[11px]"
                    style={{ color: colorCondicion(j.condicion) }}>
                {j.condicion}%
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
        <span className="w-4" />
        <span className="flex-1">Equipo</span>
        <span className="w-6 text-center">PJ</span>
        <span className="w-7 text-center">DG</span>
        <span className="w-7 text-center">Pts</span>
      </div>
      {tabla.map((f, i) => (
        <div key={f.id}
          className="mb-1 flex items-center gap-2 rounded-md px-2 py-1.5"
          style={{
            background: f.id === "olimpia"
              ? "color-mix(in srgb, #ffffff 15%, var(--carbon))"
              : "var(--carbon)",
          }}>
          <span className="num w-4 text-[11px]"
                style={{ color: i < 1 ? "#22c55e" : i >= 10 ? "#ef4444" : "var(--apagado)" }}>
            {i + 1}
          </span>
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

function VistaCalendario({ partida }: { partida: Partida }) {
  const partidos = partidosDeOlimpia();
  return (
    <>
      {partidos.map((p, i) => {
        const n = i + 1;
        const r = partida.resultados.find((x) => x.fechaNumero === n);
        const esProximo = n === partida.fechaActual;
        const resultado = r
          ? r.golesOlimpia > r.golesRival ? "#22c55e"
            : r.golesOlimpia === r.golesRival ? "#8b8b95" : "#ef4444"
          : null;
        return (
          <div key={p.etiqueta}
            className="mb-1 flex items-center gap-2 rounded-md px-2 py-1.5"
            style={{
              background: esProximo
                ? "color-mix(in srgb, #ffffff 15%, var(--carbon))"
                : "var(--carbon)",
              opacity: r ? 0.75 : 1,
            }}>
            <span className="num w-5 text-[11px]" style={{ color: "var(--apagado)" }}>{n}</span>
            <span className="w-4 text-center text-[9px] font-bold"
                  style={{ color: p.ctx.esLocal ? "#22c55e" : "#f59e0b" }}>
              {p.ctx.esLocal ? "L" : "V"}
            </span>
            <Escudo id={p.rivalId} nombre={p.rivalNombre} tam={18} />
            <span className="apellido min-w-0 flex-1 truncate text-[11px]">
              {nombreCorto(p.rivalId, p.rivalNombre)}
            </span>
            {p.ctx.esClasico && (
              <span className="rounded px-1 text-[8px] font-extrabold" style={{ background: "#ef4444", color: "#0b0b0c" }}>
                CLÁSICO
              </span>
            )}
            {r ? (
              <span className="num rounded px-1.5 py-0.5 text-[11px]"
                    style={{ background: resultado!, color: "#0b0b0c" }}>
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
