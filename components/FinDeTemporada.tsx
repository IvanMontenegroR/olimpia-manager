"use client";

import Escudo from "./Escudo.tsx";
import { balanceDelAno, type Partida } from "@/lib/temporada.ts";
import type { Cupo } from "@/lib/anual.ts";

/**
 * El resumen del año, que es la última pantalla del juego.
 *
 * Antes la temporada terminaba con un cartel de una línea ("Olimpia cerró 3°
 * con 43 puntos") y eso era todo: no se sabía qué se había ganado ni qué venía
 * después. Un año de fútbol no termina en la última fecha, termina cuando se
 * sabe a qué copa vas.
 *
 * Y ahí está la parte que de verdad importa: los cupos no se reparten por el
 * Clausura sino por la tabla ANUAL, así que salir tercero en el Clausura puede
 * ser Libertadores o puede ser nada, según cómo venías del Apertura. Esta
 * pantalla lo muestra entero para que la cuenta se pueda seguir.
 */

const COLOR_TORNEO = {
  libertadores: { acento: "#e8c25a", fondo: "linear-gradient(155deg, #2c2412, #14110a 62%)",
                  halo: "rgba(240,210,130,0.28)", nombre: "Copa Libertadores" },
  sudamericana: { acento: "#5fb0e8", fondo: "linear-gradient(155deg, #1b3f63, #10233a 62%)",
                  halo: "rgba(120,190,255,0.28)", nombre: "Copa Sudamericana" },
} as const;

/**
 * Qué le espera a cada uno según por dónde entra.
 *
 * La Libertadores tiene TRES fases previas, no dos: el que entra en fase 2
 * todavía tiene que ganar la 2 y la 3, y el que entra en fase 1 tiene que ganar
 * las tres. Acá decía una y dos, que es contar las fases que faltan y no las
 * llaves que hay que ganar, y es justo lo que el jugador necesita saber.
 */
const EXPLICA_FASE: Record<Cupo["fase"], string> = {
  grupos: "entra directo",
  "fase 2": "dos llaves antes de los grupos",
  "fase 1": "tres llaves antes de los grupos",
  "fase previa": "un partido, y el que gana entra",
};

export default function FinDeTemporada({ partida, onCerrar, onSiguiente }: {
  partida: Partida;
  onCerrar: () => void;
  /** Seguir dirigiendo: arranca el año que viene. */
  onSiguiente?: () => void;
}) {
  const b = balanceDelAno(partida);
  const ano = partida.ano;
  /* El Apertura 2026 lo dirigió otro; del 2027 en adelante lo jugaste vos. */
  const aperturaAjena = ano === 2026 && !partida.aperturaJugado;

  return (
    <div className="app scroll-y px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-5">

      <span className="text-[10px] uppercase tracking-[0.24em]" style={{ color: "var(--tenue)" }}>
        Temporada {ano} · Olimpia
      </span>
      <h1 className="apellido mt-1 text-[26px] leading-tight">Cómo terminó el año</h1>

      {/* ---------- 1. lo que se ganó ---------- */}
      <Titulo>Lo que se ganó</Titulo>
      {b.titulos.length ? (
        <div className="flex flex-col gap-1.5">
          {b.titulos.map((t) => (
            <div key={t} className="relieve flex items-center gap-2.5 rounded-lg px-3 py-2.5"
                 style={{ background: "linear-gradient(160deg, #2c2412, #14110a 70%)",
                          boxShadow: "inset 0 0 0 1px rgba(240,210,130,0.3)" }}>
              <span className="text-[18px]">★</span>
              <span className="apellido flex-1 text-[16px]" style={{ color: "#e8c25a" }}>{t}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-lg px-3 py-2.5 text-[12px] leading-snug"
           style={{ background: "var(--carbon)", color: "var(--tenue)" }}>
          Olimpia se quedó sin títulos este año.
        </p>
      )}

      {/* Dónde salió en cada cosa, que es el resumen del resumen. */}
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        <Caja etiqueta="Apertura" valor={`${b.puestoApertura}°`}
              pie={aperturaAjena ? "lo jugó el anterior"
                : `${b.apertura.find((f) => f.id === "olimpia")?.pts ?? 0} pts`}
              fuerte={b.campeonApertura === "olimpia"} />
        <Caja etiqueta="Clausura" valor={`${b.puestoClausura}°`}
              pie={`${b.clausura.find((f) => f.id === "olimpia")?.pts ?? 0} pts`}
              fuerte={b.puestoClausura === 1} />
        <Caja etiqueta="Sudamericana"
              valor={partida.copa.ronda === "campeon" ? "★"
                : partida.copa.ronda === "eliminado" ? "—" : "—"}
              pie={partida.copa.ronda === "campeon" ? "campeón" : "eliminado"}
              fuerte={partida.copa.ronda === "campeon"} />
      </div>

      {/* ---------- 2. la tabla que reparte ---------- */}
      <Titulo>La tabla del año</Titulo>
      <p className="mb-1.5 text-[10px] leading-snug" style={{ color: "var(--apagado)" }}>
        Apertura más Clausura. Es la que decide quién va a cada copa.
      </p>
      <div>
        {b.acumulada.map((f, i) => {
          const cupo = b.cupos.find((c) => c.id === f.id);
          const c = cupo ? COLOR_TORNEO[cupo.torneo] : null;
          const yo = f.id === "olimpia";
          const ap = b.apertura.find((x) => x.id === f.id)?.pts ?? 0;
          return (
            <div key={f.id} className="mb-1 flex items-center gap-2 rounded-md px-2 py-1.5"
                 style={{
                   background: yo ? "color-mix(in srgb, #ffffff 15%, var(--carbon))"
                     : c ? c.fondo : "var(--carbon)",
                   boxShadow: c ? `inset 0 0 0 1px ${c.halo}` : undefined,
                 }}>
              <span className="num w-4 shrink-0 text-[10px]"
                    style={{ color: c ? c.acento : "var(--apagado)" }}>{i + 1}</span>
              <Escudo id={f.id} nombre={f.nombre} tam={18} />
              <span className="apellido min-w-0 flex-1 truncate text-[11px]">{f.nombre}</span>
              <span className="num shrink-0 text-[9px]" style={{ color: "var(--apagado)" }}>
                {ap}+{f.pts - ap}
              </span>
              <span className="num w-7 shrink-0 text-right text-[13px] font-extrabold">{f.pts}</span>
            </div>
          );
        })}
      </div>

      {/* ---------- 3. a qué copa va cada uno ---------- */}
      {(["libertadores", "sudamericana"] as const).map((torneo) => {
        const t = COLOR_TORNEO[torneo];
        return (
          <div key={torneo}>
            <Titulo color={t.acento}>{t.nombre} {ano + 1}</Titulo>
            {b.cupos.filter((c) => c.torneo === torneo).map((c) => (
              <div key={c.id} className="mb-1 flex items-center gap-2.5 rounded-lg px-2.5 py-2"
                   style={{ background: t.fondo, boxShadow: `inset 0 0 0 1px ${t.halo}`,
                            outline: c.id === "olimpia" ? "1.5px solid var(--blanco)" : undefined }}>
                <Escudo id={c.id} nombre={c.nombre} tam={26} />
                <span className="min-w-0 flex-1">
                  <span className="apellido block truncate text-[13px]">{c.nombre}</span>
                  <span className="block text-[9px]" style={{ color: "var(--tenue)" }}>{c.por}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-[10px] font-extrabold uppercase tracking-wider"
                        style={{ color: t.acento }}>
                    {c.fase}
                  </span>
                  <span className="block text-[9px]" style={{ color: "var(--apagado)" }}>
                    {EXPLICA_FASE[c.fase]}
                  </span>
                </span>
              </div>
            ))}

            {/* El cruce de la fase previa: entrar cuarto todavía no es entrar. */}
            {torneo === "sudamericana" && (
              <>
                <p className="mb-1.5 mt-2 text-[10px] leading-snug" style={{ color: "var(--apagado)" }}>
                  Los cuatro se sortean entre ellos. Se juega un partido y solo los dos que ganan
                  entran a la fase de grupos.
                </p>
                {b.cruces.map((l, i) => (
                  <div key={i} className="mb-1 flex items-center gap-2 rounded-md px-2.5 py-2"
                       style={{ background: "var(--carbon)" }}>
                    <Escudo id={l.local} nombre={l.nombreLocal} tam={20} />
                    <span className="apellido min-w-0 flex-1 truncate text-[11px]">{l.nombreLocal}</span>
                    <span className="text-[9px]" style={{ color: "var(--apagado)" }}>vs</span>
                    <span className="apellido min-w-0 flex-1 truncate text-right text-[11px]">
                      {l.nombreVisita}
                    </span>
                    <Escudo id={l.visita} nombre={l.nombreVisita} tam={20} />
                  </div>
                ))}
              </>
            )}
          </div>
        );
      })}

      {/* ---------- lo que le tocó a Olimpia, dicho en una línea ---------- */}
      <div className="relieve-alto mt-4 rounded-xl px-3.5 py-3"
           style={{ background: b.miCupo
             ? COLOR_TORNEO[b.miCupo.torneo].fondo
             : "color-mix(in srgb, var(--ladrillo) 18%, var(--carbon))" }}>
        <span className="block text-[9px] uppercase tracking-[0.18em]"
              style={{ color: b.miCupo ? COLOR_TORNEO[b.miCupo.torneo].acento : "var(--ladrillo)" }}>
          Olimpia el año que viene
        </span>
        <span className="apellido mt-1 block text-[18px] leading-tight">
          {b.miCupo
            ? `${COLOR_TORNEO[b.miCupo.torneo].nombre}, ${b.miCupo.fase}`
            : "Sin copa internacional"}
        </span>
        <span className="mt-1 block text-[11px] leading-snug" style={{ color: "var(--tenue)" }}>
          {b.miCupo
            ? `${b.miCupo.por}. ${EXPLICA_FASE[b.miCupo.fase][0].toUpperCase()}${EXPLICA_FASE[b.miCupo.fase].slice(1)}.`
            : `${b.puestoAnual}° en la tabla del año. Los ocho cupos se los llevaron los de arriba.`}
          {b.miCruce && ` Cruza con ${b.miCruce.local === "olimpia" ? b.miCruce.nombreVisita : b.miCruce.nombreLocal}.`}
        </span>
      </div>

      {/* Seguir es lo normal: un técnico no se va porque terminó el año. */}
      {onSiguiente && (
        <button onClick={onSiguiente}
          className="mt-4 w-full shrink-0 rounded-lg py-3.5 text-[13px] font-extrabold uppercase tracking-[0.14em]"
          style={{ background: "var(--cesped)", color: "#0a120d" }}>
          Dirigir la temporada {ano + 1}
        </button>
      )}
      <button onClick={onCerrar}
        className="mt-1.5 w-full shrink-0 rounded-lg py-3 text-[12px] font-bold uppercase tracking-[0.14em]"
        style={{ background: "var(--carbon)", color: "var(--tenue)" }}>
        Quedarme mirando el resumen
      </button>
    </div>
  );
}

function Titulo({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <div className="mb-1.5 mt-4 text-[10px] uppercase tracking-[0.18em]"
         style={{ color: color ?? "var(--tenue)" }}>
      {children}
    </div>
  );
}

function Caja({ etiqueta, valor, pie, fuerte }: {
  etiqueta: string; valor: string; pie: string; fuerte?: boolean;
}) {
  return (
    <div className="rounded-lg px-2 py-1.5"
         style={{ background: fuerte
           ? "color-mix(in srgb, #e8c25a 20%, var(--carbon))" : "var(--carbon)" }}>
      <div className="text-[8px] uppercase tracking-[0.12em]" style={{ color: "var(--apagado)" }}>
        {etiqueta}
      </div>
      <div className="num text-[18px] leading-tight"
           style={{ color: fuerte ? "#e8c25a" : "var(--blanco)" }}>{valor}</div>
      <div className="text-[8px]" style={{ color: "var(--apagado)" }}>{pie}</div>
    </div>
  );
}
