"use client";

import { useEffect, useRef, useState } from "react";
import type { Momento, ResueltoMomento } from "@/engine/momentos.ts";

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
export default function MomentoOverlay({
  momento, resuelto, onElegir, onSeguir,
}: {
  momento: Momento;
  resuelto: ResueltoMomento | null;
  onElegir: (opcionId: string) => void;
  onSeguir: () => void;
}) {
  const [restante, setRestante] = useState(momento.segundos * 10);
  const yaElegido = useRef(false);
  const color = COLOR[momento.tipo] ?? "var(--blanco)";

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
    onElegir(id);
  };

  const proporcion = restante / (momento.segundos * 10);

  return (
    <div className="absolute inset-0 z-20 flex flex-col justify-end"
         style={{ background: "rgba(0,0,0,0.93)", backdropFilter: "blur(3px)" }}>
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
              {momento.opciones.map((o) => (
                <button key={o.id} onClick={() => elegir(o.id)}
                  className="w-full rounded-lg px-3.5 py-3 text-left"
                  style={{ background: "var(--carbon)", boxShadow: `inset 3px 0 0 ${color}` }}>
                  <span className="apellido block text-[15px] leading-tight">{o.etiqueta}</span>
                  <span className="block text-[11px]" style={{ color: "var(--tenue)" }}>
                    {o.detalle}
                  </span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="mb-3 rounded-lg px-3.5 py-3"
                 style={{ background: "var(--carbon)",
                          boxShadow: `inset 3px 0 0 ${resuelto.exito ? "var(--ok)" : "var(--critico)"}` }}>
              <span className="apellido block text-[15px] leading-snug"
                    style={{ color: resuelto.exito ? "var(--ok)" : "var(--critico)" }}>
                {resuelto.texto}
              </span>
            </div>
            <button onClick={onSeguir}
              className="w-full rounded-lg py-3.5 text-[14px] font-extrabold uppercase tracking-[0.14em]"
              style={{ background: "var(--blanco)", color: "var(--negro)" }}>
              Seguir
            </button>
          </>
        )}
      </div>
    </div>
  );
}
