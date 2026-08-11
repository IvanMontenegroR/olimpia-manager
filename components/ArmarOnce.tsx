"use client";

import { useMemo, useState } from "react";
import {
  CUPO_EXTRANJEROS, esSub18, mejorMolde, MOLDE_DE, nivelEf, nombreCorto,
  type PartidoUI, repartirEnMolde,
} from "@/lib/juego.ts";
import type { Actitud, Jugador, Posicion } from "@/engine/tipos.ts";
import type { EquipoGuardado } from "@/lib/temporada.ts";
import Escudo from "./Escudo.tsx";
import { comoLlega, estadoRival } from "@/lib/rivales.ts";
import Alineador, { Hoja, type EstadoAlineacion } from "./Alineador.tsx";
import { ACTITUD } from "./PartidoEnVivo.tsx";

export interface Salida {
  once: Jugador[];
  suplentes: Jugador[];
  actitud: Actitud;
  presionAlta: boolean;
  puestos: Map<string, Posicion>;
}

export default function ArmarOnce({
  partido, plantel, equipos, onJugar, onVolver, onGuardarEquipo,
}: {
  partido: PartidoUI;
  plantel: Jugador[];
  equipos: EquipoGuardado[];
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
  const inicial = useMemo<EstadoAlineacion>(() => {
    // el once sugerido sale del primer equipo; la reserva se sube a mano
    const once = autoOnce(ctx, aptos.filter((j) => !j.reserva))
      .map((id) => porId.get(id)!).filter(Boolean);
    return mejorMolde(once, ctx);
  }, [ctx, aptos, porId]);

  const [estado, setEstado] = useState<EstadoAlineacion>(inicial);
  const [actitud, setActitud] = useState<Actitud>(ctx.esLocal ? "ofensivo" : "equilibrado");
  const [presionAlta, setPresion] = useState(ctx.esLocal);
  const [verEquipos, setVerEquipos] = useState(false);
  const [nombreNuevo, setNombreNuevo] = useState("");

  const slots = MOLDE_DE(estado.formacion);
  const once = estado.alineado
    .map((id) => (id ? porId.get(id) : null))
    .filter(Boolean) as Jugador[];
  const puestos = new Map<string, Posicion>();
  estado.alineado.forEach((id, s) => { if (id) puestos.set(id, slots[s]); });

  const extranjeros = once.filter((j) => j.extranjero).length;
  const sub18 = once.filter(esSub18).length;
  const arqueros = once.filter((j) => j.posicion === "ARQ").length;
  const nivelOnce = once.length === 11
    ? Math.round(once.reduce((s, j) => s + nivelEf(j, puestos.get(j.id)!, ctx), 0) / 11)
    : 0;

  const problema =
    once.length !== 11
      ? `Faltan ${11 - once.length} · tocá un hueco de la cancha` :
    arqueros !== 1 ? "Necesitás un arquero" :
    extranjeros > CUPO_EXTRANJEROS ? `${extranjeros} extranjeros, el cupo es ${CUPO_EXTRANJEROS}` :
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
    const dentro = new Set(once.map((j) => j.id));
    // al banco van los del primer equipo, salvo que hayas subido a alguien
    const libres = aptos.filter((j) => !dentro.has(j.id) && !j.reserva);
    const porNivel = (a: Jugador, b: Jugador) =>
      nivelEf(b, b.posicion, ctx) - nivelEf(a, a.posicion, ctx);
    const arquero = libres.filter((j) => j.posicion === "ARQ").sort(porNivel)[0];
    const suplentes = [
      ...(arquero ? [arquero] : []),
      ...libres.filter((j) => j.posicion !== "ARQ").sort(porNivel).slice(0, 6),
    ];
    onJugar({ once, suplentes, actitud, presionAlta, puestos });
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

      {/* ---------- cómo llega cada uno ---------- */}
      <ComoLlegan partido={partido} />

      {/* ---------- estado del once ---------- */}
      <div className="flex items-stretch border-y" style={{ borderColor: "var(--linea)" }}>
        <Dato etiqueta="Once" valor={`${once.length}/11`} alerta={once.length !== 11} />
        <Dato etiqueta="Formación" valor={estado.formacion} />
        <Dato etiqueta="Extranj." valor={`${extranjeros}/${CUPO_EXTRANJEROS}`}
              alerta={extranjeros > CUPO_EXTRANJEROS} />
        <Dato etiqueta="Sub-18" valor={String(sub18)} alerta={sub18 === 0} />
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
        <div className="mb-1.5 flex gap-1.5">
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
          <button onClick={() => setPresion((p) => !p)}
            title="Apretar arriba rinde mucho más contra un rival que llega cansado, y desgasta igual contra uno entero"
            className="rounded px-2.5 py-2 text-[10px] font-bold uppercase tracking-wider"
            style={{
              background: presionAlta ? "var(--blanco)" : "var(--carbon)",
              color: presionAlta ? "var(--negro)" : "var(--tenue)",
            }}>
            Presión
          </button>
        </div>

        <button onClick={jugar} disabled={!!problema}
          className="w-full rounded-lg py-3 text-[14px] font-extrabold uppercase tracking-[0.14em]"
          style={{
            background: problema ? "var(--carbon)" : "var(--blanco)",
            color: problema ? "var(--apagado)" : "var(--negro)",
          }}>
          {problema ?? "Jugar el partido"}
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
function ComoLlegan({ partido }: { partido: PartidoUI }) {
  const { ctx } = partido;
  const rival = ctx.competencia === "clausura"
    ? estadoRival(partido.rivalId, ctx.fecha) : null;
  const lectura = rival ? comoLlega(rival) : null;
  const altura = ctx.alturaM >= 1500 && !ctx.esLocal;
  const viaje = ctx.viajeKm >= 800 && !ctx.esLocal;
  const acl = ctx.aclimatacion ?? 0;
  if (!lectura && !altura && !viaje) return null;

  return (
    <div className="scroll-x flex gap-1.5 px-3 pb-1.5 pt-0.5">
      {lectura && rival && (
        <Pastilla
          color={lectura.bueno ? "var(--ok)" : "var(--tenue)"}
          titulo={`${nombreCorto(partido.rivalId, partido.rivalNombre)}: ${lectura.texto.toLowerCase()}`}
          pie={
            rival.vieneDeCopa ? "jugó la copa el jueves · presionalo"
            : rival.diasDescanso !== null
              ? `${rival.diasDescanso} días de descanso${lectura.bueno ? " · presionalo" : ""}`
              : "sin partidos previos"} />
      )}
      {altura && (
        <Pastilla
          color={acl >= 1 ? "var(--ok)" : acl > 0 ? "var(--medio)" : "var(--critico)"}
          titulo={`${ctx.alturaM.toLocaleString("es")} m`}
          pie={acl >= 1 ? "adaptados" : acl > 0 ? "media adaptación" : "sin adaptar"} />
      )}
      {viaje && (
        <Pastilla
          color={acl > 0 ? "var(--ok)" : "var(--tenue)"}
          titulo={`${Math.round(ctx.viajeKm).toLocaleString("es")} km`}
          pie={acl > 0 ? "se viajó antes" : "se viajó la víspera"} />
      )}
    </div>
  );
}

function Pastilla({ color, titulo, pie }: { color: string; titulo: string; pie: string }) {
  return (
    <span className="shrink-0 rounded-md px-2 py-1" style={{ background: "var(--carbon)" }}>
      <span className="block text-[10px] font-bold leading-tight" style={{ color }}>{titulo}</span>
      <span className="block text-[9px] leading-tight" style={{ color: "var(--apagado)" }}>{pie}</span>
    </span>
  );
}

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

/** Once inicial sugerido: el mejor posible respetando cupo y Sub-18. */
function autoOnce(ctx: PartidoUI["ctx"], plantel: Jugador[]): string[] {
  // Se llena el 4-3-3 slot por slot con el mejor de cada uno, en vez de por
  // línea: así no termina un lateral derecho jugando de izquierdo teniendo un
  // izquierdo natural en el banco.
  const slots: Posicion[] =
    ["ARQ", "LD", "DFC", "DFC", "LI", "MCD", "MC", "MC", "ED", "DC", "EI"];
  const elegidos: Jugador[] = [];
  const usado = new Set<string>();
  let ext = 0;

  const meter = (j: Jugador) => {
    elegidos.push(j);
    usado.add(j.id);
    if (j.extranjero) ext++;
  };

  // El Sub-18 entra primero y consume el slot que mejor le calza, no uno
  // cualquiera: si no se descuenta un slot, el molde queda de doce y el último
  // puesto se pierde al recortar.
  const sub = plantel.filter(esSub18)
    .sort((a, b) => nivelEf(b, b.posicion, ctx) - nivelEf(a, a.posicion, ctx))[0];
  if (sub) {
    meter(sub);
    const suyo = slots.indexOf(sub.posicion);
    slots.splice(suyo >= 0 ? suyo : slots.length - 1, 1);
  }

  // Cada vuelta es un slot: contar por puesto natural saltea slots y deja el
  // once en diez, que es lo que trababa la pantalla.
  for (const puesto of slots) {
    const cand = plantel
      .filter((j) => !usado.has(j.id))
      .sort((a, b) => nivelEf(b, puesto, ctx) - nivelEf(a, puesto, ctx));
    const j = cand.find((c) => !c.extranjero || ext < CUPO_EXTRANJEROS);
    if (j) meter(j);
  }

  // Red de seguridad por si el cupo de extranjeros dejó algún hueco.
  for (const j of [...plantel].sort((a, b) => b.nivel - a.nivel)) {
    if (elegidos.length >= 11) break;
    if (usado.has(j.id)) continue;
    if (j.extranjero && ext >= CUPO_EXTRANJEROS) continue;
    meter(j);
  }
  return elegidos.slice(0, 11).map((j) => j.id);
}
