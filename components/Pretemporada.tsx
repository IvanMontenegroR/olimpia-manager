"use client";

import { useMemo, useState } from "react";
import Dorsal from "./Dorsal.tsx";
import Mercado from "./Mercado.tsx";
import Escudo from "./Escudo.tsx";
import { useAtras } from "@/lib/atras.ts";
import {
  EDAD_DE_RETIRO, miles, ofrecerJugador, plantelDe, porUnAnoMas,
  type Partida,
} from "@/lib/temporada.ts";

/**
 * Enero, antes de que empiece a rodar la pelota.
 *
 * Es la pantalla que hace que dirigir tres años sea distinto a dirigir uno tres
 * veces. Acá se ve de golpe lo que el año le hizo al plantel: quién se retiró,
 * a quién le pegó la edad y qué pibe pegó el salto. Y es la única ventana en la
 * que podés armar el equipo con la cabeza fría, sin una fecha encima.
 *
 * El que no quiere tocar nada toca Empezar y listo. El que quiere vender medio
 * plantel tiene todo el enero.
 */

export default function Pretemporada({ partida, onFichar, onCambio, onEmpezar }: {
  partida: Partida;
  onFichar: (id: string) => void;
  onCambio: (p: Partida) => void;
  onEmpezar: () => void;
}) {
  const [vista, setVista] = useState<"plantel" | "mercado">("plantel");
  useAtras(vista === "mercado", () => setVista("plantel"));

  const plantel = useMemo(() => plantelDe(partida), [partida]);
  const enVenta = new Set(partida.transferibles ?? []);
  const retirados = partida.retirados ?? [];

  /* Lo que le hizo el año a cada uno, para poder mirarlo de una. */
  const cambios = plantel
    .map((j) => ({ j, delta: porUnAnoMas(j.edad, j.posicion) }))
    .filter((x) => x.delta !== 0)
    .sort((a, b) => b.delta - a.delta || b.j.nivel - a.j.nivel);

  const media = plantel.length
    ? Math.round(plantel.filter((j) => !j.reserva)
        .sort((a, b) => b.nivel - a.nivel).slice(0, 11)
        .reduce((s, j) => s + j.nivel, 0) / 11)
    : 0;
  const edadMedia = plantel.length
    ? (plantel.reduce((s, j) => s + j.edad, 0) / plantel.length).toFixed(1) : "0";

  if (vista === "mercado") {
    return (
      <div className="app">
        <header className="flex items-center gap-2 px-4 pb-2 pt-3">
          <button onClick={() => setVista("plantel")} className="rounded px-1.5 py-0.5 text-[13px]"
                  style={{ color: "var(--tenue)" }}>←</button>
          <h1 className="apellido text-[18px]">Fichajes</h1>
          <span className="num ml-auto text-[13px]" style={{ color: "var(--cesped)" }}>
            {miles(partida.dineroUsd)}
          </span>
        </header>
        <div className="scroll-y min-h-0 flex-1 px-4 pb-4">
          <Mercado partida={partida} onFichar={onFichar} />
        </div>
      </div>
    );
  }

  return (
    <div className="app scroll-y px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-5">
      <span className="text-[10px] uppercase tracking-[0.24em]" style={{ color: "var(--tenue)" }}>
        Pretemporada {partida.ano}
      </span>
      <h1 className="apellido mt-1 text-[26px] leading-tight">Enero</h1>
      <p className="mt-1 text-[12px] leading-snug" style={{ color: "var(--tenue)" }}>
        El plantel volvió con un año más encima. Armalo ahora, que después
        empiezan las fechas.
      </p>

      <div className="mt-3 grid grid-cols-3 gap-1.5">
        <Caja etiqueta="Once" valor={String(media)} pie="nivel medio" />
        <Caja etiqueta="Edad" valor={edadMedia} pie="del plantel" />
        <Caja etiqueta="Caja" valor={miles(partida.dineroUsd)} pie="para gastar" />
      </div>

      {/* ---------- los que colgaron los botines ---------- */}
      {!!retirados.length && (
        <>
          <Titulo>Se retiraron</Titulo>
          {retirados.map((r) => (
            <div key={r.id} className="mb-1 flex items-center gap-2.5 rounded-lg px-3 py-2"
                 style={{ background: "color-mix(in srgb, var(--ladrillo) 16%, var(--carbon))" }}>
              <span className="apellido flex-1 text-[13px]">{r.apellido}</span>
              <span className="num text-[11px]" style={{ color: "var(--tenue)" }}>
                {r.edad} años
              </span>
            </div>
          ))}
          <p className="mt-1 text-[10px]" style={{ color: "var(--apagado)" }}>
            A los {EDAD_DE_RETIRO} se deja. Los arqueros aguantan hasta los 40.
          </p>
        </>
      )}

      {/* ---------- lo que el año le hizo al resto ---------- */}
      <Titulo>Un año más</Titulo>
      <p className="mb-1.5 text-[10px] leading-snug" style={{ color: "var(--apagado)" }}>
        Hasta los veintitrés se crece, de los treinta para arriba se baja. Al que
        no aparece acá no le movió nada.
      </p>
      {cambios.map(({ j, delta }) => (
        <button key={j.id} onClick={() => onCambio(ofrecerJugador(partida, j.id))}
          className="mb-1 flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left"
          style={{ background: enVenta.has(j.id)
            ? "color-mix(in srgb, var(--ladrillo) 18%, var(--carbon))" : "var(--carbon)" }}>
          <Dorsal numero={j.numero} tam={24} />
          <span className="min-w-0 flex-1">
            <span className="apellido block truncate text-[12px]">
              {j.apellido}
              {enVenta.has(j.id) && (
                <span className="ml-1.5 rounded px-1 text-[8px] font-extrabold uppercase"
                      style={{ background: "var(--ladrillo)", color: "#0a120d" }}>En venta</span>
              )}
            </span>
            <span className="text-[9px]" style={{ color: "var(--apagado)" }}>{j.edad} años</span>
          </span>
          <span className="num text-[14px]">{j.nivel}</span>
          <span className="num w-6 shrink-0 text-right text-[12px] font-extrabold"
                style={{ color: delta > 0 ? "var(--cesped)" : "var(--ladrillo)" }}>
            {delta > 0 ? "+" : "−"}{Math.abs(delta) % 1 ? Math.abs(delta).toFixed(1) : Math.abs(delta)}
          </span>
        </button>
      ))}
      <p className="mt-1 text-[10px]" style={{ color: "var(--apagado)" }}>
        Tocá a uno para ponerlo o sacarlo de la lista de transferibles.
      </p>

      {/* ---------- la copa que se ganó el año pasado ---------- */}
      <Titulo>La copa de este año</Titulo>
      <div className="flex items-center gap-2.5 rounded-lg px-3 py-2.5"
           style={{ background: "linear-gradient(155deg, #1b3f63, #10233a 62%)",
                    boxShadow: "inset 0 0 0 1px rgba(120,190,255,0.28)" }}>
        <Escudo id="olimpia" nombre="Olimpia" tam={26} />
        <span className="apellido flex-1 text-[13px]">Copa Sudamericana</span>
        <span className="text-[10px] font-extrabold uppercase tracking-wider"
              style={{ color: "#5fb0e8" }}>Octavos</span>
      </div>

      <div className="mt-4 flex gap-1.5">
        <button onClick={() => setVista("mercado")}
          className="flex-1 rounded-lg py-3.5 text-[12px] font-bold uppercase tracking-[0.12em]"
          style={{ background: "var(--carbon)", color: "var(--blanco)" }}>
          Fichajes
        </button>
        <button onClick={onEmpezar}
          className="flex-[1.4] rounded-lg py-3.5 text-[13px] font-extrabold uppercase tracking-[0.14em]"
          style={{ background: "var(--cesped)", color: "#0a120d" }}>
          Empezar el Apertura
        </button>
      </div>
    </div>
  );
}

function Titulo({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1.5 mt-4 text-[10px] uppercase tracking-[0.18em]"
         style={{ color: "var(--tenue)" }}>
      {children}
    </div>
  );
}

function Caja({ etiqueta, valor, pie }: { etiqueta: string; valor: string; pie: string }) {
  return (
    <div className="rounded-lg px-2 py-1.5" style={{ background: "var(--carbon)" }}>
      <div className="text-[8px] uppercase tracking-[0.12em]" style={{ color: "var(--apagado)" }}>
        {etiqueta}
      </div>
      <div className="num text-[17px] leading-tight">{valor}</div>
      <div className="text-[8px]" style={{ color: "var(--apagado)" }}>{pie}</div>
    </div>
  );
}
