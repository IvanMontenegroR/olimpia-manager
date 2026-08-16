"use client";

import { useMemo, useState } from "react";
import Alineador, { type EstadoAlineacion } from "./Alineador.tsx";
import { MOLDE_DE, mejorMolde, repartirEnMolde } from "@/lib/juego.ts";
import { type EquipoGuardado, type Partida, plantelDe } from "@/lib/temporada.ts";
import type { ContextoPartido } from "@/engine/tipos.ts";

/**
 * Lo primero que ves: los dos equipos con los que vas a manejar la temporada.
 *
 * Antes la partida arrancaba con dos onces armados por el juego y vos te
 * enterabas después, en la cancha de la pantalla principal. Rotar es el centro
 * de esto (el jueves hay copa y el domingo torneo), así que los dos equipos
 * son la primera decisión y no un detalle que se descubre a mitad de camino.
 *
 * El botón de autocompletar existe para el que no quiere armarlos: te deja el
 * mejor once posible y, en el alternativo, el mejor once posible SIN usar a
 * ninguno de los que pusiste de titulares.
 */

const TITULAR = "Titular";
const ALTERNATIVO = "Alternativo";

export default function Arranque({ partida, onListo }: {
  partida: Partida;
  onListo: (equipos: EquipoGuardado[]) => void;
}) {
  const plantel = useMemo(() => plantelDe(partida), [partida]);
  const porId = useMemo(() => new Map(plantel.map((j) => [j.id, j])), [plantel]);

  /* Contexto neutro: acá se ordena y se valora, no se juega. */
  const ctx = useMemo<ContextoPartido>(() => ({
    semilla: partida.semilla, fecha: partida.dia, competencia: "clausura",
    esLocal: true, rivalFuerza: 62, rivalNombre: "—", viajeKm: 0, alturaM: 43,
    diasDescanso: 6, esClasico: false,
  }), [partida.dia, partida.semilla]);

  /*
   * Se arranca con la cancha vacía a propósito, aunque la partida traiga dos
   * equipos armados de fábrica. Si ya estuvieran puestos, el botón de
   * autocompletar no haría nada y esta pantalla sería un cartel: la idea es
   * que el primer once sea tuyo, y el botón está ahí para el que no quiere.
   */
  const vacia = (): EstadoAlineacion =>
    ({ formacion: "4-3-3", alineado: new Array(11).fill(null) });

  const [cual, setCual] = useState<typeof TITULAR | typeof ALTERNATIVO>(TITULAR);
  const [titular, setTitular] = useState<EstadoAlineacion>(vacia);
  const [alterno, setAlterno] = useState<EstadoAlineacion>(vacia);

  const enTitular = cual === TITULAR;
  const estado = enTitular ? titular : alterno;
  const setEstado = enTitular ? setTitular : setAlterno;
  const puestos = estado.alineado.filter(Boolean).length;

  /*
   * Autocompletar respeta lo que ya pusiste: solo llena los casilleros vacíos.
   * Si tocás el botón con la cancha entera armada no te la desarma.
   */
  const autocompletar = () => {
    const ocupados = new Set(estado.alineado.filter(Boolean) as string[]);
    // en el alternativo no se puede repetir a un titular: ese es el punto
    const vetados = enTitular
      ? new Set<string>()
      : new Set(titular.alineado.filter(Boolean) as string[]);
    const libres = plantel.filter((j) =>
      !j.reserva && !j.lesionado_hasta && !j.suspendido &&
      !ocupados.has(j.id) && !vetados.has(j.id));

    const huecos = estado.alineado.map((x, i) => (x ? -1 : i)).filter((i) => i >= 0);
    if (!huecos.length) return;
    /*
     * Con la cancha vacía se elige también la formación, que es lo que hace
     * `mejorMolde`. Con casilleros ya puestos no: cambiar el dibujo movería de
     * lugar a los que el DT ya acomodó.
     */
    if (huecos.length === estado.alineado.length) {
      const once = [...libres].sort((a, b) => b.nivel - a.nivel).slice(0, 11);
      setEstado(mejorMolde(once, ctx));
      return;
    }
    const slots = MOLDE_DE(estado.formacion);
    const relleno = repartirEnMolde(libres, huecos.map((i) => slots[i]), ctx);
    const alineado = [...estado.alineado];
    huecos.forEach((slot, k) => { alineado[slot] = relleno[k] ?? null; });
    setEstado({ ...estado, alineado });
  };

  const armar = (e: EstadoAlineacion, nombre: string): EquipoGuardado | null => {
    const jugadores = e.alineado.filter(Boolean) as string[];
    return jugadores.length === MOLDE_DE(e.formacion).length
      ? { nombre, formacion: e.formacion, jugadores } : null;
  };

  const eqTitular = armar(titular, TITULAR);
  const eqAlterno = armar(alterno, ALTERNATIVO);
  /* El alternativo es opcional: se puede empezar solo con el titular. */
  const puedeEmpezar = !!eqTitular;

  const nivelDe = (e: EstadoAlineacion) => {
    const ids = e.alineado.filter(Boolean) as string[];
    if (!ids.length) return null;
    return Math.round(ids.reduce((s, id) => s + (porId.get(id)?.nivel ?? 0), 0) / ids.length);
  };

  /* Los que no entraron en ninguno de los dos, para que se vea el fondo. */
  const sinUsar = plantel.filter((j) => !j.reserva &&
    !titular.alineado.includes(j.id) && !alterno.alineado.includes(j.id)).length;

  return (
    <div className="app">
      <header className="px-4 pb-2 pt-3">
        <span className="text-[10px] uppercase tracking-[0.24em]" style={{ color: "var(--tenue)" }}>
          Clausura 2026 · Olimpia
        </span>
        <h1 className="apellido mt-0.5 text-[22px] leading-tight">Armá tus dos equipos</h1>
        <p className="mt-1 text-[11px] leading-snug" style={{ color: "var(--tenue)" }}>
          El titular es el que sale a la cancha. El alternativo es el que ponés
          cuando el jueves hay copa y el domingo torneo.
        </p>

        <div className="mt-2.5 flex gap-1">
          {([TITULAR, ALTERNATIVO] as const).map((n) => {
            const activo = cual === n;
            const e = n === TITULAR ? titular : alterno;
            const nv = nivelDe(e);
            const listo = (e.alineado.filter(Boolean).length) === MOLDE_DE(e.formacion).length;
            return (
              <button key={n} onClick={() => setCual(n)}
                className="flex-1 rounded-md py-1.5 text-[10px] font-bold uppercase tracking-wider"
                style={{
                  background: activo ? "var(--blanco)" : "var(--carbon)",
                  color: activo ? "var(--negro)" : "var(--tenue)",
                }}>
                {n}
                <span className="num ml-1.5 font-normal opacity-70">
                  {listo && nv !== null ? `nivel ${nv}` : `${e.alineado.filter(Boolean).length}/11`}
                </span>
              </button>
            );
          })}
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col px-4">
        <Alineador aptos={plantel} ctx={ctx} estado={estado} onCambio={setEstado} />
      </div>

      <div className="px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
        <div className="mb-1.5 flex items-center justify-between text-[10px]"
             style={{ color: "var(--apagado)" }}>
          <span>{sinUsar} jugadores fuera de los dos equipos</span>
          <span className="num" style={{ color: puestos === 11 ? "var(--cesped)" : "var(--medio)" }}>
            {puestos}/11
          </span>
        </div>
        <div className="flex gap-1.5">
          <button onClick={autocompletar} disabled={puestos === 11}
            className="flex-1 rounded-lg py-3 text-[11px] font-bold uppercase tracking-wider"
            style={{
              background: puestos === 11 ? "var(--carbon)" : "var(--linea)",
              color: puestos === 11 ? "var(--apagado)" : "var(--blanco)",
            }}>
            Autocompletar
          </button>
          <button
            disabled={!puedeEmpezar}
            onClick={() => onListo([eqTitular!, ...(eqAlterno ? [eqAlterno] : [])])}
            className="flex-[1.4] rounded-lg py-3 text-[12px] font-extrabold uppercase tracking-[0.14em]"
            style={{
              background: puedeEmpezar ? "var(--cesped)" : "var(--carbon)",
              color: puedeEmpezar ? "#0a120d" : "var(--apagado)",
            }}>
            {puedeEmpezar ? "Empezar la temporada" : `Faltan ${11 - puestos}`}
          </button>
        </div>
      </div>
    </div>
  );
}
