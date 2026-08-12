"use client";

import { useEffect, useRef, useState } from "react";
import { chanceDe, riesgoDe, type Momento, type ResueltoMomento } from "@/engine/momentos.ts";
import type { Alineacion, ContextoPartido } from "@/engine/tipos.ts";
import Definicion, { type TipoDefinicion } from "./Definicion.tsx";

const COLOR: Record<string, string> = {
  penal_favor: "var(--ok)",
  penal_contra: "var(--critico)",
  tiro_libre: "var(--medio)",
  jugador_caliente: "var(--bajo)",
  mano_a_mano: "var(--ok)",
};

/**
 * Decisión con el reloj corriendo. Si no elegís a tiempo se toma la opción
 * conservadora: no decidir también es decidir.
 */
/** Los momentos que terminan en un remate al arco se dibujan. */
const DEFINICION: Partial<Record<string, TipoDefinicion>> = {
  penal_favor: "remate",
  penal_ultima: "remate",
  penal_contra: "atajada",
  tiro_libre: "remate",
  mano_a_mano: "remate",
};

export default function MomentoOverlay({
  momento, resuelto, alineacion, ctx, onElegir, onSeguir,
}: {
  momento: Momento;
  resuelto: ResueltoMomento | null;
  alineacion: Alineacion;
  ctx: ContextoPartido;
  onElegir: (opcionId: string) => void;
  onSeguir: () => void;
}) {
  const [restante, setRestante] = useState(momento.segundos * 10);
  const [animando, setAnimando] = useState(false);
  const yaElegido = useRef(false);
  const elegida = useRef<string | null>(null);
  const color = COLOR[momento.tipo] ?? "var(--blanco)";
  const tipoDef = DEFINICION[momento.tipo];

  useEffect(() => {
    if (resuelto) return;
    const t = setInterval(() => {
      setRestante((r) => {
        if (r <= 1) {
          clearInterval(t);
          if (!yaElegido.current) {
            yaElegido.current = true;
            onElegir(momento.porDefecto);
          }
          return 0;
        }
        return r - 1;
      });
    }, 100);
    return () => clearInterval(t);
  }, [momento, resuelto, onElegir]);

  const elegir = (id: string) => {
    if (yaElegido.current) return;
    yaElegido.current = true;
    elegida.current = id;
    if (tipoDef) setAnimando(true);
    onElegir(id);
  };

  const proporcion = restante / (momento.segundos * 10);

  return (
    <div className="absolute inset-0 z-20 flex flex-col justify-end"
         style={{ background: "linear-gradient(to bottom, rgba(11,11,12,0.25) 0%, rgba(11,11,12,0.82) 45%, rgba(11,11,12,0.96) 100%)", backdropFilter: "blur(2px)" }}>
      <div className="entrar px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">

        <div className="mb-1 flex items-baseline gap-2">
          <span className="num text-[13px]" style={{ color: "var(--apagado)" }}>
            {momento.minuto}'
          </span>
          <span className="apellido text-[24px] leading-none" style={{ color }}>
            {momento.titulo}
          </span>
        </div>
        <p className="mb-3 text-[14px] leading-snug" style={{ color: "var(--tenue)" }}>
          {momento.contexto}
        </p>

        {!resuelto ? (
          <>
            {/* el reloj corriendo */}
            <div className="mb-3 h-1 w-full overflow-hidden rounded-full"
                 style={{ background: "var(--linea)" }}>
              <div className="h-full rounded-full"
                   style={{
                     width: `${proporcion * 100}%`,
                     background: proporcion < 0.3 ? "var(--critico)" : color,
                     transition: "width 100ms linear",
                   }} />
            </div>

            <div className="flex flex-col gap-1.5">
              {momento.opciones.map((o) => {
                const chance = chanceDe(momento, o.id, alineacion, ctx);
                const riesgo = riesgoDe(momento, o.id);
                return (
                  <button key={o.id} onClick={() => elegir(o.id)}
                    className="w-full rounded-lg px-3.5 py-3 text-left"
                    style={{ background: `color-mix(in srgb, ${color} 12%, var(--carbon))`,
                             outline: `1px solid color-mix(in srgb, ${color} 45%, transparent)` }}>
                    <span className="flex items-center gap-2">
                      <span className="apellido min-w-0 flex-1 truncate text-[15px] leading-tight">
                        {o.etiqueta}
                      </span>
                      {/* Sin esto no se notaba que elegir pateador cambia algo. */}
                      {chance !== null && (
                        <span className="num shrink-0 rounded px-1.5 py-0.5 text-[12px] font-extrabold"
                              style={{ background: color, color: "#0a120d" }}>
                          {Math.round(chance * 100)}%
                        </span>
                      )}
                    </span>
                    <span className="block text-[11px]" style={{ color: "var(--tenue)" }}>
                      {o.detalle}
                    </span>
                    {/* La barra muestra las dos caras: lo que ganás y lo que
                        arriesgás. Sin el rojo, la de más porcentaje siempre
                        ganaba y no había nada que decidir. */}
                    {chance !== null && (
                      <span className="mt-1.5 flex h-1.5 overflow-hidden rounded-full"
                            style={{ background: "var(--linea)" }}>
                        <span style={{ width: `${chance * 100}%`, background: color }} />
                        {riesgo && (
                          <span style={{ width: `${riesgo.contra * 100}%`, background: "#c0392b" }} />
                        )}
                      </span>
                    )}
                    {riesgo && (
                      <span className="mt-1 flex items-center gap-1 text-[10px] font-bold"
                            style={{ color: "#e07a6f" }}>
                        <span className="num rounded px-1"
                              style={{ background: "#c0392b", color: "#0a120d" }}>
                          {Math.round(riesgo.contra * 100)}%
                        </span>
                        {riesgo.texto}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <>
            {/* Primero se ve la jugada y recién después el texto: el remate
                tiene que pasar en pantalla, no contarse. */}
            {tipoDef && (
              <Definicion
                tipo={tipoDef}
                entro={tipoDef === "remate" ? !!resuelto.golOlimpia : !!resuelto.golRival}
                chance={chanceDe(momento, elegida.current ?? momento.porDefecto, alineacion, ctx)}
                semilla={momento.minuto * 7 + momento.titulo.length}
                onTermina={() => setAnimando(false)} />
            )}

            <div className="mb-3 rounded-lg px-3.5 py-3"
                 style={{ opacity: animando ? 0 : 1, transition: "opacity 260ms ease-out" }}
                 >
              <span className="apellido block text-[15px] leading-snug"
                    style={{ color: resuelto.exito ? "var(--ok)" : "var(--critico)" }}>
                {resuelto.texto}
              </span>
              {/* El premio de haber elegido la difícil, a la vista. */}
              {!!resuelto.levantaHinchada && (
                <span className="num mt-1.5 inline-block rounded px-1.5 py-0.5 text-[11px] font-extrabold"
                      style={{ background: "var(--ok)", color: "#0a120d" }}>
                  +{resuelto.levantaHinchada} hinchada
                </span>
              )}
            </div>
            <button onClick={onSeguir} disabled={animando}
              className="w-full rounded-lg py-3.5 text-[14px] font-extrabold uppercase tracking-[0.14em]"
              style={{
                background: animando ? "var(--carbon)" : "var(--blanco)",
                color: animando ? "var(--apagado)" : "var(--negro)",
                transition: "background 260ms",
              }}>
              Seguir
            </button>
          </>
        )}
      </div>
    </div>
  );
}
