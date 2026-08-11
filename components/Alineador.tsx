"use client";

import { useMemo, useState } from "react";
import {
  type Alineado, colorCondicion, CUPO_EXTRANJEROS, esSub18, MOLDE_DE, MOLDES,
  nivelEf, repartirEnMolde,
} from "@/lib/juego.ts";
import { type Punta, useArrastre } from "@/lib/arrastre.ts";
import { LINEA_DE, type ContextoPartido, type Jugador, type Linea, type Posicion } from "@/engine/tipos.ts";
import CanchaArmado, { type Casillero } from "./CanchaArmado.tsx";
import Dorsal from "./Dorsal.tsx";

/**
 * Cancha + banco + formación. Lo comparten la pantalla de armar el partido y
 * el editor de equipos guardados, que hacen exactamente lo mismo con el once y
 * se diferencian solo en lo que va arriba y abajo.
 */

const FILTROS = ["TODOS", "ARQ", "DEF", "MED", "DEL", "RES"] as const;
type Filtro = (typeof FILTROS)[number];
const ORDEN: Record<Linea, number> = { ARQ: 0, DEF: 1, MED: 2, DEL: 3 };
const orden = (p: Posicion) => ORDEN[LINEA_DE[p]];

export interface EstadoAlineacion {
  formacion: string;
  alineado: Alineado;
}

export function useAlineacion(inicial: EstadoAlineacion) {
  const [estado, setEstado] = useState(inicial);
  return { estado, setEstado };
}

export default function Alineador({
  aptos, ctx, estado, onCambio, extra,
}: {
  aptos: Jugador[];
  ctx: ContextoPartido;
  estado: EstadoAlineacion;
  onCambio: (e: EstadoAlineacion) => void;
  /** Botón propio de cada pantalla, al lado de los filtros del banco. */
  extra?: React.ReactNode;
}) {
  const porId = useMemo(() => new Map(aptos.map((j) => [j.id, j])), [aptos]);
  const [filtro, setFiltro] = useState<Filtro>("TODOS");
  const [marcado, setMarcado] = useState<Punta | null>(null);
  const [verFormaciones, setVerFormaciones] = useState(false);

  const { formacion, alineado } = estado;
  const slots = MOLDE_DE(formacion);
  const casilleros: Casillero[] = slots.map((puesto, slot) => ({
    slot, puesto, jugador: alineado[slot] ? porId.get(alineado[slot]!) ?? null : null,
  }));
  const once = casilleros.map((c) => c.jugador).filter(Boolean) as Jugador[];

  const banco = useMemo(() => {
    const dentro = new Set(alineado.filter(Boolean) as string[]);
    // La reserva no aparece salvo que la pidas: el banco de un partido son
    // siete, no todo el club, y tener treinta nombres acá era lo que hacía
    // que la pantalla no se entendiera.
    const fuera = aptos.filter((j) => !dentro.has(j.id) && (filtro === "RES" ? j.reserva : !j.reserva));
    const base = filtro === "TODOS" || filtro === "RES"
      ? fuera
      : fuera.filter((j) => LINEA_DE[j.posicion] === filtro);
    // Sin filtro conviene ver primero a los mejores: si ordenara por puesto,
    // los tres arqueros suplentes se comerían el arranque del banco.
    return [...base].sort((a, b) =>
      filtro === "TODOS" || filtro === "RES"
        ? nivelEf(b, b.posicion, ctx) - nivelEf(a, a.posicion, ctx)
        : orden(a.posicion) - orden(b.posicion) ||
          nivelEf(b, b.posicion, ctx) - nivelEf(a, a.posicion, ctx));
  }, [filtro, alineado, ctx, aptos]);

  const enReserva = aptos.filter((j) => j.reserva).length;

  /** Une dos puntas: dos casilleros se cambian entre sí, uno del banco entra. */
  const unir = (a: Punta, b: Punta) => {
    const n = [...alineado];
    if (a.tipo === "cancha" && b.tipo === "cancha") {
      [n[a.slot], n[b.slot]] = [n[b.slot], n[a.slot]];
    } else if (a.tipo === "cancha" && b.tipo === "banco") {
      n[a.slot] = b.id;
    } else if (a.tipo === "banco" && b.tipo === "cancha") {
      n[b.slot] = a.id;
    }
    onCambio({ formacion, alineado: n });
    setMarcado(null);
  };

  const { handlers, arrastrando, destino, punto } = useArrastre(unir);

  /** Por toques: el primero marca, el segundo resuelve. */
  const tocar = (p: Punta) => {
    if (!marcado) { setMarcado(p); return; }
    const esElMismo = marcado.tipo === "cancha" && p.tipo === "cancha"
      ? marcado.slot === p.slot
      : marcado.tipo === "banco" && p.tipo === "banco" && marcado.id === p.id;
    if (esElMismo) {
      if (p.tipo === "cancha") {
        const n = [...alineado]; n[p.slot] = null;
        onCambio({ formacion, alineado: n });
      }
      setMarcado(null);
      return;
    }
    if (marcado.tipo === "banco" && p.tipo === "banco") { setMarcado(p); return; }
    unir(marcado, p);
  };

  const cambiarFormacion = (nombre: string) => {
    // se conservan los jugadores y se los reparte lo mejor posible en el molde
    onCambio({ formacion: nombre, alineado: repartirEnMolde(once, MOLDE_DE(nombre), ctx) });
    setVerFormaciones(false);
  };

  const fantasma = arrastrando
    ? (arrastrando.tipo === "banco"
        ? porId.get(arrastrando.id)
        : alineado[arrastrando.slot] ? porId.get(alineado[arrastrando.slot]!) : null)
    : null;

  const adaptados = once.filter((j) => {
    const p = casilleros.find((c) => c.jugador?.id === j.id)!.puesto;
    return p !== j.posicion && j.posiciones_secundarias.includes(p);
  });
  const fueraDePuesto = once.filter((j) => {
    const p = casilleros.find((c) => c.jugador?.id === j.id)!.puesto;
    return p !== j.posicion && !j.posiciones_secundarias.includes(p);
  });
  const puestoDe = (j: Jugador) => casilleros.find((c) => c.jugador?.id === j.id)!.puesto;

  return (
    <div className="flex min-h-0 flex-1 flex-col" {...handlers}>
      <div className="flex min-h-0 flex-1 flex-col py-2">
        <CanchaArmado casilleros={casilleros} formacion={formacion} ctx={ctx}
          seleccionado={
            marcado?.tipo === "cancha" && alineado[marcado.slot]
              ? alineado[marcado.slot]
              : arrastrando?.tipo === "cancha" ? alineado[arrastrando.slot] : null}
          destino={destino?.tipo === "cancha" ? destino.slot : null}
          onTocar={(slot) => tocar({ tipo: "cancha", slot })} />
      </div>

      {(adaptados.length > 0 || fueraDePuesto.length > 0) && (
        <div className="scroll-x flex gap-2 px-4 pb-1 text-[10px]" style={{ color: "var(--tenue)" }}>
          {adaptados.map((j) => (
            <span key={j.id} className="shrink-0">
              {j.apellido} de {puestoDe(j)} <span style={{ color: "var(--medio)" }}>×0.90</span>
            </span>
          ))}
          {fueraDePuesto.map((j) => (
            <span key={j.id} className="shrink-0">
              {j.apellido} de {puestoDe(j)} <span style={{ color: "var(--critico)" }}>×0.75</span>
            </span>
          ))}
        </div>
      )}

      <div className="border-t pt-1.5" style={{ borderColor: "var(--linea)" }}>
        <div className="flex items-center gap-1 px-3 pb-1.5">
          <button onClick={() => setVerFormaciones(true)}
            className="num mr-1 shrink-0 rounded px-2 py-1 text-[11px]"
            style={{ background: "var(--carbon)", color: "var(--blanco)" }}>
            {formacion} ▾
          </button>
          {extra}
          {FILTROS.map((p) => {
            if (p === "RES" && !enReserva) return null;
            const activo = filtro === p;
            return (
              <button key={p} onClick={() => setFiltro(p)}
                className="flex-1 rounded py-1 text-[10px] font-bold uppercase tracking-wider"
                style={{
                  background: activo ? "var(--blanco)" : "var(--carbon)",
                  color: activo ? "var(--negro)"
                    : p === "RES" ? "var(--apagado)" : "var(--tenue)",
                }}>
                {p === "TODOS" ? "Todos" : p}
              </button>
            );
          })}
        </div>

        {filtro === "RES" && (
          <div className="px-3 pb-1 text-[9px]" style={{ color: "var(--apagado)" }}>
            Reserva: entrenan aparte y no cuentan para el banco salvo que los pongas.
          </div>
        )}

        <div className="scroll-x flex gap-1.5 px-3 pb-2">
          {banco.map((j) => {
            const elegido = marcado?.tipo === "banco" && marcado.id === j.id;
            const esDestino = destino?.tipo === "banco" && destino.id === j.id;
            return (
              <button key={j.id} data-banco={j.id}
                onClick={() => tocar({ tipo: "banco", id: j.id })}
                className="flex shrink-0 flex-col items-center rounded-lg px-2 py-1.5"
                style={{
                  width: 66,
                  touchAction: "pan-x", // deslizar de costado sigue scrolleando el banco
                  background: elegido ? "var(--medio)" : "var(--carbon)",
                  color: elegido ? "var(--negro)" : "var(--blanco)",
                  boxShadow: esDestino ? "0 0 0 2px var(--ok)" : undefined,
                  opacity: arrastrando?.tipo === "banco" && arrastrando.id === j.id ? 0.35 : 1,
                }}>
                <Dorsal numero={j.numero} tam={26} />
                <span className="apellido mt-1 max-w-full truncate text-[9px] leading-tight">
                  {j.apellido}
                </span>
                <span className="mt-0.5 flex items-center gap-1 text-[9px] leading-none">
                  <span style={{ color: elegido ? "var(--negro)" : "var(--apagado)" }}>
                    {j.posicion}
                  </span>
                  <span className="num" style={{ color: j.aRevelar ? "var(--medio)" : undefined }}>
                    {j.aRevelar ? "?" : nivelEf(j, j.posicion, ctx)}
                  </span>
                  <span className="inline-block h-1 w-1 rounded-full"
                        style={{ background: colorCondicion(j.condicion) }} />
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {fantasma && punto && (
        <div className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2"
             style={{ left: punto.x, top: punto.y }}>
          <span className="block" style={{ filter: "drop-shadow(0 6px 12px rgba(0,0,0,0.7))" }}>
            <Dorsal numero={fantasma.numero} tam={40} />
          </span>
        </div>
      )}

      {verFormaciones && (
        <Hoja titulo="Formación" onCerrar={() => setVerFormaciones(false)}>
          <div className="grid grid-cols-2 gap-2">
            {MOLDES.map((m) => (
              <button key={m.nombre} onClick={() => cambiarFormacion(m.nombre)}
                className="rounded-lg px-3 py-3 text-left"
                style={{
                  background: m.nombre === formacion ? "var(--blanco)" : "var(--carbon)",
                  color: m.nombre === formacion ? "var(--negro)" : "var(--blanco)",
                }}>
                <div className="num text-[18px] leading-none">{m.nombre}</div>
                <div className="mt-1 text-[9px] uppercase tracking-wider"
                     style={{ color: m.nombre === formacion ? "var(--negro)" : "var(--tenue)" }}>
                  {DESCRIPCION[m.nombre]}
                </div>
              </button>
            ))}
          </div>
          <p className="mt-3 text-[10px] leading-relaxed" style={{ color: "var(--tenue)" }}>
            Al cambiar de formación los once siguen siendo los mismos: se reparten en
            los puestos nuevos buscando el mejor encaje. El que queda fuera de puesto
            aparece marcado debajo de la cancha con lo que pierde.
          </p>
        </Hoja>
      )}
    </div>
  );
}

export const DESCRIPCION: Record<string, string> = {
  "4-3-3": "Ancho y ofensivo",
  "4-4-2": "Dos puntas, clásico",
  "4-2-3-1": "Doble cinco y enganche",
  "4-3-1-2": "Enganche entre líneas",
  "4-5-1": "Poblar el medio",
  "3-5-2": "Carrileros largos",
  "5-3-2": "Aguantar y salir",
  "3-4-3": "Todo al ataque",
};

export function Hoja({ titulo, onCerrar, children }: {
  titulo: string; onCerrar: () => void; children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end"
         style={{ background: "rgba(0,0,0,0.6)" }} onClick={onCerrar}>
      <div className="entra-abajo rounded-t-2xl px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3"
           style={{ background: "var(--negro)", borderTop: "1px solid var(--linea)",
                        maxHeight: "82vh", overflowY: "auto",
                        boxShadow: "0 -12px 40px rgba(0,0,0,0.75)" }}
           onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.18em]"
              style={{ color: "var(--tenue)" }}>{titulo}</h2>
          <button onClick={onCerrar} className="rounded px-2 py-0.5 text-[11px]"
                  style={{ background: "var(--carbon)" }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Cuántos jugadores del equipo guardado siguen disponibles. */
export const CUPO = CUPO_EXTRANJEROS;
export const esJuvenil = esSub18;
