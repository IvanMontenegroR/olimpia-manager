"use client";

import { BANDERA } from "@/lib/juego.ts";
import { diasEntre, miles, type Partida } from "@/lib/temporada.ts";
import { CHANCE_POR_CATEGORIA, ESTRELLAS, impactoDe, type CategoriaEstrella } from "@/engine/estrellas.ts";

/**
 * La oportunidad de traer un crack. Tiene pantalla propia porque es la
 * decisión más grande del juego: es toda la plata del club de una sola vez.
 *
 * Todo lo que hay acá está para que la decisión se pueda tomar sin adivinar:
 * el nivel a la vista, lo que cuesta contra lo que tenés, y qué te queda si
 * decís que sí.
 */

const ESTILO: Record<CategoriaEstrella, { acento: string; fondo: string; rotulo: string }> = {
  regreso: {
    acento: "#3fa76a",
    fondo: "radial-gradient(120% 80% at 50% 0%, #1c3a2a, #0a120d 72%)",
    rotulo: "Vuelve al país",
  },
  crack: {
    acento: "#5fb0e8",
    fondo: "radial-gradient(120% 80% at 50% 0%, #14304a, #0a120d 72%)",
    rotulo: "Oportunidad de mercado",
  },
  clasico: {
    acento: "#c0392b",
    fondo: "radial-gradient(120% 80% at 50% 0%, #3a1a20, #0a120d 72%)",
    rotulo: "Se lo sacás a Cerro",
  },
  leyenda: {
    acento: "#e8c25a",
    fondo: "radial-gradient(120% 80% at 50% 0%, #4a3a12, #0a120d 68%)",
    rotulo: "No pasa dos veces",
  },
};

export default function PantallaEstrella({ partida, onFichar, onRechazar, onVolver }: {
  partida: Partida;
  onFichar: () => void;
  onRechazar: () => void;
  onVolver: () => void;
}) {
  const e = ESTRELLAS.find((x) => x.id === partida.estrella?.id);
  if (!e || !partida.estrella) return null;

  const est = ESTILO[e.categoria];
  const alcanza = partida.dineroUsd >= e.precioUsd;
  const falta = e.precioUsd - partida.dineroUsd;
  const dias = Math.max(0, diasEntre(partida.dia, partida.estrella.venceEl));
  const imp = impactoDe(e);

  return (
    <div className="app" style={{ background: est.fondo }}>
      <div className="scroll-y flex min-h-0 flex-1 flex-col px-4 pb-3 pt-4">

        {/* ---------- de qué se trata ---------- */}
        <div className="flex items-center justify-between gap-2">
          <button onClick={onVolver} className="shrink-0 rounded px-1.5 py-0.5 text-[11px]"
                  style={{ background: "var(--carbon)" }}>←</button>
          <span className="min-w-0 flex-1 truncate text-[10px] uppercase tracking-[0.24em]"
                style={{ color: est.acento }}>
            {est.rotulo}
          </span>
          <span className="num rounded px-2 py-0.5 text-[10px]"
                style={{ background: dias <= 2 ? "#c0392b" : "var(--carbon)",
                         color: dias <= 2 ? "#fff" : "var(--tenue)" }}>
            {dias === 0 ? "último día"
              : dias === 1 ? "queda 1 día"
              : `${dias} días para decidir`}
          </span>
        </div>

        <h1 className="apellido mt-2 text-[30px] leading-none">{e.titular}</h1>

        {/* ---------- quién es ---------- */}
        <div className="relieve mt-4 flex items-center gap-3 rounded-xl p-3"
             style={{ background: "var(--carbon)" }}>
          <div className="shrink-0 text-center">
            <div className="num leading-none"
                 style={{ fontSize: 46, color: est.acento, textShadow: `0 0 26px ${est.acento}44` }}>
              {e.nivel}
            </div>
            <div className="text-[8px] uppercase tracking-widest" style={{ color: "var(--apagado)" }}>
              nivel
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="apellido truncate text-[19px] leading-tight">
              {e.nombre} {e.apellido}
            </div>
            <div className="text-[11px]" style={{ color: "var(--tenue)" }}>
              {e.edad} años · {e.posicion} · {BANDERA[e.nacionalidad] ?? ""} {e.nacionalidad}
            </div>
            <div className="text-[10px]" style={{ color: "var(--apagado)" }}>
              viene de {e.de}{e.extranjero ? " · ocupa cupo de extranjero" : ""}
            </div>
          </div>
        </div>

        <p className="mt-3 text-[13px] leading-relaxed" style={{ color: "var(--tenue)" }}>
          {e.historia}
        </p>

        <p className="mt-2 text-[11px] leading-snug" style={{ color: "var(--medio)" }}>
          {e.riesgo}
        </p>

        {/* ---------- la plata ---------- */}
        <div className="mt-4 rounded-xl p-3" style={{ background: "var(--carbon)" }}>
          <Linea etiqueta="Piden" valor={miles(e.precioUsd)} fuerte color={est.acento} />
          <Linea etiqueta="Tenés en caja" valor={miles(partida.dineroUsd)} />
          <div className="my-2 h-px" style={{ background: "var(--linea)" }} />
          {alcanza ? (
            <Linea etiqueta="Te queda" valor={miles(partida.dineroUsd - e.precioUsd)}
                   color="var(--cesped)" fuerte />
          ) : (
            <Linea etiqueta="Te falta" valor={miles(falta)} color="var(--ladrillo)" fuerte />
          )}
        </div>

        {/* ---------- qué cambia si lo traés ---------- */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Chip texto={`+${imp.hinchada} hinchada`} color={est.acento} />
          <Chip texto={`+${imp.ambiente} vestuario`} color={est.acento} />
          <Chip texto={`+${imp.prestigio} dirigencia`} color={est.acento} />
        </div>

        {!alcanza && (
          <p className="mt-3 text-[11px] leading-relaxed" style={{ color: "var(--apagado)" }}>
            Podés salir de acá, vender a alguien o jugar los partidos que vienen, y
            volver antes de que se cierre.{" "}
            {dias === 0 ? "Se define hoy." : dias === 1 ? "Te queda un día." : `Te quedan ${dias} días.`}
          </p>
        )}
      </div>

      {/* ---------- decidir ---------- */}
      <div className="border-t px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2.5"
           style={{ borderColor: "var(--linea)" }}>
        <button onClick={onFichar} disabled={!alcanza}
          className="w-full rounded-lg py-3.5 text-[14px] font-extrabold uppercase tracking-[0.14em]"
          style={{
            background: alcanza ? est.acento : "var(--carbon)",
            color: alcanza ? "#0a120d" : "var(--apagado)",
          }}>
          {alcanza ? `Traerlo por ${miles(e.precioUsd)}` : `Faltan ${miles(falta)}`}
        </button>
        <div className="mt-1.5 flex gap-1.5">
          <button onClick={onVolver}
            className="flex-1 rounded-lg py-2.5 text-[11px] font-bold uppercase tracking-[0.12em]"
            style={{ background: "var(--carbon)", color: "var(--blanco)" }}>
            {alcanza ? "Pensarlo" : "Ir a juntar la plata"}
          </button>
          <button onClick={onRechazar}
            className="flex-1 rounded-lg py-2.5 text-[11px] font-bold uppercase tracking-[0.12em]"
            style={{ background: "var(--carbon)", color: "var(--apagado)" }}>
            Dejarlo pasar
          </button>
        </div>
      </div>
    </div>
  );
}

function Linea({ etiqueta, valor, fuerte, color }: {
  etiqueta: string; valor: string; fuerte?: boolean; color?: string;
}) {
  return (
    <div className="flex items-baseline justify-between py-0.5">
      <span className="text-[11px]" style={{ color: "var(--tenue)" }}>{etiqueta}</span>
      <span className={fuerte ? "num text-[16px]" : "num text-[13px]"}
            style={{ color: color ?? "var(--blanco)" }}>
        {valor}
      </span>
    </div>
  );
}

function Chip({ texto, color }: { texto: string; color: string }) {
  return (
    <span className="num rounded px-1.5 py-0.5 text-[9px] font-extrabold"
          style={{ background: `color-mix(in srgb, ${color} 22%, transparent)`, color }}>
      {texto}
    </span>
  );
}

