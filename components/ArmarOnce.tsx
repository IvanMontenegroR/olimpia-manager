"use client";

import { useMemo, useState } from "react";
import {
  asignarPuestos, BANDERA, colorCondicion, CUPO_EXTRANJEROS, esSub18,
  nivelEf, PLANTEL, type PartidoUI,
} from "@/lib/juego.ts";
import type { Actitud, Jugador, Posicion } from "@/engine/tipos.ts";
import Escudo from "./Escudo.tsx";
import { ACTITUD } from "./PartidoEnVivo.tsx";

const POSICIONES: (Posicion | "TODOS")[] = ["TODOS", "ARQ", "DEF", "MED", "DEL"];
const ORDEN: Record<Posicion, number> = { ARQ: 0, DEF: 1, MED: 2, DEL: 3 };

export interface Salida {
  once: Jugador[];
  suplentes: Jugador[];
  actitud: Actitud;
  presionAlta: boolean;
  puestos: Map<string, Posicion>;
}

export default function ArmarOnce({
  partido, onJugar,
}: { partido: PartidoUI; onJugar: (s: Salida) => void }) {
  const { ctx } = partido;
  const [sel, setSel] = useState<Set<string>>(() => new Set(autoOnce(ctx)));
  const [filtro, setFiltro] = useState<Posicion | "TODOS">("TODOS");
  const [actitud, setActitud] = useState<Actitud>(ctx.esLocal ? "ofensivo" : "equilibrado");
  const [presionAlta, setPresion] = useState(ctx.esLocal);

  const once = useMemo(
    () => PLANTEL.filter((j) => sel.has(j.id)).sort((a, b) => ORDEN[a.posicion] - ORDEN[b.posicion]),
    [sel]);

  const asign = useMemo(() => asignarPuestos(once, ctx), [once, ctx]);
  const extranjeros = once.filter((j) => j.extranjero).length;
  const sub18 = once.filter(esSub18).length;
  const arqueros = once.filter((j) => j.posicion === "ARQ").length;

  const nivelOnce = asign
    ? Math.round(once.reduce((s, j) => s + nivelEf(j, asign.puestos.get(j.id)!, ctx), 0) / 11)
    : 0;

  const problema =
    once.length !== 11 ? `Faltan ${11 - once.length}` :
    arqueros !== 1 ? "Necesitás un arquero" :
    extranjeros > CUPO_EXTRANJEROS ? `${extranjeros} extranjeros, el cupo es ${CUPO_EXTRANJEROS}` :
    null;

  const alternar = (j: Jugador) => {
    setSel((prev) => {
      const n = new Set(prev);
      if (n.has(j.id)) n.delete(j.id);
      else if (n.size < 11) n.add(j.id);
      return n;
    });
  };

  const lista = useMemo(() => {
    const base = filtro === "TODOS" ? PLANTEL : PLANTEL.filter((j) => j.posicion === filtro);
    return [...base].sort((a, b) => {
      const sa = sel.has(a.id) ? 0 : 1, sb = sel.has(b.id) ? 0 : 1;
      if (sa !== sb) return sa - sb;
      if (ORDEN[a.posicion] !== ORDEN[b.posicion]) return ORDEN[a.posicion] - ORDEN[b.posicion];
      return nivelEf(b, b.posicion, ctx) - nivelEf(a, a.posicion, ctx);
    });
  }, [filtro, sel, ctx]);

  const jugar = () => {
    if (problema || !asign) return;
    const libres = PLANTEL.filter((j) => !sel.has(j.id) && !j.lesionado_hasta);
    const porNivel = (a: Jugador, b: Jugador) =>
      nivelEf(b, b.posicion, ctx) - nivelEf(a, a.posicion, ctx);
    const arquero = libres.filter((j) => j.posicion === "ARQ").sort(porNivel)[0];
    const suplentes = [
      ...(arquero ? [arquero] : []),
      ...libres.filter((j) => j.posicion !== "ARQ").sort(porNivel).slice(0, 6),
    ];
    onJugar({ once, suplentes, actitud, presionAlta, puestos: asign.puestos });
  };

  return (
    <div className="app">
      {/* ---------- cabecera del partido ---------- */}
      <header className="px-4 pt-3 pb-2.5 border-b" style={{ borderColor: "var(--linea)" }}>
        <div className="flex items-baseline justify-between">
          <span className="text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--tenue)" }}>
            {partido.etiqueta}
          </span>
          <span className="text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--tenue)" }}>
            {ctx.esLocal ? "Local" : "Visitante"}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-2.5">
          <Escudo id={partido.rivalId} nombre={partido.rivalNombre} tam={30} />
          <span className="text-[13px] font-semibold" style={{ color: "var(--apagado)" }}>vs</span>
          <h1 className="apellido text-[26px] leading-none">{partido.rivalNombre}</h1>
          {ctx.esClasico && (
            <span className="ml-auto rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest"
                  style={{ background: "var(--blanco)", color: "var(--negro)" }}>
              Clásico
            </span>
          )}
        </div>
        <div className="mt-1 text-[11px]" style={{ color: "var(--apagado)" }}>
          {partido.estadio} · {partido.ciudad}
          {ctx.viajeKm > 0 && ` · ${ctx.viajeKm} km de viaje`}
        </div>
      </header>

      {/* ---------- estado del once ---------- */}
      <div className="flex items-stretch border-b" style={{ borderColor: "var(--linea)" }}>
        <Dato etiqueta="Once" valor={`${once.length}/11`}
              alerta={once.length !== 11} />
        <Dato etiqueta="Sistema" valor={asign?.molde ?? "—"} />
        <Dato etiqueta="Extranj." valor={`${extranjeros}/${CUPO_EXTRANJEROS}`}
              alerta={extranjeros > CUPO_EXTRANJEROS} />
        <Dato etiqueta="Sub-18" valor={sub18 > 0 ? String(sub18) : "0"}
              alerta={sub18 === 0} />
        <Dato etiqueta="Nivel" valor={nivelOnce ? String(nivelOnce) : "—"} fuerte />
      </div>

      {(asign?.adaptados.length || asign?.fueraDePuesto.length) ? (
        <div className="px-4 py-1.5 text-[11px] border-b" style={{ borderColor: "var(--linea)", color: "var(--tenue)" }}>
          {asign.adaptados.map((j) => (
            <span key={j.id} className="mr-2">
              {j.apellido} de {asign.puestos.get(j.id)} <span style={{ color: "var(--medio)" }}>×0.90</span>
            </span>
          ))}
          {asign.fueraDePuesto.map((j) => (
            <span key={j.id} className="mr-2">
              {j.apellido} de {asign.puestos.get(j.id)} <span style={{ color: "var(--critico)" }}>×0.75</span>
            </span>
          ))}
        </div>
      ) : null}

      {/* ---------- filtro por posición ---------- */}
      <div className="flex gap-1 px-3 py-2">
        {POSICIONES.map((p) => (
          <button key={p} onClick={() => setFiltro(p)}
            className="flex-1 rounded py-1.5 text-[11px] font-bold uppercase tracking-wider transition-colors"
            style={{
              background: filtro === p ? "var(--blanco)" : "var(--carbon)",
              color: filtro === p ? "var(--negro)" : "var(--tenue)",
            }}>
            {p === "TODOS" ? "Todos" : p}
          </button>
        ))}
      </div>

      {/* ---------- plantel ---------- */}
      <div className="scroll-y flex-1 px-3 pb-2">
        {lista.map((j) => {
          const elegido = sel.has(j.id);
          const puesto = elegido && asign ? asign.puestos.get(j.id)! : j.posicion;
          const ef = nivelEf(j, puesto, ctx);
          const adaptado = elegido && puesto !== j.posicion;
          return (
            <button key={j.id} onClick={() => alternar(j)}
              className="relative mb-1 flex w-full items-center gap-3 rounded-lg px-2.5 py-2 pl-3.5 text-left transition-colors"
              style={{
                background: elegido ? "var(--carbon)" : "transparent",
                boxShadow: elegido ? "inset 0 0 0 1px var(--linea)" : "none",
                opacity: !elegido && sel.size >= 11 ? 0.42 : 1,
              }}>
              {elegido && (
                <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full"
                      style={{ background: "var(--blanco)" }} />
              )}
              <span className="num w-8 shrink-0 text-center text-[19px]"
                    style={{ color: elegido ? "var(--blanco)" : "var(--apagado)" }}>
                {j.numero}
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-1.5">
                  <span className="apellido truncate text-[14px]">{j.apellido}</span>
                  <span className="truncate text-[11px]" style={{ color: "var(--apagado)" }}>
                    {j.nombre}
                  </span>
                </span>
                <span className="mt-0.5 flex items-center gap-1.5 text-[10px]"
                      style={{ color: "var(--tenue)" }}>
                  <span style={{ color: adaptado ? "var(--medio)" : "var(--tenue)" }}>
                    {puesto}{adaptado && ` (de ${j.posicion})`}
                  </span>
                  <span>{BANDERA[j.nacionalidad] ?? ""}</span>
                  {esSub18(j) && (
                    <span className="rounded px-1 font-bold"
                          style={{ background: "var(--linea)", color: "var(--blanco)" }}>S18</span>
                  )}
                  <span className="ml-auto flex items-center gap-1">
                    <span className="h-1 w-10 overflow-hidden rounded-full" style={{ background: "var(--linea)" }}>
                      <span className="block h-full rounded-full"
                            style={{ width: `${j.condicion}%`, background: colorCondicion(j.condicion) }} />
                    </span>
                    <span style={{ color: colorCondicion(j.condicion) }}>{j.condicion}%</span>
                  </span>
                </span>
              </span>

              <span className="w-9 shrink-0 text-right">
                <span className="num block text-[20px] leading-none">{ef}</span>
                {ef !== j.nivel && (
                  <span className="block text-[9px] leading-tight" style={{ color: "var(--apagado)" }}>
                    de {j.nivel}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* ---------- decisiones y salida ---------- */}
      <div className="border-t px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2.5"
           style={{ borderColor: "var(--linea)", background: "var(--negro)" }}>
        <div className="mb-2 flex gap-1.5">
          {(["defensivo", "equilibrado", "ofensivo"] as Actitud[]).map((a) => {
            const A = ACTITUD[a];
            return (
              <button key={a} onClick={() => setActitud(a)}
                className="flex-1 rounded py-2 text-[11px] font-bold uppercase tracking-wider"
                style={{
                  background: actitud === a ? A.color : "var(--carbon)",
                  color: actitud === a ? A.sobre : "var(--tenue)",
                  boxShadow: actitud === a ? "none" : `inset 3px 0 0 ${A.color}`,
                }}>
                {A.nombre}
              </button>
            );
          })}
          <button onClick={() => setPresion((p) => !p)}
            className="rounded px-3 py-2 text-[11px] font-bold uppercase tracking-wider"
            style={{
              background: presionAlta ? "var(--blanco)" : "var(--carbon)",
              color: presionAlta ? "var(--negro)" : "var(--tenue)",
            }}>
            Presión
          </button>
        </div>

        <button onClick={jugar} disabled={!!problema}
          className="w-full rounded-lg py-3.5 text-[15px] font-extrabold uppercase tracking-[0.14em]"
          style={{
            background: problema ? "var(--carbon)" : "var(--blanco)",
            color: problema ? "var(--apagado)" : "var(--negro)",
          }}>
          {problema ?? "Jugar el partido"}
        </button>
      </div>
    </div>
  );
}

function Dato({ etiqueta, valor, alerta, fuerte }: {
  etiqueta: string; valor: string; alerta?: boolean; fuerte?: boolean;
}) {
  return (
    <div className="flex-1 border-r px-2 py-1.5 last:border-r-0" style={{ borderColor: "var(--linea)" }}>
      <div className="text-[9px] uppercase tracking-[0.12em]" style={{ color: "var(--apagado)" }}>
        {etiqueta}
      </div>
      <div className={fuerte ? "num text-[17px] leading-tight" : "text-[13px] font-bold leading-tight"}
           style={{ color: alerta ? "var(--medio)" : "var(--blanco)" }}>
        {valor}
      </div>
    </div>
  );
}

/** Once inicial sugerido: el mejor posible respetando cupo y Sub-18. */
function autoOnce(ctx: PartidoUI["ctx"]): string[] {
  const cupos: Record<Posicion, number> = { ARQ: 1, DEF: 4, MED: 3, DEL: 3 };
  const elegidos: Jugador[] = [];
  let ext = 0;
  const sub = PLANTEL.filter(esSub18).sort(
    (a, b) => nivelEf(b, b.posicion, ctx) - nivelEf(a, a.posicion, ctx))[0];
  if (sub) { elegidos.push(sub); cupos[sub.posicion]--; }

  for (const pos of ["ARQ", "DEF", "MED", "DEL"] as Posicion[]) {
    const cand = PLANTEL
      .filter((j) => j.posicion === pos && !elegidos.includes(j) && !j.lesionado_hasta)
      .sort((a, b) => nivelEf(b, pos, ctx) - nivelEf(a, pos, ctx));
    for (const j of cand) {
      if (cupos[pos] <= 0) break;
      if (j.extranjero && ext >= CUPO_EXTRANJEROS) continue;
      elegidos.push(j); cupos[pos]--; if (j.extranjero) ext++;
    }
  }
  return elegidos.map((j) => j.id);
}
