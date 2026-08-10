"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Rng } from "@/engine/rng.ts";
import { P } from "@/engine/motor.ts";
import { ambienteDe, relatarTramo, type EventoRelato } from "@/engine/relato.ts";
import { colorCondicion, nivelEf, type PartidoUI } from "@/lib/juego.ts";
import type { Actitud, Alineacion, Jugador, Posicion } from "@/engine/tipos.ts";
import type { Salida } from "./ArmarOnce.tsx";

const VELOCIDADES = [
  { etiqueta: "▶", ms: 620 },
  { etiqueta: "▶▶", ms: 260 },
  { etiqueta: "▶▶▶", ms: 90 },
];

const COLOR_EVENTO: Record<string, string> = {
  gol: "var(--ok)",
  gol_rival: "var(--critico)",
  amarilla: "var(--medio)",
  roja: "var(--critico)",
  lesion: "var(--bajo)",
  aviso_condicion: "var(--bajo)",
  cambio: "var(--tenue)",
};

export default function PartidoEnVivo({
  partido, salida, onTerminar,
}: { partido: PartidoUI; salida: Salida; onTerminar: (gO: number, gR: number) => void }) {
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
  const [actitudUsada, setActitudUsada] = useState(false);
  const [panel, setPanel] = useState<"cambio" | "actitud" | null>(null);
  const [sale, setSale] = useState<Jugador | null>(null);
  const [terminado, setTerminado] = useState(false);
  const [lesionado, setLesionado] = useState<string | null>(null);

  const semilla = useRef(0);
  /** Cursor sobre `pendientes`. Con un filtro por minuto exacto, cualquier evento
   *  que caiga en un minuto ya pasado tras re-simular se perdía. */
  const cursor = useRef(0);
  const scroller = useRef<HTMLDivElement>(null);

  /** Condición al minuto actual: el desgaste se siente durante el partido. */
  const condAhora = (j: Jugador) =>
    Math.max(0, Math.round(j.condicion - (P.desgaste90 * Math.min(minuto, 90)) / 90));

  const alineacion = useMemo<Alineacion>(
    () => ({ once, suplentes: banco, actitud, presionAlta: salida.presionAlta, puestos }),
    [once, banco, actitud, puestos, salida.presionAlta]);

  const [pendientes, setPendientes] = useState<EventoRelato[]>(() =>
    relatarTramo(
      { once: salida.once, suplentes: salida.suplentes, actitud: salida.actitud,
        presionAlta: salida.presionAlta, puestos: salida.puestos },
      ctx, new Rng(`${ctx.fecha}-${ctx.rivalNombre}-0`), 0, 90, 0, 0));

  /** Vuelve a simular lo que queda con el equipo que hay ahora. */
  const resimular = (desdeMin: number, nueva: Alineacion) => {
    semilla.current++;
    cursor.current = 0;
    setPendientes(relatarTramo(
      nueva, ctx, new Rng(`${ctx.fecha}-${ctx.rivalNombre}-${semilla.current}`),
      desdeMin, 90, gO, gR));
  };

  // reloj del partido
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
        const ultimo = ahora[ahora.length - 1];
        setGO(ultimo.golesOlimpia);
        setGR(ultimo.golesRival);
        const les = ahora.find((e) => e.tipo === "lesion");
        if (les?.jugadorId) {
          setLesionado(les.jugadorId);
          const j = once.find((x) => x.id === les.jugadorId);
          if (j && cambios > 0) { setSale(j); setPanel("cambio"); }
        }
        if (ahora.some((e) => e.pausa)) setCorriendo(false);
        if (ultimo.tipo === "final") { setTerminado(true); setCorriendo(false); }
      }
      setMinuto(siguiente);
      if (siguiente >= 90 && !ahora.some((e) => e.tipo === "final")) {
        setTerminado(true); setCorriendo(false);
      }
    }, VELOCIDADES[vel].ms);
    return () => clearTimeout(t);
  }, [minuto, corriendo, vel, pendientes, terminado]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [visibles.length]);

  const hacerCambio = (entra: Jugador) => {
    if (!sale || cambios <= 0) return;
    const nuevoOnce = once.map((j) => (j.id === sale.id ? entra : j));
    const nuevosPuestos = new Map(puestos);
    nuevosPuestos.set(entra.id, puestos.get(sale.id) ?? entra.posicion);
    setOnce(nuevoOnce);
    setPuestos(nuevosPuestos);
    setBanco(banco.filter((j) => j.id !== entra.id));
    setCambios((c) => c - 1);
    setVisibles((v) => [...v, {
      minuto, tipo: "cambio",
      texto: `Cambio en Olimpia. Sale ${sale.apellido}, entra ${entra.apellido}.`,
      golesOlimpia: gO, golesRival: gR,
    }]);
    resimular(minuto, { once: nuevoOnce, suplentes: banco.filter((j) => j.id !== entra.id),
                        actitud, presionAlta: salida.presionAlta, puestos: nuevosPuestos });
    if (sale.id === lesionado) setLesionado(null);
    setSale(null); setPanel(null); setCorriendo(true);
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

  return (
    <div className="app">
      {/* ---------- marcador ---------- */}
      <header className="border-b px-4 pb-3 pt-3" style={{ borderColor: "var(--linea)" }}>
        <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.18em]"
             style={{ color: "var(--tenue)" }}>
          <span>{partido.etiqueta}</span>
          <span>{partido.estadio}</span>
        </div>
        <div className="mt-2 flex items-center gap-3">
          <div className="franjas h-9 w-1.5 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1">
            <div className="apellido truncate text-[15px] leading-tight">Olimpia</div>
            <div className="apellido truncate text-[15px] leading-tight"
                 style={{ color: "var(--tenue)" }}>{partido.rivalNombre}</div>
          </div>
          <div className="marcador text-[42px]">{gO}</div>
          <div className="marcador text-[42px]" style={{ color: "var(--apagado)" }}>—</div>
          <div className="marcador text-[42px]" style={{ color: "var(--tenue)" }}>{gR}</div>
          <div className="ml-2 w-12 shrink-0 text-right">
            <div className={`num text-[22px] leading-none ${corriendo ? "latir" : ""}`}>
              {Math.min(minuto, 90)}'
            </div>
          </div>
        </div>
        <div className="mt-2 h-0.5 w-full overflow-hidden rounded-full" style={{ background: "var(--linea)" }}>
          <div className="h-full rounded-full transition-all duration-200"
               style={{ width: `${Math.min(minuto / 90, 1) * 100}%`, background: "var(--blanco)" }} />
        </div>
      </header>

      {/* ---------- relato ---------- */}
      <div ref={scroller} className="scroll-y flex flex-1 flex-col px-4 py-3">
        {/* el relato se ancla abajo: lo último queda junto a los controles */}
        <div className="mt-auto">
        {visibles.map((e, i) => {
          const destacado = e.tipo === "gol" || e.tipo === "gol_rival";
          return (
            <div key={i} className="entrar mb-2.5 flex gap-3">
              <span className="num w-7 shrink-0 pt-0.5 text-right text-[12px]"
                    style={{ color: "var(--apagado)" }}>
                {e.minuto}'
              </span>
              <span className={destacado ? "apellido text-[15px] leading-snug" : "text-[13px] leading-snug"}
                    style={{ color: COLOR_EVENTO[e.tipo] ?? "var(--blanco)" }}>
                {e.texto}
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
              className="w-14 rounded py-2.5 text-[13px] font-bold"
              style={{ background: "var(--blanco)", color: "var(--negro)" }}>
              {corriendo ? "❚❚" : "▶"}
            </button>
            <button onClick={() => setVel((v) => (v + 1) % VELOCIDADES.length)}
              className="w-14 rounded py-2.5 text-[12px] font-bold"
              style={{ background: "var(--carbon)", color: "var(--tenue)" }}>
              {VELOCIDADES[vel].etiqueta}
            </button>
            <button onClick={() => { setCorriendo(false); setPanel("cambio"); }}
              disabled={cambios === 0}
              className="flex-1 rounded py-2.5 text-[11px] font-bold uppercase tracking-wider"
              style={{ background: "var(--carbon)", color: cambios ? "var(--blanco)" : "var(--apagado)" }}>
              Cambios · {cambios}
            </button>
            <button onClick={() => { setCorriendo(false); setPanel("actitud"); }}
              disabled={actitudUsada}
              className="flex-1 rounded py-2.5 text-[11px] font-bold uppercase tracking-wider"
              style={{ background: "var(--carbon)", color: actitudUsada ? "var(--apagado)" : "var(--blanco)" }}>
              {actitudUsada ? "Actitud ✓" : "Actitud"}
            </button>
          </div>
        </div>
      )}

      {/* ---------- panel de cambio ---------- */}
      {panel === "cambio" && (
        <Panel titulo={sale ? `Entra por ${sale.apellido}` : "¿Quién sale?"}
               onCerrar={() => { setSale(null); setPanel(null); setCorriendo(true); }}>
          {(sale ? banco : [...once].sort((a, b) =>
              (b.id === lesionado ? 1 : 0) - (a.id === lesionado ? 1 : 0) ||
              condAhora(a) - condAhora(b))
           ).map((j) => {
            const esLesionado = j.id === lesionado;
            const cond = sale ? j.condicion : condAhora(j);
            return (
              <button key={j.id} onClick={() => (sale ? hacerCambio(j) : setSale(j))}
                className="mb-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left"
                style={{
                  background: "var(--carbon)",
                  boxShadow: esLesionado ? "inset 0 0 0 1px var(--bajo)" : "none",
                }}>
                <span className="num w-8 text-center text-[18px]">{j.numero}</span>
                <span className="flex-1 min-w-0">
                  <span className="apellido block truncate text-[14px]">{j.apellido}</span>
                  <span className="text-[10px]" style={{ color: "var(--tenue)" }}>
                    {puestos.get(j.id) ?? j.posicion} ·{" "}
                    <span style={{ color: colorCondicion(cond) }}>{cond}%</span>
                    {esLesionado && (
                      <span className="ml-1.5 font-bold" style={{ color: "var(--bajo)" }}>
                        LESIONADO
                      </span>
                    )}
                  </span>
                </span>
                <span className="num text-[19px]">
                  {nivelEf(j, puestos.get(j.id) ?? j.posicion, ctx)}
                </span>
              </button>
            );
          })}
        </Panel>
      )}

      {panel === "actitud" && (
        <Panel titulo="Cambio de actitud · una sola vez"
               onCerrar={() => { setPanel(null); setCorriendo(true); }}>
          {(["defensivo", "equilibrado", "ofensivo"] as Actitud[]).map((a) => (
            <button key={a} onClick={() => cambiarActitud(a)}
              className="mb-1.5 w-full rounded-lg px-3 py-3 text-left"
              style={{ background: a === actitud ? "var(--blanco)" : "var(--carbon)",
                       color: a === actitud ? "var(--negro)" : "var(--blanco)" }}>
              <span className="apellido text-[14px]">
                {a === "defensivo" ? "Aguantar" : a === "equilibrado" ? "Parejo" : "Ir al frente"}
              </span>
              <span className="block text-[11px] opacity-70">
                {a === "defensivo" ? "Menos peligro en contra, casi no vas a atacar"
                  : a === "equilibrado" ? "Sin ventajas ni riesgos extra"
                  : "Más peligro arriba, quedás más expuesto atrás"}
              </span>
            </button>
          ))}
        </Panel>
      )}

      {/* ---------- final ---------- */}
      {terminado && (
        <div className="border-t px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3"
             style={{ borderColor: "var(--linea)" }}>
          <div className="mb-2 text-center apellido text-[13px]"
               style={{ color: gO > gR ? "var(--ok)" : gO < gR ? "var(--critico)" : "var(--tenue)" }}>
            {gO > gR ? "Victoria" : gO < gR ? "Derrota" : "Empate"}
          </div>
          <button onClick={() => onTerminar(gO, gR)}
            className="w-full rounded-lg py-3.5 text-[15px] font-extrabold uppercase tracking-[0.14em]"
            style={{ background: "var(--blanco)", color: "var(--negro)" }}>
            Siguiente fecha
          </button>
        </div>
      )}
    </div>
  );
}

function Panel({ titulo, onCerrar, children }: {
  titulo: string; onCerrar: () => void; children: React.ReactNode;
}) {
  return (
    <div className="absolute inset-0 z-10 flex flex-col justify-end"
         style={{ background: "rgba(0,0,0,0.72)" }} onClick={onCerrar}>
      <div className="entrar rounded-t-2xl border-t px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3"
           style={{ background: "var(--negro)", borderColor: "var(--linea)", maxHeight: "72%" }}
           onClick={(e) => e.stopPropagation()}>
        <div className="mb-2.5 flex items-center justify-between px-1">
          <span className="text-[11px] uppercase tracking-[0.16em]" style={{ color: "var(--tenue)" }}>
            {titulo}
          </span>
          <button onClick={onCerrar} className="text-[11px]" style={{ color: "var(--apagado)" }}>
            Cerrar
          </button>
        </div>
        <div className="scroll-y" style={{ maxHeight: "56vh" }}>{children}</div>
      </div>
    </div>
  );
}
