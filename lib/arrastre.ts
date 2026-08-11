"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Arrastrar fichas entre la cancha y el banco, con dedo o con mouse.
 *
 * Va por delegación en el contenedor: cualquier elemento con data-slot (un
 * casillero de la cancha) o data-banco (una ficha del banco) es agarrable y
 * también sirve de destino. Se usa pointer events, que unifican dedo y mouse,
 * en vez de la API de drag nativa, que en móvil directamente no dispara.
 *
 * Mientras no se supere el umbral no pasa nada, así un toque sigue siendo un
 * toque: el arrastre no le roba el click a la selección por toques.
 */

export type Punta =
  | { tipo: "cancha"; slot: number }
  | { tipo: "banco"; id: string };

const UMBRAL = 8; // px antes de considerar que es un arrastre y no un toque

const puntaDe = (el: Element | null): Punta | null => {
  const cancha = el?.closest?.("[data-slot]");
  if (cancha) return { tipo: "cancha", slot: Number(cancha.getAttribute("data-slot")) };
  const banco = el?.closest?.("[data-banco]");
  if (banco) return { tipo: "banco", id: banco.getAttribute("data-banco")! };
  return null;
};

const mismaPunta = (a: Punta | null, b: Punta | null) =>
  !!a && !!b && a.tipo === b.tipo &&
  (a.tipo === "cancha" ? a.slot === (b as any).slot : a.id === (b as any).id);

export function useArrastre(onSoltar: (origen: Punta, destino: Punta) => void) {
  const [origen, setOrigen] = useState<Punta | null>(null);
  const [destino, setDestino] = useState<Punta | null>(null);
  const [punto, setPunto] = useState<{ x: number; y: number } | null>(null);
  const inicio = useRef<{ x: number; y: number; punta: Punta } | null>(null);
  const activo = useRef(false);

  const limpiar = () => {
    inicio.current = null;
    activo.current = false;
    setOrigen(null);
    setDestino(null);
    setPunto(null);
  };

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const punta = puntaDe(e.target as Element);
    if (!punta) return;
    inicio.current = { x: e.clientX, y: e.clientY, punta };
    activo.current = false;
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const ini = inicio.current;
    if (!ini) return;
    if (!activo.current) {
      if (Math.hypot(e.clientX - ini.x, e.clientY - ini.y) < UMBRAL) return;
      activo.current = true;
      setOrigen(ini.punta);
      // capturar recién acá: antes rompería el scroll lateral del banco
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    }
    setPunto({ x: e.clientX, y: e.clientY });
    // el fantasma va con pointer-events none, así que esto ve lo que hay debajo
    const debajo = document.elementFromPoint(e.clientX, e.clientY);
    const d = puntaDe(debajo);
    setDestino(d && !mismaPunta(d, ini.punta) ? d : null);
  }, []);

  const onPointerUp = useCallback(() => {
    const ini = inicio.current;
    if (activo.current && ini && destino && !mismaPunta(destino, ini.punta)) {
      onSoltar(ini.punta, destino);
    }
    limpiar();
  }, [destino, onSoltar]);

  return {
    /** Poner en el contenedor que envuelve a la cancha y al banco. */
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: limpiar,
    },
    arrastrando: activo.current ? origen : null,
    destino: activo.current ? destino : null,
    punto,
  };
}
