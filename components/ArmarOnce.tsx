"use client";

import { useMemo, useState } from "react";
import {
  autoOnce, bancoSugerido, cupoDe, esSub18, mejorMolde, MOLDE_DE,
  nivelEf, nombreCorto, type PartidoUI, repartirEnMolde,
} from "@/lib/juego.ts";
import type { Actitud, Jugador, Posicion } from "@/engine/tipos.ts";
import { comoLoDejaste, type EquipoGuardado } from "@/lib/temporada.ts";
import { useAtras } from "@/lib/atras.ts";
import Escudo from "./Escudo.tsx";
import Alineador, { Hoja, type EstadoAlineacion } from "./Alineador.tsx";
import { ACTITUD } from "./PartidoEnVivo.tsx";

export interface Salida {
  once: Jugador[];
  suplentes: Jugador[];
  actitud: Actitud;
  puestos: Map<string, Posicion>;
}

export default function ArmarOnce({
  partido, plantel, equipos, estadoSub18, modo = "jugar",
  onJugar, onVolver, onGuardarEquipo,
}: {
  partido: PartidoUI;
  plantel: Jugador[];
  equipos: EquipoGuardado[];
  estadoSub18: { minutos: number; partidosRestantes: number };
  /**
   * "jugar" es el día del partido. "guardar" es cuando entrás desde la cancha
   * de la pantalla principal a mover el equipo: el partido puede estar a una
   * semana, así que ahí abajo va guardar el once y no salir a jugarlo.
   */
  modo?: "jugar" | "guardar";
  onJugar: (s: Salida) => void;
  onVolver: () => void;
  onGuardarEquipo: (e: EquipoGuardado) => void;
}) {
  const { ctx } = partido;
  const aptos = useMemo(
    () => plantel.filter((j) => !j.suspendido && !j.lesionado_hasta), [plantel]);
  const porId = useMemo(() => new Map(aptos.map((j) => [j.id, j])), [aptos]);

  // El once vive como once casilleros, no como un conjunto: así se puede elegir
  // formación, arrastrar de un puesto a otro y guardar equipos armados.
  /*
   * Arranca con TU once guardado, no con uno inventado.
   *
   * La pantalla armaba siempre un equipo automático, así que el que veías en
   * la cancha de la pantalla principal toda la semana no era el que aparecía
   * acá el domingo: podías haber dejado a Romero de titular y encontrártelo en
   * el banco. Solo se completa a mano lo que dejaron vacío los lesionados y
   * los suspendidos, y si no hay equipo guardado se propone uno.
   */
  const inicial = useMemo<EstadoAlineacion>(() => {
    const eq = equipos[0];
    if (eq) {
      // tal cual lo guardaste: cada uno en su casillero, sin reordenar
      const alineado = comoLoDejaste(eq, (id) => porId.has(id));
      const huecos = alineado.map((x, i) => (x ? -1 : i)).filter((i) => i >= 0);
      if (!huecos.length) return { formacion: eq.formacion, alineado };
      // los que faltan son bajas: se rellena SOLO ese casillero
      const dentro = new Set(alineado.filter(Boolean) as string[]);
      const libres = aptos.filter((j) => !j.reserva && !dentro.has(j.id));
      const slots = MOLDE_DE(eq.formacion);
      const relleno = repartirEnMolde(libres, huecos.map((i) => slots[i]), ctx);
      huecos.forEach((slot, k) => { alineado[slot] = relleno[k] ?? null; });
      return { formacion: eq.formacion, alineado };
    }
    const once = autoOnce(ctx, aptos.filter((j) => !j.reserva), estadoSub18)
      .map((id) => porId.get(id)!).filter(Boolean);
    return mejorMolde(once, ctx);
  }, [ctx, aptos, porId, estadoSub18, equipos]);

  const [estado, setEstado] = useState<EstadoAlineacion>(inicial);
  const [actitud, setActitud] = useState<Actitud>(ctx.esLocal ? "ofensivo" : "equilibrado");
  const [verEquipos, setVerEquipos] = useState(false);
  useAtras(verEquipos, () => setVerEquipos(false));
  const [nombreNuevo, setNombreNuevo] = useState("");

  const slots = MOLDE_DE(estado.formacion);
  const once = estado.alineado
    .map((id) => (id ? porId.get(id) : null))
    .filter(Boolean) as Jugador[];
  const puestos = new Map<string, Posicion>();
  estado.alineado.forEach((id, s) => { if (id) puestos.set(id, slots[s]); });

  const extranjeros = once.filter((j) => j.extranjero).length;
  // en la Sudamericana no hay cupo: eso es del torneo local
  const cupo = cupoDe(ctx.competencia);
  const sub18 = once.filter(esSub18).length;
  const arqueros = once.filter((j) => j.posicion === "ARQ").length;
  const nivelOnce = once.length === 11
    ? Math.round(once.reduce((s, j) => s + nivelEf(j, puestos.get(j.id)!, ctx), 0) / 11)
    : 0;

  const problema =
    once.length !== 11
      ? `Faltan ${11 - once.length} · tocá un hueco de la cancha` :
    arqueros !== 1 ? "Necesitás un arquero" :
    extranjeros > cupo ? `${extranjeros} extranjeros, el cupo es ${cupo}` :
    null;

  const aplicarEquipo = (e: EquipoGuardado) => {
    const vivos = e.jugadores.map((id) => porId.get(id)).filter(Boolean) as Jugador[];
    setEstado({
      formacion: e.formacion,
      alineado: repartirEnMolde(vivos, MOLDE_DE(e.formacion), ctx),
    });
    setVerEquipos(false);
  };

  const jugar = () => {
    if (problema) return;
    /*
     * Al banco van, con preferencia, los de tus otros equipos guardados. Antes
     * se llenaba por nivel a secas y entraban solo siete, así que a cuatro del
     * Alternativo que habías armado no los podías poner nunca.
     */
    const dentro = new Set(once.map((j) => j.id));
    const otros = equipos.filter((e) => !e.jugadores.every((id) => dentro.has(id)))
      .flatMap((e) => e.jugadores);
    onJugar({ once, suplentes: bancoSugerido(aptos, once, ctx, otros), actitud, puestos });
  };

  /*
   * Fuera del día del partido, el botón de abajo guarda: pisa el equipo
   * Titular, que es el que dibuja la cancha de la pantalla principal, y vuelve.
   */
  const guardarTitular = () => {
    if (problema) return;
    onGuardarEquipo({
      nombre: equipos[0]?.nombre ?? "Titular",
      formacion: estado.formacion,
      jugadores: once.map((j) => j.id),
    });
    onVolver();
  };

  return (
    <div className="app">
      {/* ---------- cabecera ---------- */}
      <header className="px-4 pb-2 pt-2.5">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.18em]"
             style={{ color: "var(--tenue)" }}>
          <button onClick={onVolver} className="rounded px-1.5 py-0.5 text-[11px]"
                  style={{ background: "var(--carbon)" }}>←</button>
          <span>{partido.etiqueta}</span>
          <span>{ctx.esLocal ? "Local" : "Visitante"}</span>
        </div>
        <div className="mt-1 flex items-center gap-2.5">
          <Escudo id={partido.rivalId} nombre={partido.rivalNombre} tam={28} />
          <span className="text-[12px] font-semibold" style={{ color: "var(--apagado)" }}>vs</span>
          <h1 className="apellido truncate text-[22px] leading-none">
            {nombreCorto(partido.rivalId, partido.rivalNombre)}
          </h1>
          {ctx.esClasico && (
            <span className="ml-auto shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest"
                  style={{ background: "var(--blanco)", color: "var(--negro)" }}>
              Clásico
            </span>
          )}
        </div>
      </header>

      {/* Cómo llega el rival ya está en el botón de la pantalla principal,
          que es donde se decide entrar acá. Repetirlo comía una fila entera de
          la cancha, que es lo único que esta pantalla necesita mostrar. */}

      {/* ---------- estado del once ----------
          Las dos reglas (cupo y Sub-18) solo se muestran cuando hay algo que
          mirar. El resto del tiempo son ruido: nunca vas a tocar nada por
          tener 2 de 4 extranjeros. */}
      <div className="flex items-stretch border-y" style={{ borderColor: "var(--linea)" }}>
        <Dato etiqueta="Once" valor={`${once.length}/11`} alerta={once.length !== 11} />
        <Dato etiqueta="Formación" valor={estado.formacion} />
        {/* En copa no hay cupo, así que no hay nada que mirar. */}
        {Number.isFinite(cupo) && extranjeros >= cupo && (
          <Dato etiqueta="Extranj." valor={`${extranjeros}/${cupo}`}
                alerta={extranjeros > cupo} />
        )}
        {sub18 === 0 && <Dato etiqueta="Sub-18" valor="0" alerta />}
        <Dato etiqueta="Nivel" valor={nivelOnce ? String(nivelOnce) : "—"} fuerte />
      </div>

      <Alineador aptos={aptos} ctx={ctx} estado={estado} onCambio={setEstado}
        extra={
          <button onClick={() => setVerEquipos(true)}
            className="shrink-0 rounded px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em]"
            style={{ background: "var(--carbon)", color: "var(--tenue)" }}>
            Equipos
          </button>
        } />

      {/* ---------- decisiones ---------- */}
      <div className="border-t px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2"
           style={{ borderColor: "var(--linea)" }}>
        {/* Cómo salir a jugar se decide el día del partido: guardado con el
            equipo no se persiste, así que fuera de ese día sería un botón que
            no hace nada. */}
        <div className="mb-1.5 flex gap-1.5" style={{ display: modo === "jugar" ? undefined : "none" }}>
          {(["defensivo", "equilibrado", "ofensivo"] as Actitud[]).map((a) => {
            const A = ACTITUD[a];
            return (
              <button key={a} onClick={() => setActitud(a)}
                className="flex-1 rounded py-2 text-[10px] font-bold uppercase tracking-wider"
                style={{
                  background: actitud === a
                    ? A.color
                    : `color-mix(in srgb, ${A.color} 14%, var(--carbon))`,
                  color: actitud === a ? A.sobre : A.color,
                }}>
                {A.nombre}
              </button>
            );
          })}
        </div>

        <button onClick={modo === "jugar" ? jugar : guardarTitular} disabled={!!problema}
          className="w-full rounded-lg py-3 text-[14px] font-extrabold uppercase tracking-[0.14em]"
          style={{
            background: problema ? "var(--carbon)" : "var(--blanco)",
            color: problema ? "var(--apagado)" : "var(--negro)",
          }}>
          {problema ?? (modo === "jugar" ? "Jugar el partido" : "Guardar el once")}
        </button>
      </div>

      {verEquipos && (
        <Hoja titulo="Equipos guardados" onCerrar={() => setVerEquipos(false)}>
          {equipos.length === 0 && (
            <p className="text-[11px] leading-relaxed" style={{ color: "var(--tenue)" }}>
              Todavía no guardaste ninguno. Armá un once y guardalo acá abajo, o
              armalos con calma desde Plantel · Equipos.
            </p>
          )}
          <div className="flex flex-col gap-1.5">
            {equipos.map((e) => {
              const vivos = e.jugadores.filter((id) => porId.has(id)).length;
              return (
                <button key={e.nombre} onClick={() => aplicarEquipo(e)}
                  className="flex items-center justify-between rounded-lg px-3 py-2.5 text-left"
                  style={{ background: "var(--carbon)" }}>
                  <span className="min-w-0">
                    <span className="apellido block truncate text-[13px] leading-tight">{e.nombre}</span>
                    <span className="text-[9px] uppercase tracking-wider"
                          style={{ color: vivos < e.jugadores.length ? "var(--medio)" : "var(--tenue)" }}>
                      {e.formacion} · {vivos === e.jugadores.length
                        ? `${vivos} jugadores`
                        : `faltan ${e.jugadores.length - vivos}, hay bajas`}
                    </span>
                  </span>
                  <span className="shrink-0 text-[10px] font-bold uppercase tracking-widest"
                        style={{ color: "var(--medio)" }}>Poner</span>
                </button>
              );
            })}
          </div>
          {once.length === 11 && (
            <div className="mt-3 flex gap-1.5">
              <input value={nombreNuevo} onChange={(e) => setNombreNuevo(e.target.value)}
                placeholder={equipos.length ? "Nombre del equipo" : "Titular"}
                className="min-w-0 flex-1 rounded-lg px-3 py-2.5 text-[12px] outline-none"
                style={{ background: "var(--carbon)", color: "var(--blanco)" }} />
              <button
                onClick={() => {
                  const nombre = nombreNuevo.trim() || (equipos.length ? `Equipo ${equipos.length + 1}` : "Titular");
                  onGuardarEquipo({
                    nombre, formacion: estado.formacion, jugadores: once.map((j) => j.id),
                  });
                  setNombreNuevo("");
                  setVerEquipos(false);
                }}
                className="shrink-0 rounded-lg px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em]"
                style={{ background: "var(--blanco)", color: "var(--negro)" }}>
                Guardar
              </button>
            </div>
          )}
        </Hoja>
      )}
    </div>
  );
}

/**
 * Lo que hay que saber antes de elegir: si el rival llega gastado conviene
 * apretarlo, y si el viaje o la altura pesan hay que ver con qué se llega.
 */
function Dato({ etiqueta, valor, alerta, fuerte }: {
  etiqueta: string; valor: string; alerta?: boolean; fuerte?: boolean;
}) {
  return (
    <div className="flex-1 border-r px-2 py-1 last:border-r-0" style={{ borderColor: "var(--linea)" }}>
      <div className="text-[8px] uppercase tracking-[0.12em]" style={{ color: "var(--apagado)" }}>
        {etiqueta}
      </div>
      <div className={fuerte ? "num text-[16px] leading-tight" : "text-[12px] font-bold leading-tight"}
           style={{ color: alerta ? "var(--medio)" : "var(--blanco)" }}>
        {valor}
      </div>
    </div>
  );
}

