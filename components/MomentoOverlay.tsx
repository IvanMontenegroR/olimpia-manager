"use client";

import { useEffect, useRef, useState } from "react";
import {
  chanceDe, riesgoDe, zonaDelArquero, type Momento, type ResueltoMomento,
} from "@/engine/momentos.ts";
import type { Alineacion, ContextoPartido } from "@/engine/tipos.ts";
import Sorteo from "./Sorteo.tsx";

const COLOR: Record<string, string> = {
  penal_favor: "var(--ok)",
  penal_contra: "var(--critico)",
  tiro_libre: "var(--medio)",
  jugador_caliente: "var(--bajo)",
  mano_a_mano: "var(--ok)",
  festejo: "var(--medio)",
  arquero_al_area: "var(--ok)",
};

/**
 * Cómo se llama cada tramo de la barra: lo que salió bien, lo que salió mal, y
 * lo que puede salir peor todavía. Sin esto la bolilla frenaría sobre un color
 * y no sobre algo que se pueda leer.
 *
 * El tercer rótulo es el de la franja oscura. Antes no existía: la barra
 * avisaba "si la rechazan, contra con todos arriba", la bolilla frenaba justo
 * ahí y el relato decía que no había pasado nada.
 */
const TRAMOS: Partial<Record<string, [string, string, string?]>> = {
  penal_favor:      ["GOL", "AFUERA"],
  penal_ultima:     ["GOL", "AFUERA"],
  tiro_libre:       ["GOL", "NO ENTRA", "CONTRA"],
  mano_a_mano:      ["GOL", "NO ENTRA", "CONTRA"],
  penal_contra:     ["LA ATAJA", "GOL RIVAL"],
  jugador_caliente: ["AGUANTA", "ROJA"],
  festejo:          ["ZAFA", "AMARILLA"],
  arquero_al_area:  ["GOL", "NADA", "ARCO VACÍO"],
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
    const t = setInterval(() => setRestante((r) => Math.max(0, r - 1)), 100);
    return () => clearInterval(t);
  }, [resuelto]);

  /*
   * Que se acabe el tiempo avisa al partido desde acá y no desde adentro del
   * setRestante. Meter el aviso en el updater lo hacía correr durante el
   * render, y React se quejaba de que un componente cambia el estado de otro
   * mientras se dibuja: eso podía disparar la opción por defecto dos veces.
   */
  useEffect(() => {
    if (resuelto || restante > 0 || yaElegido.current) return;
    yaElegido.current = true;
    setElegida(momento.porDefecto);
    onElegir(momento.porDefecto);
  }, [restante, resuelto, momento, onElegir]);

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
            /* En el penal en contra la barra no es una probabilidad: es el
               arco, y lo verde es lo que el arquero alcanza a tapar. */
            const z = momento.tipo === "penal_contra"
              ? zonaDelArquero(alineacion, ctx, o.id) : null;
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
                        riesgoSobre={riesgo?.sobre}
                        exito={resuelto!.exito}
                        enRiesgo={!!resuelto!.porElRiesgo}
                        bien={tramos[0]} mal={tramos[1]} peor={tramos[2]}
                        zona={z && resuelto!.dondeFue !== undefined
                          ? { desde: z.desde, hasta: z.hasta, donde: resuelto!.dondeFue }
                          : undefined}
                        semilla={momento.minuto * 7 + o.id.length}
                        onTermina={() => setListo(true)} />
                    ) : z ? (
                      // el arco entero, con lo que tapás marcado en verde
                      <span className="mt-1.5 block">
                        <span className="relative flex h-2 overflow-hidden rounded-full"
                              style={{ background: "#c0392b" }}>
                          <span className="absolute inset-y-0"
                                style={{ left: `${z.desde * 100}%`,
                                         width: `${(z.hasta - z.desde) * 100}%`, background: color }} />
                          {[33.3, 66.6].map((x) => (
                            <span key={x} className="absolute inset-y-0"
                                  style={{ left: `${x}%`, width: 1, background: "#ffffff22" }} />
                          ))}
                        </span>
                        <span className="mt-0.5 block text-[9px]" style={{ color: "var(--apagado)" }}>
                          el arco de palo a palo · lo verde es lo que llega a tapar
                        </span>
                      </span>
                    ) : chance !== null && (
                      // la franja oscura se recorta del tramo del que sale, que
                      // no siempre es el del fallo
                      <span className="mt-1.5 flex h-1.5 overflow-hidden rounded-full"
                            style={{ background: "var(--linea)" }}>
                        <span style={{
                          width: `${chance * 100 * (riesgo?.sobre === "exito" ? 1 - riesgo.contra : 1)}%`,
                          background: color }} />
                        {riesgo && (
                          <span style={{
                            width: `${(riesgo.sobre === "exito"
                              ? chance * riesgo.contra
                              : (1 - chance) * riesgo.contra) * 100}%`,
                            background: "#7a1f16" }} />
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
            {/* Lo que deja en la gente, dicho y no numerado. "+10 hinchada"
                no le decía nada a nadie: la hinchada es una escala interna que
                no se muestra en ninguna pantalla, y lo que de verdad se lleva
                el jugador de este momento es que la cancha se vino abajo. */}
            {/* Lo que deja en el plantel, que es lo que de verdad se lleva. */}
            {!!resuelto.enciendeAlEquipo && resuelto.enciendeAlEquipo >= 4 && (
              <span className="mr-1 mt-1.5 inline-block rounded px-2 py-0.5 text-[11px] font-bold"
                    style={{ background: "color-mix(in srgb, var(--ok) 22%, transparent)",
                             color: "var(--ok)" }}>
                El equipo se prendió
              </span>
            )}
            {!!resuelto.levantaHinchada && (
              <span className="mt-1.5 inline-block rounded px-2 py-0.5 text-[11px] font-bold"
                    style={{ background: "color-mix(in srgb, var(--ok) 22%, transparent)",
                             color: "var(--ok)" }}>
                {resuelto.levantaHinchada >= 15 ? "El Defensores no se lo va a olvidar más"
                  : resuelto.levantaHinchada >= 9 ? "La cancha se vino abajo"
                  : "La gente lo festejó"}
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
