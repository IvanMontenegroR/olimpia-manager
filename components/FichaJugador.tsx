"use client";

import { BANDERA, colorCondicion, esSub18, MOLDE_DE, MOLDES, nivelEf } from "@/lib/juego.ts";
import {
  COORD, TEXTO_ANIMO, animoDe,
  type ContextoPartido, type Jugador, type Posicion,
} from "@/engine/tipos.ts";
import { ANIMO_POR_OFRECERLO, type EstadoPlantel } from "@/lib/temporada.ts";
import Dorsal from "./Dorsal.tsx";

/** Los puestos que existen en alguna formación, para no listar los trece. */
const PUESTOS: Posicion[] = [...new Set(MOLDES.flatMap((m) => MOLDE_DE(m.nombre)))];

const NOMBRE_RASGO: Record<string, string> = {
  desequilibrante: "Desequilibrante",
  definidor: "Definidor",
  definicion_irregular: "Definición irregular",
  juego_aereo: "Gana arriba",
  va_fuerte: "Va fuerte",
  veterano_de_copas: "Veterano de copas",
  fragil: "Frágil",
  lider: "Líder",
  cabeceador: "Cabeceador",
};

const EXPLICA_RASGO: Record<string, string> = {
  desequilibrante: "Genera más situaciones de gol para el equipo",
  definidor: "Convierte una porción mayor de las que le quedan",
  definicion_irregular: "Crea mucho, pero un día define todo y otro no define nada",
  juego_aereo: "Le gana a cualquiera por arriba en la pelota parada",
  va_fuerte: "Entra siempre fuerte: se lleva más amarillas que el resto",
  veterano_de_copas: "No le pesa jugar de visitante en la copa",
  fragil: "Se lesiona más seguido que el resto",
  lider: "Sostiene el vestuario cuando vienen mal las cosas",
  cabeceador: "Fuerte en la pelota parada",
};

export default function FichaJugador({
  jugador, estado, ctx, enVenta, onOfrecer, onCerrar,
}: {
  jugador: Jugador;
  estado: EstadoPlantel | undefined;
  ctx: ContextoPartido;
  /** Si está en la lista de transferibles. Sin `onOfrecer` no se muestra nada. */
  enVenta?: boolean;
  onOfrecer?: () => void;
  onCerrar: () => void;
}) {
  const j = jugador;
  const propio = COORD[j.posicion];
  // Los puestos ordenados por lo que rinde en cada uno: es la pregunta real
  // del DT, "si lo muevo de lugar, cuánto pierdo".
  const rinde = PUESTOS
    .map((p) => ({ puesto: p, nivel: nivelEf(j, p, ctx) }))
    .sort((a, b) => b.nivel - a.nivel);
  const mejor = rinde[0].nivel;

  const lesionado = !!j.lesionado_hasta;
  const minutos = estado?.minutos ?? 0;
  const partidos = Math.round((minutos / 90) * 10) / 10;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end"
         style={{ background: "rgba(0,0,0,0.65)" }} onClick={onCerrar}>
      <div className="entra-abajo rounded-t-2xl px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3"
           style={{ background: "var(--negro)", borderTop: "1px solid var(--linea)",
                    maxHeight: "88vh", overflowY: "auto",
                    boxShadow: "0 -12px 40px rgba(0,0,0,0.75)" }}
           onClick={(e) => e.stopPropagation()}>

        {/* ---------- quién es ---------- */}
        <div className="flex items-center gap-3">
          <Dorsal numero={j.numero} tam={44} />
          <div className="min-w-0 flex-1">
            <div className="apellido truncate text-[20px] leading-none">{j.apellido}</div>
            <div className="truncate text-[11px]" style={{ color: "var(--tenue)" }}>
              {j.nombre} - {j.edad} años - {BANDERA[j.nacionalidad] ?? ""} {j.nacionalidad}
              {j.extranjero && " - ocupa cupo"}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-1">
              <span className="rounded px-1.5 py-0.5 text-[9px] font-bold"
                    style={{ background: "var(--carbon)", color: "var(--tenue)" }}>
                {j.posicion}
              </span>
              {esSub18(j) && (
                <span className="rounded px-1.5 py-0.5 text-[9px] font-extrabold"
                      style={{ background: "#3fa76a", color: "#0a120d" }}>SUB-18</span>
              )}
              {lesionado && (
                <span className="rounded px-1.5 py-0.5 text-[9px] font-extrabold"
                      style={{ background: "#c0392b", color: "#fff" }}>LESIONADO</span>
              )}
              {j.suspendido && (
                <span className="rounded px-1.5 py-0.5 text-[9px] font-extrabold"
                      style={{ background: "#c0392b", color: "#fff" }}>SUSPENDIDO</span>
              )}
            </div>
          </div>
          <div className="shrink-0 text-right">
            {/* Al pibe que nadie vio jugar se le muestra el rango, no el número:
                el nivel real recién se sabe cuando debuta. */}
            {j.aRevelar && j.rangoNivel ? (
              <>
                <div className="num text-[20px] leading-none" style={{ color: "var(--medio)" }}>
                  {j.rangoNivel[0]}–{j.rangoNivel[1]}
                </div>
                <div className="text-[8px] uppercase tracking-widest" style={{ color: "var(--medio)" }}>
                  sin debutar
                </div>
              </>
            ) : (
              <>
                <div className="num text-[30px] leading-none">{j.nivel}</div>
                <div className="text-[8px] uppercase tracking-widest" style={{ color: "var(--apagado)" }}>
                  nivel
                </div>
              </>
            )}
          </div>
        </div>

        {/* ---------- cómo está hoy ---------- */}
        <div className="mt-3 grid grid-cols-2 gap-1.5">
          <Caja etiqueta="Condición" valor={`${j.condicion}%`} color={colorCondicion(j.condicion)} />
          {/* El número, no solo "En racha": si no se puede medir, no se puede
              querer subir. */}
          <Caja etiqueta={`Ánimo - ${TEXTO_ANIMO[animoDe(j.animo)].toLowerCase()}`}
                valor={`${Math.round(j.animo)}`}
                color={j.animo >= 78 ? "var(--ok)"
                  : j.animo >= 60 ? "var(--blanco)"
                  : j.animo >= 40 ? "var(--medio)" : "var(--critico)"} />
        </div>

        {/* ---------- la temporada ---------- */}
        <div className="mt-3 text-[9px] uppercase tracking-[0.16em]" style={{ color: "var(--apagado)" }}>
          En la temporada
        </div>
        <div className="mt-1 grid grid-cols-4 gap-1.5">
          <Caja etiqueta="Minutos" valor={String(minutos)} />
          <Caja etiqueta="Partidos" valor={String(partidos)} />
          <Caja etiqueta="Goles" valor={String(estado?.golesTorneo ?? 0)} />
          <Caja etiqueta="Amarillas" valor={String(estado?.amarillas ?? 0)}
                color={(estado?.amarillas ?? 0) >= 4 ? "var(--medio)" : undefined} />
        </div>
        {(estado?.amarillas ?? 0) >= 4 && (
          <p className="mt-1 text-[10px]" style={{ color: "var(--medio)" }}>
            Con la quinta amarilla se pierde la próxima fecha.
          </p>
        )}
        {lesionado && (
          <p className="mt-1 text-[10px]" style={{ color: "var(--critico)" }}>
            Vuelve el {j.lesionado_hasta!.slice(8, 10)}/{j.lesionado_hasta!.slice(5, 7)}.
          </p>
        )}

        {/* ---------- dónde puede jugar ---------- */}
        <div className="mt-3 text-[9px] uppercase tracking-[0.16em]" style={{ color: "var(--apagado)" }}>
          Dónde rinde
        </div>
        <div className="mt-1 flex flex-col gap-1">
          {rinde.slice(0, 6).map(({ puesto, nivel }) => {
            const natural = puesto === j.posicion;
            const sabe = j.posiciones_secundarias.includes(puesto);
            const lejos = Math.hypot(COORD[puesto].x - propio.x, COORD[puesto].y - propio.y);
            return (
              <div key={puesto} className="flex items-center gap-2">
                <span className="w-9 shrink-0 text-[10px] font-bold"
                      style={{ color: natural ? "var(--blanco)" : sabe ? "var(--medio)" : "var(--tenue)" }}>
                  {puesto}
                </span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full"
                     style={{ background: "var(--linea)" }}>
                  <div className="h-full rounded-full"
                       style={{
                         width: `${(nivel / mejor) * 100}%`,
                         background: natural ? "var(--cesped)" : sabe ? "var(--oro)" : "var(--linea-alta, #4a5a50)",
                       }} />
                </div>
                <span className="num w-6 shrink-0 text-right text-[11px]">{nivel}</span>
                <span className="w-14 shrink-0 text-[8px]" style={{ color: "var(--apagado)" }}>
                  {natural ? "natural" : sabe ? "la sabe" : lejos > 45 ? "muy lejos" : "adaptado"}
                </span>
              </div>
            );
          })}
        </div>

        {/* ---------- qué tiene de particular ---------- */}
        {j.rasgos.length > 0 && (
          <>
            <div className="mt-3 text-[9px] uppercase tracking-[0.16em]"
                 style={{ color: "var(--apagado)" }}>
              Lo que lo distingue
            </div>
            <div className="mt-1 flex flex-col gap-1">
              {j.rasgos.map((r) => (
                <div key={r} className="rounded-md px-2.5 py-1.5" style={{ background: "var(--carbon)" }}>
                  <span className="block text-[11px] font-bold">{NOMBRE_RASGO[r] ?? r}</span>
                  <span className="block text-[10px]" style={{ color: "var(--tenue)" }}>
                    {EXPLICA_RASGO[r] ?? ""}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {/*
          * Ofrecerlo al mercado.
          *
          * Va acá y no en la fila del plantel porque tiene un costo y el costo
          * hay que poder leerlo antes de tocar: el tipo se entera de que no lo
          * querés y se le cae el ánimo, que en la cancha es nivel. En la lista
          * queda la etiqueta para verlo de un vistazo.
          */}
        {onOfrecer && (
          <button onClick={onOfrecer}
            className="mt-3 w-full rounded-lg px-3 py-2.5 text-left"
            style={{
              background: enVenta
                ? "color-mix(in srgb, var(--ladrillo) 20%, var(--carbon))" : "var(--carbon)",
            }}>
            <span className="block text-[11px] font-bold uppercase tracking-[0.12em]"
                  style={{ color: enVenta ? "var(--ladrillo)" : "var(--blanco)" }}>
              {enVenta ? "Sacarlo de la lista" : "Ponerlo en la lista de transferibles"}
            </span>
            <span className="mt-0.5 block text-[10px] leading-snug" style={{ color: "var(--tenue)" }}>
              {enVenta
                ? "Dejan de llamar por él. El ánimo que perdió no vuelve"
                : `Los clubes van a llamar por él. Se entera y pierde ${ANIMO_POR_OFRECERLO} de ánimo`}
            </span>
          </button>
        )}

        <button onClick={onCerrar}
          className="mt-1.5 w-full rounded-lg py-2.5 text-[11px] font-bold uppercase tracking-[0.14em]"
          style={{ background: "var(--carbon)", color: "var(--tenue)" }}>
          Cerrar
        </button>
      </div>
    </div>
  );
}

function Caja({ etiqueta, valor, color }: { etiqueta: string; valor: string; color?: string }) {
  return (
    <div className="rounded-md px-2 py-1.5" style={{ background: "var(--carbon)" }}>
      <div className="text-[8px] uppercase tracking-[0.12em]" style={{ color: "var(--apagado)" }}>
        {etiqueta}
      </div>
      <div className="num text-[14px] leading-tight" style={{ color: color ?? "var(--blanco)" }}>
        {valor}
      </div>
    </div>
  );
}
