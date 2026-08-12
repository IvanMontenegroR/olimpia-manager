"use client";

import { useEffect, useRef, useState } from "react";
import { chanceDe, riesgoDe, type Momento, type ResueltoMomento } from "@/engine/momentos.ts";
import type { Alineacion, ContextoPartido } from "@/engine/tipos.ts";
import Sorteo from "./Sorteo.tsx";

const COLOR: Record<string, string> = {
  penal_favor: "var(--ok)",
  penal_contra: "var(--critico)",
  tiro_libre: "var(--medio)",
  jugador_caliente: "var(--bajo)",
  mano_a_mano: "var(--ok)",
};

/**
 * Cómo se llama cada tramo de la barra. Sin esto la bolilla frenaría sobre un
 * color y no sobre algo que se pueda leer.
 */
const TRAMOS: Partial<Record<string, [string, string]>> = {
  penal_favor:      ["GOL", "AFUERA"],
  penal_ultima:     ["GOL", "AFUERA"],
  tiro_libre:       ["GOL", "NO ENTRA"],
  mano_a_mano:      ["GOL", "NO ENTRA"],
  penal_contra:     ["LA ATAJA", "GOL RIVAL"],
  jugador_caliente: ["AGUANTA", "ROJA"],
};

/**
 * Decisión con el reloj corriendo. Si no elegís a tiempo se toma la opción
 * conservadora: no decidir también es decidir.
 *
 * Todo pasa acá adentro: elegís, la bolilla cae sobre la barra de esa misma
 * opción y debajo aparece qué pasó. Antes al elegir se reemplazaba la pantalla
 * por otra y perdías de vista lo que habías apostado.
 */
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
  const [listo, setListo] = useState(false);
  const yaElegido = useRef(false);
  const [elegida, setElegida] = useState<string | null>(null);
  const color = COLOR[momento.tipo] ?? "var(--blanco)";
  const tramos = TRAMOS[momento.tipo];

  useEffect(() => {
    if (resuelto) return;
    const t = setInterval(() => {
      setRestante((r) => {
        if (r <= 1) {
          clearInterval(t);
          if (!yaElegido.current) {
            yaElegido.current = true;
            setElegida(momento.porDefecto);
            onElegir(momento.porDefecto);
          }
          return 0;
        }
        return r - 1;
      });
    }, 100);
    return () => clearInterval(t);
  }, [momento, resuelto, onElegir]);

  const idElegida = elegida ?? momento.porDefecto;
  const chanceElegida = chanceDe(momento, idElegida, alineacion, ctx);
  /** Cuando la opción no era una apuesta (sacarlo del campo) no hay tirada. */
  const haySorteo = resuelto !== null && chanceElegida !== null && !!tramos;

  useEffect(() => {
    if (resuelto && !haySorteo) setListo(true);
  }, [resuelto, haySorteo]);

  const elegir = (id: string) => {
    if (yaElegido.current) return;
    yaElegido.current = true;
    setElegida(id);
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

        {/* el reloj corriendo, solo mientras hay algo que decidir */}
        <div className="mb-3 h-1 w-full overflow-hidden rounded-full"
             style={{ background: "var(--linea)", opacity: resuelto ? 0 : 1,
                      transition: "opacity 200ms" }}>
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
            const esta = resuelto !== null && o.id === idElegida;
            /* Las descartadas se achican pero no se van: parte de la gracia es
               ver la barra que dejaste pasar. */
            const descartada = resuelto !== null && !esta;

            return (
              <button key={o.id} onClick={() => elegir(o.id)} disabled={resuelto !== null}
                className="w-full rounded-lg text-left"
                style={{
                  padding: descartada ? "6px 14px" : "12px 14px",
                  opacity: descartada ? 0.32 : 1,
                  background: `color-mix(in srgb, ${color} ${esta ? 20 : 12}%, var(--carbon))`,
                  outline: `1px solid color-mix(in srgb, ${color} ${esta ? 80 : 45}%, transparent)`,
                  transition: "padding 240ms ease-out, opacity 240ms ease-out",
                }}>
                <span className="flex items-center gap-2">
                  <span className="apellido min-w-0 flex-1 truncate leading-tight"
                        style={{ fontSize: descartada ? 12 : 15, transition: "font-size 240ms" }}>
                    {o.etiqueta}
                  </span>
                  {chance !== null && (
                    <span className="num shrink-0 rounded px-1.5 py-0.5 text-[12px] font-extrabold"
                          style={{ background: color, color: "#0a120d" }}>
                      {Math.round(chance * 100)}%
                    </span>
                  )}
                </span>

                {!descartada && (
                  <>
                    <span className="block text-[11px]" style={{ color: "var(--tenue)" }}>
                      {o.detalle}
                    </span>

                    {/* Antes de elegir: la apuesta. Después: la misma barra,
                        con la bolilla cayendo adentro. */}
                    {esta && haySorteo && tramos ? (
                      <Sorteo
                        chance={chanceElegida!}
                        riesgo={riesgo?.contra ?? null}
                        exito={resuelto!.exito}
                        bien={tramos[0]} mal={tramos[1]}
                        semilla={momento.minuto * 7 + o.id.length}
                        onTermina={() => setListo(true)} />
                    ) : chance !== null && (
                      <span className="mt-1.5 flex h-1.5 overflow-hidden rounded-full"
                            style={{ background: "var(--linea)" }}>
                        <span style={{ width: `${chance * 100}%`, background: color }} />
                        {riesgo && (
                          <span style={{ width: `${(1 - chance) * riesgo.contra * 100}%`,
                                         background: "#c0392b" }} />
                        )}
                      </span>
                    )}

                    {riesgo && !esta && (
                      <span className="mt-1 flex items-center gap-1 text-[10px] font-bold"
                            style={{ color: "#e07a6f" }}>
                        <span className="num rounded px-1"
                              style={{ background: "#c0392b", color: "#0a120d" }}>
                          {Math.round(riesgo.contra * 100)}%
                        </span>
                        {riesgo.texto}
                      </span>
                    )}
                  </>
                )}
              </button>
            );
          })}
        </div>

        {/* Lo que pasó, recién cuando la bolilla frenó. */}
        {resuelto && (
          <div style={{ opacity: listo ? 1 : 0, transition: "opacity 280ms ease-out" }}>
            <p className="apellido mt-3 text-[15px] leading-snug"
               style={{ color: resuelto.exito ? "var(--ok)" : "var(--critico)" }}>
              {resuelto.texto}
            </p>
            {!!resuelto.levantaHinchada && (
              <span className="num mt-1.5 inline-block rounded px-1.5 py-0.5 text-[11px] font-extrabold"
                    style={{ background: "var(--ok)", color: "#0a120d" }}>
                +{resuelto.levantaHinchada} hinchada
              </span>
            )}
            <button onClick={onSeguir} disabled={!listo}
              className="mt-3 w-full rounded-lg py-3.5 text-[14px] font-extrabold uppercase tracking-[0.14em]"
              style={{ background: "var(--blanco)", color: "var(--negro)" }}>
              Seguir
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
